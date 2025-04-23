import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { transactionHistoryService, reviewService } from './services/api';
import { Star, AlertCircle, ArrowLeft, Send, Loader2 } from 'lucide-react';

const LeaveReviewPage = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'client' or 'freelancer'
  const [hoverRating, setHoverRating] = useState(0); // For star hover effect
  
  useEffect(() => {
    const checkEligibilityAndFetchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get current user data for validation
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const currentUserId = userData.userId || userData.id;
        
        if (!currentUserId) {
          setError('User information not found. Please log in again.');
          return;
        }
        
        console.log('Current User ID:', currentUserId);
        
        // First check if the user is eligible to leave a review
        const eligibilityResponse = await reviewService.checkReviewEligibility(applicationId);
        
        console.log('REVIEW ELIGIBILITY:', eligibilityResponse);
        
        if (!eligibilityResponse.eligible) {
          setError(eligibilityResponse.error);
          return;
        }
        
        // If eligible, use the transaction directly from the eligibility response
        if (eligibilityResponse.transaction) {
          console.log('TRANSACTION:', eligibilityResponse.transaction);
          console.log('TRANSACTION FIELDS:', Object.keys(eligibilityResponse.transaction));
          console.log('CLIENT AND FREELANCER INFO:', {
            clientId: eligibilityResponse.transaction.ClientId || eligibilityResponse.transaction.clientId || eligibilityResponse.transaction.UserId,
            freelancerId: eligibilityResponse.transaction.FreelancerId || eligibilityResponse.transaction.freelancerId || eligibilityResponse.transaction.ServiceOwnerId,
            clientName: eligibilityResponse.transaction.clientName || eligibilityResponse.transaction.ClientName,
            freelancerName: eligibilityResponse.transaction.freelancerName || eligibilityResponse.transaction.FreelancerName || eligibilityResponse.transaction.ServiceOwnerName
          });
          
          // Get the userRole directly from the backend response
          // The backend correctly determines if the user is a client or freelancer based on the transaction
          const roleFromTransaction = eligibilityResponse.transaction.userRole;
          console.log('USER ROLE FROM BACKEND:', roleFromTransaction);
          
          if (!roleFromTransaction || (roleFromTransaction !== 'client' && roleFromTransaction !== 'freelancer')) {
            console.error('Invalid role received from backend:', roleFromTransaction);
            setError('Could not determine your role in this transaction');
            return;
          }
          
          // Normalize transaction data to ensure all fields are available regardless of source format
          const normalizedTransaction = {
            ...eligibilityResponse.transaction,
            // Ensure we have standardized field names regardless of source format
            TransactionId: eligibilityResponse.transaction.TransactionId || eligibilityResponse.transaction.id,
            id: eligibilityResponse.transaction.id || eligibilityResponse.transaction.TransactionId,
            // Client fields
            ClientId: eligibilityResponse.transaction.ClientId || eligibilityResponse.transaction.clientId || eligibilityResponse.transaction.UserId,
            clientId: eligibilityResponse.transaction.clientId || eligibilityResponse.transaction.ClientId || eligibilityResponse.transaction.UserId,
            ClientName: eligibilityResponse.transaction.ClientName || eligibilityResponse.transaction.clientName || 'Client',
            clientName: eligibilityResponse.transaction.clientName || eligibilityResponse.transaction.ClientName || 'Client',
            // Freelancer fields
            FreelancerId: eligibilityResponse.transaction.FreelancerId || eligibilityResponse.transaction.freelancerId || eligibilityResponse.transaction.ServiceOwnerId,
            freelancerId: eligibilityResponse.transaction.freelancerId || eligibilityResponse.transaction.FreelancerId || eligibilityResponse.transaction.ServiceOwnerId,
            FreelancerName: eligibilityResponse.transaction.FreelancerName || eligibilityResponse.transaction.freelancerName || eligibilityResponse.transaction.ServiceOwnerName || 'Freelancer',
            freelancerName: eligibilityResponse.transaction.freelancerName || eligibilityResponse.transaction.FreelancerName || eligibilityResponse.transaction.ServiceOwnerName || 'Freelancer',
            // Make sure post type is available
            postType: eligibilityResponse.transaction.postType || 'client' // Default to client if not specified
          };
          
          console.log('NORMALIZED TRANSACTION:', normalizedTransaction);
          
          // Verify user is not trying to review themselves
          const clientId = normalizedTransaction.ClientId || normalizedTransaction.clientId;
          const freelancerId = normalizedTransaction.FreelancerId || normalizedTransaction.freelancerId;
          
          console.log('Role verification:', {
            currentUserId,
            clientId,
            freelancerId,
            userRole: roleFromTransaction
          });
          
          if (roleFromTransaction === 'client' && currentUserId === freelancerId) {
            setError('System error: You cannot review yourself. Please contact support.');
            return;
          }
          
          if (roleFromTransaction === 'freelancer' && currentUserId === clientId) {
            setError('System error: You cannot review yourself. Please contact support.');
            return;
          }
          
          setTransaction(normalizedTransaction);
          setUserRole(roleFromTransaction);
        } else {
          // Fallback to get transaction details
          const transactions = await transactionHistoryService.getTransactionHistory();
          const matchingTransaction = transactions.find(t => 
            String(t.applicationId) === String(applicationId));
          
          console.log('MATCHING TRANSACTION:', matchingTransaction);
          
          if (!matchingTransaction) {
            setError('Transaction details not found');
            return;
          }
          
          // Use the role provided by the transaction history service
          const roleFromTransaction = matchingTransaction.userRole;
          console.log('USER ROLE FROM TRANSACTION HISTORY:', roleFromTransaction);
          
          if (!roleFromTransaction || (roleFromTransaction !== 'client' && roleFromTransaction !== 'freelancer')) {
            console.error('Invalid role from transaction history:', roleFromTransaction);
            setError('Could not determine your role in this transaction');
            return;
          }
          
          // Normalize transaction data from transaction history
          const normalizedTransaction = {
            ...matchingTransaction,
            // Ensure we have standardized field names regardless of source format
            TransactionId: matchingTransaction.TransactionId || matchingTransaction.id,
            id: matchingTransaction.id || matchingTransaction.TransactionId,
            // Client fields
            ClientId: matchingTransaction.ClientId || matchingTransaction.clientId || matchingTransaction.UserId,
            clientId: matchingTransaction.clientId || matchingTransaction.ClientId || matchingTransaction.UserId,
            ClientName: matchingTransaction.ClientName || matchingTransaction.clientName || 'Client',
            clientName: matchingTransaction.clientName || matchingTransaction.ClientName || 'Client',
            // Freelancer fields
            FreelancerId: matchingTransaction.FreelancerId || matchingTransaction.freelancerId || matchingTransaction.ServiceOwnerId,
            freelancerId: matchingTransaction.freelancerId || matchingTransaction.FreelancerId || matchingTransaction.ServiceOwnerId,
            FreelancerName: matchingTransaction.FreelancerName || matchingTransaction.freelancerName || matchingTransaction.ServiceOwnerName || 'Freelancer',
            freelancerName: matchingTransaction.freelancerName || matchingTransaction.FreelancerName || matchingTransaction.ServiceOwnerName || 'Freelancer',
            // Make sure post type is available
            postType: matchingTransaction.postType || 'client' // Default to client if not specified
          };
          
          console.log('NORMALIZED TRANSACTION:', normalizedTransaction);
          
          // Verify user is not trying to review themselves
          const clientId = normalizedTransaction.ClientId || normalizedTransaction.clientId;
          const freelancerId = normalizedTransaction.FreelancerId || normalizedTransaction.freelancerId;
          
          if (roleFromTransaction === 'client' && currentUserId === freelancerId) {
            setError('System error: You cannot review yourself. Please contact support.');
            return;
          }
          
          if (roleFromTransaction === 'freelancer' && currentUserId === clientId) {
            setError('System error: You cannot review yourself. Please contact support.');
            return;
          }
          
          setTransaction(normalizedTransaction);
          setUserRole(roleFromTransaction);
        }
      } catch (err) {
        console.error('Error loading review details:', err);
        setError('Failed to load details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    checkEligibilityAndFetchDetails();
  }, [applicationId]);

  const handleStarClick = (selectedRating) => {
    setRating(selectedRating);
  };

  const handleStarHover = (hoveredRating) => {
    setHoverRating(hoveredRating);
  };

  const handleStarLeave = () => {
    setHoverRating(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Get current user data for validation
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const currentUserId = userData.userId || userData.id;
      
      // Validate user role before submission
      if (!userRole || (userRole !== 'client' && userRole !== 'freelancer')) {
        console.error('Invalid user role for review submission:', userRole);
        setError('Cannot determine your role. Please try again later.');
        return;
      }
      
      // Get reviewee information
      const revieweeName = getRevieweeName();
      const revieweeRole = getRevieweeRole().toLowerCase(); // Lowercase for API submission
      
      // Determine reviewee ID based on roles AND post type
      let revieweeId;
      if (userRole === 'client') {
        // Client is reviewing the freelancer
        if (transaction.postType === 'client') {
          // For client requests: freelancer is the applicant
          revieweeId = transaction.FreelancerId || transaction.freelancerId || transaction.ApplicantId;
        } else {
          // For freelancer services: freelancer is the service owner
          revieweeId = transaction.ServiceOwnerId || transaction.sellerId;
        }
        
        // Additional debugging
        console.log('Client reviewing freelancer:', {
          revieweeId,
          currentUserId,
          postType: transaction.postType,
          availableIds: {
            FreelancerId: transaction.FreelancerId,
            freelancerId: transaction.freelancerId,
            ServiceOwnerId: transaction.ServiceOwnerId,
            ApplicantId: transaction.ApplicantId,
            sellerId: transaction.sellerId
          }
        });
      } else {
        // Freelancer is reviewing the client
        if (transaction.postType === 'client') {
          // For client requests: client is the service owner
          revieweeId = transaction.ServiceOwnerId || transaction.ClientId || transaction.clientId || transaction.UserId;
        } else {
          // For freelancer services: client is the applicant
          revieweeId = transaction.ApplicantId || transaction.UserId || transaction.clientId;
        }
        
        // Additional debugging
        console.log('Freelancer reviewing client:', {
          revieweeId,
          currentUserId,
          postType: transaction.postType,
          availableIds: {
            ClientId: transaction.ClientId, 
            clientId: transaction.clientId,
            ServiceOwnerId: transaction.ServiceOwnerId,
            ApplicantId: transaction.ApplicantId,
            UserId: transaction.UserId
          }
        });
      }
      
      // Verify not reviewing self
      if (revieweeId === currentUserId) {
        setError('System error: You cannot review yourself. Please contact support.');
        return;
      }
      
      console.log('Submitting review with details:', {
        applicationId: applicationId,
        rating: rating,
        reviewText: reviewText || '',
        userRole: userRole,
        revieweeRole: revieweeRole,
        revieweeName: revieweeName,
        revieweeId: revieweeId,
        currentUserId: currentUserId,
        postType: transaction.postType
      });
      
      // Submit the review with complete information
      await reviewService.submitReview(
        parseInt(applicationId, 10),
        rating,
        reviewText,
        userRole, // Pass the user role to specify who is being reviewed
        {
          revieweeName: revieweeName,
          revieweeRole: revieweeRole,
          revieweeId: revieweeId
        }
      );
      
      setSuccessMessage('Your review has been submitted successfully!');
      
      // Redirect back to transaction history after a brief delay
      setTimeout(() => {
        navigate('/transaction-history');
      }, 2000);
      
    } catch (err) {
      // Handle different types of errors
      if (err.response?.data?.error) {
        // Display both the error and details if available
        setError(
          err.response.data.details 
            ? `${err.response.data.error}: ${err.response.data.details}` 
            : err.response.data.error
        );
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get the name of the person being reviewed
  const getRevieweeName = () => {
    if (!transaction) return '';
    
    // Get current user data for comparison
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currentUserId = userData.userId || userData.id;
    
    // Get the name of the person being reviewed based on user role AND post type
    if (userRole === 'client') {
      // If user is client, they review the freelancer
      // For client posts, freelancer is the applicant
      // For freelancer posts, freelancer is the service owner
      const freelancerId = transaction.postType === 'client' 
        ? transaction.FreelancerId || transaction.freelancerId || transaction.ApplicantId
        : transaction.ServiceOwnerId || transaction.sellerId;
      
      // Make sure we're not returning our own name
      if (currentUserId === freelancerId) {
        console.error('Role determination issue: Current user is both client and freelancer', {
          currentUserId,
          freelancerId,
          transaction
        });
        return 'Error: User role conflict';
      }
      
      return transaction.postType === 'client'
        ? transaction.freelancerName || transaction.FreelancerName || 'Freelancer'
        : transaction.ServiceOwnerName || transaction.ClientName || 'Freelancer';
    } else {
      // If user is freelancer, they review the client
      // For client posts, client is the service owner
      // For freelancer posts, client is the applicant
      const clientId = transaction.postType === 'client'
        ? transaction.ServiceOwnerId || transaction.ClientId || transaction.clientId || transaction.UserId
        : transaction.ApplicantId || transaction.UserId;
      
      // Make sure we're not returning our own name
      if (currentUserId === clientId) {
        console.error('Role determination issue: Current user is both freelancer and client', {
          currentUserId,
          clientId,
          transaction
        });
        return 'Error: User role conflict';
      }
      
      return transaction.postType === 'client'
        ? transaction.clientName || transaction.ClientName || transaction.ownerName || 'Client'
        : transaction.FreelancerName || transaction.clientName || 'Client';
    }
  };

  // Get the role of the person being reviewed
  const getRevieweeRole = () => {
    if (!transaction) return '';
    
    // The reviewee's role is always the opposite of the current user's role
    return userRole === 'client' ? 'Freelancer' : 'Client';
  };

  // Get rating text based on the rating value
  const getRatingText = (ratingValue) => {
    const displayRating = hoverRating || ratingValue;
    switch (displayRating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Select Rating';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 relative animate-spin">
          <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-4 border-[#800000] border-t-[#FFD700] animate-pulse"></div>
          <div className="absolute top-2 left-2 right-2 bottom-2 rounded-full border-4 border-t-4 border-[#800000] border-opacity-60 border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-4 text-[#800000] font-medium">Loading your review form...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center border-t-4 border-[#800000] transform transition-all hover:scale-105 duration-300">
          <AlertCircle size={48} className="mx-auto text-[#800000] mb-4" />
          <h2 className="text-2xl font-bold text-[#800000] mb-2">Error</h2>
          <p className="text-[#800000]/80 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/transaction-history')} 
            className="px-6 py-3 bg-[#800000] text-[#FFD700] rounded-full hover:bg-[#800000]/90 transition-all flex items-center space-x-2 mx-auto shadow-md"
          >
            <ArrowLeft size={16} />
            <span>Back to Transaction History</span>
          </button>
        </div>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border-t-4 border-[#800000] transform animate-fade-in-up">
          <div className="w-20 h-20 mx-auto bg-[#800000] rounded-full flex items-center justify-center mb-6">
            <Star size={40} className="text-[#FFD700]" fill="#FFD700" />
          </div>
          <h2 className="text-2xl font-bold text-[#800000] mb-4">Review Submitted</h2>
          <p className="text-[#800000]/80 mb-6">{successMessage}</p>
          <div className="mt-4 animate-pulse">
            <p className="text-[#800000]/60">Redirecting to Transaction History...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center border-t-4 border-[#800000] transform transition-all hover:scale-105 duration-300">
          <AlertCircle size={48} className="mx-auto text-[#FFD700] mb-4" />
          <h2 className="text-2xl font-bold text-[#800000] mb-2">Transaction Not Found</h2>
          <p className="text-[#800000]/80 mb-6">The transaction details could not be loaded.</p>
          <button 
            onClick={() => navigate('/transaction-history')} 
            className="px-6 py-3 bg-[#800000] text-[#FFD700] rounded-full hover:bg-[#800000]/90 transition-all flex items-center space-x-2 mx-auto shadow-md"
          >
            <ArrowLeft size={16} />
            <span>Back to Transaction History</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-[#FFD700]/20 transform transition-all hover:shadow-xl">
          <div className="bg-[#800000] text-white p-6">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/transaction-history')} 
                className="p-2 hover:bg-[#800000]/80 rounded-full transition-colors flex items-center justify-center"
              >
                <ArrowLeft size={20} className="text-[#FFD700]" />
              </button>
              <h2 className="text-2xl font-bold">
                Review Experience
              </h2>
            </div>
          </div>
          
          <div className="p-8">
            {/* Transaction Details */}
            <div className="mb-8 bg-[#FFF9E6] p-6 rounded-lg border border-[#FFD700]/30">
              <h3 className="font-semibold text-xl text-[#800000] mb-4 border-b border-[#FFD700]/20 pb-2">
                {transaction.serviceTitle}
              </h3>
              <div className="text-[#800000]/80">
                <p className="mb-4">Transaction #{transaction.id || transaction.TransactionId}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-[#FFD700]/20 shadow-sm transition-all hover:shadow-md">
                    <p className="text-[#800000] font-medium flex items-center">
                      <span className="inline-block w-3 h-3 bg-[#800000] rounded-full mr-2"></span>
                      <span className="font-bold">Your role:</span> 
                      <span className="ml-2">{userRole === 'client' ? 'Client (Service Requester)' : 'Freelancer (Service Provider)'}</span>
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-[#FFD700]/20 shadow-sm transition-all hover:shadow-md">
                    <p className="text-[#800000] font-medium flex items-center">
                      <span className="inline-block w-3 h-3 bg-[#FFD700] rounded-full mr-2"></span>
                      <span className="font-bold">You are reviewing:</span> 
                      <span className="ml-2">{getRevieweeName()} ({getRevieweeRole()})</span>
                    </p>
                  </div>
                </div>
                
                {transaction.postType && (
                  <div className="mt-4 bg-white p-4 rounded-lg border border-[#FFD700]/20 shadow-sm">
                    <p className="text-[#800000] font-medium">
                      <span className="font-bold">Post type:</span> {transaction.postType === 'client' ? 'Client Request' : 'Freelancer Service'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Review Form */}
            <form onSubmit={handleSubmit} className="animate-fade-in">
              <div className="mb-8">
                <label className="block text-[#800000] font-medium mb-4">How would you rate your experience with {getRevieweeName()}?</label>
                <div className="flex justify-center space-x-4 mb-2">
                  {[1, 2, 3, 4, 5].map((starValue) => (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => handleStarClick(starValue)}
                      onMouseEnter={() => handleStarHover(starValue)}
                      onMouseLeave={handleStarLeave}
                      className="focus:outline-none transition-all transform hover:scale-110 duration-200"
                    >
                      <Star
                        size={40}
                        fill={(hoverRating || rating) >= starValue ? '#FFD700' : 'none'}
                        stroke={(hoverRating || rating) >= starValue ? '#FFD700' : '#800000'}
                        strokeWidth={1.5}
                        className={`${(hoverRating || rating) >= starValue ? 'text-[#FFD700]' : 'text-[#800000]/40'}`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center text-[#800000] font-medium mt-2 h-6 text-lg">
                  {getRatingText(rating)}
                </p>
              </div>
              
              <div className="mb-8">
                <label className="block text-[#800000] font-medium mb-3">Share your experience (Optional)</label>
                <div className="relative">
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder={`Tell others about your experience with this ${getRevieweeRole()}...`}
                    className="w-full h-32 p-4 border-2 border-[#FFD700]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-[#FFD700] bg-white shadow-sm resize-none transition-all"
                  ></textarea>
                  <div className="absolute bottom-3 right-3 text-[#800000]/50 text-sm">
                    {reviewText.length} / 500
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <button
                  type="submit"
                  disabled={isSubmitting || rating === 0}
                  className={`w-full py-4 px-6 flex items-center justify-center space-x-3 rounded-full transition-all shadow-lg transform hover:translate-y-[-2px] ${
                    isSubmitting || rating === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#800000] text-[#FFD700] hover:bg-[#800000]/90'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      <span className="font-bold">Submit Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveReviewPage;

// Add these styles to your global CSS or component
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in-up {
    animation: fade-in-up 0.5s ease-out forwards;
  }
  
  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.5s ease-out forwards;
  }
`;
document.head.appendChild(styleTag);
