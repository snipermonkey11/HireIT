const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get transaction details
router.get('/:applicationId', verifyToken, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.user.userId;

  try {
    const pool = await getPool();
    
    console.log('Fetching transaction for applicationId:', applicationId, 'userId:', userId);

    // Get transaction details with service and user information
    const result = await pool.request()
      .input('applicationId', sql.Int, applicationId)
      .input('userId', sql.Int, userId)
      .query(`
        SELECT t.*, 
               s.Title as ServiceTitle, s.Price as ServicePrice, s.PostType,
               a.UserId as ApplicantId, s.SellerId as ServiceOwnerId,
               -- IMPORTANT: The naming below is based on ownership, NOT role
               -- 'client' is the service owner (which is actually the freelancer in freelancer services)
               -- 'freelancer' is the applicant (which is actually the client in freelancer services)
               -- For freelancer services, these names are opposite to their actual roles
               client.FullName as ClientName, client.Email as ClientEmail,
               freelancer.FullName as FreelancerName, freelancer.Email as FreelancerEmail,
               ISNULL(freelancer.GcashQR, '') as FreelancerGcashQR,
               a.Status as ApplicationStatus
        FROM Transactions t
        JOIN Applications a ON t.ApplicationId = a.ApplicationId
        JOIN Services s ON a.ServiceId = s.ServiceId
        JOIN Users client ON s.SellerId = client.UserId
        JOIN Users freelancer ON a.UserId = freelancer.UserId
        WHERE t.ApplicationId = @applicationId 
        AND (client.UserId = @userId OR freelancer.UserId = @userId)
      `);

    if (!result.recordset[0]) {
      console.log('Transaction not found for applicationId:', applicationId);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if the user is authorized to view this transaction
    const transaction = result.recordset[0];
    
    console.log('Transaction found:', JSON.stringify(transaction, null, 2));

    // Determine the correct roles based on post type
    let isClient, canPay;
    
    if (transaction.PostType.toLowerCase() === 'freelancer') {
      // For freelancer service posts:
      // - The applicant (not the service owner) is the CLIENT
      // - The service owner is the FREELANCER
      // IMPORTANT: This means the "FreelancerName" in the database is actually the CLIENT
      // and the "ClientName" is actually the FREELANCER for this post type
      isClient = transaction.ApplicantId === userId;
      
      // Client (applicant) can pay for freelancer services
      canPay = isClient && 
              transaction.Status === 'Pending' && 
              transaction.ApplicationStatus === 'Service Started';
    } else {
      // For client request posts:
      // - The service owner is the CLIENT
      // - The applicant is the FREELANCER
      // Here the naming in the database matches the roles
      isClient = transaction.ServiceOwnerId === userId;
      
      // Freelancer (applicant) can pay for client requests
      canPay = !isClient && // Freelancer pays
              transaction.Status === 'Pending' && 
              transaction.ApplicationStatus === 'Service Started';
    }
    
    const isFreelancer = !isClient;
    
    if (transaction.ApplicantId !== userId && transaction.ServiceOwnerId !== userId) {
      console.log('User not authorized to view this transaction');
      return res.status(403).json({ error: 'You are not authorized to view this transaction' });
    }

    // Format the response
    const response = {
      transactionId: transaction.TransactionId,
      serviceTitle: transaction.ServiceTitle,
      amount: transaction.ServicePrice,
      status: transaction.Status,
      postType: transaction.PostType,
      // For freelancer service posts, the client (applicant/payee) should be payer
      // For client request posts, maintain existing logic where service owner is payer
      payer: transaction.PostType.toLowerCase() === 'freelancer' ? 
        {
          id: transaction.ApplicantId,
          name: transaction.FreelancerName,
          email: transaction.FreelancerEmail
        } : 
        {
          id: transaction.ServiceOwnerId,
          name: transaction.ClientName,
          email: transaction.ClientEmail
        },
      // Corresponding payee based on post type
      payee: transaction.PostType.toLowerCase() === 'freelancer' ? 
        {
          id: transaction.ServiceOwnerId,
          name: transaction.ClientName,
          email: transaction.ClientEmail
        } : 
        {
          id: transaction.ApplicantId,
          name: transaction.FreelancerName,
          email: transaction.FreelancerEmail
        },
      canPay,
      isClient,
      // Add explicit role labels to assist frontend
      userRole: isClient ? 'client' : 'freelancer',
      payerRole: transaction.PostType.toLowerCase() === 'freelancer' ? 'client' : 'freelancer',
      payeeRole: transaction.PostType.toLowerCase() === 'freelancer' ? 'freelancer' : 'client',
      FreelancerGcashQR: transaction.FreelancerGcashQR
    };

    console.log('Sending updated response with corrected roles:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

// Process payment
router.post('/:transactionId/pay', verifyToken, async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.userId;

  try {
    const pool = await getPool();

    // Begin transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Get transaction details
      const result = await transaction.request()
        .input('transactionId', sql.Int, transactionId)
        .query(`
          SELECT t.*, s.PostType, s.Title as ServiceTitle,
                 payer.FullName as PayerName,
                 payee.FullName as PayeeName,
                 a.Status as ApplicationStatus
          FROM Transactions t
          JOIN Applications a ON t.ApplicationId = a.ApplicationId
          JOIN Services s ON a.ServiceId = s.ServiceId
          JOIN Users payer ON t.PayerId = payer.UserId
          JOIN Users payee ON t.PayeeId = payee.UserId
          WHERE t.TransactionId = @transactionId
        `);

      if (!result.recordset[0]) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const transactionDetails = result.recordset[0];

      // Verify that:
      // 1. The user is the payer
      // 2. The transaction is pending
      // 3. The application is in Service Started status
      // 4. The user is the client (for client posts) or the service owner (for freelancer posts)
      if (transactionDetails.PayerId !== userId || 
          transactionDetails.Status !== 'Pending' || 
          transactionDetails.ApplicationStatus !== 'Service Started') {
        await transaction.rollback();
        return res.status(403).json({ error: 'You are not authorized to make this payment' });
      }

      // Update transaction status
      await transaction.request()
        .input('transactionId', sql.Int, transactionId)
        .query('UPDATE Transactions SET Status = \'Completed\', UpdatedAt = GETDATE() WHERE TransactionId = @transactionId');

      // Create notifications for both parties
      await transaction.request()
        .input('payerId', sql.Int, transactionDetails.PayerId)
        .input('payeeId', sql.Int, transactionDetails.PayeeId)
        .input('payerMessage', sql.NVarChar(500), `Payment completed for "${transactionDetails.ServiceTitle}"`)
        .input('payeeMessage', sql.NVarChar(500), `Payment received for "${transactionDetails.ServiceTitle}"`)
        .query(`
          INSERT INTO Notifications (UserId, Message, Type, CreatedAt)
          VALUES 
            (@payerId, @payerMessage, 'PAYMENT_COMPLETED', GETDATE()),
            (@payeeId, @payeeMessage, 'PAYMENT_RECEIVED', GETDATE())
        `);

      // Commit transaction
      await transaction.commit();

      res.json({
        message: 'Payment processed successfully',
        transactionStatus: 'Completed'
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Update payment status
router.patch('/:applicationId/status', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, paymentMethod, referenceNumber } = req.body;
        const userId = req.user.userId;
        const pool = await getPool();

        // First update the transaction
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('status', sql.VarChar(50), status)
            .input('paymentMethod', sql.VarChar(50), paymentMethod)
            .input('referenceNumber', sql.VarChar(100), referenceNumber)
            .input('paymentDate', sql.DateTime, new Date())
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE [dbo].[Transactions]
                SET [Status] = @status,
                    [PaymentMethod] = @paymentMethod,
                    [ReferenceNumber] = @referenceNumber,
                    [PaymentDate] = @paymentDate,
                    [UpdatedAt] = @updatedAt
                WHERE [ApplicationId] = @applicationId;

                UPDATE [dbo].[Applications]
                SET [Status] = 'Payment Sent',
                    [UpdatedAt] = @updatedAt
                WHERE [ApplicationId] = @applicationId;

                SELECT 
                    t.[TransactionId],
                    t.[ApplicationId],
                    t.[Amount],
                    t.[Status] as PaymentStatus,
                    t.[PaymentMethod],
                    t.[ReferenceNumber],
                    t.[PaymentDate],
                    t.[CreatedAt],
                    t.[UpdatedAt],
                    a.[Status] as ApplicationStatus
                FROM [dbo].[Transactions] t
                JOIN [dbo].[Applications] a ON t.[ApplicationId] = a.[ApplicationId]
                WHERE t.[ApplicationId] = @applicationId
            `);

        res.json({ 
            message: 'Payment status updated successfully',
            applicationId: applicationId,
            status: status,
            paymentMethod: paymentMethod
        });

    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({
            error: 'Failed to update payment status',
            details: error.message
        });
    }
});

// Upload payment proof
router.post('/:applicationId/payment-proof', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { paymentProof } = req.body;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify user's permission
        const transaction = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT t.*, a.UserId as FreelancerId, s.SellerId
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                LEFT JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                WHERE a.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);

        if (!transaction.recordset[0]) {
            return res.status(404).json({
                error: 'Transaction not found or you do not have permission'
            });
        }

        // Update transaction with payment proof
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('paymentProof', sql.VarChar(sql.MAX), paymentProof)
            .input('paymentDate', sql.DateTime, new Date())
            .input('status', sql.VarChar(50), 'Sent')
            .query(`
                UPDATE Transactions
                SET PaymentProof = @paymentProof,
                    PaymentDate = @paymentDate,
                    Status = @status
                WHERE ApplicationId = @applicationId
            `);

        res.json({
            message: 'Payment proof uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading payment proof:', error);
        res.status(500).json({
            error: 'Failed to upload payment proof',
            details: error.message
        });
    }
});

// Get all transactions (admin only)
router.get('/', verifyToken, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT 
                    t.TransactionId,
                    t.ApplicationId,
                    t.Amount,
                    t.Status,
                    t.PaymentMethod,
                    t.ReferenceNumber,
                    t.PaymentDate,
                    t.CreatedAt,
                    s.Title as ServiceTitle,
                    u.FullName as ClientName,
                    seller.FullName as FreelancerName
                FROM Transactions t
                JOIN Applications a ON t.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                JOIN Users seller ON s.SellerId = seller.UserId
                ORDER BY t.CreatedAt DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Update transaction status (admin only)
router.patch('/:transactionId', verifyToken, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }

        const { transactionId } = req.params;
        const { status } = req.body;

        if (!['Pending', 'Completed', 'Failed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const pool = await getPool();
        const transaction = await pool.transaction();

        try {
            // Update transaction status
            await transaction.request()
                .input('transactionId', sql.Int, transactionId)
                .input('status', sql.VarChar(50), status)
                .input('updatedAt', sql.DateTime, new Date())
                .query(`
                    UPDATE Transactions 
                    SET Status = @status, 
                        UpdatedAt = @updatedAt,
                        CompletedAt = CASE WHEN @status = 'Completed' THEN @updatedAt ELSE CompletedAt END
                    WHERE TransactionId = @transactionId
                `);

            // If status is completed, update application status
            if (status === 'Completed') {
                await transaction.request()
                    .input('transactionId', sql.Int, transactionId)
                    .input('updatedAt', sql.DateTime, new Date())
                    .query(`
                        UPDATE Applications
                        SET Status = 'Payment Received',
                            UpdatedAt = @updatedAt
                        WHERE ApplicationId IN (
                            SELECT ApplicationId 
                            FROM Transactions 
                            WHERE TransactionId = @transactionId
                        )
                    `);
            }

            await transaction.commit();

            res.json({ message: 'Transaction status updated successfully' });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete transaction (admin only)
router.delete('/:transactionId', verifyToken, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }

        const { transactionId } = req.params;
        const pool = await getPool();
        
        // Check if transaction exists
        const checkResult = await pool.request()
            .input('transactionId', sql.Int, transactionId)
            .query('SELECT TransactionId FROM Transactions WHERE TransactionId = @transactionId');

        if (!checkResult.recordset[0]) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Delete the transaction
        await pool.request()
            .input('transactionId', sql.Int, transactionId)
            .query('DELETE FROM Transactions WHERE TransactionId = @transactionId');

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

module.exports = router; 