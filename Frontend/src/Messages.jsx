import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { messageService } from './services/api';
import socketService from './services/socket';
import { User, Search, Loader, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

const Messages = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const storedUserData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!storedUserData.token) {
      navigate('/login');
      return;
    }
    
    setUserData(storedUserData);
    
    // Connect to socket.io
    socketService.connect(storedUserData);
    
    const fetchConversations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await messageService.getConversations();
        setConversations(data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError(err.message || 'Failed to load conversations');
        toast.error('Failed to load your conversations');
        setLoading(false);
      }
    };
    
    fetchConversations();
    
    // Socket event handlers for real-time updates
    const messageNotificationHandler = (data) => {
      // Update conversation with new message
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.conversationId === data.conversationId) {
            // Update last message and unread count
            return {
              ...conv,
              lastMessage: data.message.content,
              lastMessageTime: data.message.createdAt,
              lastMessageSenderId: data.message.senderId,
              isLastMessageFromCurrentUser: data.message.senderId === storedUserData.userId,
              unreadCount: conv.unreadCount + (data.message.senderId !== storedUserData.userId ? 1 : 0)
            };
          }
          return conv;
        });
      });
    };
    
    const messagesReadHandler = (data) => {
      // Update read status for messages in a conversation
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.conversationId === data.conversationId) {
            // If the last message is from the current user, mark it as read
            if (conv.isLastMessageFromCurrentUser) {
              return { ...conv, lastMessageRead: true };
            }
          }
          return conv;
        });
      });
    };
    
    const userStatusHandler = (data) => {
      // Update online status for conversations
      setConversations(prev => {
        return prev.map(conv => {
          if (String(conv.otherUserId) === String(data.userId)) {
            return { ...conv, otherUserIsOnline: data.isOnline };
          }
          return conv;
        });
      });
    };
    
    // Register socket event listeners
    socketService.on('message_notification', messageNotificationHandler);
    socketService.on('messages_read', messagesReadHandler);
    socketService.on('user_status', userStatusHandler);
    
    // Clean up event listeners
    return () => {
      socketService.off('message_notification', messageNotificationHandler);
      socketService.off('messages_read', messagesReadHandler);
      socketService.off('user_status', userStatusHandler);
    };
  }, [navigate]);
  
  const filteredConversations = conversations.filter(conversation => 
    conversation.otherUserName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Format relative time for messages
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - messageDate) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d`;
    } else {
      return messageDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };
  
  const handleConversationClick = (conversationId) => {
    // Mark conversation messages as read when clicked
    const conversation = conversations.find(c => c.conversationId === conversationId);
    if (conversation && conversation.unreadCount > 0) {
      socketService.markAsRead(conversationId);
      
      // Update UI immediately
      setConversations(prev => 
        prev.map(c => 
          c.conversationId === conversationId 
            ? { ...c, unreadCount: 0 } 
            : c
        )
      );
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="text-center p-6">
          <Loader className="h-8 w-8 text-[#800000] animate-spin mx-auto" />
          <p className="mt-4 text-[#5d4037]">Loading messages...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="mb-4 text-[#800000]">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#5d4037] mb-2">Error Loading Messages</h2>
          <p className="text-[#5d4037] mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0]">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .fade-in {
          animation: fadeIn 0.6s ease-out;
        }
        .pulse-animation {
          animation: pulse 2s infinite;
        }
      `}</style>
      
      {/* Header */}
      <div className="bg-[#800000] border-b border-[#d4af37] sticky top-0 z-10 shadow-md">
        <div className="container mx-auto max-w-2xl py-4">
          <div className="px-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Messages</h1>
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="container mx-auto max-w-2xl px-4 pt-4 fade-in">
        <div className="relative">
          <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5d4037]" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-3 rounded-full bg-white border border-[#d4af37] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Conversations list */}
      <div className="container mx-auto max-w-2xl px-4 py-4">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md border border-[#d4af37] fade-in">
            {searchTerm ? (
              <div>
                <Search className="h-10 w-10 mx-auto text-[#5d4037] mb-4" />
                <p className="text-[#5d4037] mb-2">No conversations matching "{searchTerm}"</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-[#800000] hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div>
                <Clock className="h-10 w-10 mx-auto text-[#5d4037] mb-4" />
                <p className="text-[#5d4037] mb-2">No conversations yet</p>
                <p className="text-[#5d4037] text-sm mb-4">
                  When you connect with other users, your conversations will appear here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conversation, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={conversation.conversationId}
                className="fade-in"
              >
                <Link
                  to={`/conversation/${conversation.conversationId}`}
                  className="block bg-white rounded-lg hover:bg-[#fff9e6] transition-colors border border-[#d4af37] shadow-sm"
                  onClick={() => handleConversationClick(conversation.conversationId)}
                >
                  <div className="p-3 flex items-center">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {conversation.otherUserPhoto ? (
                        <img
                          src={conversation.otherUserPhoto}
                          alt={conversation.otherUserName}
                          className="w-14 h-14 rounded-full object-cover border-2 border-[#d4af37]"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-avatar.png';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[#f0e6d2] flex items-center justify-center text-[#800000] border-2 border-[#d4af37]">
                          <User size={24} />
                        </div>
                      )}
                      
                      {/* Online indicator */}
                      {conversation.otherUserIsOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full pulse-animation"></div>
                      )}
                    </div>
                    
                    {/* Message content */}
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex justify-between">
                        <h3 className="font-semibold text-[#5d4037] truncate">
                          {conversation.otherUserName}
                        </h3>
                        <span className="text-xs text-[#5d4037] whitespace-nowrap ml-2">
                          {formatMessageTime(conversation.lastMessageTime)}
                        </span>
                      </div>
                      
                      <div className="flex items-center mt-1">
                        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-semibold text-[#5d4037]' : 'text-[#5d4037]'}`}>
                          {conversation.isLastMessageFromCurrentUser && (
                            <span className="text-[#800000] mr-1">You: </span>
                          )}
                          {!conversation.isLastMessageFromCurrentUser && (
                            <span className="text-[#d4af37] mr-1">{conversation.otherUserFirstName || conversation.otherUserName.split(' ')[0]}: </span>
                          )}
                          {conversation.lastMessage}
                        </p>
                      </div>
                    </div>
                    
                    {/* Unread indicator */}
                    {conversation.unreadCount > 0 && (
                      <div className="ml-2 bg-[#800000] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full pulse-animation">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
