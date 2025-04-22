import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, User, Loader, Trash2, X, Check, CheckCheck, Image, XCircle } from 'lucide-react';
import { messageService } from './services/api';
import socketService from './services/socket';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

const Conversation = () => {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userData, setUserData] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Connect to socket and initialize conversation
  useEffect(() => {
    const storedUserData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!storedUserData.token) {
      navigate('/login');
      return;
    }
    
    setUserData(storedUserData);
    
    // Initialize socket connection
    socketService.connect(storedUserData);
    
    // Periodically check socket connection and reconnect if needed
    const connectionCheckInterval = setInterval(() => {
      if (!socketService.isConnected()) {
        console.log('Socket disconnected, reconnecting...');
        socketService.connect(storedUserData);
      }
    }, 5000); // Check every 5 seconds
    
    // Load initial conversation data
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const data = await messageService.getConversation(conversationId);
        
        // Format messages
        setMessages(data.messages || []);
        setOtherUser(data.otherUser || {});
        
        // Join the conversation room
        socketService.joinConversation(conversationId);
        
        // Mark messages as read
        socketService.markAsRead(conversationId);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError(err.message || 'Failed to load conversation');
        setLoading(false);
      }
    };
    
    fetchConversation();
    
    // Socket event handlers
    const newMessageHandler = (message) => {
      if (message.conversationId === parseInt(conversationId)) {
        console.log('New message received via socket:', message);
        setMessages(prev => {
          // Better duplicate checking with proper comparison
          const exists = prev.some(m => 
            (m.id && m.id === message.id) || 
            (m.content === message.content && 
             m.senderId === message.senderId &&
             Math.abs(new Date(m.createdAt || 0) - new Date(message.createdAt || 0)) < 5000)
          );
          if (exists) {
            console.log('Duplicate message detected, not adding');
            return prev;
          }
          console.log('Adding new message to state');
          return [...prev, message];
        });
        
        // Mark as read if it's from the other user
        if (message.senderId !== storedUserData.userId) {
          socketService.markAsRead(conversationId);
        }
        
        // Reset typing indicator when a message is received
        setIsOtherUserTyping(false);
      }
    };
    
    const messageReadHandler = (data) => {
      if (data.conversationId === parseInt(conversationId)) {
        // Update messages to show they've been read
        setMessages(prev => 
          prev.map(msg => 
            msg.senderId === storedUserData.userId ? { ...msg, isRead: true } : msg
          )
        );
      }
    };
    
    const typingHandler = (data) => {
      if (data.conversationId === parseInt(conversationId) && data.userId !== storedUserData.userId) {
        setIsOtherUserTyping(true);
        
        // Auto-clear typing indicator after 3 seconds of no updates
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          setIsOtherUserTyping(false);
        }, 3000);
      }
    };
    
    const stopTypingHandler = (data) => {
      if (data.conversationId === parseInt(conversationId) && data.userId !== storedUserData.userId) {
        setIsOtherUserTyping(false);
      }
    };
    
    // Register socket event listeners
    socketService.on('new_message', newMessageHandler);
    socketService.on('messages_read', messageReadHandler);
    socketService.on('user_typing', typingHandler);
    socketService.on('user_stop_typing', stopTypingHandler);
    
    // Clean up event listeners
    return () => {
      socketService.off('new_message', newMessageHandler);
      socketService.off('messages_read', messageReadHandler);
      socketService.off('user_typing', typingHandler);
      socketService.off('user_stop_typing', stopTypingHandler);
      
      // Clear intervals and timeouts
      clearInterval(connectionCheckInterval);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOtherUserTyping]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    
    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    
    setImageAttachment(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Clear image attachment
  const clearImageAttachment = () => {
    setImageAttachment(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle input change with debounced typing notifications
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Send typing indicator if value is not empty
    if (value.trim() || imageAttachment) {
      debouncedSendTypingStatus();
    } else {
      socketService.stopTyping(conversationId);
    }
  };
  
  // Debounced function to avoid too many typing events
  const debouncedSendTypingStatus = debounce(() => {
    socketService.startTyping(conversationId);
  }, 500);

  // Handle message send - update to handle image
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    const messageContent = newMessage.trim();
    if ((!messageContent && !imageAttachment) || sending) return; // Check both text and image
    
    try {
      setSending(true);
      
      // Clear input immediately for better UX
      setNewMessage('');
      const fileToSend = imageAttachment; // Store before clearing for sending
      
      // Stop typing indicator
      socketService.stopTyping(conversationId);
      
      // Focus back on input
      messageInputRef.current?.focus();
      
      // Create unique ID for this message
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create optimistic message for UI with timestamp for reliable identification
      const tempMessage = {
        id: tempId,
        conversationId: parseInt(conversationId),
        senderId: userData.userId,
        content: messageContent,
        imageUrl: imagePreview, // Add image preview to temporary message
        hasImage: !!imageAttachment,
        isRead: false,
        createdAt: new Date().toISOString(),
        sending: true
      };
      
      // Clear image attachment after creating temp message
      clearImageAttachment();
      
      // Add to UI immediately
      setMessages(prev => [...prev, tempMessage]);
      
      let response;
      let socketSuccess = false;
      
      try {
        // Try sending with image if there's an attachment
        if (fileToSend) {
          // We'll use the REST API for file uploads since socket.io isn't ideal for binary data
          const formData = new FormData();
          if (messageContent) {
            formData.append('content', messageContent);
          }
          formData.append('image', fileToSend);
          
          response = await messageService.sendMessageWithImage(conversationId, formData);
          console.log('Message with image sent via REST API:', response);
        } else {
          // Text-only message - try socket first
          response = await socketService.sendMessage(conversationId, messageContent);
          console.log('Message sent via socket:', response);
          socketSuccess = true;
        }
      } catch (socketError) {
        console.warn("Socket sending failed, falling back to REST API:", socketError);
        
        // Fallback to REST API if socket fails
        if (!socketSuccess && !fileToSend) {
          response = await messageService.sendMessage(conversationId, messageContent);
          console.log('Message sent via REST API fallback:', response);
        }
      }
      
      if (!response) {
        throw new Error("Failed to get response from both Socket.IO and REST API");
      }
      
      // Replace temp message with real one
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === tempId) {
            return { 
              ...response, 
              sending: false,
              // Make sure we have the right timestamp and ID
              id: response.id || msg.id,
              createdAt: response.createdAt || msg.createdAt
            };
          }
          return msg;
        })
      );
      
      setSending(false);
    } catch (err) {
      console.error('Error sending message:', err);
      
      toast.error('Failed to send message. Please try again.');
      
      // Mark message as failed - find the correct temp message by ID
      setMessages(prev => 
        prev.map(msg => {
          // Find the message with the temp ID pattern
          if (msg.id && typeof msg.id === 'string' && msg.id.startsWith('temp-')) {
            return { ...msg, failed: true, sending: false };
          }
          return msg;
        })
      );
      
      setSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    try {
      setDeleting(true);
      
      await messageService.deleteConversation(conversationId);
      toast.success('Conversation deleted successfully');
      navigate('/messages');
    } catch (err) {
      console.error('Error deleting conversation:', err);
      
      // Extract the most relevant error message
      let errorMessage = 'Failed to delete conversation';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
      setShowDeleteModal(false);
      setDeleting(false);
    }
  };

  const handleMessageRetry = async (tempId) => {
    // Find the failed message
    const failedMessage = messages.find(m => m.id === tempId);
    if (!failedMessage) return;
    
    try {
      // Mark message as sending again
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId ? { ...msg, failed: false, sending: true } : msg
        )
      );
      
      setSending(true);
      
      let response;
      
      try {
        // Try to reconnect and resend via socket
        socketService.connect(userData);
        
        // Wait a short time for connection
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try with socket.io first
        response = await socketService.sendMessage(conversationId, failedMessage.content);
      } catch (socketError) {
        console.warn("Socket retry failed, falling back to REST API:", socketError);
        
        // Fallback to REST API
        response = await messageService.sendMessage(conversationId, failedMessage.content);
      }
      
      if (!response) {
        throw new Error("Failed to get response from both Socket.IO and REST API");
      }
      
      // Replace temp message with successful one
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId ? { ...response, sending: false } : msg
        )
      );
      
      // Clear retry state
      setSending(false);
      
    } catch (err) {
      console.error('Error retrying message:', err);
      
      toast.error('Failed to send message. Please try again.');
      
      // Mark message as failed again
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId ? { ...msg, failed: true, sending: false } : msg
        )
      );
      
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="text-center p-6">
          <Loader className="h-8 w-8 text-[#800000] animate-spin mx-auto" />
          <p className="mt-4 text-[#5d4037]">Loading conversation...</p>
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
          <h2 className="text-xl font-bold text-[#5d4037] mb-2">Error Loading Conversation</h2>
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

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.createdAt).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Group messages by sender in sequence - helps with message grouping
  const processGroupedMessages = (dateGroups) => {
    const result = {};
    
    Object.keys(dateGroups).forEach(date => {
      result[date] = [];
      let currentGroup = null;
      
      dateGroups[date].forEach(message => {
        const isUserMessage = String(message.senderId) === String(userData?.userId);
        
        // If this is the first message or sender changed, create a new group
        if (!currentGroup || currentGroup.isUserMessage !== isUserMessage) {
          currentGroup = {
            isUserMessage,
            senderId: message.senderId,
            messages: [message]
          };
          result[date].push(currentGroup);
        } else {
          // Add to existing group
          currentGroup.messages.push(message);
        }
      });
    });
    
    return result;
  };
  
  const processedMessages = processGroupedMessages(groupedMessages);

  return (
    <div className="min-h-screen bg-[#f8f5f0] flex flex-col h-[100vh]">
      <style jsx="true">{`
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 0.6;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.6;
          }
        }
        
        .animate-fade-in-right {
          animation: fadeInRight 0.3s ease-out;
        }
        
        .animate-fade-in-left {
          animation: fadeInLeft 0.3s ease-out;
        }
        
        .animate-pulse-custom {
          animation: pulse 1.5s infinite;
        }
      `}</style>

      {/* Header - Messenger style with maroon background */}
      <div className="bg-[#800000] border-b border-[#600000] sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto max-w-2xl py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/messages" className="p-2 rounded-full hover:bg-[#6a0000] transition-colors mr-2">
                <ArrowLeft className="text-white" size={20} />
              </Link>
              
              <div className="flex items-center">
                {otherUser?.photo ? (
                  <img 
                    src={otherUser.photo} 
                    alt={otherUser.name} 
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#ffd700] shadow-md transition-transform hover:scale-105"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#ffd700] flex items-center justify-center text-[#800000] shadow-md transition-transform hover:scale-105">
                    <User size={20} />
                  </div>
                )}
                
                <div className="ml-3">
                  <h2 className="font-bold text-white">{otherUser?.firstName || otherUser?.name || 'User'}</h2>
                  <p className="text-xs text-gray-200">
                    {isOtherUserTyping ? 
                      <span className="text-[#ffd700] font-medium">Typing...</span> : 
                      (otherUser?.isOnline ? 'Active now' : 'Offline')}
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="p-2 rounded-full hover:bg-[#6a0000] transition-colors text-white"
              aria-label="Delete conversation"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div 
        className="flex-1 overflow-auto p-4 bg-[#f8f5f0]"
      >
        <div className="container mx-auto max-w-2xl">
          {Object.keys(processedMessages).map(date => (
            <div key={date} className="mb-4">
              {/* Date divider */}
              <div className="flex justify-center my-3">
                <div className="bg-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full">
                  {new Date(date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
              
              {/* Message groups for this date */}
              {processedMessages[date].map((group, groupIndex) => (
                <div key={`group-${date}-${groupIndex}`} className="mb-3">
                  {/* Sender name at the top of each group */}
                  <div className="text-xs font-medium mb-1 px-12">
                    <span className={group.isUserMessage ? "text-right block text-blue-600" : "text-gray-600"}>
                      {group.isUserMessage ? "You" : otherUser?.firstName || otherUser?.name || "User"}
                    </span>
                  </div>
                  
                  {/* Messages in this group */}
                  {group.messages.map((message, messageIndex) => {
                    // Create a unique key using message ID and additional unique identifiers
                    const uniqueKey = typeof message.id === 'string' && message.id.startsWith('temp-')
                      ? message.id // temp IDs are already unique
                      : `msg-${message.id}-${messageIndex}-${date}-${groupIndex}`;
                    
                    return (
                    <div key={uniqueKey} className="mb-1">
                      {/* Your messages - right side */}
                      {group.isUserMessage && (
                        <div className="flex justify-end items-end animate-fade-in-right">
                          <div className="max-w-[75%]">
                            <div className={`bg-[#800000] text-white px-3 py-2 rounded-lg ${
                              messageIndex === group.messages.length - 1 ? 'rounded-br-none' : ''
                            } ${message.failed ? 'opacity-60' : ''} shadow-md hover:shadow-lg transition-shadow`}>
                              {/* Add image rendering */}
                              {(message.imageUrl || message.image) && (
                                <div className="mb-2">
                                  <img 
                                    src={message.imageUrl || message.image} 
                                    alt="Sent image" 
                                    className="rounded max-h-60 max-w-full object-contain"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://via.placeholder.com/200x200?text=Image+Failed';
                                    }}
                                  />
                                </div>
                              )}
                              {message.content && <p className="text-sm">{message.content}</p>}
                              <div className="flex items-center justify-end mt-1 space-x-1">
                                <span className="text-[10px] text-gray-100">
                                  {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </span>
                                {message.sending && <span className="text-[10px] text-[#ffd700]">• Sending</span>}
                                {message.failed && (
                                  <span 
                                    className="text-[10px] text-[#ffd700] cursor-pointer hover:underline"
                                    onClick={() => handleMessageRetry(message.id)}
                                  >
                                    • Failed - Retry
                                  </span>
                                )}
                                {!message.sending && !message.failed && (
                                  message.isRead ? 
                                    <CheckCheck size={12} className="text-[#ffd700]" /> : 
                                    <Check size={12} className="text-[#ffd700]" />
                                )}
                              </div>
                            </div>
                          </div>
                          {messageIndex === group.messages.length - 1 && (
                            <div className="ml-2 flex-shrink-0 w-8 h-8 bg-[#800000] rounded-full flex items-center justify-center shadow-md border border-[#ffd700] transition-transform hover:scale-105">
                              {userData?.photo ? (
                                <img 
                                  src={userData.photo} 
                                  alt="You" 
                                  className="w-8 h-8 rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/default-avatar.png';
                                  }}
                                />
                              ) : (
                                <User size={14} className="text-[#ffd700]" />
                              )}
                            </div>
                          )}
                          {messageIndex !== group.messages.length - 1 && <div className="ml-2 w-8"></div>}
                        </div>
                      )}

                      {/* Other user's messages - left side */}
                      {!group.isUserMessage && (
                        <div className="flex items-end animate-fade-in-left">
                          {messageIndex === group.messages.length - 1 && (
                            <div className="mr-2 flex-shrink-0 w-8 h-8 bg-[#ffd700] rounded-full flex items-center justify-center shadow-md border border-[#800000] transition-transform hover:scale-105">
                              {otherUser?.photo ? (
                                <img 
                                  src={otherUser.photo} 
                                  alt={otherUser.firstName || otherUser.name} 
                                  className="w-8 h-8 rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/default-avatar.png';
                                  }}
                                />
                              ) : (
                                <User size={14} className="text-[#800000]" />
                              )}
                            </div>
                          )}
                          {messageIndex !== group.messages.length - 1 && <div className="mr-2 w-8"></div>}
                          <div className="max-w-[75%]">
                            <div className="bg-[#ffd700] text-[#800000] px-3 py-2 rounded-lg rounded-bl-none shadow-md hover:shadow-lg transition-shadow">
                              {/* Add image rendering for other user */}
                              {(message.imageUrl || message.image) && (
                                <div className="mb-2">
                                  <img 
                                    src={message.imageUrl || message.image} 
                                    alt="Received image" 
                                    className="rounded max-h-60 max-w-full object-contain"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://via.placeholder.com/200x200?text=Image+Failed';
                                    }}
                                  />
                                </div>
                              )}
                              {message.content && <p className="text-sm font-medium">{message.content}</p>}
                              <div className="flex justify-end mt-1">
                                <span className="text-[10px] text-[#800000]">
                                  {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
          
          {/* Typing indicator with maroon and gold theme */}
          {isOtherUserTyping && (
            <div className="flex items-end mb-4 animate-fade-in-left">
              <div className="mr-2 flex-shrink-0 w-8 h-8 bg-[#ffd700] rounded-full flex items-center justify-center shadow-md border border-[#800000]">
                {otherUser?.photo ? (
                  <img 
                    src={otherUser.photo} 
                    alt={otherUser.name} 
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                ) : (
                  <User size={14} className="text-[#800000]" />
                )}
              </div>
              <div className="bg-[#ffd700] px-4 py-2 rounded-full rounded-bl-none inline-block shadow-md">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-[#800000] rounded-full animate-pulse-custom" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-[#800000] rounded-full animate-pulse-custom" style={{ animationDelay: '200ms' }}></div>
                  <div className="w-2 h-2 bg-[#800000] rounded-full animate-pulse-custom" style={{ animationDelay: '400ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="bg-[#800000]/10 border-t border-[#800000]/20 px-3 py-2">
          <div className="container mx-auto max-w-2xl">
            <div className="flex items-center">
              <div className="relative mr-2">
                <img 
                  src={imagePreview} 
                  alt="Upload preview" 
                  className="h-16 w-16 object-cover rounded border border-[#800000]"
                />
                <button 
                  onClick={clearImageAttachment}
                  className="absolute -top-2 -right-2 bg-[#800000] text-white rounded-full p-1 shadow-md hover:bg-[#600000] transition-colors"
                >
                  <XCircle size={16} />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#800000]">Image ready to send</p>
                <p className="text-xs text-[#800000]/70">Add an optional message or click send</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Input - Updated with image upload button */}
      <div className="bg-[#800000] border-t border-[#600000] p-3">
        <div className="container mx-auto max-w-2xl">
          <form onSubmit={handleSendMessage} className="flex items-center">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={sending}
            />
            
            {/* Image button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="p-3 mr-2 rounded-full bg-[#ffd700] text-[#800000] hover:bg-[#ffeb99] hover:shadow-md transition-all duration-200 flex-shrink-0 shadow"
            >
              <Image size={20} />
            </button>
            
            <div className="flex-1 relative">
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder={imageAttachment ? "Add a message or send image..." : "Type a message..."}
                className="w-full px-4 py-3 bg-[#f8f5f0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:bg-white shadow-inner transition-all duration-200"
                disabled={sending}
              />
            </div>
            <button
              type="submit"
              disabled={(!newMessage.trim() && !imageAttachment) || sending}
              className={`ml-2 p-3 rounded-full ${
                (!newMessage.trim() && !imageAttachment) || sending
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#ffd700] text-[#800000] hover:bg-[#ffeb99] hover:shadow-md'
              } transition-all duration-200 flex-shrink-0 shadow`}
            >
              {sending ? (
                <Loader size={20} className="animate-spin" />
              ) : (
                <Send size={20} className={(!newMessage.trim() && !imageAttachment) ? '' : 'fill-[#800000]'} />
              )}
            </button>
          </form>
        </div>
      </div>
      
      {/* Delete Confirmation Modal with Maroon and Gold theme */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f8f5f0] rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in border-2 border-[#ffd700]">
            <div className="flex justify-between items-center mb-4 border-b border-[#800000] pb-3">
              <h2 className="text-xl font-bold text-[#800000]">Delete Conversation</h2>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="p-2 rounded-full hover:bg-[#ffe97d] transition-all"
                disabled={deleting}
              >
                <X size={20} className="text-[#800000]" />
              </button>
            </div>
            
            <p className="text-[#800000] mb-6">
              Are you sure you want to delete this entire conversation with <span className="font-semibold">{otherUser?.firstName || otherUser?.name || 'this user'}</span>? 
              This action cannot be undone.
            </p>
            
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-[#f0e6d2] text-[#800000] rounded-lg hover:bg-[#e6d7b8] transition-all shadow-sm"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConversation}
                className="px-4 py-2 bg-[#800000] text-[#ffd700] rounded-lg hover:bg-[#6a0000] transition-all flex items-center shadow-md"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader size={16} className="animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conversation;
