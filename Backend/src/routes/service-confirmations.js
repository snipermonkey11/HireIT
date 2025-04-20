const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get all applications for services owned by the logged-in user
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('Fetching received applications for user:', userId);
        
        const pool = await getPool();

        // First check what services this user owns
        const userServices = await pool.request()
            .input('sellerId', sql.Int, userId)
            .query(`
                SELECT ServiceId, Title, SellerId, PostType
                FROM Services
                WHERE SellerId = @sellerId
            `);
        
        console.log(`User ${userId} owns ${userServices.recordset.length} services:`, 
            userServices.recordset.map(s => `${s.ServiceId}: ${s.Title} (${s.PostType})`));

        // Then check if there are any applications for those services
        const serviceIds = userServices.recordset.map(s => s.ServiceId);
        
        if (serviceIds.length === 0) {
            console.log(`User ${userId} has no services, so no applications to show`);
            return res.json([]);
        }

        // Debug: Check all applications in the system
        const allApplications = await pool.request().query(`
            SELECT ApplicationId, ServiceId, UserId, Status, Message, CreatedAt 
            FROM Applications
        `);
        
        console.log(`Total applications in system: ${allApplications.recordset.length}`);
        console.log('All applications:', JSON.stringify(allApplications.recordset, null, 2));
        
        // Get service ownership info for debugging
        const serviceOwnershipQuery = await pool.request().query(`
            SELECT s.ServiceId, s.Title, s.SellerId, s.PostType, u.FullName
            FROM Services s
            JOIN Users u ON s.SellerId = u.UserId
        `);
        console.log('Service ownership:', JSON.stringify(serviceOwnershipQuery.recordset, null, 2));
        
        // Format service IDs for SQL IN clause
        const serviceIdsString = serviceIds.join(',');
        
        // Get all applications with applicant details - use direct table joins
        const applications = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.ServiceId,
                    a.UserId as ApplicantId,
                    a.Message as ApplicationMessage,
                    a.Status,
                    a.CreatedAt,
                    a.UpdatedAt,
                    s.Title as ServiceTitle,
                    s.Description as ServiceDescription,
                    s.Price as ServicePrice,
                    s.Photo as ServiceImage,
                    s.Category as ServiceCategory,
                    s.Status as ServiceStatus,
                    s.PostType,
                    CASE WHEN s.Status = 'Deleted' THEN 1 ELSE 0 END as ServiceDeleted,
                    s.SellerId as ServiceOwnerId,
                    u.FullName as ApplicantFullName,
                    u.Email as ApplicantEmail,
                    u.Photo as ApplicantPhoto,
                    u.StudentId as ApplicantStudentId,
                    u.Grade as ApplicantGrade,
                    u.Section as ApplicantSection
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                WHERE s.SellerId = @userId
                ORDER BY a.CreatedAt DESC
            `);

        console.log(`Found ${applications.recordset.length} applications for user ${userId}'s services`);
        console.log('Retrieved applications:', JSON.stringify(applications.recordset.map(a => ({
            ApplicationId: a.ApplicationId,
            ServiceId: a.ServiceId,
            Status: a.Status,
            PostType: a.PostType,
            ApplicantName: a.ApplicantFullName
        })), null, 2));
        
        if (applications.recordset.length === 0) {
            // Double check for any applications that should be showing
            const applicationsForUserServices = allApplications.recordset.filter(app => 
                serviceIds.includes(app.ServiceId)
            );
            
            console.log(`Applications that should be showing: ${applicationsForUserServices.length}`);
            console.log(JSON.stringify(applicationsForUserServices, null, 2));
            
            // Check each application and service connection
            for (const app of applicationsForUserServices) {
                const serviceCheck = await pool.request()
                    .input('serviceId', sql.Int, app.ServiceId)
                    .query(`
                        SELECT ServiceId, Title, SellerId, PostType
                        FROM Services 
                        WHERE ServiceId = @serviceId
                    `);
                    
                console.log(`Application ${app.ApplicationId} is for service ${app.ServiceId}:`);
                console.log(serviceCheck.recordset[0]);
                
                const userCheck = await pool.request()
                    .input('userId', sql.Int, app.UserId)
                    .query('SELECT UserId, FullName FROM Users WHERE UserId = @userId');
                    
                console.log(`Applicant ${app.UserId}:`, userCheck.recordset[0] || 'User not found');
            }
        }

        // Return the raw data from database
        res.json(applications.recordset);

    } catch (error) {
        console.error('Error fetching received applications:', error);
        res.status(500).json({ 
            error: 'Failed to fetch received applications',
            details: error.message
        });
    }
});

// Accept application
router.patch('/:applicationId/accept', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify ownership and current status
        const application = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.SellerId, s.Price, s.PostType
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @applicationId
                AND s.SellerId = @userId
                AND a.Status = 'Pending'
            `);

        if (!application.recordset[0]) {
            return res.status(404).json({
                error: 'Application not found or cannot be accepted'
            });
        }

        const appDetails = application.recordset[0];
        const currentDate = new Date();

        // Start a transaction to ensure both operations succeed or fail together
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Update status to Accepted
            await transaction.request()
                .input('applicationId', sql.Int, applicationId)
                .input('updatedAt', sql.DateTime, currentDate)
                .query(`
                    UPDATE Applications
                    SET Status = 'Accepted',
                        UpdatedAt = @updatedAt
                    WHERE ApplicationId = @applicationId
                `);

            // Create a transaction record
            await transaction.request()
                .input('applicationId', sql.Int, applicationId)
                .input('amount', sql.Money, appDetails.Price)
                .input('status', sql.VarChar(50), 'Pending')
                .input('createdAt', sql.DateTime, currentDate)
                .input('updatedAt', sql.DateTime, currentDate)
                .query(`
                    -- Check if a transaction already exists for this application
                    IF NOT EXISTS (SELECT 1 FROM Transactions WHERE ApplicationId = @applicationId)
                    BEGIN
                        -- Insert new transaction
                        INSERT INTO Transactions (
                            ApplicationId, 
                            Amount, 
                            Status, 
                            CreatedAt, 
                            UpdatedAt
                        ) VALUES (
                            @applicationId,
                            @amount,
                            @status,
                            @createdAt,
                            @updatedAt
                        )
                    END
                `);

            // Reject all other pending applications for this service
            await transaction.request()
                .input('serviceId', sql.Int, appDetails.ServiceId)
                .input('applicationId', sql.Int, applicationId)
                .input('updatedAt', sql.DateTime, currentDate)
                .query(`
                    UPDATE Applications
                    SET Status = 'Rejected',
                        UpdatedAt = @updatedAt
                    WHERE ServiceId = @serviceId
                    AND ApplicationId != @applicationId
                    AND Status = 'Pending'
                `);

            // Commit the transaction
            await transaction.commit();

            res.json({
                message: 'Application accepted successfully and transaction created',
                applicationId,
                postType: appDetails.PostType
            });
        } catch (err) {
            // If there was an error, roll back the transaction
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error accepting application:', error);
        res.status(500).json({
            error: 'Failed to accept application',
            details: error.message
        });
    }
});

// Reject application
router.patch('/:applicationId/reject', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify ownership and current status
        const application = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.SellerId, s.PostType
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @applicationId
                AND s.SellerId = @userId
                AND a.Status = 'Pending'
            `);

        if (!application.recordset[0]) {
            return res.status(404).json({
                error: 'Application not found or cannot be rejected'
            });
        }

        // Update status to Rejected
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications
                SET Status = 'Rejected',
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @applicationId
            `);

        res.json({
            message: 'Application rejected successfully',
            applicationId,
            postType: application.recordset[0].PostType
        });
    } catch (error) {
        console.error('Error rejecting application:', error);
        res.status(500).json({
            error: 'Failed to reject application',
            details: error.message
        });
    }
});

module.exports = router; 