import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { reviewService } from './services/api';
import { Star, AlertCircle, ArrowLeft, Loader2, User, UserCheck, Filter, Clock, CheckCircle } from 'lucide-react';

const Reviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [receivedReviews, setReceivedReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'submitted', 'received'

  useEffect(() => {
    // Get user data from localStorage
    try {
      const storedUserData = JSON.parse(localStorage.getItem('userData') || '{}');
      setUserData(storedUserData);
    } catch (err) {
      console.error('Error parsing user data:', err);
    }

    const fetchAllReviews = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch reviews submitted by the user
        try {
          const userReviews = await reviewService.getUserReviews();
          console.log('User submitted reviews:', userReviews);
          
          // Process submitted reviews
          const processedSubmittedReviews = (userReviews || []).map(review => {
            // Use the display properties provided by the backend, fallback to constructed ones if needed
            return {
              id: review.ReviewId || review.id,
              applicationId: review.ApplicationId || review.applicationId,
              transactionId: review.TransactionId || review.transactionId,
              serviceId: review.ServiceId || review.serviceId,
              reviewText: review.ReviewText || review.reviewText || '',
              rating: review.Rating || review.rating || 0,
              createdAt: review.CreatedAt || review.createdAt,
              serviceTitle: review.ServiceTitle || review.serviceTitle || 'Service',
              reviewType: 'submitted',
              displayName: 'You',
              displayRole: review.ReviewerRole === 'client' ? 'As a client' : 'As a freelancer',
              revieweeName: review.RevieweeName || review.revieweeName || 'Service Provider',
              revieweeRole: review.RevieweeRole || review.revieweeRole || 'freelancer',
              displayText: review.displayText || `You reviewed ${review.RevieweeName || review.revieweeName || 'Service Provider'}`
            };
          });
          
          setReviews(processedSubmittedReviews);
        } catch (submittedError) {
          console.error('Error fetching submitted reviews:', submittedError);
          setReviews([]);
        }
        
        // Fetch reviews received by the user
        try {
          const received = await reviewService.getReceivedReviews();
          console.log('Received reviews:', received);
          
          // Process received reviews
          const processedReceivedReviews = (received || []).map(review => {
            // Use the display properties provided by the backend, fallback to constructed ones if needed
            return {
              id: review.ReviewId || review.id,
              applicationId: review.ApplicationId || review.applicationId,
              transactionId: review.TransactionId || review.transactionId,
              serviceId: review.ServiceId || review.serviceId,
              reviewText: review.ReviewText || review.reviewText || '',
              rating: review.Rating || review.rating || 0,
              createdAt: review.CreatedAt || review.createdAt,
              serviceTitle: review.ServiceTitle || review.serviceTitle || 'Service',
              reviewType: 'received',
              displayName: review.ReviewerName || review.reviewerName || 'Client',
              reviewerRole: review.ReviewerRole || review.reviewerRole || 'client',
              revieweeRole: review.RevieweeRole || review.revieweeRole || 'freelancer',
              displayText: review.displayText || `${review.ReviewerName || review.reviewerName || 'Client'} reviewed your service`
            };
          });
          
          setReceivedReviews(processedReceivedReviews);
        } catch (receivedError) {
          console.error('Error fetching received reviews:', receivedError);
          setReceivedReviews([]);
        }
        
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
        setError('Failed to load your reviews. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllReviews();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Render stars based on rating
  const renderRatingStars = (rating) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={18}
            fill={star <= rating ? '#FFD700' : 'none'}
            stroke={star <= rating ? '#FFD700' : 'currentColor'}
            className={star <= rating ? 'text-[#FFD700]' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  // Get all reviews based on active tab
  const getFilteredReviews = () => {
    if (activeTab === 'submitted') return reviews;
    if (activeTab === 'received') return receivedReviews;
    // For 'all', combine both and sort by date
    return [...reviews, ...receivedReviews].sort((a, b) => 
      new Date(b.createdAt || b.CreatedAt || Date.now()) - new Date(a.createdAt || a.CreatedAt || Date.now())
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-[#800000] border-t-[#FFD700] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Star className="text-[#FFD700]" size={24} fill="#FFD700" />
          </div>
        </div>
        <p className="mt-6 text-[#800000] font-medium animate-pulse">Loading your reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border-t-4 border-[#800000]">
          <AlertCircle size={48} className="mx-auto text-[#800000] mb-4" />
          <h2 className="text-2xl font-bold text-[#800000] mb-2">Error</h2>
          <p className="text-[#800000]/70 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="px-6 py-3 bg-[#800000] text-[#FFD700] rounded-full hover:bg-opacity-90 transition-all shadow-md flex items-center justify-center mx-auto"
          >
            <ArrowLeft size={18} className="mr-2" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const filteredReviews = getFilteredReviews();

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-[#800000]">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <button 
                  onClick={() => navigate('/dashboard')} 
                  className="p-2 mr-3 bg-[#800000]/10 hover:bg-[#800000]/20 rounded-full transition-all text-[#800000]"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-[#800000] flex items-center">
                    <Star className="mr-2 text-[#FFD700]" size={24} fill="#FFD700" />
                    My Reviews
                  </h2>
                  <p className="text-[#800000]/70 text-sm mt-1">
                    View all reviews you've received and submitted
                  </p>
                </div>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-[#FFD700]/30 mb-6 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 font-medium flex items-center rounded-t-lg transition-all ${
                  activeTab === 'all'
                    ? 'border-b-2 border-[#800000] text-[#800000] bg-[#FFD700]/10'
                    : 'text-[#800000]/70 hover:text-[#800000] hover:bg-[#FFD700]/5'
                }`}
              >
                <Filter size={16} className="mr-2" />
                All Reviews
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#800000]/10 text-[#800000]">
                  {reviews.length + receivedReviews.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('received')}
                className={`px-4 py-2 font-medium flex items-center rounded-t-lg transition-all ${
                  activeTab === 'received'
                    ? 'border-b-2 border-[#800000] text-[#800000] bg-[#FFD700]/10'
                    : 'text-[#800000]/70 hover:text-[#800000] hover:bg-[#FFD700]/5'
                }`}
              >
                <UserCheck size={16} className="mr-2" />
                Reviews Received
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#800000]/10 text-[#800000]">
                  {receivedReviews.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('submitted')}
                className={`px-4 py-2 font-medium flex items-center rounded-t-lg transition-all ${
                  activeTab === 'submitted'
                    ? 'border-b-2 border-[#800000] text-[#800000] bg-[#FFD700]/10'
                    : 'text-[#800000]/70 hover:text-[#800000] hover:bg-[#FFD700]/5'
                }`}
              >
                <Star size={16} className="mr-2" fill={activeTab === 'submitted' ? "#FFD700" : "none"} />
                Reviews Submitted
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#800000]/10 text-[#800000]">
                  {reviews.length}
                </span>
              </button>
            </div>
            
            {/* Reviews List */}
            {filteredReviews.length === 0 ? (
              <div className="text-center py-12 bg-[#f8f5f0] rounded-lg border border-dashed border-[#FFD700]/30">
                <div className="w-16 h-16 mx-auto bg-[#800000]/10 rounded-full flex items-center justify-center mb-4">
                  <Star size={32} className="text-[#FFD700]" fill="#FFD700" />
                </div>
                <p className="text-[#800000]/80 font-medium">No reviews found in this category.</p>
                <p className="text-[#800000]/60 mt-1 mb-4">Reviews will appear here after you complete transactions.</p>
                <button
                  onClick={() => navigate('/transaction-history')}
                  className="mt-4 inline-block py-2 px-6 bg-[#800000] text-[#FFD700] rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  View Transaction History
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredReviews.map((review, index) => (
                  <div 
                    key={review.id || review.ReviewId || `review-${index}`} 
                    className={`p-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border-l-4 
                      ${review.reviewType === 'received' 
                        ? 'bg-[#f8f5f0] border-[#800000]' 
                        : 'bg-[#f8f5f0] border-[#FFD700]'}`}
                    style={{animationDelay: `${index * 100}ms`}}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg text-[#800000]">
                          {review.serviceTitle || 'Service'}
                        </h3>
                        
                        <div className="mt-2 flex items-center flex-wrap gap-2">
                          <span 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                              ${review.reviewType === 'received' 
                                ? 'bg-[#800000]/10 text-[#800000]' 
                                : 'bg-[#FFD700]/20 text-[#800000]'}`}
                          >
                            {review.reviewType === 'received' ? (
                              <>
                                <UserCheck size={14} className="mr-1.5" />
                                Review Received
                              </>
                            ) : (
                              <>
                                <Star size={14} className="mr-1.5" fill="#FFD700" />
                                Review Submitted
                              </>
                            )}
                          </span>
                          
                          <p className="text-sm text-[#800000]/80">
                            {review.displayText}
                          </p>
                        </div>
                        
                        <div className="mt-3 flex items-center">
                          {renderRatingStars(review.rating)}
                          <span className="ml-2 text-sm text-[#800000]/70 font-medium">
                            {review.rating}/5
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-[#800000]/60 bg-white px-3 py-1 rounded-full shadow-sm border border-[#FFD700]/20 flex items-center">
                        <Clock size={14} className="mr-1.5 text-[#800000]/70" />
                        {formatDate(review.createdAt)}
                      </div>
                    </div>
                    
                    {review.reviewText && (
                      <div className="mt-4 text-[#800000]/80 bg-white p-4 rounded-lg border border-[#FFD700]/20 shadow-sm italic">
                        "{review.reviewText}"
                      </div>
                    )}
                    
                    <div className="mt-3 flex justify-between items-center">
                      <div className="text-xs text-[#800000]/60 bg-[#800000]/5 px-2 py-1 rounded">
                        Transaction #{review.transactionId || review.applicationId}
                      </div>
                      
                      <Link 
                        to={`/transaction-history`}
                        className="text-xs font-medium text-[#800000] hover:text-[#800000]/80 flex items-center"
                      >
                        View Transaction <ArrowLeft size={14} className="ml-1 transform rotate-180" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .space-y-6 > div {
    animation: fadeInUp 0.5s ease-out forwards;
  }
`;
document.head.appendChild(style);

export default Reviews;
