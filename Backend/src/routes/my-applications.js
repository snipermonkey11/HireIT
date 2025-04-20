const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get user's applications (as applicant)
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('Fetching applications for user:', userId);
        
        const pool = await getPool();
        
        const applications = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.ServiceId,
                    a.Message,
                    a.Status,
                    a.CreatedAt,
                    a.UpdatedAt,
                    s.Title,
                    s.Description,
                    s.Price,
                    s.Photo,
                    s.Category,
                    s.Status as ServiceStatus,
                    s.PostType,
                    s.SellerId,
                    CASE WHEN s.Status = 'Deleted' THEN 1 ELSE 0 END as ServiceDeleted,
                    u.UserId,
                    u.FullName as SellerName,
                    u.Email as SellerEmail,
                    COALESCE(u.Photo, '') as SellerPhoto,
                    app_user.FullName as ApplicantName,
                    CASE 
                        WHEN s.SellerId = @userId THEN 1 
                        ELSE 0 
                    END as isOwner,
                    CASE 
                        WHEN a.Status = 'Started' AND (
                            (s.PostType = 'client' AND s.SellerId != @userId) OR 
                            (s.PostType = 'freelancer' AND s.SellerId = @userId)
                        ) THEN 1 
                        ELSE 0 
                    END as canUploadProof,
                    CASE 
                        WHEN a.Status = 'Started' AND (
                            (s.PostType = 'client' AND s.SellerId = @userId) OR 
                            (s.PostType = 'freelancer' AND s.SellerId != @userId)
                        ) THEN 1 
                        ELSE 0 
                    END as canMarkComplete
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON s.SellerId = u.UserId
                JOIN Users app_user ON a.UserId = app_user.UserId
                WHERE a.UserId = @userId OR s.SellerId = @userId
                ORDER BY a.CreatedAt DESC
            `);

        console.log('Found applications:', applications.recordset.length);
        res.json(applications.recordset);

    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ 
            error: 'Failed to fetch applications',
            details: error.message
        });
    }
});

// Delete (cancel) an application
router.delete('/:applicationId', verifyToken, async (req, res) => {
    const { applicationId } = req.params;
    const userId = req.user.userId;

    try {
        const pool = await getPool();
        
        // Check if the application exists and belongs to the user
        const application = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.SellerId, s.PostType
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @applicationId
                AND a.UserId = @userId
            `);
        
        if (application.recordset.length === 0) {
            return res.status(404).json({ error: 'Application not found or you do not have permission to cancel it' });
        }
        
        // Check if the application status allows cancellation
        const status = application.recordset[0].Status;
        if (status !== 'Pending') {
            return res.status(403).json({ 
                error: 'Only pending applications can be cancelled',
                currentStatus: status
            });
        }
        
        // Delete the application
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .query('DELETE FROM Applications WHERE ApplicationId = @applicationId');
        
        res.json({ message: 'Application cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling application:', error);
        res.status(500).json({ 
            error: 'Failed to cancel application',
            details: error.message
        });
    }
});

// Start service
router.patch('/:applicationId/start', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify ownership and current status
        const application = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.PostType, s.SellerId, s.Title as ServiceTitle
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @applicationId
                AND a.UserId = @userId
                AND (a.Status = 'Approved' OR a.Status = 'Accepted')
            `);

        if (!application.recordset[0]) {
            return res.status(404).json({
                error: 'Application not found or cannot be started'
            });
        }

        const appDetails = application.recordset[0];

        // Update status to Started
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications
                SET Status = 'Service Started',
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @applicationId
            `);

        // Determine the user's role based on the post type
        // If it's a client post, the user is applying as a freelancer
        // If it's a freelancer post, the user is applying as a client
        const userRole = appDetails.PostType === 'client' ? 'freelancer' : 'client';

        // FIXED: Correct redirect path based on user role
        // Clients go to project status to monitor freelancer work
        // Freelancers go to active projects to do the client work
        const redirectPath = userRole === 'client' 
            ? '/projectstatus'  // Clients who applied to freelancer posts go to project status
            : '/active';        // Freelancers who applied to client posts go to active projects

        res.json({
            message: 'Service started successfully',
            applicationId,
            postType: appDetails.PostType,
            userRole: userRole,
            redirectPath,
            serviceTitle: appDetails.ServiceTitle
        });
    } catch (error) {
        console.error('Error starting service:', error);
        res.status(500).json({
            error: 'Failed to start service',
            details: error.message
        });
    }
});

// Upload proof/delivery
router.post('/:applicationId/proof', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { proofImage, comments } = req.body;
        const userId = req.user.userId;
        
        if (!proofImage) {
            return res.status(400).json({ error: 'Proof image is required' });
        }
        
        const pool = await getPool();
        
        // Verify the application exists and user has permission
        const application = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.PostType, s.SellerId
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
                AND a.Status = 'Service Started'
            `);
        
        if (application.recordset.length === 0) {
            return res.status(404).json({
                error: 'Application not found, not started, or you do not have permission'
            });
        }
        
        const appDetails = application.recordset[0];
        
        // Check if user is allowed to upload proof based on role
        const isFreelancer = appDetails.PostType === 'client' ? (appDetails.UserId === userId) : (appDetails.SellerId === userId);
        const isClient = !isFreelancer;
        
        if (isClient && appDetails.PostType === 'client') {
            return res.status(403).json({
                error: 'As the client for this job, you cannot upload delivery proof'
            });
        }
        
        if (isFreelancer && appDetails.PostType === 'freelancer') {
            return res.status(403).json({
                error: 'As the service provider, you cannot upload approval proof'
            });
        }
        
        // Update the application with proof
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('proofImage', sql.NVarChar(sql.MAX), proofImage)
            .input('comments', sql.NVarChar(500), comments || '')
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications
                SET ProofImage = @proofImage,
                    ProofComments = @comments,
                    Status = 'Proof Submitted',
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @applicationId
            `);
        
        res.json({
            message: 'Proof uploaded successfully',
            applicationId,
            status: 'Proof Submitted'
        });
    } catch (error) {
        console.error('Error uploading proof:', error);
        res.status(500).json({
            error: 'Failed to upload proof',
            details: error.message
        });
    }
});

// Mark application as complete
router.patch('/:applicationId/complete', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { rating, review } = req.body;
        const userId = req.user.userId;
        
        const pool = await getPool();
        
        // Verify the application exists and user has permission
        const application = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.PostType, s.SellerId, s.Title as ServiceTitle
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
                AND (a.Status = 'Service Started' OR a.Status = 'Proof Submitted')
            `);
        
        if (application.recordset.length === 0) {
            return res.status(404).json({
                error: 'Application not found, not in proper status, or you do not have permission'
            });
        }
        
        const appDetails = application.recordset[0];
        
        // Check if user is allowed to mark complete based on role
        const isFreelancer = appDetails.PostType === 'client' ? (appDetails.UserId === userId) : (appDetails.SellerId === userId);
        const isClient = !isFreelancer;
        
        if (isFreelancer && appDetails.PostType === 'client') {
            return res.status(403).json({
                error: 'As the freelancer, you cannot mark client-posted jobs as complete'
            });
        }
        
        if (isClient && appDetails.PostType === 'freelancer') {
            return res.status(403).json({
                error: 'As the client, you cannot mark freelancer services as complete'
            });
        }
        
        // Update the application as complete
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('rating', sql.Int, rating || 5)
            .input('review', sql.NVarChar(500), review || '')
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications
                SET Status = 'Completed',
                    Rating = @rating,
                    Review = @review,
                    CompletedAt = @updatedAt,
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @applicationId
            `);
        
        // TODO: Update user ratings based on this review
        
        res.json({
            message: 'Service marked as complete',
            applicationId,
            status: 'Completed'
        });
    } catch (error) {
        console.error('Error marking service as complete:', error);
        res.status(500).json({
            error: 'Failed to mark service as complete',
            details: error.message
        });
    }
});

// Export the router
module.exports = router; 