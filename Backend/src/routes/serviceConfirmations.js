// Accept application endpoint
router.patch('/:applicationId/accept', authenticateToken, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.user.id;

  try {
    const pool = await getPool();

    // First, verify the user owns the service
    const [application] = await pool.query(
      `SELECT a.*, s.UserId as ServiceOwnerId, s.PostType 
       FROM Applications a 
       JOIN Services s ON a.ServiceId = s.ServiceId 
       WHERE a.ApplicationId = ? AND s.UserId = ?`,
      [applicationId, userId]
    );

    if (!application[0]) {
      return res.status(404).json({ error: 'Application not found or you do not have permission' });
    }

    // Begin transaction
    await pool.query('START TRANSACTION');

    try {
      // Update application status to Accepted
      await pool.query(
        'UPDATE Applications SET Status = "Accepted" WHERE ApplicationId = ?',
        [applicationId]
      );

      // Update other applications for this service to Rejected
      await pool.query(
        'UPDATE Applications SET Status = "Rejected" WHERE ServiceId = ? AND ApplicationId != ? AND Status = "Pending"',
        [application[0].ServiceId, applicationId]
      );

      // Create transaction record
      await pool.query(
        `INSERT INTO Transactions (ServiceId, ApplicationId, PayerId, PayeeId, Status)
         VALUES (?, ?, ?, ?, "Pending")`,
        [
          application[0].ServiceId,
          applicationId,
          application[0].PostType === 'client' ? application[0].ApplicantId : userId,
          application[0].PostType === 'client' ? userId : application[0].ApplicantId,
        ]
      );

      // Automatically start the service
      await pool.query(
        'UPDATE Applications SET Status = "Service Started" WHERE ApplicationId = ?',
        [applicationId]
      );

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: 'Application accepted and service started successfully',
        postType: application[0].PostType
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error accepting application:', error);
    res.status(500).json({ error: 'Failed to accept application' });
  }
}); 