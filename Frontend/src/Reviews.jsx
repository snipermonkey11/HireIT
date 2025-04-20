import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { reviewService } from './services/api';
import { Star, AlertCircle, ArrowLeft, Loader2, User } from 'lucide-react';

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
        const userReviews = await reviewService.getUserReviews();
        console.log('User submitted reviews:', userReviews);
        
        // Process submitted reviews
        const processedSubmittedReviews = (userReviews || []).map(review => {
          // Extract reviewer data from metadata if available
          let reviewerRole = review.ReviewerRole || 'client';
          let reviewerName = review.ReviewerName || 'You';
          let revieweeName = review.RevieweeName || 'Service Provider';
          
          // Try to parse metadata for more information
          if (review.Metadata) {
            try {
              const metadata = JSON.parse(review.Metadata);
              reviewerRole = metadata.reviewerRole || reviewerRole;
              reviewerName = metadata.reviewerName || reviewerName;
              revieweeName = metadata.revieweeName || revieweeName;
            } catch (err) {
              console.warn('Could not parse review metadata:', err);
            }
          }
          
          return {
            ...review,
            reviewType: 'submitted',
            displayName: reviewerName,
            displayRole: reviewerRole === 'client' ? 'As a client' : 'As a freelancer',
            revieweeName: revieweeName,
            displayText: `You reviewed ${revieweeName}`
          };
        });
        
        // Fetch reviews received by the user
        const received = await reviewService.getReceivedReviews();
        console.log('Received reviews:', received);
        
        // Process received reviews
        const processedReceivedReviews = (received || []).map(review => {
          let reviewerName = review.ReviewerName || 'Client';
          
          // Try to parse metadata if available
          if (review.Metadata) {
            try {
              const metadata = JSON.parse(review.Metadata);
              reviewerName = metadata.reviewerName || reviewerName;
            } catch (err) {
              console.warn('Could not parse review metadata:', err);
            }
          }
          
          return {
            ...review,
            reviewType: 'received',
            displayName: reviewerName,
            displayText: `${reviewerName} reviewed your service`
          };
        });
        
        // Store both types separately
        setReviews(processedSubmittedReviews);
        setReceivedReviews(processedReceivedReviews);
        
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
            fill={star <= rating ? '#FFC107' : 'none'}
            stroke={star <= rating ? '#FFC107' : 'currentColor'}
            className={star <= rating ? 'text-yellow-500' : 'text-gray-400'}
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
      new Date(b.CreatedAt || b.createdAt) - new Date(a.CreatedAt || a.createdAt)
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
        <p className="mt-4 text-gray-700">Loading your reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 transition-all flex items-center space-x-2 mx-auto"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const filteredReviews = getFilteredReviews();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => navigate('/dashboard')} 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-800">
                  My Reviews
                </h2>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'all'
                    ? 'border-b-2 border-[#800000] text-[#800000]'
                    : 'text-gray-500 hover:text-[#800000]'
                }`}
              >
                All Reviews
              </button>
              <button
                onClick={() => setActiveTab('received')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'received'
                    ? 'border-b-2 border-[#800000] text-[#800000]'
                    : 'text-gray-500 hover:text-[#800000]'
                }`}
              >
                Reviews Received ({receivedReviews.length})
              </button>
              <button
                onClick={() => setActiveTab('submitted')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'submitted'
                    ? 'border-b-2 border-[#800000] text-[#800000]'
                    : 'text-gray-500 hover:text-[#800000]'
                }`}
              >
                Reviews Submitted ({reviews.length})
              </button>
            </div>
            
            {/* Reviews List */}
            {filteredReviews.length === 0 ? (
              <div className="text-center py-10">
                <Star size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No reviews found in this category.</p>
                <button
                  onClick={() => navigate('/transaction-history')}
                  className="mt-4 px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 transition-all"
                >
                  View Transaction History
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredReviews.map((review) => (
                  <div 
                    key={review.ReviewId || review.id} 
                    className={`p-5 rounded-lg shadow-md hover:shadow-lg transition-all border-l-4 
                      ${review.reviewType === 'received' 
                        ? 'bg-blue-50 border-blue-500' 
                        : 'bg-green-50 border-green-500'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">
                          {review.ServiceTitle || review.serviceTitle || 'Service'}
                        </h3>
                        
                        <div className="mt-2 flex items-center">
                          <span 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mr-3
                              ${review.reviewType === 'received' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'}`}
                          >
                            {review.reviewType === 'received' ? 'Review Received' : 'Review Submitted'}
                          </span>
                          
                          <p className="text-sm text-gray-700">
                            {review.displayText}
                          </p>
                        </div>
                        
                        <div className="mt-3 flex items-center">
                          {renderRatingStars(review.Rating || review.rating)}
                          <span className="ml-2 text-sm text-gray-600">
                            {review.Rating || review.rating}/5
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(review.CreatedAt || review.createdAt)}
                      </div>
                    </div>
                    
                    {(review.ReviewText || review.reviewText) && (
                      <div className="mt-3 text-gray-700 bg-white p-4 rounded-md border border-gray-100">
                        "{review.ReviewText || review.reviewText}"
                      </div>
                    )}
                    
                    <div className="mt-3 text-xs text-gray-500">
                      Transaction #{review.ApplicationId || review.applicationId}
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

export default Reviews;
