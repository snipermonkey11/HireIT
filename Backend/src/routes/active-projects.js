const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// Get user's active projects (as freelancer only)
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('Fetching active projects for user ID:', userId);
        
        const pool = await getPool();

        // First check all applications for this user
        const appCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as total FROM Applications WHERE UserId = @userId
            `);
        console.log(`Found ${appCheck.recordset[0].total} total applications for user ${userId}`);
        
        // Check applications with statuses
        const statusCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT Status, COUNT(*) as count 
                FROM Applications 
                WHERE UserId = @userId
                GROUP BY Status
            `);
        console.log('Status counts for this user:');
        statusCheck.recordset.forEach(status => {
            console.log(`- ${status.Status}: ${status.count}`);
        });

        const activeProjects = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.ServiceId,
                    a.UserId as FreelancerId,
                    a.Message as ApplicationMessage,
                    a.Status,
                    a.CreatedAt,
                    a.UpdatedAt,
                    ISNULL(a.ProofImage, '') as ProofImage,
                    s.Title as ServiceTitle,
                    s.Description as ServiceDescription,
                    s.Price as ServicePrice,
                    s.Photo as ServiceImage,
                    s.Category as ServiceCategory,
                    s.SellerId as ServiceOwnerId,
                    s.PostType,
                    u.FullName as FreelancerName,
                    u.Email as FreelancerEmail,
                    u.Photo as FreelancerPhoto,
                    so.FullName as ServiceOwnerName,
                    so.Email as ServiceOwnerEmail,
                    t.Status as PaymentStatus,
                    t.PaymentMethod,
                    t.ReferenceNumber
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                JOIN Users so ON s.SellerId = so.UserId
                LEFT JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                WHERE (
                    -- Case 1: User applied as freelancer to a client post
                    (a.UserId = @userId AND s.PostType = 'client')
                    OR
                    -- Case 2: User posted a freelancer service that was accepted by a client
                    (s.SellerId = @userId AND s.PostType = 'freelancer')
                )
                AND a.Status IN ('Accepted', 'Service Started', 'Completed', 'Waiting for Approval', 'Proof Rejected', 'Approved', 'Payment Sent', 'Payment Received')
                ORDER BY a.UpdatedAt DESC
            `);

        console.log(`Found ${activeProjects.recordset.length} active projects for freelancer`);
        
        // Add additional flags for frontend rendering
        const processedProjects = activeProjects.recordset.map(project => ({
            ...project,
            isClient: false,
            isFreelancer: true,
            userRole: 'Freelancer'
        }));

        res.json(processedProjects);
    } catch (error) {
        console.error('Error fetching active projects:', error);
        res.status(500).json({
            error: 'Failed to fetch active projects',
            details: error.message
        });
    }
});

// Mark project as completed
router.patch('/:projectId/complete', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        
        console.log(`[DEBUG] Attempting to mark project ${projectId} as completed for user ${userId}`);
        
        const pool = await getPool();

        // First debug query to check if project exists at all
        const projectExists = await pool.request()
            .input('projectId', sql.Int, projectId)
            .query(`
                SELECT a.ApplicationId, a.Status, s.PostType, s.SellerId, a.UserId, s.Title
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId
            `);
            
        if (projectExists.recordset.length > 0) {
            const project = projectExists.recordset[0];
            console.log(`[DEBUG] Project found: ID=${projectId}, Status=${project.Status}, PostType=${project.PostType}, SellerId=${project.SellerId}, ApplicantId=${project.UserId}`);
        } else {
            console.log(`[DEBUG] No project found with ID ${projectId}`);
            return res.status(404).json({
                error: 'Project not found'
            });
        }

        // Verify the user is the freelancer with a more permissive query
        const projectCheck = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.Title as ServiceTitle, s.PostType, s.SellerId
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId 
                AND (
                    -- Case 1: User is freelancer who applied to client post
                    (a.UserId = @userId AND s.PostType = 'client')
                    OR
                    -- Case 2: User is freelancer who posted a service that client applied to
                    (s.SellerId = @userId AND s.PostType = 'freelancer')
                )
                -- Allow any status that makes sense for completion
                AND a.Status IN ('Accepted', 'Service Started')
            `);

        if (!projectCheck.recordset[0]) {
            console.log(`[DEBUG] Authorization failed for user ${userId} on project ${projectId}`);
            
            // Additional debug check to see why authorization failed
            const userRoleCheck = await pool.request()
                .input('projectId', sql.Int, projectId)
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        a.Status,
                        s.PostType,
                        s.SellerId,
                        a.UserId,
                        CASE 
                            WHEN a.UserId = @userId THEN 'Applicant'
                            WHEN s.SellerId = @userId THEN 'Service Owner'
                            ELSE 'Not Related'
                        END as UserRole,
                        CASE
                            WHEN s.PostType = 'client' AND a.UserId = @userId THEN 'Freelancer'
                            WHEN s.PostType = 'freelancer' AND s.SellerId = @userId THEN 'Freelancer'
                            ELSE 'Client'
                        END as BusinessRole
                    FROM Applications a
                    JOIN Services s ON a.ServiceId = s.ServiceId
                    WHERE a.ApplicationId = @projectId
                `);
                
            if (userRoleCheck.recordset[0]) {
                const role = userRoleCheck.recordset[0];
                console.log(`[DEBUG] User role check: Status=${role.Status}, UserRole=${role.UserRole}, BusinessRole=${role.BusinessRole}`);
            }
            
            return res.status(403).json({
                error: 'You are not authorized to complete this project or it is not in the correct status'
            });
        }
        
        console.log(`[DEBUG] Authorization successful for user ${userId} on project ${projectId}, status: ${projectCheck.recordset[0].Status}`);

        // Update project status to Completed
        await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications 
                SET Status = 'Completed',
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @projectId
            `);
            
        console.log(`[DEBUG] Successfully marked project ${projectId} as completed`);

        res.json({
            message: 'Project marked as completed successfully',
            projectId: projectId
        });

    } catch (error) {
        console.error('Error completing project:', error);
        res.status(500).json({
            error: 'Failed to complete project',
            details: error.message
        });
    }
});

// Upload proof of completion
router.post('/:projectId/proof', verifyToken, (req, res, next) => {
    // Debug the incoming request before multer processes it
    console.log('Pre-multer request details:', {
        headers: req.headers,
        contentType: req.headers['content-type'],
        hasBody: !!req.body,
        params: req.params
    });
    next();
}, upload.single('proof'), async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;

        // Debug logging
        console.log('Received proof upload request:', {
            projectId,
            userId,
            hasFile: !!req.file,
            contentType: req.headers['content-type'],
            fileDetails: req.file ? {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                size: req.file.size,
                buffer: req.file.buffer ? `Buffer (${req.file.buffer.length} bytes)` : 'No buffer'
            } : 'No file details'
        });

        if (!req.file) {
            console.error('No file received in request');
            return res.status(400).json({ error: 'No proof image uploaded' });
        }

        const pool = await getPool();

        // Verify the user is the freelancer and project is in correct status
        const projectCheck = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.Title as ServiceTitle, s.PostType, s.SellerId
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId 
                AND (
                    -- Case 1: User is freelancer who applied to client post
                    (a.UserId = @userId AND s.PostType = 'client')
                    OR
                    -- Case 2: User is freelancer who posted a service that client applied to
                    (s.SellerId = @userId AND s.PostType = 'freelancer')
                )
                AND (a.Status = 'Completed' OR a.Status = 'Proof Rejected')
            `);

        if (!projectCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Project not found or you cannot upload proof at this time'
            });
        }

        if (!req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({
                error: 'Uploaded file is empty or corrupted'
            });
        }

        const proofImage = req.file.buffer.toString('base64');

        // Update project with proof and change status
        await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('proofImage', sql.VarChar(sql.MAX), proofImage)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications 
                SET Status = 'Waiting for Approval',
                    ProofImage = @proofImage,
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @projectId
            `);

        res.json({
            message: 'Proof uploaded successfully',
            projectId: projectId
        });

    } catch (error) {
        console.error('Error uploading proof:', error);
        res.status(500).json({
            error: 'Failed to upload proof',
            details: error.message
        });
    }
});

// Mark payment as received by freelancer
router.patch('/:projectId/payment-received', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify the user is the freelancer and project is in correct status
        const projectCheck = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.*, s.Title as ServiceTitle, s.PostType, s.SellerId
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId 
                AND (
                    -- Case 1: User is freelancer who applied to client post
                    (a.UserId = @userId AND s.PostType = 'client')
                    OR
                    -- Case 2: User is freelancer who posted a service that client applied to
                    (s.SellerId = @userId AND s.PostType = 'freelancer')
                )
                AND (a.Status = 'Payment Sent' OR a.Status = 'Approved')
            `);

        if (!projectCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Project not found or you cannot mark payment as received at this time'
            });
        }

        // Update project status to Payment Received
        await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications 
                SET Status = 'Payment Received',
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @projectId
            `);

        // Also update transaction status if it exists
        await pool.request()
            .input('projectId', sql.Int, projectId)
            .query(`
                UPDATE Transactions
                SET Status = 'Completed'
                WHERE ApplicationId = @projectId
            `);

        res.json({
            success: true,
            message: 'Payment marked as received successfully',
            projectId: projectId
        });

    } catch (error) {
        console.error('Error marking payment as received:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark payment as received',
            details: error.message
        });
    }
});

module.exports = router; 