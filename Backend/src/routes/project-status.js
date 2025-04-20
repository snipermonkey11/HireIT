const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get projects for client actions (as a service owner of client posts)
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('Fetching client projects for user ID:', userId);
        console.log('Request headers:', req.headers);
        console.log('User role:', req.user.role);
        
        const pool = await getPool();

        // First query to check user's services and applications
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    'OwnedServices' as Type,
                    s.ServiceId,
                    s.PostType,
                    s.Title
                FROM Services s
                WHERE s.SellerId = @userId
                UNION ALL
                SELECT 
                    'AppliedServices' as Type,
                    s.ServiceId,
                    s.PostType,
                    s.Title
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.UserId = @userId
            `);
            
        console.log('User services/applications check:', JSON.stringify(userCheck.recordset, null, 2));

        // Add separate query to count client requests for this user
        const clientRequestsCount = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as count
                FROM Services s
                WHERE s.SellerId = @userId AND s.PostType = 'client'
            `);
            
        console.log('Client requests created by this user:', clientRequestsCount.recordset[0].count);

        const projects = await pool.request()
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
                    s.PostType,
                    s.SellerId as ServiceOwnerId,
                    u.FullName as FreelancerName,
                    u.Email as FreelancerEmail,
                    u.Photo as FreelancerPhoto,
                    seller.FullName as ServiceOwnerName,
                    seller.Email as ServiceOwnerEmail,
                    t.Status as PaymentStatus,
                    t.PaymentMethod,
                    t.ReferenceNumber
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                LEFT JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                WHERE 
                    -- Show only client requests - only to the client who posted it
                    (s.PostType = 'client' AND s.SellerId = @userId)
                    OR
                    -- Show freelancer services where this user is a client who applied
                    (s.PostType = 'freelancer' AND a.UserId = @userId)
                    AND a.Status IN ('Pending', 'Service Started', 'Waiting for Approval', 'Accepted', 'Completed', 'Approved', 'Proof Rejected', 'Payment Sent', 'Payment Received')
                ORDER BY a.UpdatedAt DESC
            `);

        console.log('SQL query executed successfully');
        console.log('Number of client projects found:', projects.recordset.length);

        // Enhanced response with clear relationship information
        const projectsWithRelationships = projects.recordset.map(project => {
            // Determine project relationships based on PostType
            const isClientPost = project.PostType === 'client';
            
            // Create enhanced project object with clear relationship info
            return {
                ...project,
                UserRole: 'Client',
                isClient: true,
                isFreelancer: false,
                
                // Clear relationship information
                relationshipDescription: isClientPost 
                    ? "You posted this project and a freelancer applied to it" 
                    : "You applied to this freelancer's service posting",
                
                // Explicit role identifiers
                postedBy: isClientPost ? 'client' : 'freelancer',
                postedById: isClientPost ? project.ServiceOwnerId : project.ServiceOwnerId,
                postedByName: isClientPost ? project.ServiceOwnerName : project.ServiceOwnerName,
                
                appliedBy: isClientPost ? 'freelancer' : 'client',
                appliedById: isClientPost ? project.FreelancerId : project.ServiceOwnerId,
                appliedByName: isClientPost ? project.FreelancerName : project.ServiceOwnerName,
                
                // For frontend display
                clientName: isClientPost ? project.ServiceOwnerName : project.ServiceOwnerName,
                clientId: isClientPost ? project.ServiceOwnerId : project.ServiceOwnerId,
                freelancerName: isClientPost ? project.FreelancerName : project.FreelancerName,
                freelancerId: isClientPost ? project.FreelancerId : project.FreelancerId
            };
        });

        res.json(projectsWithRelationships);
    } catch (error) {
        console.error('Error fetching client projects:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to fetch client projects',
            details: error.message
        });
    }
});

// Approve proof
router.patch('/:projectId/approve', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify the user is authorized to approve the proof (either client or freelancer service owner)
        const projectCheck = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.*,
                    s.Title as ServiceTitle,
                    s.SellerId,
                    s.PostType
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId 
                AND (
                    -- Client can approve proof for their request
                    (s.PostType = 'client' AND s.SellerId = @userId)
                    OR
                    -- Client can approve proof when they've applied to a freelancer's service
                    (s.PostType = 'freelancer' AND a.UserId = @userId)
                )
                AND a.Status = 'Waiting for Approval'
            `);

        if (!projectCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Project not found or you are not authorized to approve it'
            });
        }

        // Update project status to Approved
        await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications 
                SET Status = 'Approved',
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @projectId
            `);

        // Get the freelancer details
        const freelancerDetails = await pool.request()
            .input('projectId', sql.Int, projectId)
            .query(`
                SELECT u.UserId, u.Email, u.FullName, a.ServiceId, s.Title
                FROM Applications a
                JOIN Users u ON a.UserId = u.UserId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId
            `);

        const freelancer = freelancerDetails.recordset[0];
        const project = projectCheck.recordset[0];

        // Send notification to freelancer (in a real app this would be an email or push notification)
        console.log(`Notification to freelancer ${freelancer.FullName} (${freelancer.Email}): Your proof for ${freelancer.Title} was approved!`);

        res.json({
            message: 'Proof approved successfully',
            projectId: projectId,
            projectDetails: {
                title: project.ServiceTitle,
                status: 'Approved',
                nextStep: 'Payment'
            },
            freelancerNotified: true
        });

    } catch (error) {
        console.error('Error approving proof:', error);
        res.status(500).json({
            error: 'Failed to approve proof',
            details: error.message
        });
    }
});

// Reject proof (sets back to Completed status for new proof upload)
router.patch('/:projectId/reject', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify the user is authorized to reject the proof (either client or freelancer service owner)
        const projectCheck = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.*,
                    s.Title as ServiceTitle,
                    s.SellerId,
                    s.PostType
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId 
                AND (
                    -- Only client can reject proof for their request
                    s.PostType = 'client' AND s.SellerId = @userId
                )
                AND a.Status = 'Waiting for Approval'
            `);

        if (!projectCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Project not found or you are not authorized to reject it'
            });
        }

        // Clear the current proof image and set status to rejected
        await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Applications 
                SET Status = 'Proof Rejected',
                    ProofImage = NULL, -- Clear the current proof
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @projectId
            `);

        // Get the freelancer details
        const freelancerDetails = await pool.request()
            .input('projectId', sql.Int, projectId)
            .query(`
                SELECT u.UserId, u.Email, u.FullName, a.ServiceId, s.Title
                FROM Applications a
                JOIN Users u ON a.UserId = u.UserId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE a.ApplicationId = @projectId
            `);

        const freelancer = freelancerDetails.recordset[0];

        // Send notification to freelancer (in a real app this would be an email or push notification)
        console.log(`Notification to freelancer ${freelancer.FullName} (${freelancer.Email}): Your proof for ${freelancer.Title} was rejected.`);

        res.json({
            message: 'Proof rejected successfully. Freelancer can upload new proof.',
            projectId: projectId,
            freelancerNotified: true
        });

    } catch (error) {
        console.error('Error rejecting proof:', error);
        res.status(500).json({
            error: 'Failed to reject proof',
            details: error.message
        });
    }
});

module.exports = router; 