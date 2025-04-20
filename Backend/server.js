require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sql, getPool } = require('./src/config/database');
const http = require('http');
const socketIo = require('socket.io');

// Import routes
const userRoutes = require('./src/routes/users');
const serviceRoutes = require('./src/routes/services');
const applicationRoutes = require('./src/routes/applications');
const myApplicationsRoutes = require('./src/routes/my-applications');
const serviceConfirmationsRoutes = require('./src/routes/service-confirmations');
const activeProjectsRoutes = require('./src/routes/active-projects');
const projectStatusRoutes = require('./src/routes/project-status');
const transactionRoutes = require('./src/routes/transactions');
const receivedPaymentsRoutes = require('./src/routes/received-payments');
const transactionHistoryRoutes = require('./src/routes/transaction-history');
const reviewsRoutes = require('./src/routes/reviews');
const dashboardRoutes = require('./src/routes/dashboard');
const messagesRoutes = require('./src/routes/messages');

// Create upload directories if they don't exist
const uploadDir = path.join(__dirname, 'uploads');
const photoDir = path.join(uploadDir, 'photos');
const gcashDir = path.join(uploadDir, 'gcash');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir);
if (!fs.existsSync(gcashDir)) fs.mkdirSync(gcashDir);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Add response logging
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    
    // Log error responses
    if (res.statusCode >= 400) {
      console.error(`ERROR RESPONSE: ${body}`);
    }
    
    originalSend.call(this, body);
    return this;
  };
  
  next();
});

// Increase header size limit
app.use((req, res, next) => {
  res.setHeader('Connection', 'Keep-Alive');
  res.setHeader('Keep-Alive', 'timeout=600');
  next();
});

// Serve static files with caching headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Test route to check if server is running
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/user/applications', myApplicationsRoutes);
app.use('/api/service-confirmations', serviceConfirmationsRoutes);
app.use('/api/active', activeProjectsRoutes);
app.use('/api/status', projectStatusRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/received-payments', receivedPaymentsRoutes);
app.use('/api/transaction-history', transactionHistoryRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messagesRoutes);

// Health check endpoint for Azure
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// For Azure deployment - serve static files if in production
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the uploads directory
    app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
        maxAge: '1d',
        etag: true,
        lastModified: true
    }));
}

// Socket.IO connection handler
const connectedUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // User authentication
  socket.on('authenticate', (userData) => {
    if (userData && userData.userId) {
      console.log(`User ${userData.userId} authenticated`);
      
      // Associate socket with user ID
      socket.userId = userData.userId;
      connectedUsers[userData.userId] = socket.id;
      
      // Notify others that this user is online
      io.emit('user_status', { userId: userData.userId, isOnline: true });
    }
  });
  
  // Join a conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  });
  
  // Send a message
  socket.on('send_message', async (messageData) => {
    try {
      const { conversationId, content } = messageData;
      
      if (!socket.userId || !conversationId || !content) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }
      
      const pool = await getPool();
      
      // Check if the user is part of this conversation
      const conversationCheck = await pool.request()
        .input('conversationId', sql.Int, conversationId)
        .input('userId', sql.Int, socket.userId)
        .query(`
          SELECT ConversationId, User1Id, User2Id
          FROM Conversations 
          WHERE ConversationId = @conversationId
          AND (User1Id = @userId OR User2Id = @userId)
        `);
        
      if (conversationCheck.recordset.length === 0) {
        socket.emit('error', { message: 'Conversation not found or you are not a participant' });
        return;
      }
      
      // Get the other user in the conversation
      const conversation = conversationCheck.recordset[0];
      const otherUserId = conversation.User1Id === socket.userId ? conversation.User2Id : conversation.User1Id;
      
      // Insert the message
      const result = await pool.request()
        .input('conversationId', sql.Int, conversationId)
        .input('senderId', sql.Int, socket.userId)
        .input('content', sql.NVarChar(1000), content.trim())
        .query(`
          INSERT INTO Messages (ConversationId, SenderId, Content, IsRead, CreatedAt)
          OUTPUT INSERTED.MessageId, INSERTED.ConversationId, INSERTED.SenderId, 
                INSERTED.Content, INSERTED.IsRead, INSERTED.CreatedAt
          VALUES (@conversationId, @senderId, @content, 0, GETDATE())
        `);
      
      if (result.recordset.length === 0) {
        socket.emit('error', { message: 'Failed to save message' });
        return;
      }
      
      // Add unique ID components for frontend 
      const uniqueIdComponents = new Date().getTime();
      
      // Format the message
      const message = {
        id: result.recordset[0].MessageId,
        // Add a unique timestamp component to avoid duplicate IDs in clients
        uniqueTimestamp: uniqueIdComponents,
        conversationId: result.recordset[0].ConversationId,
        senderId: result.recordset[0].SenderId,
        content: result.recordset[0].Content,
        isRead: !!result.recordset[0].IsRead,
        createdAt: result.recordset[0].CreatedAt
      };
      
      // Log the message being sent
      console.log(`Socket message sent - ID: ${message.id}, ConversationId: ${message.conversationId}, From: ${message.senderId}`);
      
      // Emit the message to the conversation room
      io.to(`conversation:${conversationId}`).emit('new_message', message);
      
      // Emit notification to the other user if they're online
      if (connectedUsers[otherUserId]) {
        io.to(connectedUsers[otherUserId]).emit('message_notification', {
          conversationId,
          message
        });
      }
      
      // Confirm message was sent to the sender
      socket.emit('message_sent', message);
      
    } catch (error) {
      console.error('Error sending message via socket:', error);
      socket.emit('error', { message: 'Failed to send message', details: error.message });
    }
  });
  
  // Mark messages as read
  socket.on('mark_as_read', async (data) => {
    try {
      const { conversationId } = data;
      
      if (!socket.userId || !conversationId) {
        return;
      }
      
      const pool = await getPool();
      
      await pool.request()
        .input('conversationId', sql.Int, conversationId)
        .input('userId', sql.Int, socket.userId)
        .query(`
          UPDATE Messages
          SET IsRead = 1
          WHERE ConversationId = @conversationId
          AND SenderId != @userId
          AND IsRead = 0
        `);
      
      // Notify the other user that their messages have been read
      const conversationCheck = await pool.request()
        .input('conversationId', sql.Int, conversationId)
        .query(`
          SELECT User1Id, User2Id
          FROM Conversations
          WHERE ConversationId = @conversationId
        `);
      
      if (conversationCheck.recordset.length > 0) {
        const conversation = conversationCheck.recordset[0];
        const otherUserId = conversation.User1Id === socket.userId ? conversation.User2Id : conversation.User1Id;
        
        if (connectedUsers[otherUserId]) {
          io.to(connectedUsers[otherUserId]).emit('messages_read', { conversationId });
        }
      }
      
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });
  
  // User is typing
  socket.on('typing', (data) => {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      conversationId,
      userId: socket.userId
    });
  });
  
  // User stopped typing
  socket.on('stop_typing', (data) => {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
      conversationId,
      userId: socket.userId
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      // Remove the user from the connected users
      delete connectedUsers[socket.userId];
      
      // Notify others that this user is offline
      io.emit('user_status', { userId: socket.userId, isOnline: false });
    }
  });
});

// Pass Socket.IO instance to routes that need it
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    
    // Check for specific error types
    if (err.name === 'RequestError' || err.name === 'ConnectionError') {
        return res.status(503).json({ 
            error: 'Database connection error',
            details: err.message,
            code: 'DB_CONNECTION_ERROR'
        });
    }
    
    if (err.code === 'ETIMEOUT') {
        return res.status(504).json({ 
            error: 'Request timeout',
            details: 'The database request timed out',
            code: 'DB_TIMEOUT'
        });
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message,
        code: 'INTERNAL_ERROR'
    });
});

// Start server
async function startServer() {
    try {
        // Initialize database
        const pool = await getPool();
        await require('./src/config/database').setupDatabase();
        
        const PORT = process.env.PORT || 3000;
        
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 