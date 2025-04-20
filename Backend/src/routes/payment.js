const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Get payment details including seller's GCash QR
router.get('/:applicationId', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Check if application exists and user has permission
        const applicationCheck = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.*,
                    s.SellerId,
                    s.Title as ServiceTitle,
                    s.Price as ServicePrice,
                    u.GcashQr as SellerGcashQr,
                    u.FullName as SellerName,
                    f.FullName as FreelancerName,
                    f.GcashQr as FreelancerGcashQr
                FROM Applications a
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON s.SellerId = u.UserId
                JOIN Users f ON a.UserId = f.UserId
                WHERE a.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);

        if (!applicationCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Application not found or you do not have permission'
            });
        }

        // Check if payment record exists
        const paymentCheck = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .query(`
                SELECT *
                FROM Payments
                WHERE ApplicationId = @applicationId
            `);

        if (!paymentCheck.recordset[0]) {
            // Create new payment record
            await pool.request()
                .input('applicationId', sql.Int, applicationId)
                .input('amount', sql.Decimal(10,2), applicationCheck.recordset[0].ServicePrice)
                .input('status', sql.VarChar(50), 'Pending')
                .query(`
                    INSERT INTO Payments (
                        ApplicationId,
                        Amount,
                        Status,
                        CreatedAt,
                        UpdatedAt
                    )
                    VALUES (
                        @applicationId,
                        @amount,
                        @status,
                        GETDATE(),
                        GETDATE()
                    )
                `);
        }

        // Get complete payment details
        const result = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .query(`
                SELECT 
                    p.*,
                    a.Status as ApplicationStatus,
                    s.Title as ServiceTitle,
                    s.Description as ServiceDescription,
                    s.Price as Amount,
                    s.Category as ServiceCategory,
                    s.Photo as ServiceImage,
                    u.FullName as SellerName,
                    u.GcashQr as SellerGcashQr,
                    f.FullName as FreelancerName,
                    f.GcashQr as FreelancerGcashQr
                FROM Payments p
                JOIN Applications a ON p.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON s.SellerId = u.UserId
                JOIN Users f ON a.UserId = f.UserId
                WHERE p.ApplicationId = @applicationId
            `);

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error in payment details:', error);
        res.status(500).json({
            error: 'Failed to get payment details',
            details: error.message
        });
    }
});

// Update payment status and method
router.patch('/:applicationId/status', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, paymentMethod, referenceNumber } = req.body;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify user's permission
        const paymentCheck = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT p.*, a.UserId as FreelancerId, s.SellerId
                FROM Payments p
                JOIN Applications a ON p.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE p.ApplicationId = @applicationId
                AND (a.UserId = @userId OR s.SellerId = @userId)
            `);

        if (!paymentCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Payment not found or you do not have permission'
            });
        }

        // Update payment status and details
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('status', sql.VarChar(50), status)
            .input('paymentMethod', sql.VarChar(50), paymentMethod)
            .input('referenceNumber', sql.VarChar(50), referenceNumber)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Payments
                SET Status = @status,
                    PaymentMethod = @paymentMethod,
                    ReferenceNumber = @referenceNumber,
                    UpdatedAt = @updatedAt
                WHERE ApplicationId = @applicationId
            `);

        // If payment is completed, update application status
        if (status === 'Completed') {
            await pool.request()
                .input('applicationId', sql.Int, applicationId)
                .input('status', sql.VarChar(50), 'In Progress')
                .query(`
                    UPDATE Applications
                    SET Status = @status,
                        UpdatedAt = GETDATE()
                    WHERE ApplicationId = @applicationId
                `);
        }

        res.json({
            message: 'Payment status updated successfully'
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({
            error: 'Failed to update payment status',
            details: error.message
        });
    }
});

// Confirm payment receipt
router.post('/:applicationId/confirm', verifyToken, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;
        const pool = await getPool();

        // Verify user is the seller
        const paymentCheck = await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('sellerId', sql.Int, userId)
            .query(`
                SELECT p.*
                FROM Payments p
                JOIN Applications a ON p.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                WHERE p.ApplicationId = @applicationId
                AND s.SellerId = @sellerId
            `);

        if (!paymentCheck.recordset[0]) {
            return res.status(404).json({
                error: 'Payment not found or you are not the seller'
            });
        }

        // Update payment and application status
        await pool.request()
            .input('applicationId', sql.Int, applicationId)
            .input('status', sql.VarChar(50), 'Completed')
            .input('completedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Payments
                SET Status = @status,
                    CompletedAt = @completedAt,
                    UpdatedAt = GETDATE()
                WHERE ApplicationId = @applicationId;

                UPDATE Applications
                SET Status = 'In Progress',
                    UpdatedAt = GETDATE()
                WHERE ApplicationId = @applicationId;
            `);

        res.json({
            message: 'Payment confirmed successfully'
        });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            error: 'Failed to confirm payment',
            details: error.message
        });
    }
});

module.exports = router; 