const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Debug middleware for this router
router.use(function(req, res, next) {
    console.log('Applications Route Hit:', {
        method: req.method,
        path: req.path,
        body: req.body,
        userId: req.user ? req.user.id : undefined
    });
    next();
});

// Test database connection
router.get('/test-connection', function(req, res) {
    getPool()
        .then(pool => {
            return pool.query('SELECT 1 as test');
        })
        .then(([result]) => {
            console.log('Database connection test result:', result);
            res.json({ 
                message: 'Database connection successful',
                result: result[0]
            });
        })
        .catch(error => {
            console.error('Database connection test failed:', error);
            res.status(500).json({
                error: 'Database connection test failed',
                details: error.message
            });
        });
});

// Get all applications for a user
router.get('/', verifyToken, function(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    
    getPool()
        .then(pool => {
            return pool.query(`
                SELECT 
                    a.*,
                    s.Title,
                    s.Description,
                    s.Price,
                    s.Photo,
                    s.PostType,
                    u.FullName as ApplicantName,
                    seller.FullName as SellerName,
                    u.StudentId as ApplicantStudentId,
                    u.Grade as ApplicantGrade,
                    u.Section as ApplicantSection,
                    u.Email as ApplicantEmail,
                    u.Photo as ApplicantPhoto
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE a.UserId = ? OR s.SellerId = ?
                ORDER BY a.CreatedAt DESC`,
                [userId, userId]
            );
        })
        .then(([results]) => {
            res.json(results);
        })
        .catch(error => {
            console.error('Error fetching applications:', error);
            res.status(500).json({ error: 'Failed to fetch applications' });
        });
});

// Create a new application
router.post('/', verifyToken, function(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { serviceId, message } = req.body;
    const userId = req.user.id;

    if (!serviceId) {
        return res.status(400).json({ error: 'ServiceId is required' });
    }

    let pool;
    let serviceDetails;
    
    getPool()
        .then(p => {
            pool = p;
            const request = pool.request();
            request.input('serviceId', serviceId);
            return request.query('SELECT ServiceId, SellerId, PostType, Title FROM Services WHERE ServiceId = @serviceId');
        })
        .then(result => {
            const service = result.recordset[0];
            if (!service) {
                throw { status: 404, message: 'Service not found' };
            }
            if (service.SellerId === userId) {
                throw { status: 400, message: 'You cannot apply to your own service' };
            }
            
            // Store service details for later use
            serviceDetails = service;
            
            const request = pool.request();
            request.input('serviceId', serviceId);
            request.input('userId', userId);
            return request.query('SELECT * FROM Applications WHERE ServiceId = @serviceId AND UserId = @userId');
        })
        .then(result => {
            if (result.recordset[0]) {
                throw { status: 400, message: 'You have already applied to this service' };
            }

            // Use the PostType from the service
            const request = pool.request();
            request.input('serviceId', serviceId);
            request.input('userId', userId);
            request.input('postType', serviceDetails.PostType);
            request.input('message', message || '');
            
            return request.query(`
                INSERT INTO Applications 
                (ServiceId, UserId, Status, PostType, Message, CreatedAt, UpdatedAt)
                VALUES (@serviceId, @userId, 'Pending', @postType, @message, GETDATE(), GETDATE());
                SELECT SCOPE_IDENTITY() AS insertId;
            `);
        })
        .then(result => {
            const applicationId = result.recordset[0].insertId;
            
            const request = pool.request();
            request.input('applicationId', applicationId);
            
            return request.query(`
                SELECT 
                    a.*,
                    s.Title,
                    s.Description,
                    s.Price,
                    s.Photo,
                    s.PostType,
                    u.FullName as ApplicantName,
                    u.Email as ApplicantEmail,
                    u.Photo as ApplicantPhoto,
                    seller.FullName as SellerName,
                    seller.UserId as ServiceOwnerId
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE a.ApplicationId = @applicationId`
            );
        })
        .then(result => {
            const details = result.recordset[0];
            if (!details) {
                throw { status: 500, message: 'Failed to retrieve application details' };
            }
            
            res.status(201).json({
                message: 'Application submitted successfully',
                application: details
            });
        })
        .catch(error => {
            console.error('Error creating application:', {
                error: error.message,
                code: error.code,
                originalError: error.originalError,
                status: error.status
            });

            // Handle specific SQL Server errors
            if (error.code === 'EREQUEST') {
                return res.status(500).json({ 
                    error: 'Database error occurred while creating application. Please try again.',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }

            // Handle validation errors
            if (error.status === 400 || error.status === 404) {
                return res.status(error.status).json({ 
                    error: error.message 
                });
            }

            // Handle other errors
            res.status(500).json({ 
                error: 'Failed to create application. Please try again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        });
});

// Get applications for a specific service (for service owner)
router.get('/service/:serviceId', verifyToken, function(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const serviceId = req.params.serviceId;
    const userId = req.user.id;
    let pool;

    getPool()
        .then(p => {
            pool = p;
            return pool.query(
                'SELECT ServiceId FROM Services WHERE ServiceId = ? AND SellerId = ?',
                [serviceId, userId]
            );
        })
        .then(([results]) => {
            if (!results[0]) {
                throw { status: 403, message: 'Unauthorized - You can only view applications for your own services' };
            }

            return pool.query(`
                SELECT 
                    a.*,
                    u.FullName as ApplicantFullName,
                    u.Email as ApplicantEmail,
                    u.Photo as ApplicantPhoto,
                    u.StudentId as ApplicantStudentId,
                    u.Grade as ApplicantGrade,
                    u.Section as ApplicantSection
                FROM Applications a
                JOIN Users u ON a.UserId = u.UserId
                WHERE a.ServiceId = ?
                ORDER BY a.CreatedAt DESC`,
                [serviceId]
            );
        })
        .then(([applications]) => {
            res.json(applications);
        })
        .catch(error => {
            console.error('Error fetching applications:', error);
            const status = error.status || 500;
            const message = error.status ? error.message : 'Failed to fetch applications';
            res.status(status).json({ error: message });
        });
});

// Update application status
router.patch('/:applicationId', verifyToken, function(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { applicationId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    let pool;
    let applicationData;

    getPool()
        .then(p => {
            pool = p;
            return pool.query(`
                SELECT a.*, s.SellerId, s.PostType, s.Title,
                       u.FullName as FreelancerName
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                WHERE a.ApplicationId = ?`,
                [applicationId]
            );
        })
        .then(([results]) => {
            applicationData = results[0];
            if (!applicationData) {
                throw { status: 404, message: 'Application not found' };
            }
            if (applicationData.SellerId !== userId) {
                throw { status: 403, message: 'You do not have permission to update this application' };
            }

            return pool.query(
                'UPDATE Applications SET Status = ?, UpdatedAt = NOW() WHERE ApplicationId = ?',
                [status, applicationId]
            );
        })
        .then(() => {
            if (status === 'Accepted') {
                return pool.query(`
                    UPDATE Applications 
                    SET Status = 'Rejected', UpdatedAt = NOW()
                    WHERE ServiceId = ? AND ApplicationId != ? AND Status = 'Pending'`,
                    [applicationData.ServiceId, applicationId]
                );
            }
            return Promise.resolve();
        })
        .then(() => {
            return pool.query(`
                INSERT INTO Notifications (UserId, Message, Type, CreatedAt)
                VALUES (?, ?, 'APPLICATION_STATUS_CHANGE', NOW())`,
                [applicationData.UserId, `Your application for "${applicationData.Title}" has been ${status.toLowerCase()}`]
            );
        })
        .then(() => {
            res.json({ 
                message: 'Application status updated successfully',
                application: {
                    ...applicationData,
                    Status: status
                }
            });
        })
        .catch(error => {
            console.error('Error updating application:', error);
            const status = error.status || 500;
            const message = error.status ? error.message : 'Failed to update application';
            res.status(status).json({ error: message });
        });
});

// Start service for an accepted application
router.patch('/:applicationId/start-service', verifyToken, function(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { applicationId } = req.params;
    const userId = req.user.id;
    let pool;
    let applicationData;

    getPool()
        .then(p => {
            pool = p;
            return pool.query(`
                SELECT a.*, s.Title, s.SellerId,
                       u.FullName as FreelancerName,
                       seller.FullName as ServiceOwnerName
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                WHERE a.ApplicationId = ? 
                AND a.UserId = ?
                AND a.Status = 'Accepted'`,
                [applicationId, userId]
            );
        })
        .then(([results]) => {
            applicationData = results[0];
            if (!applicationData) {
                throw { status: 404, message: 'Application not found, not accepted, or you are not authorized' };
            }

            return pool.query(
                'UPDATE Applications SET Status = "Service Started", UpdatedAt = NOW() WHERE ApplicationId = ?',
                [applicationId]
            );
        })
        .then(() => {
            return pool.query(`
                INSERT INTO Notifications (UserId, Message, Type, CreatedAt)
                VALUES 
                    (?, ?, 'SERVICE_STARTED', NOW()),
                    (?, ?, 'SERVICE_STARTED', NOW())`,
                [
                    userId,
                    `You have started working on "${applicationData.Title}"`,
                    applicationData.SellerId,
                    `${applicationData.FreelancerName} has started working on "${applicationData.Title}"`
                ]
            );
        })
        .then(() => {
            res.json({
                message: 'Service started successfully',
                application: {
                    ...applicationData,
                    Status: 'Service Started'
                }
            });
        })
        .catch(error => {
            console.error('Error starting service:', error);
            const status = error.status || 500;
            const message = error.status ? error.message : 'Failed to start service';
            res.status(status).json({ error: message });
        });
});

// Delete (cancel) an application
router.delete('/:applicationId', verifyToken, function(req, res) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { applicationId } = req.params;
    const userId = req.user.id;
    let pool;

    getPool()
        .then(p => {
            pool = p;
            return pool.query(
                'SELECT * FROM Applications WHERE ApplicationId = ? AND UserId = ?',
                [applicationId, userId]
            );
        })
        .then(([results]) => {
            const application = results[0];
            if (!application) {
                throw { status: 404, message: 'Application not found or you do not have permission to delete it' };
            }
            if (application.Status !== 'Pending') {
                throw { status: 400, message: `Cannot cancel application with status "${application.Status}". Only pending applications can be cancelled.` };
            }

            return pool.query(
                'DELETE FROM Applications WHERE ApplicationId = ?',
                [applicationId]
            );
        })
        .then(() => {
            res.json({
                message: 'Application cancelled successfully',
                applicationId
            });
        })
        .catch(error => {
            console.error('Error deleting application:', error);
            const status = error.status || 500;
            const message = error.status ? error.message : 'Failed to cancel application';
            res.status(status).json({ error: message });
        });
});

module.exports = router; 