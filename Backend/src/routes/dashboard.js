const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get all services for the current user (services they posted)
router.get('/my-services', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const pool = await getPool();
        
        console.log('Fetching user services for userId:', userId);
        
        // First check if Image column exists
        let imageColumnExists = true;
        try {
            const columnCheck = await pool.request().query(`
                SELECT COUNT(1) as ColumnExists
                FROM sys.columns 
                WHERE Name = 'Image'
                AND Object_ID = OBJECT_ID('dbo.Services')
            `);
            imageColumnExists = !!columnCheck.recordset[0].ColumnExists;
            console.log('Image column exists:', imageColumnExists);
        } catch (error) {
            console.log('Error checking Image column:', error.message);
            imageColumnExists = false;
        }
        
        // Build the query based on whether Image column exists
        let query = `
            SELECT 
                s.ServiceId,
                s.Title,
                s.Description,
                FORMAT(s.Price, 'N2') as Price,
                'PHP' as Currency,
                s.Category,
                s.Status,
                s.PostType,
                s.CreatedAt,
                s.UpdatedAt,
                u.FullName as SellerName,
                u.Email as SellerEmail,
                u.Photo as SellerPhoto,
                u.StudentId as SellerStudentId
        `;
        
        // Add Image column to query only if it exists
        if (imageColumnExists) {
            query += `, s.Image`;
        } else {
            query += `, NULL as Image`;
        }
        
        query += `
                , COUNT(a.ApplicationId) AS ApplicationCount
            FROM Services s
            LEFT JOIN Applications a ON s.ServiceId = a.ServiceId
            LEFT JOIN Users u ON s.SellerId = u.UserId
            WHERE s.SellerId = @userId
        `;

        // Add post type filter if specified
        if (req.query.type && req.query.type !== 'all') {
            query += ` AND s.PostType = @postType`;
        }

        query += `
            GROUP BY 
                s.ServiceId,
                s.Title,
                s.Description,
                FORMAT(s.Price, 'N2'),
                s.Category,
                s.Status,
                s.PostType,
                s.CreatedAt,
                s.UpdatedAt,
                u.FullName,
                u.Email,
                u.Photo,
                u.StudentId
        `;
        
        // Add Image to GROUP BY only if it exists
        if (imageColumnExists) {
            query += `, s.Image`;
        }
        
        query += ` ORDER BY 
            CASE WHEN s.Status = 'Deleted' THEN 1 ELSE 0 END,
            s.CreatedAt DESC`;

        // Execute the query with post type parameter if needed
        let request = pool.request()
            .input('userId', sql.Int, userId);

        if (req.query.type && req.query.type !== 'all') {
            request.input('postType', sql.NVarChar, req.query.type);
        }

        const result = await request.query(query);
        
        const services = result.recordset.map(service => ({
            id: service.ServiceId,
            title: service.Title,
            description: service.Description,
            price: service.Price,
            currency: service.Currency,
            category: service.Category,
            image: service.Image,
            status: service.Status,
            postType: service.PostType,
            createdAt: service.CreatedAt,
            updatedAt: service.UpdatedAt,
            sellerName: service.SellerName,
            sellerEmail: service.SellerEmail,
            sellerPhoto: service.SellerPhoto,
            sellerStudentId: service.SellerStudentId,
            applicationCount: service.ApplicationCount,
            isDeleted: service.Status === 'Deleted'
        }));
        
        res.json(services);
    } catch (error) {
        console.error('Error fetching user services:', error);
        res.status(500).json({
            error: 'Failed to fetch user services',
            details: error.message
        });
    }
});

// Update a service
router.put('/services/:serviceId', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const { serviceId } = req.params;
        const { title, description, price, category, image, status } = req.body;
        
        if (!title || !description || !price) {
            return res.status(400).json({ error: 'Title, description, and price are required' });
        }
        
        const pool = await getPool();
        
        // First check if the service belongs to the user
        const serviceCheck = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ServiceId FROM Services 
                WHERE ServiceId = @serviceId AND SellerId = @userId
            `);
        
        if (serviceCheck.recordset.length === 0) {
            return res.status(403).json({ error: 'You do not have permission to update this service' });
        }
        
        // Check if Image column exists
        let imageColumnExists = true;
        try {
            const columnCheck = await pool.request().query(`
                SELECT COUNT(1) as ColumnExists
                FROM sys.columns 
                WHERE Name = 'Image'
                AND Object_ID = OBJECT_ID('dbo.Services')
            `);
            imageColumnExists = !!columnCheck.recordset[0].ColumnExists;
        } catch (error) {
            console.log('Error checking Image column:', error.message);
            imageColumnExists = false;
        }
        
        // Build update query
        let updateFields = [
            'Title = @title',
            'Description = @description',
            'Price = @price',
            'Category = @category',
            'Status = @status',
            'UpdatedAt = GETDATE()'
        ];
        
        // Only include Image field if it exists
        if (imageColumnExists) {
            updateFields.push('Image = @image');
        }
        
        // Update the service
        let request = pool.request()
            .input('serviceId', sql.Int, serviceId)
            .input('title', sql.NVarChar(100), title)
            .input('description', sql.NVarChar(500), description)
            .input('price', sql.Decimal(10, 2), price)
            .input('category', sql.NVarChar(50), category || null)
            .input('status', sql.NVarChar(50), status || 'Active');
            
        // Only add image input if the column exists
        if (imageColumnExists) {
            request.input('image', sql.NVarChar(sql.MAX), image || null);
        }
        
        await request.query(`
            UPDATE Services
            SET ${updateFields.join(', ')}
            WHERE ServiceId = @serviceId
        `);
        
        res.json({ message: 'Service updated successfully' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({
            error: 'Failed to update service',
            details: error.message
        });
    }
});

// Get all reviews for services created by the user
router.get('/my-reviews', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const pool = await getPool();
        
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
        
        if (!reviewsTableExists) {
            console.log('Reviews table does not exist, returning empty array');
            return res.json([]);
        }
        
        console.log('Fetching reviews for user ID:', userId);
        
        // Get all reviews for services posted by the user
        try {
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        r.ReviewId,
                        r.ApplicationId,
                        r.Rating,
                        r.ReviewText,
                        r.CreatedAt,
                        a.ServiceId,
                        s.Title as ServiceTitle,
                        u.UserId as ClientId,
                        u.FullName as ClientName,
                        u.Email as ClientEmail,
                        'Client Review' as ReviewType
                    FROM Reviews r
                    JOIN Applications a ON r.ApplicationId = a.ApplicationId
                    JOIN Services s ON a.ServiceId = s.ServiceId
                    JOIN Users u ON a.UserId = u.UserId
                    WHERE s.SellerId = @userId
                    ORDER BY r.CreatedAt DESC
                `);
            
            // Process results for clarity
            const formattedReviews = result.recordset.map(review => ({
                ReviewId: review.ReviewId,
                ApplicationId: review.ApplicationId,
                Rating: review.Rating,
                ReviewText: review.ReviewText,
                CreatedAt: review.CreatedAt,
                ServiceId: review.ServiceId,
                ServiceTitle: review.ServiceTitle,
                ReviewerName: review.ClientName,  // Rename to make role clear
                ReviewerEmail: review.ClientEmail,
                ReviewerId: review.ClientId,
                ReviewType: review.ReviewType
            }));
            
            console.log('Found reviews count:', formattedReviews.length);
            res.json(formattedReviews);
        } catch (error) {
            console.error('SQL Error fetching reviews:', error.message);
            
            // If the query failed due to missing columns, try a simpler query
            try {
                console.log('Trying simplified query...');
                const simpleResult = await pool.request()
                    .input('userId', sql.Int, userId)
                    .query(`
                        SELECT 
                            r.ReviewId,
                            r.ApplicationId,
                            r.Rating,
                            r.ReviewText,
                            r.CreatedAt,
                            a.ServiceId,
                            s.Title as ServiceTitle
                        FROM Reviews r
                        JOIN Applications a ON r.ApplicationId = a.ApplicationId
                        JOIN Services s ON a.ServiceId = s.ServiceId
                        WHERE s.SellerId = @userId
                        ORDER BY r.CreatedAt DESC
                    `);
                
                // Add reviewer information afterward
                const reviewsWithUserInfo = [];
                for (const review of simpleResult.recordset) {
                    try {
                        // Try to get reviewer info
                        const userResult = await pool.request()
                            .input('applicationId', sql.Int, review.ApplicationId)
                            .query(`
                                SELECT 
                                    u.UserId as ClientId,
                                    u.FullName as ClientName,
                                    u.Email as ClientEmail
                                FROM Applications a
                                JOIN Users u ON a.UserId = u.UserId
                                WHERE a.ApplicationId = @applicationId
                            `);
                        
                        if (userResult.recordset[0]) {
                            reviewsWithUserInfo.push({
                                ...review,
                                ReviewerId: userResult.recordset[0].ClientId,
                                ReviewerName: userResult.recordset[0].ClientName,
                                ReviewerEmail: userResult.recordset[0].ClientEmail,
                                ReviewType: 'Client Review'
                            });
                        } else {
                            reviewsWithUserInfo.push({
                                ...review,
                                ReviewerId: null,
                                ReviewerName: 'Anonymous Client',
                                ReviewerEmail: '',
                                ReviewType: 'Client Review'
                            });
                        }
                    } catch (userError) {
                        // If we can't get user info, still add the review
                        reviewsWithUserInfo.push({
                            ...review,
                            ReviewerId: null,
                            ReviewerName: 'Anonymous Client',
                            ReviewerEmail: '',
                            ReviewType: 'Client Review'
                        });
                    }
                }
                
                console.log('Found reviews with simplified query:', reviewsWithUserInfo.length);
                res.json(reviewsWithUserInfo);
            } catch (fallbackError) {
                console.error('Fallback query also failed:', fallbackError.message);
                res.json([]);
            }
        }
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({
            error: 'Failed to fetch reviews',
            details: error.message
        });
    }
});

// Delete a service
router.delete('/services/:serviceId', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const { serviceId } = req.params;
        const pool = await getPool();
        
        // First check if the service belongs to the user
        const serviceCheck = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ServiceId, Status FROM Services 
                WHERE ServiceId = @serviceId AND SellerId = @userId
            `);
        
        if (serviceCheck.recordset.length === 0) {
            return res.status(403).json({ error: 'You do not have permission to update this service' });
        }
        
        // Instead of deleting, mark the service as "Deleted"
        console.log(`Marking service ${serviceId} as deleted`);
        
        await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query(`
                UPDATE Services
                SET Status = 'Deleted', UpdatedAt = GETDATE()
                WHERE ServiceId = @serviceId
            `);
        
        // Also update any applications that aren't already completed to Cancelled
        await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query(`
                UPDATE Applications
                SET Status = 'Cancelled', UpdatedAt = GETDATE()
                WHERE ServiceId = @serviceId 
                AND Status NOT IN ('Completed', 'Cancelled')
            `);
            
        console.log(`Service ${serviceId} marked as deleted successfully`);
        res.json({ 
            message: 'Service marked as deleted successfully',
            info: 'Related applications, transactions, and reviews are preserved'
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({
            error: 'Failed to delete service',
            details: error.message
        });
    }
});

module.exports = router; 