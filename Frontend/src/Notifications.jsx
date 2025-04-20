import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, CreditCard, Briefcase, AlertCircle, CheckCircle, User } from 'lucide-react';
import socketService from './services/socket';
import { toast } from 'react-toastify';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Track processed notification IDs to prevent duplicates
  const [processedIds] = useState(new Set());

  // Fetch notifications and set up real-time listeners
  useEffect(() => {
    // Get user data for authentication
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData.token) {
      navigate('/login');
      return;
    }

    // Initialize socket connection if not already connected
    if (!socketService.isConnected()) {
      socketService.connect(userData);
    }

    // Fetch initial notifications from localStorage
    const storedNotifications = JSON.parse(localStorage.getItem('notifications')) || [];
    setNotifications(storedNotifications);
    setLoading(false);

    // Set up socket event listeners for new notifications
    const newMessageHandler = (message) => {
      if (message.senderId !== userData.userId) {
        addNotification({
          type: 'message',
          message: `New message from ${message.senderName || 'Someone'}`,
          details: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
          timestamp: new Date().toISOString(),
          read: false,
          actionLink: `/conversation/${message.conversationId}`,
          senderId: message.senderId,
          senderName: message.senderName,
          senderPhoto: message.senderPhoto
        });
      }
    };

    const transactionHandler = (transaction) => {
      addNotification({
        type: 'transaction',
        message: `Transaction ${transaction.status}: ${transaction.amount}`,
        details: `Service: ${transaction.serviceName}`,
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: `/dashboard/transactions`,
        transactionId: transaction.id
      });
    };

    const applicationHandler = (application) => {
      addNotification({
        type: 'application',
        message: `Application ${application.status}`,
        details: `Service: ${application.serviceName}`,
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: `/dashboard/applications`,
        applicationId: application.id
      });
    };

    const serviceHandler = (service) => {
      addNotification({
        type: 'service',
        message: `Service Update: ${service.title}`,
        details: service.message || 'Your service status has changed',
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: `/dashboard/services/${service.id}`,
        serviceId: service.id
      });
    };

    // Register socket event listeners
    socketService.on('new_message', newMessageHandler);
    socketService.on('transaction_update', transactionHandler);
    socketService.on('application_update', applicationHandler);
    socketService.on('service_update', serviceHandler);

    // Clean up event listeners
    return () => {
      socketService.off('new_message', newMessageHandler);
      socketService.off('transaction_update', transactionHandler);
      socketService.off('application_update', applicationHandler);
      socketService.off('service_update', serviceHandler);
    };
  }, [navigate]);

  // Helper function to add new notification
  const addNotification = (notification) => {
    // Create a unique ID for the notification
    const notificationId = `${notification.type}-${notification.timestamp}-${JSON.stringify(notification.actionLink || '')}`;
    
    // Skip if we've already processed this notification
    if (processedIds.has(notificationId)) {
      console.log('Preventing duplicate notification:', notificationId);
      return;
    }
    
    // Add to processed set
    processedIds.add(notificationId);
    
    // Wait a short time before removing from processed set to prevent duplicates
    setTimeout(() => {
      processedIds.delete(notificationId);
    }, 5000);
    
    setNotifications(prev => {
      const newNotifications = [notification, ...prev];
      // Store in localStorage
      localStorage.setItem('notifications', JSON.stringify(newNotifications));
      // Show toast notification (only once)
      toast.info(notification.message, {
        toastId: notificationId // Ensure toast doesn't duplicate
      });
      return newNotifications;
    });
  };

  // Mark a notification as read
  const markAsRead = (index) => {
    setNotifications(prev => {
      const updated = [...prev];
      updated[index].read = true;
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }));
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  // Delete a notification
  const deleteNotification = (index) => {
    setNotifications(prev => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.setItem('notifications', JSON.stringify([]));
  };

  // Time Ago function to display "Just now", "X minutes ago", etc.
  const timeAgo = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diff = now - messageTime; // Difference in milliseconds

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return "Just now";
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="text-[#ffd700]" />;
      case 'transaction':
        return <CreditCard className="text-[#ffd700]" />;
      case 'application':
        return <Briefcase className="text-[#ffd700]" />;
      case 'service':
        return <Briefcase className="text-[#ffd700]" />;
      case 'alert':
        return <AlertCircle className="text-[#ffd700]" />;
      case 'success':
        return <CheckCircle className="text-[#ffd700]" />;
      default:
        return <Bell className="text-[#ffd700]" />;
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification, index) => {
    markAsRead(index);
    if (notification.actionLink) {
      navigate(notification.actionLink);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <style jsx="true">{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .notification-item {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>

      <div className="container mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold text-[#800000]">Notifications</h2>
          
          <div className="flex space-x-3">
            {notifications.length > 0 && (
              <>
                <button 
                  onClick={markAllAsRead}
                  className="px-3 py-1 bg-[#ffd700] text-[#800000] text-sm rounded-md hover:bg-[#ffe97d] transition-all shadow-sm"
                >
                  Mark all as read
                </button>
                <button 
                  onClick={clearAllNotifications}
                  className="px-3 py-1 bg-[#800000] text-[#ffd700] text-sm rounded-md hover:bg-[#6a0000] transition-all shadow-sm"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#800000]"></div>
          </div>
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-10">
            <Bell size={40} className="mx-auto text-[#800000] opacity-30" />
            <p className="mt-4 text-[#5d4037]">No notifications yet.</p>
          </div>
        )}

        {/* Notifications list */}
        {!loading && notifications.length > 0 && (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className={`p-4 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 
                  ${notification.read ? 'border-l-4 border-gray-300' : 'border-l-4 border-[#800000]'} 
                  notification-item cursor-pointer`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => handleNotificationClick(notification, index)}
              >
                <div className="flex items-start">
                  <div className="mr-3 p-2 bg-[#800000] rounded-full">
                    {notification.senderPhoto ? (
                      <img 
                        src={notification.senderPhoto} 
                        alt={notification.senderName || 'User'} 
                        className="h-10 w-10 rounded-full object-cover border-2 border-[#ffd700]"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/default-avatar.png';
                        }}
                      />
                    ) : (
                      <div className="h-10 w-10 flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${notification.read ? 'text-[#5d4037]' : 'text-[#800000]'}`}>
                      {notification.message}
                    </h3>
                    
                    {notification.details && (
                      <p className="mt-1 text-sm text-gray-600">{notification.details}</p>
                    )}
                    
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-gray-500">{timeAgo(notification.timestamp)}</span>
                      
                      {!notification.read && (
                        <span className="inline-block h-2 w-2 rounded-full bg-[#800000]"></span>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    className="ml-2 text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(index);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
