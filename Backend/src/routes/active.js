const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get active projects for both clients and freelancers
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const pool = await getPool();

    // Get active projects with service details and user information
    const [activeProjects] = await pool.query(
      `SELECT 
        a.ApplicationId,
        a.Status as ApplicationStatus,
        a.ProofImage,
        s.ServiceId,
        s.ServiceTitle,
        s.ServiceImage,
        s.ServicePrice,
        s.PostType,
        s.SellerId as ServiceOwnerId,
        a.UserId as ApplicantId,
        CASE 
          WHEN s.PostType = 'client' THEN 
            (SELECT FullName FROM Users WHERE UserId = s.SellerId)
          ELSE 
            (SELECT FullName FROM Users WHERE UserId = a.UserId)
        END as FreelancerName,
        CASE 
          WHEN s.PostType = 'client' THEN s.SellerId
          ELSE a.UserId
        END as FreelancerId,
        t.TransactionId,
        t.Status as PaymentStatus
      FROM Applications a
      JOIN Services s ON a.ServiceId = s.ServiceId
      LEFT JOIN Transactions t ON a.ApplicationId = t.ApplicationId
      WHERE (
        -- For client posts: show to both service owner (client) and applicant (freelancer)
        (s.PostType = 'client' AND (s.SellerId = ? OR a.UserId = ?))
        OR
        -- For freelancer posts: show to both service owner (freelancer) and applicant (client)
        (s.PostType = 'freelancer' AND (s.SellerId = ? OR a.UserId = ?))
      )
      AND a.Status IN ('Accepted', 'Service Started', 'Completed', 'Payment Sent', 'Payment Received', 'Proof Rejected')
      ORDER BY a.UpdatedAt DESC`,
      [userId, userId, userId, userId]
    );

    // Format the response
    const formattedProjects = activeProjects.map(project => ({
      ApplicationId: project.ApplicationId,
      ServiceId: project.ServiceId,
      ServiceTitle: project.ServiceTitle,
      ServiceImage: project.ServiceImage,
      ServicePrice: project.ServicePrice,
      Status: project.ApplicationStatus,
      PostType: project.PostType,
      ProofImage: project.ProofImage,
      ServiceOwnerId: project.ServiceOwnerId,
      ApplicantId: project.ApplicantId,
      FreelancerId: project.FreelancerId,
      FreelancerName: project.FreelancerName,
      TransactionId: project.TransactionId,
      PaymentStatus: project.PaymentStatus,
      // Add role-specific flags
      isServiceOwner: project.ServiceOwnerId === userId,
      isApplicant: project.ApplicantId === userId,
      canUploadProof: (project.FreelancerId === userId && 
        (project.ApplicationStatus === 'Completed' || project.ApplicationStatus === 'Proof Rejected')),
      canMarkCompleted: (project.FreelancerId === userId && project.ApplicationStatus === 'Service Started'),
      canMakePayment: (project.PostType === 'client' ? 
        (project.ServiceOwnerId === userId) : (project.ApplicantId === userId)) && 
        project.ApplicationStatus === 'Service Started'
    }));

    res.json(formattedProjects);

  } catch (error) {
    console.error('Error fetching active projects:', error);
    res.status(500).json({ error: 'Failed to fetch active projects' });
  }
});

// Mark service as completed
router.patch('/:applicationId/complete', authenticateToken, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.user.id;

  try {
    const pool = await getPool();

    // Verify user's permission and current status
    const [application] = await pool.query(
      `SELECT a.*, s.PostType, s.SellerId
       FROM Applications a
       JOIN Services s ON a.ServiceId = s.ServiceId
       WHERE a.ApplicationId = ?`,
      [applicationId]
    );

    if (!application[0]) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isFreelancer = application[0].PostType === 'client' ? 
      application[0].UserId === userId : 
      application[0].SellerId === userId;

    if (!isFreelancer) {
      return res.status(403).json({ error: 'Only the freelancer can mark the service as completed' });
    }

    if (application[0].Status !== 'Service Started') {
      return res.status(400).json({ error: 'Service must be in "Service Started" status to be marked as completed' });
    }

    // Update application status
    await pool.query(
      'UPDATE Applications SET Status = "Completed", UpdatedAt = NOW() WHERE ApplicationId = ?',
      [applicationId]
    );

    res.json({ message: 'Service marked as completed' });

  } catch (error) {
    console.error('Error marking service as completed:', error);
    res.status(500).json({ error: 'Failed to mark service as completed' });
  }
});

// Upload proof of completion
router.post('/:applicationId/proof', authenticateToken, async (req, res) => {
  const { applicationId } = req.params;
  const { proofImage } = req.body;
  const userId = req.user.id;

  try {
    const pool = await getPool();

    // Verify user's permission and current status
    const [application] = await pool.query(
      `SELECT a.*, s.PostType, s.SellerId
       FROM Applications a
       JOIN Services s ON a.ServiceId = s.ServiceId
       WHERE a.ApplicationId = ?`,
      [applicationId]
    );

    if (!application[0]) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isFreelancer = application[0].PostType === 'client' ? 
      application[0].UserId === userId : 
      application[0].SellerId === userId;

    if (!isFreelancer) {
      return res.status(403).json({ error: 'Only the freelancer can upload proof' });
    }

    if (!['Completed', 'Proof Rejected'].includes(application[0].Status)) {
      return res.status(400).json({ error: 'Service must be completed or proof rejected to upload proof' });
    }

    // Update application with proof
    await pool.query(
      'UPDATE Applications SET ProofImage = ?, Status = "Proof Submitted", UpdatedAt = NOW() WHERE ApplicationId = ?',
      [proofImage, applicationId]
    );

    res.json({ message: 'Proof uploaded successfully' });

  } catch (error) {
    console.error('Error uploading proof:', error);
    res.status(500).json({ error: 'Failed to upload proof' });
  }
});

module.exports = router; 