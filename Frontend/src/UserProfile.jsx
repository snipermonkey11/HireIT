import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; 
import { messageService, userService } from './services/api';
import { User, MessageSquare, Star, Loader, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const UserProfile = () => {
  const { id } = useParams();  // Extract id from the URL
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchUserData();
  }, [id, retryCount]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Validate user ID 
      if (!id || isNaN(parseInt(id))) {
        setError('Invalid user ID');
        setLoading(false);
        return;
      }
      
      // Fetch user profile from API
      const userData = await userService.getUserProfile(id);
      
      // Filter reviews to remove self-reviews (where reviewer name equals user's own name)
      if (userData && userData.reviews && userData.reviews.length > 0) {
        userData.reviews = userData.reviews.filter(review => 
          review.reviewer?.name !== userData.fullName
        );
      }
      
      setUser(userData);
    } catch (err) {
      if (err.response?.status === 404) {
        setError(`User with ID ${id} not found`);
      } else {
        setError(err.response?.data?.error || 'Failed to load user profile');
      }
      toast.error('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleMessageClick = async () => {
    try {
      // First check if user is authenticated
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const token = userData.token || localStorage.getItem('token');
      
      if (!token) {
        // Save the current URL so we can redirect back after login
        sessionStorage.setItem('redirectAfterLogin', `/userprofile/${id}`);
        toast.info('Please log in to message this user');
        navigate('/login');
        return;
      }
      
      setStartingChat(true);
      // Start a new conversation with the user
      const response = await messageService.startConversation(id);
      
      // Navigate to the conversation
      navigate(`/conversation/${response.conversationId}`);
    } catch (err) {
      // Check if it's an auth error
      if (err.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        navigate('/login');
      } else {
        toast.error('Failed to start conversation');
      }
    } finally {
      setStartingChat(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="text-center">
          <Loader size={40} className="mx-auto text-[#800000] animate-spin mb-4" />
          <p className="text-gray-700">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto text-[#800000] mb-4" />
          <p className="text-lg text-[#800000] font-semibold mb-4">{error}</p>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all"
            >
              Go Back
            </button>
            <button 
              onClick={handleRetry}
              className="px-6 py-2 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
          <User size={48} className="mx-auto text-[#800000] mb-4" />
          <p className="text-lg text-[#800000] font-semibold">User not found</p>
          <button 
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Navigation */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-[#800000] hover:text-opacity-80 transition-all"
          >
            <ArrowLeft size={20} className="mr-2" />
            <span>Back</span>
          </button>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-[#800000] text-white p-8">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="flex-shrink-0 mb-4 md:mb-0">
                {user?.photo ? (
                  <img
                    src={user.photo}
                    alt={user.fullName}
                    className="w-24 h-24 rounded-full border-4 border-[#ffd700] object-cover shadow-lg"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#ffd700] flex items-center justify-center text-[#800000]">
                    <User size={36} />
                  </div>
                )}
              </div>
              <div className="md:ml-6 flex-1">
                <h2 className="text-3xl font-bold">{user.fullName}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  {user.grade && user.section && (
                    <span className="bg-[#ffd700] bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                      {user.grade} - {user.section}
                    </span>
                  )}
                  {user.email && (
                    <span className="bg-[#ffd700] bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Bio Section */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#800000] mb-4 flex items-center">
                <User className="mr-2" size={20} />
                Bio
              </h3>
              <div className="bg-[#f8f5f0] p-4 rounded-lg">
                <p className="text-gray-700">{user?.bio || 'This user has not written a bio yet.'}</p>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#800000] mb-4 flex items-center">
                <Star className="mr-2" size={20} />
                Reviews
              </h3>
              <div className="space-y-4">
                {user.reviews && user.reviews.length > 0 ? (
                  user.reviews.map((review, index) => (
                    <div key={review.id || index} className="bg-[#f8f5f0] p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <div className="bg-[#800000] text-white p-2 rounded-full mr-3">
                          {review.reviewer?.photo ? (
                            <img 
                              src={review.reviewer.photo} 
                              alt={review.reviewer.name}
                              className="w-6 h-6 rounded-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = null;
                              }}
                            />
                          ) : (
                            <User size={16} />
                          )}
                        </div>
                        <h4 className="font-semibold">{review.reviewer?.name || 'Anonymous'}</h4>
                      </div>
                      <p className="text-gray-700 mb-2">{review.text}</p>
                      <div className="flex text-[#ffd700]">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            fill={i < review.rating ? "#ffd700" : "none"}
                            className={i < review.rating ? "text-[#ffd700]" : "text-gray-300"}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#f8f5f0] p-4 rounded-lg text-center">
                    <p className="text-gray-500">No reviews yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Message Button */}
            <div className="flex justify-center mt-8">
              <button
                onClick={handleMessageClick}
                disabled={startingChat}
                className="flex items-center px-6 py-3 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingChat ? (
                  <>
                    <Loader size={20} className="animate-spin mr-2" />
                    Starting Conversation...
                  </>
                ) : (
                  <>
                    <MessageSquare size={20} className="mr-2" />
                    Message {user.fullName}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
