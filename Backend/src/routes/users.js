const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/database');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Email configuration for Gmail
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    },
    // Add retry mechanism
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 3
});

// Verify email configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error('Email configuration error:', error);
        console.error('Email settings:', {
            host: 'smtp.gmail.com',
            port: 465,
            user: process.env.EMAIL_USER
        });
    } else {
        console.log('Gmail server is ready to send verification codes');
    }
});

// Helper function to send verification email with retries
const sendVerificationEmail = async (userEmail, verificationToken) => {
    const maxRetries = 3;
    let currentTry = 0;

    const attemptSend = async () => {
        try {
            const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
            
            console.log('Attempting to send verification email to:', userEmail);
            console.log('Using verification link:', verificationLink);
            
            const mailOptions = {
                from: {
                    name: "HireIT Support",
                    address: process.env.EMAIL_USER
                },
                to: userEmail,
                subject: 'Welcome to HireIT - Verify Your Email',
                priority: 'high',
                headers: {
                    'X-Priority': '1',
                    'X-MSMail-Priority': 'High',
                    'Importance': 'high'
                },
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Email Verification</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            
                            body {
                                font-family: 'Segoe UI', Arial, sans-serif;
                                line-height: 1.6;
                                background-color: #fff5e6;
                                padding: 20px;
                            }
                            
                            .email-container {
                                max-width: 600px;
                                margin: 0 auto;
                                background-color: #ffffff;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 12px rgba(128, 0, 0, 0.15);
                                border: 2px solid #800000;
                            }
                            
                            .header {
                                background-color: #800000;
                                padding: 40px 20px;
                                text-align: center;
                            }
                            
                            .welcome-text {
                                font-size: 18px;
                                text-transform: uppercase;
                                letter-spacing: 3px;
                                margin-bottom: 15px;
                                color: #FFD700;
                                font-weight: 600;
                            }
                            
                            .title {
                                font-size: 42px;
                                font-weight: 800;
                                margin: 0;
                                color: #FFD700;
                                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                                letter-spacing: 2px;
                            }
                            
                            .content {
                                padding: 40px;
                                text-align: center;
                                background-color: #ffffff;
                            }
                            
                            .verification-title {
                                color: #800000;
                                font-size: 28px;
                                font-weight: 700;
                                margin-bottom: 20px;
                            }
                            
                            .message-text {
                                color: #800000;
                                font-size: 16px;
                                margin-bottom: 25px;
                            }
                            
                            .verification-button {
                                display: inline-block;
                                background: linear-gradient(45deg, #800000, #a52a2a);
                                color: #FFD700 !important;
                                text-decoration: none;
                                padding: 16px 40px;
                                border-radius: 30px;
                                font-weight: 600;
                                font-size: 16px;
                                margin: 25px 0;
                                border: 2px solid #FFD700;
                                transition: all 0.3s ease;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                            }
                            
                            .verification-button:hover {
                                background: linear-gradient(45deg, #a52a2a, #800000);
                                transform: translateY(-2px);
                                box-shadow: 0 5px 15px rgba(128, 0, 0, 0.3);
                            }
                            
                            .note {
                                background-color: #fff5e6;
                                border: 2px solid #FFD700;
                                border-radius: 10px;
                                padding: 20px;
                                margin: 20px 0;
                                color: #800000;
                            }
                            
                            .link-text {
                                word-break: break-all;
                                color: #800000;
                                font-size: 14px;
                                padding: 12px;
                                background-color: #fff5e6;
                                border: 2px dashed #FFD700;
                                border-radius: 8px;
                                margin: 15px 0;
                                display: inline-block;
                                width: 100%;
                            }
                            
                            .warning-text {
                                color: #800000;
                                margin-top: 12px;
                                font-weight: 600;
                            }
                            
                            .security-notice {
                                background-color: #fff5e6;
                                border: 2px solid #800000;
                                border-radius: 10px;
                                padding: 20px;
                                margin-top: 25px;
                                color: #800000;
                            }
                            
                            .security-title {
                                color: #800000;
                                font-weight: 700;
                                margin-bottom: 10px;
                                font-size: 16px;
                            }
                            
                            .footer {
                                background-color: #800000;
                                padding: 25px 20px;
                                text-align: center;
                            }
                            
                            .footer p {
                                color: #FFD700;
                                margin: 5px 0;
                            }
                            
                            .copyright {
                                font-weight: 600;
                                font-size: 14px;
                            }
                            
                            .university {
                                font-size: 16px;
                                margin: 8px 0;
                            }
                            
                            .disclaimer {
                                font-size: 12px;
                                opacity: 0.9;
                            }
                            
                            .divider {
                                height: 3px;
                                background: linear-gradient(90deg, #800000, #FFD700);
                                margin: 30px auto;
                                width: 80%;
                                border-radius: 2px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <p class="welcome-text">Welcome to</p>
                                <h1 class="title">HireIT</h1>
                            </div>
                            
                            <div class="content">
                                <h2 class="verification-title">Verify Your Email Address</h2>
                                <p class="message-text">
                                    We're excited to have you join our community! Please verify your email to get started.
                                </p>
                                
                                <a href="${verificationLink}" class="verification-button">
                                    Verify Email Address
                                </a>
                                
                                <div class="divider"></div>
                                
                                <div class="note">
                                    <p>If the button doesn't work, copy and paste this link:</p>
                                    <div class="link-text">
                                        ${verificationLink}
                                    </div>
                                    <p class="warning-text">
                                        ⚠️ This link will expire in 24 hours
                                    </p>
                                </div>
                                
                                <div class="security-notice">
                                    <p class="security-title">Security Notice</p>
                                    <p>If you didn't create an account with HireIT, please ignore this email.</p>
                                </div>
                            </div>
                            
                            <div class="footer">
                                <p class="copyright">© ${new Date().getFullYear()} HireIT</p>
                                <p class="university">Cebu Institute of Technology - University</p>
                                <p class="disclaimer">This is an automated message, please do not reply.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('Verification email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending verification email:', error.message);
            return false;
        }
    };

    while (currentTry < maxRetries) {
        currentTry++;
        if (await attemptSend()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between attempts
    }
    return false;
};

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const photoDir = path.join(uploadDir, 'photos');
const gcashDir = path.join(uploadDir, 'gcash');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir);
if (!fs.existsSync(gcashDir)) fs.mkdirSync(gcashDir);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'));
        }
        cb(null, true);
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const pool = await getPool();
        
        // Check if user exists and is not deleted
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`
                SELECT 
                    UserId, Email, PasswordHash, FullName, Role, IsVerified, IsDeleted,
                    StudentId, Grade, Section, Photo
                FROM Users 
                WHERE Email = @email
            `);
            
        const user = result.recordset[0];
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user is deleted
        if (user.IsDeleted) {
            return res.status(401).json({ 
                error: 'This account has been deactivated',
                deletedAt: user.DeletedAt
            });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.PasswordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.UserId,
                email: user.Email,
                role: user.Role,
                isAdmin: user.Role === 'admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Return user data and token
        res.json({
            token,
            user: {
                id: user.UserId,
                email: user.Email,
                fullName: user.FullName,
                role: user.Role,
                isAdmin: user.Role === 'admin',
                isVerified: user.IsVerified,
                studentId: user.StudentId,
                grade: user.Grade,
                section: user.Section,
                photo: user.Photo
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Failed to login', 
            details: error.message 
        });
    }
});

// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;
        console.log('Registration attempt:', { email, fullName });

        if (!email || !password || !fullName) {
            console.log('Missing required fields');
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!email.endsWith('@cit.edu')) {
            console.log('Invalid email domain:', email);
            return res.status(400).json({ error: 'Please use your institutional email (@cit.edu)' });
        }

        const pool = await getPool();

        // First check if the exact email exists
        const checkUser = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT Email, IsDeleted FROM Users WHERE Email = @email');

        if (checkUser.recordset.length > 0 && !checkUser.recordset[0].IsDeleted) {
            console.log('Email already registered');
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Check if this is a previously deleted account (by searching for email with .deleted. suffix)
        const checkDeletedQuery = `
            SELECT UserId, Email, DeletedAt, IsDeleted 
            FROM Users 
            WHERE Email LIKE @emailPattern AND IsDeleted = 1
        `;
        
        const checkDeleted = await pool.request()
            .input('emailPattern', sql.VarChar, email + '.deleted.%')
            .query(checkDeletedQuery);
        
        let userId;
        
        if (checkDeleted.recordset.length > 0) {
            // This is a previously deleted account - reactivate it
            console.log('Found previously deleted account, reactivating...');
            const deletedUser = checkDeleted.recordset[0];
            
            // Hash new password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Reactivate the account by updating it
            const reactivateResult = await pool.request()
                .input('userId', sql.Int, deletedUser.UserId)
                .input('email', sql.VarChar, email)
                .input('hashedPassword', sql.VarChar, hashedPassword)
                .input('fullName', sql.VarChar, fullName)
                .query(`
                    UPDATE Users
                    SET 
                        Email = @email,
                        PasswordHash = @hashedPassword,
                        FullName = @fullName,
                        IsDeleted = 0,
                        DeletedAt = NULL,
                        IsVerified = 0,
                        UpdatedAt = GETDATE()
                    WHERE UserId = @userId;
                    
                    SELECT @userId as UserId;
                `);
                
            userId = reactivateResult.recordset[0].UserId;
            console.log('Account reactivated with ID:', userId);
        } else {
            // Create a new user
            console.log('Creating new user...');
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const result = await pool.request()
                .input('email', sql.VarChar, email)
                .input('hashedPassword', sql.VarChar, hashedPassword)
                .input('fullName', sql.VarChar, fullName)
                .query(`
                    INSERT INTO Users (Email, PasswordHash, FullName, Role, IsVerified)
                    VALUES (@email, @hashedPassword, @fullName, 'user', 0);
                    SELECT SCOPE_IDENTITY() as UserId;
                `);

            userId = result.recordset[0].UserId;
            console.log('New user created with ID:', userId);
        }

        // Generate verification token
        const verificationToken = jwt.sign(
            { userId: userId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Send verification email with retries
        console.log('Attempting to send verification email...');
        const emailSent = await sendVerificationEmail(email, verificationToken);

        if (!emailSent) {
            // If email fails, still create the account but inform the user
            console.log('Warning: Verification email could not be sent');
            return res.status(201).json({
                message: 'Account created but verification email could not be sent. Please use the resend verification option.',
                userId: userId,
                email: email,
                verificationEmailSent: false
            });
        }

        console.log('Registration successful, verification email sent');
        return res.status(201).json({
            message: 'Registration successful! Please check your email to verify your account.',
            userId: userId,
            email: email,
            verificationEmailSent: true
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({
            error: 'Registration failed',
            details: error.message
        });
    }
});

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const pool = await getPool();

        // Check if user exists and isn't already verified
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT UserId, Email, IsVerified FROM Users WHERE UserId = @userId');

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.recordset[0];

        if (user.IsVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        // Update user verification status
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('UPDATE Users SET IsVerified = 1 WHERE UserId = @userId');

        console.log(`Email verified successfully for user: ${user.Email}`);

        return res.json({
            message: 'Email verified successfully',
            email: user.Email,
            isEmailVerified: true
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Verification link has expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid verification token' });
        }

        console.error('Email verification error:', error);
        return res.status(500).json({ error: 'Error verifying email' });
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        // Check if user exists
        const pool = await getPool();
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT UserId, FullName, IsVerified FROM Users WHERE Email = @email');

        const user = result.recordset[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.IsVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        // Generate new verification token
        const verificationToken = jwt.sign(
            { userId: user.UserId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        res.json({ message: 'Verification email sent successfully' });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to resend verification email' });
    }
});

// Update profile route
router.put('/profile', async (req, res) => {
    try {
        const { userId, studentId, grade, section, fullName, email } = req.body;

        // Validate required fields
        if (!userId || !studentId || !grade || !section) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Log the update attempt
        console.log('Updating profile for user:', userId);

        // Update user profile
        const pool = await getPool();
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('studentId', sql.Int, studentId)
            .input('grade', sql.Int, grade)
            .input('section', sql.VarChar, section)
            .input('fullName', sql.VarChar, fullName)
            .input('email', sql.VarChar, email)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Users
                SET StudentId = @studentId,
                    Grade = @grade,
                    Section = @section,
                    FullName = @fullName,
                    Email = @email,
                    UpdatedAt = @updatedAt
                WHERE UserId = @userId
            `);

        console.log('Profile updated successfully');
        res.json({ 
            message: 'Profile updated successfully',
            profile: {
                userId,
                studentId,
                grade,
                section,
                fullName,
                email
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile. Please try again.' });
    }
});

// Delete non-admin users route
router.delete('/delete-users', async (req, res) => {
    try {
        // First check if the request is from an admin
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Delete all non-admin users
        const pool = await getPool();
        const result = await pool.request()
            .query('DELETE FROM Users WHERE Role != @adminRole');

        console.log('Deleted users count:', result.rowsAffected[0]);

        res.json({ 
            message: 'Non-admin users deleted successfully',
            deletedCount: result.rowsAffected[0]
        });

    } catch (error) {
        console.error('Delete users error:', error);
        res.status(500).json({ error: 'Failed to delete users' });
    }
});

// Reset admin password route (temporary, remove after use)
router.post('/reset-admin', async (req, res) => {
    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Update admin password
        const pool = await getPool();
        await pool.request()
            .input('hashedPassword', sql.VarChar, hashedPassword)
            .query('UPDATE Users SET PasswordHash = @hashedPassword WHERE Email = @email AND Role = @adminRole');

        res.json({ message: 'Admin password reset successfully' });

    } catch (error) {
        console.error('Reset admin password error:', error);
        res.status(500).json({ error: 'Failed to reset admin password' });
    }
});

// Get all users endpoint
router.get('/all', async (req, res) => {
    try {
        const pool = await getPool();
        
        const result = await pool.request().query(`
            SELECT 
                UserId,
                Email,
                FullName,
                StudentId,
                Grade,
                Section,
                Role,
                IsVerified,
                IsDeleted,
                CreatedAt,
                UpdatedAt,
                Photo,
                GcashQr,
                CASE 
                    WHEN IsDeleted = 1 THEN 'Deleted'
                    WHEN IsVerified = 0 THEN 'Pending'
                    ELSE 'Active'
                END as Status
            FROM Users
            ORDER BY CreatedAt DESC
        `);

        const users = result.recordset.map(user => ({
            userId: user.UserId,
            email: user.Email,
            fullName: user.FullName,
            studentId: user.StudentId,
            grade: user.Grade,
            section: user.Section,
            isAdmin: user.Role === 'admin',
            status: user.Status,
            isDeleted: user.IsDeleted,
            createdAt: user.CreatedAt,
            updatedAt: user.UpdatedAt,
            photo: user.Photo,
            gcashQr: user.GcashQr
        }));

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Delete (deactivate) a user
router.delete('/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUser = req.user;
        
        // Allow deletion only if:
        // 1. User is deleting their own account OR
        // 2. User is an admin (based on role)
        if (currentUser.userId !== parseInt(userId) && currentUser.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Unauthorized: Only admins or the account owner can delete this account' 
            });
        }

        const pool = await getPool();

        // First, ensure necessary columns exist
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'IsDeleted'
            )
            BEGIN
                ALTER TABLE Users ADD IsDeleted BIT NOT NULL DEFAULT 0;
            END

            IF NOT EXISTS (
                SELECT 1 FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'DeletedAt'
            )
            BEGIN
                ALTER TABLE Users ADD DeletedAt DATETIME NULL;
            END
        `);

        // Check if the user being deleted is an admin
        const userToDelete = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Role FROM Users WHERE UserId = @userId');
            
        if (userToDelete.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Don't allow deletion of admin users unless it's self-deletion
        if (userToDelete.recordset[0].Role === 'admin' && currentUser.userId !== parseInt(userId)) {
            return res.status(403).json({ error: 'Admin accounts can only be deleted by the account owner' });
        }

        // Update user to mark as deleted
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('deletedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Users
                SET 
                    IsDeleted = 1,
                    DeletedAt = @deletedAt,
                    Email = Email + '.deleted.' + CAST(GETDATE() AS varchar(50)),
                    UpdatedAt = GETDATE()
                WHERE UserId = @userId;
                
                SELECT @@ROWCOUNT as count;
            `);

        if (result.recordset[0].count === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return appropriate message based on who initiated the deletion
        const isOwnAccount = currentUser.userId === parseInt(userId);
        res.json({ 
            message: isOwnAccount ? 'Your account was successfully deactivated' : 'Account successfully deactivated',
            userId: userId
        });

    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ 
            error: 'Failed to deactivate account', 
            details: error.message 
        });
    }
});

// Suspend user endpoint (protected, admin only)
router.put('/:userId/suspend', async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if user exists
        const pool = await getPool();
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT UserId, Role FROM Users WHERE UserId = @userId');

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow suspension of admin users
        if (userCheck.recordset[0].Role === 'admin') {
            return res.status(403).json({ error: 'Cannot suspend admin users' });
        }

        // Update user status to suspended
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('UPDATE Users SET IsVerified = 0 WHERE UserId = @userId');

        res.json({ message: 'User suspended successfully' });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// Test email route
router.post('/test-email', async (req, res) => {
    try {
        const testMailOptions = {
            from: process.env.EMAIL_USER,
            to: req.body.email, // The test recipient email
            subject: 'HireIT Email Test',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>HireIT Email Test</h2>
                    <p>This is a test email to verify the email configuration is working correctly.</p>
                    <p>If you received this, the email system is working!</p>
                </div>
            `
        };

        const pool = await getPool();
        await pool.request()
            .input('testMailOptions', sql.VarChar, JSON.stringify(testMailOptions))
            .query('EXEC SendTestEmail @testMailOptions');

        res.json({ message: 'Test email sent successfully!' });
    } catch (error) {
        console.error('Email test error:', error);
        res.status(500).json({ error: 'Failed to send test email', details: error.message });
    }
});

// Create profile route
router.post('/profile', async (req, res) => {
    try {
        const { userId, studentId, grade, section } = req.body;
        console.log('Received profile data:', req.body);

        // Validate required fields
        if (!userId || !studentId || !grade || !section) {
            console.log('Missing required fields:', { userId, studentId, grade, section });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate data types
        if (!Number.isInteger(userId) || !Number.isInteger(grade)) {
            console.log('Invalid data types:', { userId, grade });
            return res.status(400).json({ error: 'Invalid data types. userId and grade must be integers.' });
        }

        // Validate studentId format (XX-XXXX-XXX)
        if (typeof studentId !== 'string' && typeof studentId !== 'number') {
            console.log('Invalid studentId type:', typeof studentId);
            return res.status(400).json({ error: 'Invalid studentId type. Must be a string in XX-XXXX-XXX format or a number.' });
        }

        // Format studentId appropriately based on type
        let formattedStudentId = studentId;
        if (typeof studentId === 'string' && /^\d{2}-\d{4}-\d{3}$/.test(studentId)) {
            // Already correctly formatted, keep as is
            formattedStudentId = studentId;
        } else if (typeof studentId === 'number') {
            // Convert number to formatted string
            const studentIdStr = studentId.toString().padStart(9, '0');
            formattedStudentId = `${studentIdStr.substring(0, 2)}-${studentIdStr.substring(2, 6)}-${studentIdStr.substring(6, 9)}`;
        }

        // Check if user exists
        const pool = await getPool();
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT UserId, Email, IsDeleted FROM Users WHERE UserId = @userId');

        if (userCheck.recordset.length === 0) {
            console.log('User not found:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate a JWT token for the user
        const userEmail = userCheck.recordset[0].Email;
        const token = jwt.sign(
            { 
                userId: userId,
                email: userEmail,
                isAdmin: false
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update user profile
        const updateResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('studentId', sql.VarChar(15), formattedStudentId)
            .input('grade', sql.Int, grade)
            .input('section', sql.VarChar, section)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Users
                SET StudentId = @studentId,
                    Grade = @grade,
                    Section = @section,
                    UpdatedAt = @updatedAt
                WHERE UserId = @userId;

                SELECT UserId, Email, FullName, StudentId, Grade, Section, Role, IsVerified
                FROM Users
                WHERE UserId = @userId;
            `);

        const updatedUser = updateResult.recordset[0];
        console.log('Profile updated successfully:', updatedUser);

        res.json({ 
            message: 'Profile created successfully',
            profile: {
                userId: updatedUser.UserId,
                email: updatedUser.Email,
                fullName: updatedUser.FullName,
                studentId: updatedUser.StudentId,
                grade: updatedUser.Grade,
                section: updatedUser.Section,
                isAdmin: updatedUser.Role === 'admin',
                isVerified: updatedUser.IsVerified
            },
            token: token
        });
    } catch (error) {
        console.error('Profile creation error:', error);
        res.status(500).json({ error: 'Failed to create profile. Please try again.' });
    }
});

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const pool = await getPool();
        
        // Get user profile data
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    UserId,
                    FullName,
                    Email,
                    Bio,
                    Photo,
                    GcashQr,
                    StudentId,
                    Grade,
                    Section,
                    CreatedAt,
                    UpdatedAt
                FROM Users
                WHERE UserId = @userId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.recordset[0];
        
        // Return user profile data
        res.json({
            userId: user.UserId,
            fullName: user.FullName,
            email: user.Email,
            bio: user.Bio,
            photo: user.Photo,
            gcashQr: user.GcashQr,
            studentId: user.StudentId,
            grade: user.Grade,
            section: user.Section,
            createdAt: user.CreatedAt,
            updatedAt: user.UpdatedAt
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            error: 'Failed to fetch user profile',
            details: error.message
        });
    }
});

// Update user profile
router.patch('/profile', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        const userId = req.user.userId;
        const { fullName, bio, photo, studentId, grade, section } = req.body;
        
        const pool = await getPool();
        
        // Build the update query dynamically based on provided fields
        let updateFields = [];
        let request = pool.request().input('userId', sql.Int, userId);
        
        if (fullName !== undefined) {
            updateFields.push('FullName = @fullName');
            request.input('fullName', sql.NVarChar(100), fullName);
        }
        
        if (bio !== undefined) {
            updateFields.push('Bio = @bio');
            request.input('bio', sql.NVarChar(500), bio);
        }
        
        if (photo !== undefined) {
            updateFields.push('Photo = @photo');
            request.input('photo', sql.NVarChar(500), photo);
        }
        
        if (studentId !== undefined) {
            updateFields.push('StudentId = @studentId');
            request.input('studentId', sql.NVarChar(50), studentId);
        }
        
        if (grade !== undefined) {
            updateFields.push('Grade = @grade');
            request.input('grade', sql.NVarChar(20), grade);
        }
        
        if (section !== undefined) {
            updateFields.push('Section = @section');
            request.input('section', sql.NVarChar(20), section);
        }
        
        // Add the updated timestamp
        updateFields.push('UpdatedAt = GETDATE()');
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update provided' });
        }
        
        // Execute the update query
        await request.query(`
            UPDATE Users
            SET ${updateFields.join(', ')}
            WHERE UserId = @userId
        `);
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            error: 'Failed to update profile',
            details: error.message
        });
    }
});

// Helper function to update user photo
const updateUserPhoto = async (userId, photoData) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('photo', sql.NVarChar(sql.MAX), photoData)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Users
                SET Photo = @photo,
                    UpdatedAt = @updatedAt
                WHERE UserId = @userId
            `);
        return true;
    } catch (error) {
        console.error('Error updating user photo:', error);
        return false;
    }
};

// Helper function to update GcashQr
const updateUserGcashQr = async (userId, qrData) => {
    try {
        console.log(`Updating GcashQr for user ${userId}, data length: ${qrData.length} chars`);
        
        const pool = await getPool();
        
        // First update the GcashQr without using OUTPUT clause
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('gcashQr', sql.NVarChar(sql.MAX), qrData)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Users
                SET GcashQr = @gcashQr,
                    UpdatedAt = @updatedAt
                WHERE UserId = @userId
            `);
            
        // Then query to verify the update worked
        const verifyResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT GcashQr 
                FROM Users 
                WHERE UserId = @userId
            `);
            
        if (verifyResult.recordset.length === 0) {
            console.error(`No user found with ID ${userId} for GcashQr update`);
            return false;
        }
        
        const updatedQr = verifyResult.recordset[0].GcashQr;
        if (!updatedQr) {
            console.error(`GcashQr was not updated properly for user ${userId}`);
            return false;
        }
        
        console.log(`GcashQr successfully updated for user ${userId}, stored length: ${updatedQr.length} chars`);
        return true;
    } catch (error) {
        console.error('Error updating GcashQr:', error);
        console.error('Error stack:', error.stack);
        console.error(`Error details - userId: ${userId}, data length: ${qrData ? qrData.length : 'null'}`);
        return false;
    }
};

// Update profile photo endpoint
router.post('/profile/photo', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No photo uploaded' });
        }

        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        const success = await updateUserPhoto(req.user.userId, imageData);
        
        if (success) {
            res.json({ 
                message: 'Profile photo updated successfully',
                photo: imageData
            });
        } else {
            res.status(500).json({ message: 'Failed to update profile photo' });
        }
    } catch (error) {
        console.error('Error in photo upload:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update GcashQr endpoint
router.post('/profile/gcash-qr', verifyToken, upload.single('gcashQr'), async (req, res) => {
    try {
        console.log('GCash QR upload request received from user:', req.user.userId);
        
        if (!req.file) {
            console.log('No QR code file received in the request');
            return res.status(400).json({ message: 'No QR code uploaded' });
        }

        console.log('File received:', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        console.log('Converting image to base64 and updating user GcashQr field');
        const success = await updateUserGcashQr(req.user.userId, imageData);
        
        if (success) {
            console.log('GcashQr updated successfully for user:', req.user.userId);
            res.json({ 
                message: 'GcashQr updated successfully',
                gcashQr: imageData
            });
        } else {
            console.error('Database update failed for GcashQr');
            res.status(500).json({ message: 'Failed to update GcashQr' });
        }
    } catch (error) {
        console.error('Error in GcashQr upload:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: 'Internal server error',
            details: error.message
        });
    }
});

// Get user profile by ID (for viewing other users' profiles)
router.get('/profile/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        if (!userId || isNaN(userId)) {
            console.log(`Invalid user ID provided: ${req.params.userId}`);
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        console.log(`Getting profile for user ID: ${userId}`);
        
        const pool = await getPool();
        
        // Get the user from the database with limited information (for privacy)
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    UserId as id,
                    FullName as fullName,
                    Email as email,
                    Photo as photo,
                    GcashQr as gcashQr,
                    StudentId as studentId,
                    Grade as grade,
                    Section as section,
                    Bio as bio,
                    CreatedAt as createdAt
                FROM Users
                WHERE UserId = @userId
            `);
            
        if (userResult.recordset.length === 0) {
            console.log(`User with ID ${userId} not found`);
            return res.status(404).json({ error: `User with ID ${userId} not found` });
        }
        
        const user = userResult.recordset[0];
        console.log(`Successfully retrieved user profile for ID: ${userId}`);
        
        // Get the user's reviews (as a seller)
        const reviewsResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    r.ReviewId,
                    r.Rating,
                    r.ReviewText,
                    r.CreatedAt,
                    u.FullName as ReviewerName,
                    u.Photo as ReviewerPhoto
                FROM Reviews r
                JOIN Applications a ON r.ApplicationId = a.ApplicationId
                JOIN Services s ON a.ServiceId = s.ServiceId
                JOIN Users u ON a.UserId = u.UserId
                WHERE s.SellerId = @userId
                ORDER BY r.CreatedAt DESC
            `);
            
        // Format the response
        const response = {
            ...user,
            reviews: reviewsResult.recordset.map(review => ({
                id: review.ReviewId,
                rating: review.Rating,
                text: review.ReviewText,
                createdAt: review.CreatedAt,
                reviewer: {
                    name: review.ReviewerName,
                    photo: review.ReviewerPhoto
                }
            }))
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ 
            error: 'Failed to fetch user profile',
            details: error.message
        });
    }
});

// Update user's GCash QR code
router.post('/gcash-qr', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { qrCodeImage } = req.body;
    
    if (!qrCodeImage) {
      return res.status(400).json({ error: 'QR code image is required' });
    }
    
    const pool = await getPool();
    
    // Update the user's GCash QR code
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('gcashQR', sql.VarChar(sql.MAX), qrCodeImage)
      .query(`
        UPDATE Users
        SET GcashQR = @gcashQR
        WHERE UserId = @userId
      `);
      
    res.status(200).json({ 
      success: true, 
      message: 'GCash QR code updated successfully'
    });
  } catch (error) {
    console.error('Error updating GCash QR code:', error);
    res.status(500).json({ error: 'Failed to update GCash QR code' });
  }
});

module.exports = router;
