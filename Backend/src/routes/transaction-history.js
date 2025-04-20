const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

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

// Get transaction history for the current user
router.get('/', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        const userId = req.user.userId;
        const pool = await getPool();

        console.log('Transaction History Route Hit:', {
            method: 'GET',
            path: req.path,
            userId
        });

        // First check if Reviews table exists
        let reviewsTableExists = false;
        try {
            const tableCheck = await pool.request().query(`
                SELECT OBJECT_ID('dbo.Reviews') as ReviewsTableId
            `);
            reviewsTableExists = !!tableCheck.recordset[0].ReviewsTableId;
            console.log('Reviews table exists:', reviewsTableExists);
        } catch (error) {
            console.log('Error checking Reviews table:', error.message);
            reviewsTableExists = false;
        }

        // Check for specific columns
        const hasReviewerId = reviewsTableExists && await columnExists(pool, 'Reviews', 'ReviewerId');
        console.log('HasReviewerId column:', hasReviewerId);
        
        // Build the query based on what tables and columns exist
        let query = `
            SELECT 
                t.TransactionId,
                t.ApplicationId,
                t.Amount,
                t.Status as TransactionStatus,
                t.PaymentMethod,
                t.ReferenceNumber,
                t.PaymentDate,
                t.CreatedAt,
                t.UpdatedAt,
                a.Status as ApplicationStatus,
                a.UserId as ClientId,
                s.ServiceId,
                s.Title as ServiceTitle,
                s.Description as ServiceDescription,
                s.Price,
                s.PostType,
                s.SellerId as FreelancerId,
                c.FullName as ClientName,
                c.Email as ClientEmail,
                f.FullName as FreelancerName,
                f.Email as FreelancerEmail
        `;

        // Add review fields depending on column existence
        if (reviewsTableExists) {
            if (hasReviewerId) {
                query += `,
                    CASE 
                        WHEN r.ReviewId IS NOT NULL AND r.ReviewerId = @userId THEN 'Reviewed'
                        ELSE 'Not Reviewed'
                    END as ReviewStatus,
                    r.ReviewId,
                    r.Rating,
                    r.ReviewText,
                    CASE 
                        WHEN r.ReviewerId = @userId THEN 1
                        ELSE 0
                    END as hasReviewed
                `;
            } else {
                query += `,
                    CASE 
                        WHEN r.ReviewId IS NOT NULL THEN 'Reviewed'
                        ELSE 'Not Reviewed'
                    END as ReviewStatus,
                    r.ReviewId,
                    r.Rating,
                    r.ReviewText,
                    0 as hasReviewed
                `;
            }
        } else {
            query += `,
                'Not Reviewed' as ReviewStatus,
                NULL as ReviewId,
                NULL as Rating,
                NULL as ReviewText,
                0 as hasReviewed
            `;
        }

        query += `
            FROM Transactions t
            JOIN Applications a ON t.ApplicationId = a.ApplicationId
            JOIN Services s ON a.ServiceId = s.ServiceId
            JOIN Users c ON a.UserId = c.UserId
            JOIN Users f ON s.SellerId = f.UserId
        `;

        // Add Reviews join only if the table exists
        if (reviewsTableExists) {
            if (hasReviewerId) {
                query += `
                    LEFT JOIN Reviews r ON a.ApplicationId = r.ApplicationId 
                    AND (r.ReviewerId = @userId OR r.ReviewerId IS NULL)
                `;
            } else {
                query += `
                    LEFT JOIN Reviews r ON a.ApplicationId = r.ApplicationId
                `;
            }
        }

        query += `
            WHERE (a.UserId = @userId OR s.SellerId = @userId)
            ORDER BY t.CreatedAt DESC
        `;

        console.log('Executing transaction history query...');
        
        // Execute query
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(query);

        console.log(`Found ${result.recordset.length} transactions`);
            
        // Format the response data
        const formattedTransactions = result.recordset.map(t => {
            // A user is a client if they applied for the service (ClientId/UserId matches)
            // A user is a freelancer if they posted the service (SellerId matches)
            const isClient = t.ClientId === userId;
            const isFreelancer = t.FreelancerId === userId;
            
            // For client requests (services posted by clients), the roles are reversed:
            // - If PostType is 'client' and user is SellerId, they are the client (request poster)
            // - If PostType is 'client' and user is UserId, they are the freelancer (applicant)
            let userRole = 'unknown';
            if (t.PostType === 'client') {
                // For client requests, SellerId is the client and UserId is the freelancer
                userRole = t.FreelancerId === userId ? 'client' : 'freelancer';
            } else {
                // For regular services, UserId is the client and SellerId is the freelancer
                userRole = t.ClientId === userId ? 'client' : 'freelancer';
            }
            
            console.log(`Transaction ${t.TransactionId}: PostType=${t.PostType}, SellerId=${t.FreelancerId}, UserId=${t.ClientId}, userRole=${userRole}`);
            
            return {
                id: t.TransactionId,
                applicationId: t.ApplicationId,
                serviceId: t.ServiceId,
                serviceTitle: t.ServiceTitle,
                description: t.ServiceDescription,
                amount: t.Amount,
                price: t.Price,
                status: t.TransactionStatus || t.ApplicationStatus,
                paymentMethod: t.PaymentMethod || 'Face to Face',
                referenceNumber: t.ReferenceNumber,
                completedDate: t.PaymentDate,
                createdAt: t.CreatedAt,
                userRole: userRole,
                clientName: t.PostType === 'client' ? t.FreelancerName : t.ClientName,
                clientEmail: t.PostType === 'client' ? t.FreelancerEmail : t.ClientEmail,
                freelancerName: t.PostType === 'client' ? t.ClientName : t.FreelancerName,
                freelancerEmail: t.PostType === 'client' ? t.ClientEmail : t.FreelancerEmail,
                serviceOwnerName: t.FreelancerName,
                serviceOwnerId: t.FreelancerId,
                applicantName: t.ClientName,
                applicantId: t.ClientId,
                reviewStatus: t.ReviewStatus,
                hasReviewed: !!t.hasReviewed,
                reviewId: t.ReviewId,
                rating: t.Rating,
                reviewText: t.ReviewText,
                postType: t.PostType
            };
        });

        res.json(formattedTransactions);
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({
            error: 'Failed to fetch transaction history',
            details: error.message
        });
    }
});

// Get transaction history details by transaction ID - update with similar column check logic
router.get('/:transactionId', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const { transactionId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Check if Reviews table exists
        let reviewsTableExists = false;
        try {
            const tableCheck = await pool.request().query(`
                SELECT OBJECT_ID('dbo.Reviews') as ReviewsTableId
            `);
            reviewsTableExists = !!tableCheck.recordset[0].ReviewsTableId;
        } catch (error) {
            reviewsTableExists = false;
        }

        // Check for specific columns
        const hasReviewerId = reviewsTableExists && await columnExists(pool, 'Reviews', 'ReviewerId');

        // Build the query based on what tables and columns exist
        let query = `
            SELECT 
                t.TransactionId,
                t.ApplicationId,
                t.Amount,
                t.Status as TransactionStatus,
                t.PaymentMethod,
                t.ReferenceNumber,
                t.PaymentDate,
                t.CreatedAt,
                t.UpdatedAt,
                a.Status as ApplicationStatus,
                a.UserId as ClientId,
                s.ServiceId,
                s.Title as ServiceTitle,
                s.Description as ServiceDescription,
                s.Price,
                s.Category,
                s.PostType,
                s.SellerId as FreelancerId,
                c.FullName as ClientName,
                c.Email as ClientEmail,
                f.FullName as FreelancerName,
                f.Email as FreelancerEmail
        `;

        // Add review fields depending on what exists
        if (reviewsTableExists) {
            query += `,
                r.ReviewId,
                r.Rating,
                r.ReviewText,
                CASE 
                    WHEN r.ReviewId IS NOT NULL THEN 'Reviewed'
                    ELSE 'Not Reviewed'
                END as ReviewStatus
            `;
        } else {
            query += `,
                NULL as ReviewId,
                NULL as Rating,
                NULL as ReviewText,
                'Not Reviewed' as ReviewStatus
            `;
        }

        query += `
            FROM Transactions t
            JOIN Applications a ON t.ApplicationId = a.ApplicationId
            JOIN Services s ON a.ServiceId = s.ServiceId
            JOIN Users c ON a.UserId = c.UserId
            JOIN Users f ON s.SellerId = f.UserId
        `;

        // Add Reviews join only if the table exists
        if (reviewsTableExists) {
            query += `LEFT JOIN Reviews r ON a.ApplicationId = r.ApplicationId`;
        }

        query += `
            WHERE t.TransactionId = @transactionId
            AND (a.UserId = @userId OR s.SellerId = @userId)
        `;

        // Query to get detailed information about a specific transaction
        const result = await pool.request()
            .input('transactionId', sql.Int, transactionId)
            .input('userId', sql.Int, userId)
            .query(query);

        if (!result.recordset[0]) {
            return res.status(404).json({ 
                error: 'Transaction not found',
                details: 'Could not find transaction with provided ID or you do not have permission to view it'
            });
        }

        const transaction = result.recordset[0];
        // Format the response
        const formattedTransaction = {
            id: transaction.TransactionId,
            applicationId: transaction.ApplicationId,
            serviceId: transaction.ServiceId,
            serviceTitle: transaction.ServiceTitle,
            description: transaction.ServiceDescription,
            category: transaction.Category,
            amount: transaction.Amount,
            price: transaction.Price,
            status: transaction.TransactionStatus,
            paymentMethod: transaction.PaymentMethod || 'Face to Face',
            referenceNumber: transaction.ReferenceNumber,
            paymentDate: transaction.PaymentDate,
            createdAt: transaction.CreatedAt,
            // Determine user role based on PostType
            userRole: transaction.PostType === 'client' 
                ? (transaction.FreelancerId === userId ? 'client' : 'freelancer')
                : (transaction.ClientId === userId ? 'client' : 'freelancer'),
            // Adjust client/freelancer names based on PostType
            clientName: transaction.PostType === 'client' ? transaction.FreelancerName : transaction.ClientName,
            clientEmail: transaction.PostType === 'client' ? transaction.FreelancerEmail : transaction.ClientEmail,
            freelancerName: transaction.PostType === 'client' ? transaction.ClientName : transaction.FreelancerName,
            freelancerEmail: transaction.PostType === 'client' ? transaction.ClientEmail : transaction.FreelancerEmail,
            serviceOwnerName: transaction.FreelancerName,
            serviceOwnerId: transaction.FreelancerId,
            applicantName: transaction.ClientName,
            applicantId: transaction.ClientId,
            reviewStatus: transaction.ReviewStatus,
            reviewId: transaction.ReviewId,
            rating: transaction.Rating,
            reviewText: transaction.ReviewText,
            postType: transaction.PostType
        };

        res.json(formattedTransaction);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({
            error: 'Failed to fetch transaction details',
            details: error.message
        });
    }
});

module.exports = router; 