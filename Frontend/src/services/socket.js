import { io } from 'socket.io-client';

// Get the API URL from environment variables or use localhost as fallback
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = {};
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.userId = null;
    this.handlers = {
      new_message: [],
      message_sent: [],
      messages_read: [],
      user_typing: [],
      user_stop_typing: [],
      user_status: [],
      error: [],
      connect: [],
      disconnect: [],
      transaction_update: [],
      application_update: [],
      service_update: []
    };
    
    // Bind methods to prevent 'this' issues
    this.connect = this.connect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this._notifyHandlers = this._notifyHandlers.bind(this);
  }

  isConnected() {
    return this.socket && this.socket.connected && this.connected;
  }

  connect(userData) {
    if (this.isConnected()) {
      console.log('Socket already connected');
      return;
    }

    if (this.connecting) {
      console.log('Socket connection in progress');
      return;
    }

    try {
      this.connecting = true;
      this.userId = userData.userId;
      
      console.log(`Connecting to socket at ${SOCKET_URL}`);
      
      this.socket = io(SOCKET_URL, {
        auth: {
          token: userData.token
        },
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('Socket connected successfully', this.socket.id);
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        
        // Join user's room for direct notifications
        this.socket.emit('join_user_room', userData.userId);
        
        // Notify connect handlers
        this._notifyHandlers('connect', { connected: true });
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.connected = false;
        this.connecting = false;
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error(`Failed to connect after ${this.maxReconnectAttempts} attempts`);
          this.socket.disconnect();
        }
        
        this._notifyHandlers('error', { error: 'Connection failed', details: error });
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.connected = false;
        this.connecting = false;
        
        // Try to reconnect if unexpected disconnect
        if (reason === 'io server disconnect' || reason === 'transport close') {
          console.log('Attempting to reconnect...');
          setTimeout(() => {
            if (!this.connected && !this.connecting) {
              this.socket.connect();
            }
          }, 2000);
        }
        
        this._notifyHandlers('disconnect', { reason });
      });

      // Set up event listeners for messages
      this.socket.on('new_message', (message) => {
        if (message && message.conversationId) {
          console.log('New message received via socket server:', message);
          
          // Force update for all UI subscribers
          setTimeout(() => {
            // Make a copy to ensure React detects the change
            const messageCopy = {...message, _timestamp: Date.now()};
            this._notifyHandlers('new_message', messageCopy);
            
            // Also notify on message_sent to ensure all handlers are called
            if (message.senderId === this.userId) {
              this._notifyHandlers('message_sent', messageCopy);
            }
          }, 0);
        } else {
          console.error('Received invalid message format:', message);
        }
      });

      this.socket.on('message_sent', (message) => {
        console.log('Message sent confirmation from server:', message);
        
        // Force update UI in two separate events for better React state updates
        setTimeout(() => {
          // Make a copy to ensure React detects the change
          const messageCopy = {...message, _timestamp: Date.now()};
          this._notifyHandlers('message_sent', messageCopy);
          
          // Also dispatch as new_message to ensure UI updates
          this._notifyHandlers('new_message', messageCopy);
        }, 0);
      });

      this.socket.on('messages_read', (data) => {
        console.log('Messages marked as read:', data);
        this._notifyHandlers('messages_read', data);
      });

      this.socket.on('user_typing', (data) => {
        this._notifyHandlers('user_typing', data);
      });

      this.socket.on('user_stop_typing', (data) => {
        this._notifyHandlers('user_stop_typing', data);
      });

      this.socket.on('user_status', (data) => {
        console.log('User status update:', data);
        this._notifyHandlers('user_status', data);
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
        this._notifyHandlers('error', error);
      });
      
      // Listen for reconnect events
      this.socket.io.on('reconnect', (attempt) => {
        console.log(`Reconnected after ${attempt} attempts`);
        this.connected = true;
        this.connecting = false;
        
        // Rejoin user's room after reconnection
        if (this.userId) {
          this.socket.emit('join_user_room', this.userId);
        }
      });
      
      this.socket.io.on('reconnect_attempt', (attempt) => {
        console.log(`Reconnection attempt ${attempt}`);
      });
      
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      this.connecting = false;
      this._notifyHandlers('error', { error: 'Failed to initialize socket', details: error });
    }
  }

  authenticate(userData) {
    if (!this.socket) {
      console.error('Cannot authenticate: Socket not initialized');
      return;
    }

    if (!userData || !userData.userId || !userData.token) {
      console.error('Cannot authenticate: Invalid user data');
      return;
    }

    console.log('Authenticating user:', userData.userId);
    this.socket.emit('authenticate', {
      userId: userData.userId,
      token: userData.token
    });
  }

  joinConversation(conversationId) {
    if (!this.socket) {
      console.error('Cannot join conversation: Socket not initialized');
      return;
    }

    if (!conversationId) {
      console.error('Cannot join conversation: Invalid conversation ID');
      return;
    }

    // Ensure conversation ID is a number
    const conversationIdNum = parseInt(conversationId);
    if (isNaN(conversationIdNum)) {
      console.error('Cannot join conversation: Conversation ID must be a number');
      return;
    }

    // Even if not connected, try to join (will be queued)
    console.log(`Joining conversation ${conversationIdNum}`);
    this.socket.emit('join_conversation', conversationIdNum);

    // If not connected, reconnect
    if (!this.connected && this.socket) {
      console.log('Socket disconnected, trying to reconnect...');
      this.socket.connect();
    }
  }

  sendMessage(conversationId, content) {
    if (!this.socket) {
      console.error('Cannot send message: Socket not initialized');
      return Promise.reject(new Error('Socket not initialized'));
    }
    
    if (!this.connected) {
      console.warn('Socket not connected, attempting to reconnect before sending');
      this.socket.connect();
      return Promise.reject(new Error('Socket not connected'));
    }

    return new Promise((resolve, reject) => {
      try {
        // Set a timeout in case the server doesn't respond
        const timeoutId = setTimeout(() => {
          this.socket.off('message_sent', messageHandler);
          this.socket.off('error', errorHandler);
          reject(new Error('Message sending timeout - server did not respond'));
        }, 10000); // 10 second timeout

        // Create one-time handler for this specific message
        const messageHandler = (message) => {
          clearTimeout(timeoutId);
          this.socket.off('message_sent', messageHandler);
          this.socket.off('error', errorHandler);
          
          // Important: trigger the new_message event for this message too
          // This ensures the message appears in the UI without a refresh
          setTimeout(() => {
            this._notifyHandlers('new_message', message);
          }, 100);
          
          resolve(message);
        };

        const errorHandler = (error) => {
          clearTimeout(timeoutId);
          this.socket.off('message_sent', messageHandler);
          this.socket.off('error', errorHandler);
          console.error('Socket message error:', error);
          reject(error || new Error('Unknown socket error'));
        };

        // Listen for confirmation or error
        this.socket.once('message_sent', messageHandler);
        this.once('error', errorHandler);

        // Validate message format
        if (!conversationId || !content) {
          clearTimeout(timeoutId);
          this.socket.off('message_sent', messageHandler);
          this.socket.off('error', errorHandler);
          reject(new Error('Invalid message: conversationId and content are required'));
          return;
        }

        // Ensure conversation ID is a number
        const conversationIdNum = parseInt(conversationId);
        if (isNaN(conversationIdNum)) {
          clearTimeout(timeoutId);
          this.socket.off('message_sent', messageHandler);
          this.socket.off('error', errorHandler);
          reject(new Error('Invalid conversation ID'));
          return;
        }

        // Generate unique message ID to help track it
        const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Send the message with validated data
        console.log('Sending message to server:', { 
          conversationId: conversationIdNum, 
          content,
          clientMessageId
        });
        
        this.socket.emit('send_message', { 
          conversationId: conversationIdNum, 
          content,
          clientMessageId
        });
      } catch (err) {
        console.error('Error in sendMessage:', err);
        reject(err);
      }
    });
  }

  markAsRead(conversationId) {
    if (!this.socket) {
      console.error('Cannot mark as read: Socket not initialized');
      return Promise.reject(new Error('Socket not initialized'));
    }

    if (!conversationId) {
      console.error('Cannot mark as read: Invalid conversation ID');
      return Promise.reject(new Error('Invalid conversation ID'));
    }

    // Ensure conversation ID is a number
    const conversationIdNum = parseInt(conversationId);
    if (isNaN(conversationIdNum)) {
      console.error('Cannot mark as read: Conversation ID must be a number');
      return Promise.reject(new Error('Conversation ID must be a number'));
    }

    return new Promise((resolve, reject) => {
      try {
        // If not connected, try to mark through the API
        if (!this.connected) {
          console.warn('Socket not connected, using REST API to mark as read');
          import('./api').then(({ messageService }) => {
            messageService.markAsRead(conversationIdNum)
              .then(resolve)
              .catch(reject);
          });
          return;
        }

        console.log(`Marking conversation ${conversationIdNum} as read via socket`);
        this.socket.emit('mark_as_read', { conversationId: conversationIdNum });
        resolve({ success: true });
      } catch (err) {
        console.error('Error in markAsRead:', err);
        reject(err);
      }
    });
  }

  startTyping(conversationId) {
    if (!this.socket || !this.connected) {
      return;
    }

    this.socket.emit('typing', { conversationId });
  }

  stopTyping(conversationId) {
    if (!this.socket || !this.connected) {
      return;
    }

    this.socket.emit('stop_typing', { conversationId });
  }

  once(event, handler) {
    const onceHandler = (data) => {
      // Remove after first execution
      this.off(event, onceHandler);
      handler(data);
    };
    
    this.on(event, onceHandler);
  }

  on(event, handler) {
    if (!this.handlers[event]) {
      console.error(`Unknown event: ${event}`);
      return;
    }

    this.handlers[event].push(handler);

    // Return unsubscribe function
    return () => {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    };
  }

  off(event, handler) {
    if (!this.handlers[event]) {
      return;
    }

    this.handlers[event] = this.handlers[event].filter(h => h !== handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.connecting = false;
      this.userId = null;
    }
  }

  _notifyHandlers(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  triggerEvent(event, data) {
    this._notifyHandlers(event, data);
  }
}

// Create and export a singleton instance
const socketService = new SocketService();
export default socketService; 