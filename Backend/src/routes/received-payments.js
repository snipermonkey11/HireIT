const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get received payment details
router.get('/:applicationId', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        
        console.log(`Fetching payment details for applicationId: ${applicationId}, userId: ${userId}`);
        
        const pool = await getPool();

        // Log pool status
        console.log('Database pool obtained');

        // Check if application exists first - with error handling
        try {
            const appCheck = await pool.request()
                .input('applicationId', sql.Int, applicationId)
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        a.ApplicationId,
                        a.ServiceId,
                        a.UserId,
                        a.Status,
                        s.SellerId
                    FROM Applications a
                    JOIN Services s ON a.ServiceId = s.ServiceId
                    WHERE a.ApplicationId = @applicationId
                    AND (a.UserId = @userId OR s.SellerId = @userId)
                `);
            
            console.log('Application check completed', appCheck?.recordset?.length || 0, 'records found');
            
            if (!appCheck.recordset[0]) {
                return res.status(404).json({ 
                    error: 'Application not found',
                    details: 'Could not find application with provided ID or you do not have permission to view it'
                });
            }
        } catch (appCheckError) {
            console.error('Error during application check:', appCheckError);
            return res.status(500).json({
                error: 'Error verifying application',
                details: appCheckError.message
            });
        }

        // Now get transaction details
        const transaction = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .query(`
                SELECT TOP 1 * FROM Transactions 
                WHERE ApplicationId = @applicationId
            `);

        console.log('Transaction check result:', 
            transaction?.recordset?.length || 0, 
            'records found');

        // If transaction doesn't exist yet, create one
        if (!transaction.recordset[0]) {
            console.log(`Transaction not found for applicationId: ${applicationId}, creating new transaction`);
            
            try {
                // Get service price
                const serviceInfo = await pool.request()
                    .input('applicationId', sql.Int, applicationId)
                    .query(`
                        SELECT s.Price
                        FROM Applications a
                        JOIN Services s ON a.ServiceId = s.ServiceId
                        WHERE a.ApplicationId = @applicationId
                    `);
                    
                console.log('Service info found:', serviceInfo?.recordset[0]);
                
                const servicePrice = serviceInfo.recordset[0]?.Price || 0;
                const currentDate = new Date();
                
                // Create transaction
                const newTrans = await pool.request()
                    .input('applicationId', sql.Int, applicationId)
                    .input('amount', sql.Money, servicePrice)
                    .input('status', sql.VarChar(50), 'Pending')
                    .input('createdAt', sql.DateTime, currentDate)
                    .input('updatedAt', sql.DateTime, currentDate)
                    .query(`
                        INSERT INTO Transactions (
                            ApplicationId,
                            Amount,
                            Status,
                            CreatedAt,
                            UpdatedAt
                        )
                        OUTPUT INSERTED.*
                        VALUES (
                            @applicationId,
                            @amount,
                            @status,
                            @createdAt,
                            @updatedAt
                        )
                    `);
                
                console.log('New transaction created:', newTrans?.recordset[0]);
            } catch (transCreateError) {
                console.error('Error creating transaction:', transCreateError);
                return res.status(500).json({
                    error: 'Error creating transaction',
                    details: transCreateError.message
                });
            }
        }

        // Get full payment details with application and user info - with simplified query
        try {
            console.log('Attempting to fetch full payment details');
            
            const result = await pool.request()
                .input('applicationId', sql.Int, applicationId)
                .query(`
                    SELECT 
                        t.TransactionId,
                        t.ApplicationId,
                        t.Amount,
                        t.Status as PaymentStatus,
                        t.PaymentMethod,
                        t.ReferenceNumber,
                        t.PaymentDate,
                        t.CreatedAt,
                        t.UpdatedAt,
                        a.Status as ApplicationStatus,
                        a.UserId as ClientId,
                        s.Title as ServiceTitle,
                        s.Description as ServiceDescription,
                        s.Category as ServiceCategory,
                        s.Price as ServicePrice,
                        s.Photo as ServiceImage,
                        s.SellerId as ServiceOwnerId,
                        client.FullName as ClientName,
                        client.Email as ClientEmail,
                        owner.FullName as ServiceOwnerName,
                        owner.Email as ServiceOwnerEmail
                    FROM Transactions t
                    JOIN Applications a ON t.ApplicationId = a.ApplicationId
                    JOIN Services s ON a.ServiceId = s.ServiceId
                    JOIN Users client ON a.UserId = client.UserId
                    JOIN Users owner ON s.SellerId = owner.UserId
                    WHERE t.ApplicationId = @applicationId
                `);

            console.log('Result query completed', 
                result?.recordset?.length || 0, 
                'records found');

            if (!result.recordset[0]) {
                return res.status(404).json({
                    error: 'Payment details not found',
                    details: 'Could not retrieve payment information'
                });
            }

            // Format response
            const paymentDetails = {
                ...result.recordset[0],
                ServiceImage: result.recordset[0].ServiceImage || null
            };

            console.log('Successfully retrieved payment details for applicationId:', applicationId);
            res.json(paymentDetails);
        } catch (finalQueryError) {
            console.error('Error in final query:', finalQueryError);
            return res.status(500).json({
                error: 'Failed to fetch detailed payment information',
                details: finalQueryError.message,
                stack: process.env.NODE_ENV === 'development' ? finalQueryError.stack : undefined
            });
        }
    } catch (error) {
        console.error('Error fetching received payment details:', error);
        res.status(500).json({
            error: 'Failed to fetch payment details',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Mark payment as received
router.patch('/:applicationId/confirm', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        console.log(`Confirming payment for applicationId: ${applicationId}, userId: ${userId}`);

        // First verify that the user is the user for this application (client or freelancer)
        const verifyUser = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.UserId as ClientId,
                    s.SellerId as FreelancerId,
                    s.Title as ServiceTitle,
                    t.Status as CurrentStatus
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                LEFT JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                WHERE a.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);

        if (!verifyUser.recordset[0]) {
            return res.status(403).json({
                error: 'Unauthorized - You do not have permission to confirm this payment'
            });
        }

        const application = verifyUser.recordset[0];
        console.log('Application details:', application);

        // Update both transaction and application status
        try {
            // Start a transaction for data consistency
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            
            try {
                // First check if the status is already completed to avoid rollback
                const currentStatus = await transaction.request()
                    .input('applicationId', sql.Int, applicationId)
                    .query(`
                        SELECT t.Status, a.Status as AppStatus 
                        FROM Transactions t
                        JOIN Applications a ON t.ApplicationId = a.ApplicationId
                        WHERE t.ApplicationId = @applicationId
                    `);
                
                console.log('Current statuses:', currentStatus.recordset[0]);
                
                // Update only if not already completed
                await transaction.request()
                    .input('applicationId', sql.Int, applicationId)
                    .input('updatedAt', sql.DateTime, new Date())
                    .query(`
                        UPDATE Transactions
                        SET Status = 'Completed',
                            UpdatedAt = @updatedAt
                        WHERE ApplicationId = @applicationId;

                        UPDATE Applications
                        SET Status = 'Completed',
                            UpdatedAt = @updatedAt
                        WHERE ApplicationId = @applicationId;
                    `);
                
                // Verify the updates were successful
                const verifyUpdate = await transaction.request()
                    .input('applicationId', sql.Int, applicationId)
                    .query(`
                        SELECT t.Status as TransStatus, a.Status as AppStatus
                        FROM Transactions t
                        JOIN Applications a ON t.ApplicationId = a.ApplicationId
                        WHERE t.ApplicationId = @applicationId
                    `);
                
                console.log('Statuses after update:', verifyUpdate.recordset[0]);
                
                // Check if the update was successful
                if (verifyUpdate.recordset[0].TransStatus !== 'Completed') {
                    throw new Error('Failed to update transaction status to Completed');
                }
                
                await transaction.commit();
                console.log('Transaction committed successfully');
                
            } catch (updateError) {
                await transaction.rollback();
                console.error('Transaction rollback due to error:', updateError);
                throw updateError;
            }
        } catch (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({
                error: 'Failed to update payment status',
                details: transactionError.message
            });
        }

        // Get updated transaction details
        const result = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .query(`
                SELECT 
                    t.TransactionId,
                    t.ApplicationId,
                    t.Amount,
                    t.Status as PaymentStatus,
                    t.PaymentMethod,
                    t.ReferenceNumber,
                    t.PaymentDate,
                    t.CreatedAt,
                    t.UpdatedAt,
                    a.Status as ApplicationStatus,
                    s.Title as ServiceTitle
                FROM Transactions t
                JOIN Applications a ON t.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE t.ApplicationId = @applicationId
            `);

        // Determine if this was a proper confirmation or just marking as received
        const wasPaymentSent = application.CurrentStatus === 'Sent';
        const message = wasPaymentSent 
            ? 'Payment confirmed successfully' 
            : 'Payment marked as received successfully';

        res.json({
            message,
            transaction: result.recordset[0]
        });

    } catch (error) {
        console.error('Error confirming payment receipt:', error);
        res.status(500).json({
            error: 'Failed to confirm payment receipt',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router; 