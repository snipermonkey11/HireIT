const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Submit a review for an application
router.post('/', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const { applicationId, rating, reviewText, userRole, revieweeId, revieweeRole, revieweeName } = req.body;
        const userId = req.user.userId;
        
        if (!applicationId) {
            return res.status(400).json({ error: 'Application ID is required' });
        }
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating is required and must be between 1 and 5' });
        }
        
        const pool = await getPool();
        
        // Check if the user is either the service owner OR the client who applied
        const checkResult = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.UserId as ClientId,
                    s.SellerId as ServiceOwnerId,
                    t.Status as TransactionStatus,
                    c.FullName as ClientName,
                    so.FullName as ServiceOwnerName,
                    s.Title as ServiceTitle
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                JOIN Users c ON a.UserId = c.UserId
                JOIN Users so ON s.SellerId = so.UserId
                WHERE a.ApplicationId = @applicationId 
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);
            
        if (!checkResult.recordset[0]) {
            return res.status(403).json({ 
                error: 'Unauthorized to submit review',
                details: 'You must be involved in this transaction to submit a review'
            });
        }
        
        // Check if transaction has the right status
        const transaction = checkResult.recordset[0];
        const transactionStatus = transaction.TransactionStatus;
        
        // Accept different variations of "completed" status
        if (transactionStatus !== 'Completed' && 
            transactionStatus !== 'completed' && 
            transactionStatus !== 'Received' && 
            transactionStatus !== 'received') {
            return res.status(403).json({ 
                error: 'Unauthorized to submit review',
                details: `Transaction is not completed (current status: ${transactionStatus}). You can only review completed transactions.`
            });
        }
        
        // Check if a review already exists for this application/user
        const existingReview = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as ReviewCount 
                FROM Reviews
                WHERE ApplicationId = @applicationId
                AND 
                -- Check existing reviews based on what table schema we have
                (
                    -- Either this is an older schema without ReviewerId
                    (NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ReviewerId' AND Object_ID = Object_ID(N'Reviews')))
                    OR
                    -- Or we have a new schema and check by ReviewerId
                    (
                        EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ReviewerId' AND Object_ID = Object_ID(N'Reviews'))
                        AND ReviewerId = @userId
                    )
                )
            `);
            
        if (existingReview.recordset[0].ReviewCount > 0) {
            return res.status(400).json({
                error: 'Review already exists',
                details: 'You have already submitted a review for this application'
            });
        }
        
        // Get reviewee details from frontend or fallback to database
        const actualRevieweeId = revieweeId || (userRole === 'client' ? transaction.ServiceOwnerId : transaction.ClientId);
        const actualRevieweeName = revieweeName || (userRole === 'client' ? transaction.ServiceOwnerName : transaction.ClientName);
        const actualRevieweeRole = revieweeRole || (userRole === 'client' ? 'freelancer' : 'client');
        
        // Store additional metadata for the review
        const metadata = {
            reviewerId: userId,
            reviewerRole: userRole || 'client',
            reviewerName: userRole === 'client' ? transaction.ClientName : transaction.ServiceOwnerName,
            revieweeName: actualRevieweeName,
            revieweeId: actualRevieweeId,
            revieweeRole: actualRevieweeRole,
            serviceTitle: transaction.ServiceTitle,
            timestamp: new Date().toISOString()
        };
        
        const metadataJson = JSON.stringify(metadata);
        
        console.log('Storing review with metadata:', metadata);
        
        // Use a very simple insertion query with only the columns we know exist
        const insertQuery = `
            INSERT INTO Reviews (
                ApplicationId,
                Rating,
                ReviewText,
                CreatedAt
            )
            OUTPUT INSERTED.ReviewId
            VALUES (
                @applicationId,
                @rating,
                @reviewText,
                GETDATE()
            )
        `;
        
        const request = pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('rating', sql.Int, rating)
            .input('reviewText', sql.NVarChar(1000), reviewText || '');
        
        // Execute the query
        const result = await request.query(insertQuery);
            
        if (!result.recordset[0]) {
            return res.status(500).json({ error: 'Failed to create review' });
        }
        
        const reviewId = result.recordset[0].ReviewId;
        
        // After successful insert, try to add the reviewer info via UPDATE
        try {
            // First check if ReviewerId column exists
            const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
            
            if (hasReviewerIdColumn) {
                // Update the ReviewerId if the column exists
                await pool.request()
                    .input('reviewId', sql.Int, reviewId)
                    .input('userId', sql.Int, userId)
                    .query(`
                        UPDATE Reviews
                        SET ReviewerId = @userId
                        WHERE ReviewId = @reviewId
                    `);
                console.log(`Updated ReviewerId for review ${reviewId}`);
            }
            
            // Check if RevieweeId column exists
            const hasRevieweeIdColumn = await columnExists(pool, 'Reviews', 'RevieweeId');
            
            if (hasRevieweeIdColumn) {
                // Update the RevieweeId if the column exists
                await pool.request()
                    .input('reviewId', sql.Int, reviewId)
                    .input('revieweeId', sql.Int, actualRevieweeId)
                    .query(`
                        UPDATE Reviews
                        SET RevieweeId = @revieweeId
                        WHERE ReviewId = @reviewId
                    `);
                console.log(`Updated RevieweeId for review ${reviewId}`);
            }
            
            // Check if Metadata column exists
            const hasMetadataColumn = await columnExists(pool, 'Reviews', 'Metadata');
            
            if (hasMetadataColumn) {
                // Update the Metadata if the column exists
                await pool.request()
                    .input('reviewId', sql.Int, reviewId)
                    .input('metadata', sql.NVarChar(sql.MAX), metadataJson)
                    .query(`
                        UPDATE Reviews
                        SET Metadata = @metadata
                        WHERE ReviewId = @reviewId
                    `);
                console.log(`Updated Metadata for review ${reviewId}`);
            }
        } catch (err) {
            // Just log the error but continue since the basic review was saved
            console.warn('Could not update additional review fields:', err.message);
        }
        
        // Get the complete review data
        const reviewData = await pool.request()
            .input('reviewId', sql.Int, reviewId)
            .query(`
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    a.ServiceId,
                    s.Title as ServiceTitle,
                    '${metadata.reviewerName}' as ReviewerName,
                    '${metadata.revieweeName}' as RevieweeName,
                    '${metadata.reviewerRole}' as ReviewerRole,
                    '${metadata.revieweeRole}' as RevieweeRole
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE r.ReviewId = @reviewId
            `);
            
        res.status(201).json({
            message: 'Review submitted successfully',
            review: reviewData.recordset[0]
        });
        
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ 
            error: 'Failed to submit review', 
            details: error.message 
        });
    }
});

// Helper function to check if a column exists in a table
async function columnExists(pool, tableName, columnName) {
    try {
        const result = await pool.request()
            .input('tableName', sql.NVarChar, tableName)
            .input('columnName', sql.NVarChar, columnName)
            .query(`
                SELECT COUNT(1) as exists_count
                FROM sys.columns 
                WHERE Name = @columnName
                AND Object_ID = Object_ID(@tableName)
            `);
        
        return result.recordset[0].exists_count > 0;
    } catch (err) {
        console.error('Error checking column existence:', err);
        return false;
    }
}

// Get all reviews for a service
router.get('/service/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const pool = await getPool();
        
        // First check if ReviewerId column exists
        const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
        
        let query = `
            SELECT 
                r.ReviewId,
                r.ApplicationId,
                r.Rating,
                r.ReviewText,
                r.CreatedAt,
        `;
        
        // Add ReviewerName based on available columns
        if (hasReviewerIdColumn) {
            query += `
                u.FullName as ReviewerName
            FROM Reviews r
            JOIN Applications a ON r.ApplicationId = a.ApplicationId
            JOIN Users u ON r.ReviewerId = u.UserId
            `;
        } else {
            query += `
                c.FullName as ReviewerName
            FROM Reviews r
            JOIN Applications a ON r.ApplicationId = a.ApplicationId
            JOIN Users c ON a.UserId = c.UserId
            `;
        }
        
        query += `
            WHERE a.ServiceId = @serviceId
            ORDER BY r.CreatedAt DESC
        `;
        
        const result = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query(query);
            
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching service reviews:', error);
        res.status(500).json({ 
            error: 'Failed to fetch reviews', 
            details: error.message 
        });
    }
});

// Get all reviews by a user
router.get('/user', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const pool = await getPool();
        
        // First check if ReviewerId column exists
        const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
        
        // Use a different query based on column availability
        let query;
        if (hasReviewerIdColumn) {
            // If ReviewerId column exists, query by ReviewerId
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    s.ServiceId,
                    seller.FullName as ServiceOwnerName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE r.ReviewerId = @userId
                ORDER BY r.CreatedAt DESC
            `;
        } else {
            // Fall back to joining based on ApplicationId
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    s.ServiceId,
                    seller.FullName as ServiceOwnerName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE a.UserId = @userId
                ORDER BY r.CreatedAt DESC
            `;
        }
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(query);
            
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ 
            error: 'Failed to fetch reviews', 
            details: error.message 
        });
    }
});

// Get reviews where the current user is the reviewee 
// IMPORTANT: This route must be defined BEFORE the '/:reviewId' route
router.get('/received', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        console.log(`Fetching received reviews for user ID: ${userId}`);
        
        const pool = await getPool();
        
        // Check for advanced columns to determine query strategy
        const hasRevieweeIdColumn = await columnExists(pool, 'Reviews', 'RevieweeId');
        const hasMetadataColumn = await columnExists(pool, 'Reviews', 'Metadata');
        
        console.log(`Database schema: hasRevieweeIdColumn=${hasRevieweeIdColumn}, hasMetadataColumn=${hasMetadataColumn}`);
        
        let query = '';
        
        if (hasRevieweeIdColumn) {
            // If RevieweeId column exists, use it directly (most accurate)
            console.log('Using RevieweeId-based query');
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    s.ServiceId,
                    u_reviewer.UserId as ReviewerId,
                    u_reviewer.FullName as ReviewerName,
                    u_reviewee.UserId as RevieweeId,
                    u_reviewee.FullName as RevieweeName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u_reviewer ON r.ReviewerId = u_reviewer.UserId
                JOIN Users u_reviewee ON r.RevieweeId = u_reviewee.UserId
                WHERE r.RevieweeId = @userId
                ORDER BY r.CreatedAt DESC
            `;
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(query);
            
            console.log(`Found ${result.recordset.length} reviews using RevieweeId query`);    
            res.json(result.recordset);
            
        } else if (hasMetadataColumn) {
            // If Metadata exists, query reviews where the revieweeId in metadata matches the user's ID
            console.log('Using Metadata-based query');
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    r.Metadata,
                    s.Title as ServiceTitle,
                    s.ServiceId
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE 
                    r.Metadata LIKE '%"revieweeId":' + CAST(@userId AS NVARCHAR(20)) + '%'
                    OR r.Metadata LIKE '%"revieweeId": ' + CAST(@userId AS NVARCHAR(20)) + '%'
                ORDER BY r.CreatedAt DESC
            `;
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(query);
            
            console.log(`Found ${result.recordset.length} reviews using Metadata query`);
                
            // Process metadata to extract reviewer information
            const processedResults = result.recordset.map(review => {
                try {
                    if (review.Metadata) {
                        const metadata = JSON.parse(review.Metadata);
                        review.ReviewerName = metadata.reviewerName;
                        review.RevieweeName = metadata.revieweeName;
                    }
                } catch (err) {
                    console.warn('Failed to parse review metadata:', err.message);
                }
                return review;
            });
            
            res.json(processedResults);
            
        } else {
            // Fallback to old query - this is less accurate as it assumes all reviews for seller's services are reviews for the seller
            console.log('Using fallback seller-based query');
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    s.ServiceId,
                    c.FullName as ReviewerName,
                    so.FullName as RevieweeName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users c ON a.UserId = c.UserId
                JOIN Users so ON s.SellerId = so.UserId
                WHERE s.SellerId = @userId
                ORDER BY r.CreatedAt DESC
            `;
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(query);
            
            console.log(`Found ${result.recordset.length} reviews using seller fallback query`);    
            res.json(result.recordset);
        }
        
    } catch (error) {
        console.error('Error fetching received reviews:', error);
        res.status(500).json({ 
            error: 'Failed to fetch reviews', 
            details: error.message 
        });
    }
});

// Get a specific review
router.get('/:reviewId', async (req, res) => {
    try {
        const { reviewId } = req.params;
        const pool = await getPool();
        
        // First check if ReviewerId column exists
        const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
        
        let query;
        if (hasReviewerIdColumn) {
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    s.ServiceId,
                    reviewer.FullName as ReviewerName,
                    seller.FullName as ServiceOwnerName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users reviewer ON r.ReviewerId = reviewer.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE r.ReviewId = @reviewId
            `;
        } else {
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    s.ServiceId,
                    client.FullName as ReviewerName,
                    seller.FullName as ServiceOwnerName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users client ON a.UserId = client.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE r.ReviewId = @reviewId
            `;
        }
        
        const result = await pool.request()
            .input('reviewId', sql.Int, reviewId)
            .query(query);
            
        if (!result.recordset[0]) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching review details:', error);
        res.status(500).json({ 
            error: 'Failed to fetch review details', 
            details: error.message 
        });
    }
});

// Get all reviews for a specific freelancer
router.get('/freelancer/:freelancerId', async (req, res) => {
    try {
        const { freelancerId } = req.params;
        const pool = await getPool();
        
        // First check if ReviewerId column exists
        const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
        
        let query;
        if (hasReviewerIdColumn) {
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    u.FullName as ReviewerName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON r.ReviewerId = u.UserId
                WHERE s.SellerId = @freelancerId
                ORDER BY r.CreatedAt DESC
            `;
        } else {
            query = `
                SELECT 
                    r.ReviewId,
                    r.ApplicationId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    s.Title as ServiceTitle,
                    c.FullName as ReviewerName
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users c ON a.UserId = c.UserId
                WHERE s.SellerId = @freelancerId
                ORDER BY r.CreatedAt DESC
            `;
        }
        
        const result = await pool.request()
            .input('freelancerId', sql.Int, freelancerId)
            .query(query);
            
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching freelancer reviews:', error);
        res.status(500).json({ 
            error: 'Failed to fetch reviews', 
            details: error.message 
        });
    }
});

// Get all reviews (admin access)
router.get('/', verifyToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }
        
        const pool = await getPool();
        
        // First check if Reviews table exists
        let reviewsTableExists = false;
        try {
            const tableCheck = await pool.request().query(`
                SELECT OBJECT_ID('dbo.Reviews') as ReviewsTableId
            `);
            reviewsTableExists = !!tableCheck.recordset[0].ReviewsTableId;
        } catch (error) {
            console.log('Error checking Reviews table:', error.message);
            reviewsTableExists = false;
        }
        
        if (!reviewsTableExists) {
            return res.json([]);
        }
        
        // Fetch all reviews with service and reviewer details
        const result = await pool.request().query(`
            SELECT 
                r.ReviewId,
                r.ApplicationId,
                r.Rating,
                r.ReviewText,
                r.CreatedAt,
                s.ServiceId,
                s.Title as ServiceTitle, 
                reviewer.UserId as ReviewerId,
                reviewer.FullName as ReviewerName,
                seller.UserId as SellerId,
                seller.FullName as SellerName
            FROM Reviews r
            JOIN Applications a ON r.ApplicationId = a.ApplicationId
            JOIN Services s ON a.ServiceId = s.ServiceId
            JOIN Users reviewer ON a.UserId = reviewer.UserId
            JOIN Users seller ON s.SellerId = seller.UserId
            ORDER BY r.CreatedAt DESC
        `);
        
        res.json(result.recordset);
        
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({
            error: 'Failed to fetch reviews',
            details: error.message
        });
    }
});

// Delete a review (admin only)
router.delete('/:reviewId', verifyToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }
        
        const { reviewId } = req.params;
        const pool = await getPool();
        
        // First check if the review exists
        const reviewCheck = await pool.request()
            .input('reviewId', sql.Int, reviewId)
            .query(`
                SELECT ReviewId 
                FROM Reviews 
                WHERE ReviewId = @reviewId
            `);
            
        if (!reviewCheck.recordset[0]) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        // Delete the review
        await pool.request()
            .input('reviewId', sql.Int, reviewId)
            .query(`
                DELETE FROM Reviews
                WHERE ReviewId = @reviewId
            `);
            
        res.json({
            message: 'Review deleted successfully',
            reviewId
        });
        
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({
            error: 'Failed to delete review',
            details: error.message
        });
    }
});

// Check eligibility to submit a review for an application
router.get('/eligibility/:applicationId', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ 
                eligible: false, 
                error: 'Unauthorized - Please log in again' 
            });
        }
        
        const { applicationId } = req.params;
        const userId = req.user.userId;
        
        if (!applicationId || isNaN(applicationId)) {
            return res.status(400).json({ 
                eligible: false, 
                error: 'Valid application ID is required' 
            });
        }
        
        const pool = await getPool();
        
        // Check if the user is authorized for this transaction
        const checkResult = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.UserId as ClientId,
                    s.SellerId as ServiceOwnerId,
                    t.Status as TransactionStatus,
                    t.TransactionId,
                    c.FullName as ClientName,
                    so.FullName as ServiceOwnerName,
                    s.Title as ServiceTitle,
                    s.PostType,
                    CASE
                        WHEN s.PostType = 'client' AND s.SellerId = @userId THEN 'client'
                        WHEN s.PostType = 'client' AND a.UserId = @userId THEN 'freelancer'
                        WHEN s.PostType != 'client' AND a.UserId = @userId THEN 'client'
                        WHEN s.PostType != 'client' AND s.SellerId = @userId THEN 'freelancer'
                        ELSE 'unknown'
                    END as UserRole
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                JOIN Users c ON a.UserId = c.UserId
                JOIN Users so ON s.SellerId = so.UserId
                WHERE a.ApplicationId = @applicationId 
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);
            
        if (!checkResult.recordset[0]) {
            return res.status(403).json({ 
                eligible: false, 
                error: 'Transaction not found or you do not have permission to review it' 
            });
        }
        
        // Check if the transaction is completed
        const transaction = checkResult.recordset[0];
        const transactionStatus = transaction.TransactionStatus?.toLowerCase();
        
        if (transactionStatus !== 'completed' && 
            transactionStatus !== 'received') {
            return res.status(403).json({ 
                eligible: false, 
                error: `Transaction must be completed (current status: ${transaction.TransactionStatus}). You can only review completed transactions.`
            });
        }
        
        // Check if the user has already submitted a review
        const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
        
        let existingReviewQuery;
        if (hasReviewerIdColumn) {
            existingReviewQuery = `
                SELECT COUNT(*) as ReviewCount 
                FROM Reviews
                WHERE ApplicationId = @applicationId
                AND ReviewerId = @userId
            `;
        } else {
            // If ReviewerId doesn't exist, we need another way to check
            // This is a best-effort check but may not be 100% accurate
            existingReviewQuery = `
                SELECT COUNT(*) as ReviewCount 
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                WHERE r.ApplicationId = @applicationId
                AND (
                    (a.UserId = @userId) OR
                    EXISTS (
                        SELECT 1 FROM Services s 
                        WHERE s.ServiceId = a.ServiceId 
                        AND s.SellerId = @userId
                    )
                )
            `;
        }
        
        const existingReview = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(existingReviewQuery);
            
        if (existingReview.recordset[0].ReviewCount > 0) {
            return res.status(400).json({
                eligible: false,
                error: 'You have already submitted a review for this application'
            });
        }
        
        // Format transaction information for the frontend
        const formattedTransaction = {
            id: transaction.TransactionId,
            applicationId: parseInt(applicationId),
            clientName: transaction.ClientName,
            freelancerName: transaction.ServiceOwnerName,
            serviceTitle: transaction.ServiceTitle,
            status: transaction.TransactionStatus,
            userRole: transaction.UserRole,
            postType: transaction.PostType
        };
        
        // All checks passed
        res.json({
            eligible: true,
            transaction: formattedTransaction
        });
        
    } catch (error) {
        console.error('Error checking review eligibility:', error);
        res.status(500).json({ 
            eligible: false,
            error: 'Failed to check review eligibility', 
            details: error.message 
        });
    }
});

// Get all reviews for a user (reviews they've submitted)
router.get('/all', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const pool = await getPool();
        
        // Check if needed columns exist for optimal query
        const hasReviewerIdColumn = await columnExists(pool, 'Reviews', 'ReviewerId');
        const hasMetadataColumn = await columnExists(pool, 'Reviews', 'Metadata');
        
        // Build the appropriate query based on available columns
        let query = `
            SELECT 
                r.ReviewId,
                r.ApplicationId,
                r.Rating,
                r.ReviewText,
                r.CreatedAt,
                a.ServiceId,
                s.Title as ServiceTitle`;
                
        if (hasMetadataColumn) {
            query += `,
                r.Metadata`;
        }
                
        // Add more detail fields based on review schema
        if (hasReviewerIdColumn) {
            query += `,
                r.ReviewerId,
                u_reviewer.FullName as ReviewerName,
                CASE 
                    WHEN s.SellerId = r.ReviewerId THEN u_client.FullName
                    ELSE u_seller.FullName
                END as RevieweeName,
                CASE 
                    WHEN s.SellerId = r.ReviewerId THEN 'client'
                    ELSE 'freelancer'
                END as RevieweeRole`;
        } else {
            query += `,
                u_client.FullName as ReviewerName,
                u_seller.FullName as RevieweeName,
                'freelancer' as RevieweeRole`;
        }
        
        query += `
            FROM Reviews r
            JOIN Applications a ON r.ApplicationId = a.ApplicationId
            JOIN Services s ON a.ServiceId = s.ServiceId
            JOIN Users u_client ON a.UserId = u_client.UserId
            JOIN Users u_seller ON s.SellerId = u_seller.UserId`;
            
        if (hasReviewerIdColumn) {
            query += `
            JOIN Users u_reviewer ON r.ReviewerId = u_reviewer.UserId`;
        }
        
        query += `
            WHERE `;
            
        // Filter based on the available schema
        if (hasReviewerIdColumn) {
            query += `r.ReviewerId = @userId`;
        } else {
            query += `a.UserId = @userId`;
        }
        
        query += `
            ORDER BY r.CreatedAt DESC`;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(query);
        
        // Enhance the results with parsed metadata
        const enhancedResults = result.recordset.map(review => {
            // Parse metadata if available
            if (review.Metadata) {
                try {
                    const metadata = JSON.parse(review.Metadata);
                    // Add any useful fields from metadata
                    if (metadata.revieweeName && !review.RevieweeName) {
                        review.RevieweeName = metadata.revieweeName;
                    }
                    if (metadata.reviewerName && !review.ReviewerName) {
                        review.ReviewerName = metadata.reviewerName;
                    }
                    review.ReviewerRole = metadata.reviewerRole || 'client';
                } catch (err) {
                    console.warn('Failed to parse review metadata:', err.message);
                }
            }
            return review;
        });
        
        res.json(enhancedResults);
    } catch (error) {
        console.error('Error fetching all user reviews:', error);
        res.status(500).json({ 
            error: 'Failed to fetch reviews', 
            details: error.message 
        });
    }
});

module.exports = router; 