const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { getPool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const applicationRoutes = require('./routes/applications');
const transactionRoutes = require('./routes/transactions');
const myApplicationsRouter = require('./routes/my-applications');
const projectStatusRoutes = require('./routes/project-status');
const activeProjectsRoutes = require('./routes/active-projects');

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', // Vite's default port
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log('\n--- Incoming Request ---');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Body:', req.body);
    console.log('Headers:', req.headers);
    console.log('----------------------\n');
    next();
});

// Database connection check middleware
app.use(async (req, res, next) => {
    try {
        const pool = await getPool();
        // Test the connection
        await pool.request().query('SELECT 1');
        next();
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ error: 'Database connection error' });
    }
});

// Handle trailing slashes consistently
app.use((req, res, next) => {
    if (req.path.slice(-1) === '/' && req.path.length > 1) {
        const query = req.url.slice(req.path.length);
        const safePath = req.path.slice(0, -1).replace(/\/+/g, '/');
        res.redirect(301, safePath + query);
    } else {
        next();
    }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
const servicesDir = path.join(uploadsDir, 'services');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(servicesDir)) {
    fs.mkdirSync(servicesDir);
}

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/user/applications', myApplicationsRouter);
app.use('/api/status', projectStatusRoutes);
app.use('/api/active', activeProjectsRoutes);

// Print registered routes
console.log('\n=== Registered Routes ===');
function printRoutes(stack, basePath = '') {
    stack.forEach(mw => {
        if (mw.route) {
            const methods = Object.keys(mw.route.methods).join(',').toUpperCase();
            console.log(`${methods} ${basePath}${mw.route.path}`);
        } else if (mw.name === 'router') {
            const regexp = mw.regexp.toString().replace('\\/?(?=\\/|$)', '').slice(2, -3);
            console.log(`\nRouter base path: ${regexp}`);
            if (mw.handle.stack) {
                mw.handle.stack.forEach(handler => {
                    if (handler.route) {
                        const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
                        console.log(`${methods} ${regexp}${handler.route.path}`);
                    }
                });
            }
        }
    });
}
printRoutes(app._router.stack);
console.log('=====================\n');

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('\n=== Error ===');
    console.error('Message:', err.message);
    console.error('Path:', req.path);
    console.error('Method:', req.method);
    console.error('Stack:', err.stack);
    console.error('============\n');
    
    res.status(500).json({ 
        error: 'Something broke!',
        details: err.message 
    });
});

// 404 handler - must be last
app.use((req, res) => {
    console.log('\n=== 404 Not Found ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Body:', req.body);
    console.log('===================\n');
    
    res.status(404).json({ 
        error: 'Not found',
        path: req.path,
        method: req.method
    });
});

// Start server only after database is initialized
async function startServer() {
    try {
        // Initialize database connection
        const pool = await getPool();
        console.log('Database connected successfully');

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`\nServer is running on port ${PORT}`);
            console.log('Available at: http://localhost:' + PORT);
            
            // Print all registered routes after server starts
            console.log('\nAvailable Routes:');
            app._router.stack.forEach(r => {
                if (r.route && r.route.path) {
                    console.log(`${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
                }
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app; 