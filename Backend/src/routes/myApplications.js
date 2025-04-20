// Start service/project endpoint
router.patch('/:applicationId/start', authenticateToken, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.user.id;

  try {
    const pool = await getPool();

    // Begin transaction
    await pool.query('START TRANSACTION');

    try {
      // Get application details including service info
      const [applicationDetails] = await pool.query(
        `SELECT a.*, s.PostType, s.UserId as ServiceOwnerId, s.ServiceTitle,
                u.FullName as ServiceOwnerName, 
                app.FullName as ApplicantName
         FROM Applications a 
         JOIN Services s ON a.ServiceId = s.ServiceId
         JOIN Users u ON s.UserId = u.UserId
         JOIN Users app ON a.ApplicantId = app.UserId
         WHERE a.ApplicationId = ? AND (a.ApplicantId = ? OR s.UserId = ?)
         AND a.Status = 'Accepted'`,
        [applicationId, userId, userId]
      );

      if (!applicationDetails[0]) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ 
          error: 'Application not found or cannot be started. Make sure it is accepted and you are authorized.' 
        });
      }

      const application = applicationDetails[0];

      // Update application status
      await pool.query(
        'UPDATE Applications SET Status = "Service Started" WHERE ApplicationId = ?',
        [applicationId]
      );

      // Create or update transaction record
      const [existingTransaction] = await pool.query(
        'SELECT * FROM Transactions WHERE ApplicationId = ?',
        [applicationId]
      );

      if (!existingTransaction[0]) {
        // Create new transaction record
        await pool.query(
          `INSERT INTO Transactions (
            ServiceId, 
            ApplicationId, 
            PayerId, 
            PayeeId, 
            Status,
            CreatedAt
          ) VALUES (?, ?, ?, ?, "Pending", NOW())`,
          [
            application.ServiceId,
            applicationId,
            application.PostType === 'client' ? application.ApplicantId : application.ServiceOwnerId,
            application.PostType === 'client' ? application.ServiceOwnerId : application.ApplicantId,
          ]
        );
      }

      // Add notification for both parties
      const serviceOwnerNotification = {
        message: application.PostType === 'client'
          ? `${application.ApplicantName} has started the project for "${application.ServiceTitle}"`
          : `${application.ApplicantName} has started providing the service "${application.ServiceTitle}"`,
        type: 'SERVICE_STARTED',
        timestamp: new Date().toISOString(),
        userId: application.ServiceOwnerId
      };

      const applicantNotification = {
        message: application.PostType === 'client'
          ? `You have started the project "${application.ServiceTitle}" with ${application.ServiceOwnerName}`
          : `You have started providing the service "${application.ServiceTitle}" for ${application.ServiceOwnerName}`,
        type: 'SERVICE_STARTED',
        timestamp: new Date().toISOString(),
        userId: application.ApplicantId
      };

      // Store notifications in database
      await pool.query(
        'INSERT INTO Notifications (UserId, Message, Type, CreatedAt) VALUES (?, ?, ?, NOW()), (?, ?, ?, NOW())',
        [
          application.ServiceOwnerId, serviceOwnerNotification.message, serviceOwnerNotification.type,
          application.ApplicantId, applicantNotification.message, applicantNotification.type
        ]
      );

      // Commit transaction
      await pool.query('COMMIT');

      res.json({
        message: 'Service started successfully',
        postType: application.PostType,
        serviceTitle: application.ServiceTitle,
        serviceOwner: application.ServiceOwnerName,
        applicant: application.ApplicantName
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error starting service:', error);
    res.status(500).json({ error: 'Failed to start service' });
  }
}); 