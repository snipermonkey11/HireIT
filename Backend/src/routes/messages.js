const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Get all conversations for the current user
router.get('/conversations', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log(`Fetching conversations for user: ${userId}`);
        
        const pool = await getPool();
        
        // Get the conversations
        const conversations = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    c.ConversationId,
                    c.User1Id,
                    c.User2Id,
                    c.CreatedAt,
                    c.UpdatedAt,
                    -- Determine the other user's ID
                    CASE 
                        WHEN c.User1Id = @userId THEN c.User2Id
                        ELSE c.User1Id
                    END as OtherUserId
                FROM Conversations c
                WHERE c.User1Id = @userId OR c.User2Id = @userId
                ORDER BY c.UpdatedAt DESC
            `);
            
        if (conversations.recordset.length === 0) {
            console.log(`No conversations found for user ID: ${userId}`);
            return res.json([]);
        }
        
        // Get latest message for each conversation
        const conversationsWithDetails = await Promise.all(
            conversations.recordset.map(async (conversation) => {
                // Get the other user's information
                const otherUserResult = await pool.request()
                    .input('otherUserId', sql.Int, conversation.OtherUserId)
                    .query(`
                        SELECT 
                            UserId,
                            FullName as Name,
                            Email,
                            Photo
                            -- IsOnline column is not available in the Users table
                        FROM Users
                        WHERE UserId = @otherUserId
                    `);
                
                const otherUser = otherUserResult.recordset[0] || { Name: 'Unknown User' };
                
                // Extract first name for display purposes
                const firstName = otherUser.Name ? otherUser.Name.split(' ')[0] : 'User';
                
                // Get the latest message
                const latestMessageResult = await pool.request()
                    .input('conversationId', sql.Int, conversation.ConversationId)
                    .query(`
                        SELECT TOP 1
                            MessageId,
                            SenderId,
                            Content,
                            IsRead,
                            CreatedAt
                        FROM Messages
                        WHERE ConversationId = @conversationId
                        ORDER BY CreatedAt DESC
                    `);
                
                const latestMessage = latestMessageResult.recordset[0];
                
                // Determine if the latest message was sent by the current user
                const isLatestMessageFromCurrentUser = latestMessage ? latestMessage.SenderId === userId : false;
                
                // Get unread count
                const unreadCountResult = await pool.request()
                    .input('conversationId', sql.Int, conversation.ConversationId)
                    .input('userId', sql.Int, userId)
                    .query(`
                        SELECT COUNT(*) as UnreadCount
                        FROM Messages
                        WHERE ConversationId = @conversationId
                          AND SenderId != @userId
                          AND IsRead = 0
                    `);
                
                const unreadCount = unreadCountResult.recordset[0].UnreadCount;
                
                // Return the conversation with additional details
                return {
                    conversationId: conversation.ConversationId,
                    otherUserId: conversation.OtherUserId,
                    otherUserName: otherUser.Name,
                    otherUserFirstName: firstName,
                    otherUserPhoto: otherUser.Photo,
                    otherUserIsOnline: false, // Default to false since the column doesn't exist
                    lastMessage: latestMessage ? latestMessage.Content : 'No messages yet',
                    lastMessageTime: latestMessage ? latestMessage.CreatedAt : conversation.CreatedAt,
                    lastMessageSenderId: latestMessage ? latestMessage.SenderId : null,
                    isLastMessageFromCurrentUser: isLatestMessageFromCurrentUser,
                    unreadCount: unreadCount
                };
            })
        );
        
        res.json(conversationsWithDetails);
        
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ 
            error: 'Failed to fetch conversations',
            details: error.message
        });
    }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = parseInt(req.params.conversationId);
        console.log(`Fetching messages for conversation: ${conversationId}`);
        
        const pool = await getPool();
        
        // Check if the user is part of the conversation
        const conversationCheck = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    ConversationId,
                    User1Id,
                    User2Id,
                    CASE 
                        WHEN User1Id = @userId THEN User2Id
                        ELSE User1Id
                    END as OtherUserId
                FROM Conversations
                WHERE ConversationId = @conversationId
                  AND (User1Id = @userId OR User2Id = @userId)
            `);
        
        if (conversationCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        const conversation = conversationCheck.recordset[0];
        
        // Get the other user's information
        const otherUserResult = await pool.request()
            .input('otherUserId', sql.Int, conversation.OtherUserId)
            .query(`
                SELECT 
                    UserId,
                    FullName as Name,
                    Email,
                    Photo
                    -- IsOnline column is not available in the Users table
                FROM Users
                WHERE UserId = @otherUserId
            `);
        
        const otherUser = otherUserResult.recordset[0] || { Name: 'Unknown User' };
        
        // Extract first name for display purposes
        const firstName = otherUser.Name ? otherUser.Name.split(' ')[0] : 'User';
        
        // Get messages for the conversation
        const messagesResult = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .query(`
                SELECT 
                    MessageId as id,
                    SenderId as senderId,
                    Content as content,
                    IsRead as isRead,
                    CreatedAt as createdAt
                FROM Messages
                WHERE ConversationId = @conversationId
                ORDER BY CreatedAt ASC
            `);
        
        const messages = messagesResult.recordset;
        
        // Add unique timestamp to each message to prevent duplicate keys in frontend
        const messagesWithTimestamp = messages.map(message => ({
            ...message,
            uniqueTimestamp: Date.now() + Math.floor(Math.random() * 1000) // Add random offset to ensure uniqueness
        }));
        
        console.log(`Retrieved ${messagesWithTimestamp.length} messages for conversation ${conversationId}`);
        
        res.json({
            conversationId,
            otherUser: {
                id: otherUser.UserId,
                name: otherUser.Name,
                firstName: firstName,
                photo: otherUser.Photo,
                isOnline: false // Default to false since the column doesn't exist
            },
            messages: messagesWithTimestamp
        });
        
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            error: 'Failed to fetch messages',
            details: error.message
        });
    }
});

// Send a message in a conversation
router.post('/conversations/:conversationId/send', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const conversationId = parseInt(req.params.conversationId);
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (isNaN(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    const pool = await getPool();
    
    try {
        console.log(`Sending message to conversation ${conversationId} from user ${userId}`);
        
        // First check if the user is part of this conversation
        const checkResult = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ConversationId, User1Id, User2Id
                FROM Conversations 
                WHERE ConversationId = @conversationId
                AND (User1Id = @userId OR User2Id = @userId)
            `);
            
        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ 
                error: 'Conversation not found or you do not have permission to send messages in it' 
            });
        }
        
        // Insert the new message
        const result = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('senderId', sql.Int, userId)
            .input('content', sql.NVarChar(1000), content.trim())
            .query(`
                INSERT INTO Messages (ConversationId, SenderId, Content, IsRead, CreatedAt)
                OUTPUT INSERTED.MessageId, INSERTED.ConversationId, INSERTED.SenderId, 
                       INSERTED.Content, INSERTED.IsRead, INSERTED.CreatedAt
                VALUES (@conversationId, @senderId, @content, 0, GETDATE())
            `);
        
        if (result.recordset.length === 0) {
            throw new Error('Failed to insert message');
        }
        
        const message = {
            id: result.recordset[0].MessageId,
            uniqueTimestamp: new Date().getTime(), // Add unique timestamp to avoid key collisions
            conversationId: result.recordset[0].ConversationId,
            senderId: result.recordset[0].SenderId,
            content: result.recordset[0].Content,
            isRead: !!result.recordset[0].IsRead,
            createdAt: result.recordset[0].CreatedAt
        };
        
        console.log(`Message sent to conversation ${conversationId}`);
        
        return res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ 
            error: 'Failed to send message', 
            details: error.message 
        });
    }
});

// Mark messages as read in a conversation
router.post('/conversations/:conversationId/read', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = parseInt(req.params.conversationId);
        
        console.log(`Marking messages as read in conversation: ${conversationId}`);
        
        const pool = await getPool();
        
        // Check if the user is part of the conversation
        const conversationCheck = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ConversationId
                FROM Conversations
                WHERE ConversationId = @conversationId
                  AND (User1Id = @userId OR User2Id = @userId)
            `);
        
        if (conversationCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Mark messages as read
        await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Messages
                SET IsRead = 1
                WHERE ConversationId = @conversationId
                  AND SenderId != @userId
                  AND IsRead = 0
            `);
        
        res.json({ message: 'Messages marked as read' });
        
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ 
            error: 'Failed to mark messages as read',
            details: error.message
        });
    }
});

// Mark all messages in a conversation as read
router.put('/conversations/:conversationId/read', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const conversationId = parseInt(req.params.conversationId);
    
    if (isNaN(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    const pool = await getPool();
    
    try {
        console.log(`Marking messages as read in conversation ${conversationId} for user ${userId}`);
        
        // First check if the user is part of this conversation
        const checkResult = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ConversationId
                FROM Conversations 
                WHERE ConversationId = @conversationId
                AND (User1Id = @userId OR User2Id = @userId)
            `);
            
        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ 
                error: 'Conversation not found or you do not have permission to access it' 
            });
        }
        
        // Mark all messages as read where the current user is NOT the sender
        await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Messages
                SET IsRead = 1
                WHERE ConversationId = @conversationId
                AND SenderId != @userId
                AND IsRead = 0
            `);
            
        console.log(`Marked messages as read in conversation ${conversationId}`);
        
        return res.status(200).json({ 
            success: true, 
            message: 'Messages marked as read successfully' 
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        return res.status(500).json({ 
            error: 'Failed to mark messages as read', 
            details: error.message 
        });
    }
});

// Create a new conversation
router.post('/conversations', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        // Accept either otherUserId or userId from request body for compatibility
        const otherUserId = req.body.otherUserId || req.body.userId;
        
        console.log('Create conversation request:', req.body);
        
        if (!otherUserId) {
            return res.status(400).json({ error: 'Target user ID is required' });
        }
        
        // Parse as integer to ensure consistent comparison
        const parsedOtherUserId = parseInt(otherUserId);
        
        if (isNaN(parsedOtherUserId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        if (userId === parsedOtherUserId) {
            return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
        }
        
        console.log(`Creating conversation between users: ${userId} and ${parsedOtherUserId}`);
        
        const pool = await getPool();
        
        // Check if the other user exists
        const userCheck = await pool.request()
            .input('userId', sql.Int, parsedOtherUserId)
            .query(`
                SELECT UserId
                FROM Users
                WHERE UserId = @userId
            `);
        
        if (userCheck.recordset.length === 0) {
            console.log(`User with ID ${parsedOtherUserId} not found`);
            return res.status(404).json({ error: `User with ID ${parsedOtherUserId} not found` });
        }
        
        // Check if a conversation already exists between these users
        const conversationCheck = await pool.request()
            .input('user1Id', sql.Int, userId)
            .input('user2Id', sql.Int, parsedOtherUserId)
            .query(`
                SELECT ConversationId
                FROM Conversations
                WHERE (User1Id = @user1Id AND User2Id = @user2Id)
                   OR (User1Id = @user2Id AND User2Id = @user1Id)
            `);
        
        if (conversationCheck.recordset.length > 0) {
            // Return the existing conversation
            const conversationId = conversationCheck.recordset[0].ConversationId;
            console.log(`Existing conversation found with ID: ${conversationId}`);
            return res.json({ 
                conversationId: conversationId,
                message: 'Conversation already exists'
            });
        }
        
        // Create a new conversation
        const result = await pool.request()
            .input('user1Id', sql.Int, userId)
            .input('user2Id', sql.Int, parsedOtherUserId)
            .input('now', sql.DateTime, new Date())
            .query(`
                INSERT INTO Conversations (
                    User1Id,
                    User2Id,
                    CreatedAt,
                    UpdatedAt
                ) VALUES (
                    @user1Id,
                    @user2Id,
                    @now,
                    @now
                );
                
                SELECT SCOPE_IDENTITY() as ConversationId
            `);
        
        const conversationId = result.recordset[0].ConversationId;
        console.log(`New conversation created with ID: ${conversationId}`);
        
        res.status(201).json({ 
            conversationId,
            message: 'Conversation created successfully'
        });
        
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ 
            error: 'Failed to create conversation',
            details: error.message
        });
    }
});

// Delete a conversation
router.delete('/conversations/:conversationId', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const conversationId = parseInt(req.params.conversationId);
    
    const pool = await getPool();
    
    try {
        console.log(`Attempting to delete conversation ${conversationId} for user ${userId}`);
        
        // First check if the conversation exists and user has permission
        const checkResult = await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ConversationId
                FROM Conversations 
                WHERE ConversationId = @conversationId
                AND (User1Id = @userId OR User2Id = @userId)
            `);
            
        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ 
                error: 'Conversation not found or you do not have permission to delete it' 
            });
        }
        
        // Delete messages first - no transaction needed as this is a simple operation
        await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .query(`
                DELETE FROM Messages
                WHERE ConversationId = @conversationId
            `);
            
        console.log(`Deleted messages for conversation ${conversationId}`);
        
        // Then delete the conversation
        await pool.request()
            .input('conversationId', sql.Int, conversationId)
            .query(`
                DELETE FROM Conversations
                WHERE ConversationId = @conversationId
            `);
            
        console.log(`Successfully deleted conversation ${conversationId}`);
        
        return res.status(200).json({ 
            success: true, 
            message: 'Conversation deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        
        // Provide more specific error message for SQL constraint violations
        if (error.number === 547) { // SQL Server constraint violation
            return res.status(400).json({
                error: 'Cannot delete conversation due to database constraints',
                message: 'Please try again later or contact support.'
            });
        }
        
        return res.status(500).json({ 
            error: 'Failed to delete conversation', 
            details: error.message 
        });
    }
});

module.exports = router;