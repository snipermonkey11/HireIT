import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = {};
    this.connected = false;
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
  }

  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  connect(userData) {
    if (this.isConnected()) {
      console.log('Socket already connected');
      return;
    }

    try {
      this.socket = io('http://localhost:3000', {
        auth: {
          token: userData.token
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('Socket connected successfully');
        this.connected = true;
        
        // Join user's room for direct notifications
        this.socket.emit('join_user_room', userData.userId);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.connected = false;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.connected = false;
      });

      // Listen for events that trigger notifications
      this.socket.on('new_message', (data) => {
        this.triggerEvent('new_message', data);
      });

      this.socket.on('transaction_update', (data) => {
        this.triggerEvent('transaction_update', data);
      });

      this.socket.on('application_update', (data) => {
        this.triggerEvent('application_update', data);
      });

      this.socket.on('service_update', (data) => {
        this.triggerEvent('service_update', data);
      });

      // Set up event listeners
      this.socket.on('new_message', (message) => {
        if (message && message.conversationId) {
          console.log('New message received:', message);
          this._notifyHandlers('new_message', message);
        } else {
          console.error('Received invalid message format:', message);
        }
      });

      this.socket.on('message_sent', (message) => {
        console.log('Message sent confirmation:', message);
        this._notifyHandlers('message_sent', message);
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
    } catch (error) {
      console.error('Failed to initialize socket:', error);
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
    if (!this.socket || !this.connected) {
      console.error('Cannot send message: Socket not connected');
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

        // Send the message with validated data
        console.log('Sending message to server:', { conversationId: conversationIdNum, content });
        this.socket.emit('send_message', { conversationId: conversationIdNum, content });
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