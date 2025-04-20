const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get payment details by application ID
router.get('/:applicationId', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Please log in again' });
        }

        const pool = await getPool();

        // First check if application exists
        const result = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.ServiceId,
                    a.UserId as ClientId,
                    a.Status as ApplicationStatus,
                    s.Title as ServiceTitle,
                    s.Description as ServiceDescription,
                    s.Category as ServiceCategory,
                    s.Price as ServicePrice,
                    s.Photo as ServiceImage,
                    s.SellerId as ServiceOwnerId,
                    c.FullName as ClientName,
                    c.Email as ClientEmail,
                    so.FullName as ServiceOwnerName,
                    so.Email as ServiceOwnerEmail,
                    so.GcashQr as ServiceOwnerGcashQr,
                    t.TransactionId,
                    t.Amount,
                    t.Status as PaymentStatus,
                    t.PaymentMethod,
                    t.ReferenceNumber,
                    t.PaymentDate,
                    t.CreatedAt,
                    t.UpdatedAt,
                    t.CompletedAt
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users c ON a.UserId = c.UserId
                JOIN Users so ON s.SellerId = so.UserId
                LEFT JOIN Transactions t ON a.ApplicationId = t.ApplicationId
                WHERE a.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);

        if (!result.recordset[0]) {
            return res.status(404).json({ 
                error: 'Payment not found',
                details: 'Could not find payment details for this application'
            });
        }

        const application = result.recordset[0];

        // If no transaction exists, create one
        if (!application.TransactionId) {
            const newTransaction = await pool.request()
                .input('applicationId', sql.Int, applicationId)
                .input('amount', sql.Decimal(10,2), application.ServicePrice)
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
                        'Pending',
                        GETDATE(),
                        GETDATE()
                    )
                `);
            
            application.TransactionId = newTransaction.recordset[0].TransactionId;
            application.PaymentStatus = 'Pending';
            application.Amount = newTransaction.recordset[0].Amount;
        }

        res.json({
            ...application,
            ServiceImage: application.ServiceImage || '',
            ServiceOwnerGcashQr: application.ServiceOwnerGcashQr || ''
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get payment details' });
    }
});

// Update payment status
router.patch('/:applicationId/status', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, paymentMethod, referenceNumber } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Please log in again' });
        }

        const pool = await getPool();

        // Update transaction
        const result = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('status', sql.VarChar(50), status)
            .input('paymentMethod', sql.VarChar(50), paymentMethod)
            .input('referenceNumber', sql.VarChar(100), referenceNumber)
            .input('now', sql.DateTime, new Date())
            .query(`
                UPDATE Transactions
                SET 
                    Status = @status,
                    PaymentMethod = @paymentMethod,
                    ReferenceNumber = @referenceNumber,
                    PaymentDate = @now,
                    UpdatedAt = @now
                WHERE ApplicationId = @applicationId;

                UPDATE Applications
                SET Status = 'Payment Sent',
                    UpdatedAt = @now
                WHERE ApplicationId = @applicationId;

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
                    s.Title as ServiceTitle,
                    s.Price as ServicePrice
                FROM Transactions t
                JOIN Applications a ON t.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE t.ApplicationId = @applicationId
            `);

        if (!result.recordset[0]) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(result.recordset[0]);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// Get all payments for a user (either as client or freelancer)
router.get('/user/payments', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        const userId = req.user.userId;
        const pool = await getPool();

        console.log('User Payments Route Hit:', {
            method: 'GET',
            path: req.path,
            userId
        });

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    t.*,
                    a.ServiceId,
                    s.Title as ServiceTitle,
                    s.Description as ServiceDescription,
                    s.Category as ServiceCategory,
                    s.Price as ServicePrice,
                    uc.Name as ClientName,
                    uf.Name as FreelancerName,
                    uf.GcashQr as FreelancerGcashQr,
                    uf.Email as FreelancerEmail
                FROM Transactions t
                JOIN Applications a ON t.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users uc ON a.UserId = uc.UserId
                JOIN Users uf ON s.SellerId = uf.UserId
                WHERE a.UserId = @userId OR s.SellerId = @userId
                ORDER BY t.CreatedAt DESC
            `);

        // Format the GcashQr for each transaction
        const formattedResults = result.recordset.map(record => ({
            ...record,
            FreelancerGcashQr: record.FreelancerGcashQr ? record.FreelancerGcashQr.toString('base64') : null
        }));

        res.json(formattedResults);
    } catch (error) {
        console.error('Error fetching user payments:', error);
        res.status(500).json({
            error: 'Failed to fetch payments',
            details: error.message
        });
    }
});

// Add a new route to update GcashQr
router.patch('/update-gcash-qr', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        const userId = req.user.userId;
        const { gcashQr } = req.body;

        if (!gcashQr) {
            return res.status(400).json({ error: 'GcashQr is required' });
        }

        const pool = await getPool();

        // Update the user's GcashQr
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('gcashQr', sql.VarChar(sql.MAX), gcashQr)
            .query(`
                UPDATE Users
                SET GcashQr = @gcashQr
                OUTPUT INSERTED.GcashQr
                WHERE UserId = @userId
            `);

        if (!result.recordset[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            message: 'GcashQr updated successfully',
            gcashQr: result.recordset[0].GcashQr 
        });
    } catch (error) {
        console.error('Error updating GcashQr:', error);
        res.status(500).json({
            error: 'Failed to update GcashQr',
            details: error.message
        });
    }
});

module.exports = router; 