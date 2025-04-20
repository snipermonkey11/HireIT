const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only jpg, jpeg, png
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
            console.log(`✅ Accepting file with mimetype: ${file.mimetype}`);
            cb(null, true);
        } else {
            console.log(`❌ Rejecting file with mimetype: ${file.mimetype}`);
            cb(new Error(`Only JPG, JPEG and PNG files are allowed! Received: ${file.mimetype}`), false);
        }
    }
});

// Get all services with filters
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const { search, category, type } = req.query;
        
        console.log('Search request params:', { search, category, type });
        
        // Build base query
        let query = `
            SELECT 
                s.ServiceId,
                s.Title,
                s.Description,
                s.Price,
                s.Photo,
                s.Category,
                s.Status,
                s.PostType,
                s.CreatedAt,
                s.UpdatedAt,
                u.UserId as SellerId,
                u.FullName as SellerName,
                u.Photo as SellerPhoto
            FROM Services s
            JOIN Users u ON s.SellerId = u.UserId
            WHERE s.Status = 'Active'
        `;

        // Create a request object for parameters
        const request = pool.request();

        // Add basic search parameter if it exists
        if (search && typeof search === 'string' && search.trim() !== '') {
            const searchTerm = '%' + search.trim() + '%';
            query += ` AND (s.Title LIKE @search OR s.Description LIKE @search)`;
            request.input('search', sql.NVarChar, searchTerm);
            console.log('Adding search filter:', searchTerm);
        }

        // Add category parameter if it exists
        if (category && typeof category === 'string' && category.trim() !== '') {
            query += ` AND s.Category = @category`;
            request.input('category', sql.NVarChar, category.trim());
            console.log('Adding category filter:', category.trim());
        }

        // Add post type filter if it exists
        if (type && type !== 'all') {
            query += ` AND s.PostType = @postType`;
            request.input('postType', sql.NVarChar, type);
            console.log('Adding post type filter:', type);
        }

        // Add ordering
        query += ` ORDER BY s.CreatedAt DESC`;
        
        console.log('Executing query:', query);
        
        // Execute the query
        const result = await request.query(query);
        console.log(`Query returned ${result.recordset.length} results`);
        
        // Format photos for frontend
        const services = result.recordset.map(service => {
            // Check if Photo field exists and is not empty
            if (service.Photo) {
                console.log(`Processing image for service ${service.ServiceId}, type: ${typeof service.Photo}`);
                
                // Only add prefix if it doesn't already have one
                if (typeof service.Photo === 'string' && !service.Photo.startsWith('data:image')) {
                    try {
                        service.Photo = `data:image/jpeg;base64,${service.Photo}`;
                        console.log(`Added prefix to service ${service.ServiceId} image`);
                    } catch (err) {
                        console.error(`Error formatting image for service ${service.ServiceId}:`, err);
                    }
                }
            } else {
                console.log(`No image for service ${service.ServiceId}`);
            }
            return service;
        });
        
        res.json(services);
        
    } catch (error) {
        console.error('Error fetching services:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch services',
            details: error.message 
        });
    }
});

// Get single service
router.get('/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const pool = await getPool();

        const query = `
            SELECT 
                s.ServiceId,
                s.Title,
                s.Description,
                s.Price,
                s.Photo,
                s.Category,
                s.Status,
                s.CreatedAt,
                s.UpdatedAt,
                u.UserId as SellerId,
                u.FullName as SellerName,
                u.Photo as SellerPhoto
            FROM Services s
            JOIN Users u ON s.SellerId = u.UserId
            WHERE s.ServiceId = @serviceId
        `;

        const result = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query(query);

        if (!result.recordset[0]) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Format photo for frontend
        const service = result.recordset[0];
        if (service.Photo && typeof service.Photo === 'string' && !service.Photo.startsWith('data:')) {
            service.Photo = `data:image/jpeg;base64,${service.Photo}`;
        }

        res.json(service);

    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ error: 'Failed to fetch service' });
    }
});

// Create new service
router.post('/', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const { title, description, price, category, postType } = req.body;
        const sellerId = req.user.userId;
        
        console.log('Creating new service with data:', {
            title, description, price, category, postType,
            hasPhoto: !!req.file,
            userId: sellerId
        });
        
        // Validate required fields
        if (!title || !description || !price || !category || !postType) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate post type
        if (!['client', 'freelancer'].includes(postType)) {
            return res.status(400).json({ error: 'Invalid post type. Must be either "client" or "freelancer"' });
        }

        // Convert photo to base64 if provided
        let photoData = null;
        if (req.file) {
            try {
                // Log file information
                console.log('File details:', {
                    filename: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                });
                
                photoData = req.file.buffer.toString('base64');
                console.log(`Converted uploaded image to base64, size: ${(req.file.size / 1024).toFixed(2)}KB`);
            } catch (err) {
                console.error('Error converting image to base64:', err);
            }
        }

        const pool = await getPool();
        
        // Insert with explicit timestamps
        const currentTimestamp = new Date();
        
        // Create service without photo first
        let insertQuery = `
            INSERT INTO Services (
                Title, 
                Description, 
                Price, 
                Category,
                PostType,
                SellerId, 
                Status,
                CreatedAt,
                UpdatedAt
            )
            VALUES (
                @title, 
                @description, 
                @price, 
                @category,
                @postType,
                @sellerId,
                'Active',
                @createdAt,
                @createdAt
            );
            
            SELECT SCOPE_IDENTITY() as ServiceId;
        `;

        const result = await pool.request()
            .input('title', sql.NVarChar, title)
            .input('description', sql.NVarChar, description)
            .input('price', sql.Decimal(10, 2), price)
            .input('category', sql.NVarChar, category)
            .input('postType', sql.NVarChar, postType)
            .input('sellerId', sql.Int, sellerId)
            .input('createdAt', sql.DateTime, currentTimestamp)
            .query(insertQuery);

        const serviceId = result.recordset[0].ServiceId;
        console.log(`Service created with ID: ${serviceId}`);
        
        // Update photo separately if provided
        if (photoData) {
            const updatePhotoQuery = `
                UPDATE Services
                SET Photo = @photo
                WHERE ServiceId = @serviceId
            `;
            
            await pool.request()
                .input('serviceId', sql.Int, serviceId)
                .input('photo', sql.NVarChar(sql.MAX), photoData)
                .query(updatePhotoQuery);
        }

        // Fetch the created service with seller details
        const serviceSelectQuery = `
            SELECT 
                s.ServiceId,
                s.Title,
                s.Description,
                s.Price,
                s.Photo,
                s.Category,
                s.SellerId,
                s.Status,
                s.CreatedAt,
                s.UpdatedAt,
                u.FullName as SellerName,
                u.Email as SellerEmail
            FROM Services s
            JOIN Users u ON s.SellerId = u.UserId
            WHERE s.ServiceId = @serviceId
        `;

        const serviceResult = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query(serviceSelectQuery);

        const service = serviceResult.recordset[0];
        
        // Add data:image prefix if needed
        if (service.Photo && typeof service.Photo === 'string' && !service.Photo.startsWith('data:')) {
            service.Photo = `data:image/jpeg;base64,${service.Photo}`;
        }

        res.status(201).json(service);

    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ error: 'Failed to create service: ' + error.message });
    }
});

// Update service
router.put('/:serviceId', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { title, description, price, category, status } = req.body;
        const userId = req.user.userId;

        const pool = await getPool();

        // Check if user owns the service
        const checkOwnership = await pool.request()
            .input('ServiceId', sql.Int, serviceId)
            .query(`
                SELECT s.SellerId, u.Role
                FROM Services s
                JOIN Users u ON s.SellerId = u.UserId
                WHERE s.ServiceId = @ServiceId
            `);

        if (checkOwnership.recordset.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const { SellerId, Role } = checkOwnership.recordset[0];
        if (SellerId !== userId && Role !== 'admin') {
            return res.status(403).json({ error: 'You do not have permission to edit this service' });
        }

        // Convert new photo to base64 if provided
        let photoData = null;
        if (req.file) {
            try {
                photoData = req.file.buffer.toString('base64');
                console.log(`Converted uploaded image to base64, length: ${photoData.length}`);
                
                // Validate that the base64 string is valid
                if (!photoData || photoData.length < 100) {
                    console.error('Image conversion produced invalid data');
                    photoData = null;
                }
            } catch (err) {
                console.error('Error converting image to base64:', err);
            }
        }

        // Check if we have Image column
        const columnCheck = await pool.request().query(`
            SELECT * 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Services' 
            AND COLUMN_NAME = 'Image'
        `);
        
        const hasImageColumn = columnCheck.recordset.length > 0;

        // Build update query with explicit UpdatedAt
        const currentTimestamp = new Date();
        let query = `
            UPDATE Services
            SET UpdatedAt = @updatedAt
        `;

        if (title) query += `, Title = @title`;
        if (description) query += `, Description = @description`;
        if (price) query += `, Price = @price`;
        if (category) query += `, Category = @category`;
        if (status) query += `, Status = @status`;
        if (photoData) {
            if (hasImageColumn) {
                query += `, Image = @photo`;
            } else {
                query += `, Photo = @photo`;
            }
        }

        query += ` WHERE ServiceId = @serviceId`;

        const request = pool.request()
            .input('serviceId', sql.Int, serviceId)
            .input('updatedAt', sql.DateTime, currentTimestamp);

        if (title) request.input('title', sql.NVarChar, title);
        if (description) request.input('description', sql.NVarChar, description);
        if (price) request.input('price', sql.Decimal(10, 2), price);
        if (category) request.input('category', sql.NVarChar, category);
        if (status) request.input('status', sql.NVarChar, status);
        if (photoData) request.input('photo', sql.NVarChar, photoData);

        await request.query(query);

        // Fetch updated service
        const updatedServiceResult = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query(`
                SELECT 
                    s.*,
                    u.FullName as SellerName,
                    u.Email as SellerEmail
                FROM Services s
                JOIN Users u ON s.SellerId = u.UserId
                WHERE s.ServiceId = @serviceId
            `);

        // Format photos for frontend
        const service = updatedServiceResult.recordset[0];
        if (service.Photo && typeof service.Photo === 'string' && !service.Photo.startsWith('data:')) {
            service.Photo = `data:image/jpeg;base64,${service.Photo}`;
        } else if (service.Image && typeof service.Image === 'string' && !service.Image.startsWith('data:')) {
            service.Photo = `data:image/jpeg;base64,${service.Image}`;
            delete service.Image; // Remove Image property from response
        }

        res.json(service);

    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// Delete service
router.delete('/:serviceId', verifyToken, async (req, res) => {
    let transaction;
    try {
        const { serviceId } = req.params;
        const userId = req.user.userId;
        const isAdmin = req.user.isAdmin;
        const pool = await getPool();

        // Check if service exists and get seller info
        const serviceCheck = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query('SELECT ServiceId, SellerId FROM Services WHERE ServiceId = @serviceId');

        if (!serviceCheck.recordset[0]) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const service = serviceCheck.recordset[0];

        // Check if user is authorized to delete (either admin or service owner)
        if (!isAdmin && service.SellerId !== userId) {
            return res.status(403).json({ error: 'Unauthorized - You can only delete your own services' });
        }

        // Start a transaction
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // First, delete related transactions
            await transaction.request()
                .input('serviceId', sql.Int, serviceId)
                .query(`
                    DELETE FROM dbo.Transactions
                    WHERE ApplicationId IN (
                        SELECT ApplicationId 
                        FROM dbo.Applications 
                        WHERE ServiceId = @serviceId
                    )
                `);

            // Then, delete related applications
            await transaction.request()
                .input('serviceId', sql.Int, serviceId)
                .query(`
                    DELETE FROM dbo.Applications
                    WHERE ServiceId = @serviceId
                `);

            // Finally, delete the service
            await transaction.request()
                .input('serviceId', sql.Int, serviceId)
                .query(`
                    DELETE FROM dbo.Services
                    WHERE ServiceId = @serviceId
                `);

            // Commit the transaction
            await transaction.commit();

            res.json({ message: 'Service and related records deleted successfully' });
        } catch (err) {
            // If there's an error, rollback the transaction
            if (transaction) await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({
            error: 'Failed to delete service',
            details: error.message
        });
    }
});

// Get categories
router.get('/categories/list', async (req, res) => {
    try {
        const pool = await getPool();
        
        try {
            const result = await pool.request()
                .query('SELECT DISTINCT Category FROM Services ORDER BY Category');
    
            const categories = result.recordset.map(row => row.Category);
            res.json(categories);
        } catch (queryError) {
            console.error('Database query error:', queryError);
            res.status(500).json({ 
                error: 'Failed to execute database query',
                details: queryError.message 
            });
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ 
            error: 'Failed to fetch categories',
            details: error.message 
        });
    }
});

// Get all services for admin
router.get('/admin/all', verifyToken, async (req, res) => {
    try {
        // Verify user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }

        const pool = await getPool();
        
        const query = `
            SELECT 
                s.ServiceId,
                s.Title,
                s.Description,
                s.Price,
                s.Photo,
                s.Category,
                s.Status,
                s.CreatedAt,
                s.UpdatedAt,
                u.UserId as SellerId,
                u.FullName as SellerName,
                u.Email as SellerEmail,
                u.Photo as SellerPhoto
            FROM Services s
            JOIN Users u ON s.SellerId = u.UserId
            ORDER BY s.CreatedAt DESC
        `;
        
        const result = await pool.request().query(query);
        
        // Format photos for frontend
        const services = result.recordset.map(service => {
            if (service.Photo && typeof service.Photo === 'string' && !service.Photo.startsWith('data:')) {
                service.Photo = `data:image/jpeg;base64,${service.Photo}`;
            }
            if (service.SellerPhoto && typeof service.SellerPhoto === 'string' && !service.SellerPhoto.startsWith('data:')) {
                service.SellerPhoto = `data:image/jpeg;base64,${service.SellerPhoto}`;
            }
            return service;
        });
        
        res.json(services);
        
    } catch (error) {
        console.error('Error fetching services for admin:', error);
        res.status(500).json({ 
            error: 'Failed to fetch services',
            details: error.message 
        });
    }
});

// Update service status
router.put('/:serviceId/status', verifyToken, async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;
        const isAdmin = req.user.isAdmin;
        
        // Validate status value
        const validStatuses = ['Active', 'Paused', 'Deleted'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status value',
                message: 'Status must be one of: Active, Paused, Deleted'
            });
        }
        
        const pool = await getPool();
        
        // Check if service exists and get seller info
        const serviceCheck = await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .query('SELECT ServiceId, SellerId FROM Services WHERE ServiceId = @serviceId');
            
        if (!serviceCheck.recordset[0]) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        const service = serviceCheck.recordset[0];
        
        // Check if user is authorized to update status (either admin or service owner)
        if (!isAdmin && service.SellerId !== userId) {
            return res.status(403).json({ 
                error: 'Unauthorized - You can only update status for your own services' 
            });
        }
        
        // Update service status
        await pool.request()
            .input('serviceId', sql.Int, serviceId)
            .input('status', sql.VarChar(50), status)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Services
                SET Status = @status,
                    UpdatedAt = @updatedAt
                WHERE ServiceId = @serviceId
            `);
            
        res.json({ 
            message: 'Service status updated successfully',
            serviceId,
            status 
        });
        
    } catch (error) {
        console.error('Error updating service status:', error);
        res.status(500).json({ 
            error: 'Failed to update service status',
            details: error.message 
        });
    }
});

// Fix database - PUBLIC endpoint with no auth required for emergency fixes
router.get('/fix-database', async (req, res) => {
    try {
        const pool = await getPool();
        
        console.log('Running SQL to fix the database...');
        
        // First, check if Image column exists and needs to be fixed
        const columnCheck = await pool.request().query(`
            SELECT * 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Services' 
            AND COLUMN_NAME = 'Image'
        `);
        
        const hasImageColumn = columnCheck.recordset.length > 0;
        
        // Check if Photo column also exists
        const photoCheck = await pool.request().query(`
            SELECT * 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Services' 
            AND COLUMN_NAME = 'Photo'
        `);
        
        const hasPhotoColumn = photoCheck.recordset.length > 0;
        
        let columnFixResult = 'No column changes needed';
        
        if (hasImageColumn && hasPhotoColumn) {
            // Both columns exist, update Photo from Image and drop Image
            await pool.request().query(`
                UPDATE Services 
                SET Photo = Image 
                WHERE Photo IS NULL AND Image IS NOT NULL;
                
                ALTER TABLE Services DROP COLUMN Image;
            `);
            columnFixResult = 'Updated Photo from Image and dropped Image column';
        } else if (hasImageColumn && !hasPhotoColumn) {
            // Only Image exists, rename to Photo
            await pool.request().query(`
                EXEC sp_rename 'Services.Image', 'Photo', 'COLUMN';
            `);
            columnFixResult = 'Renamed Image column to Photo';
        }
        
        // Drop the problematic trigger
        await pool.request().query(`
            IF EXISTS (
                SELECT * 
                FROM sys.triggers 
                WHERE name = 'TR_Services_UpdatedAt'
            )
            BEGIN
                DROP TRIGGER TR_Services_UpdatedAt;
            END
            
            -- Update any null UpdatedAt values
            UPDATE Services 
            SET UpdatedAt = CreatedAt 
            WHERE UpdatedAt IS NULL;
        `);
        
        res.json({
            message: 'Database fixed successfully',
            fixes: {
                columnFix: columnFixResult,
                triggerDropped: 'Trigger TR_Services_UpdatedAt dropped if it existed',
                nullTimestampsFixed: 'Any null UpdatedAt values set to CreatedAt value'
            }
        });
    } catch (error) {
        console.error('Error fixing database:', error);
        res.status(500).json({ 
            error: 'Failed to fix database',
            details: error.message 
        });
    }
});

module.exports = router; 