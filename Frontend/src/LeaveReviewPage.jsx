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
  
  useEffect(() => {
    const checkEligibilityAndFetchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
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
          
          // Get the userRole directly from the backend response
          // The backend correctly determines if the user is a client or freelancer based on the transaction
          const roleFromTransaction = eligibilityResponse.transaction.userRole;
          console.log('USER ROLE FROM BACKEND:', roleFromTransaction);
          
          if (!roleFromTransaction || (roleFromTransaction !== 'client' && roleFromTransaction !== 'freelancer')) {
            console.error('Invalid role received from backend:', roleFromTransaction);
            setError('Could not determine your role in this transaction');
            return;
          }
          
          setTransaction(eligibilityResponse.transaction);
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
          
          setTransaction(matchingTransaction);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate user role before submission
      if (!userRole || (userRole !== 'client' && userRole !== 'freelancer')) {
        console.error('Invalid user role for review submission:', userRole);
        setError('Cannot determine your role. Please try again later.');
        return;
      }
      
      console.log('Submitting review with details:', {
        applicationId: applicationId,
        rating: rating,
        reviewText: reviewText || '',
        userRole: userRole,
        revieweeRole: userRole === 'client' ? 'freelancer' : 'client',
        revieweeName: getRevieweeName()
      });
      
      // Submit the review with user role information
      await reviewService.submitReview(
        parseInt(applicationId, 10),
        rating,
        reviewText,
        userRole // Pass the user role to specify who is being reviewed
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
    
    // Logic fix: If the transaction has clientName that matches your logged-in information,
    // then you are the client and you should review the freelancer (ServiceOwnerName)
    // If the transaction has a freelancerName that matches you, then you're the freelancer
    // and should review the client
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currentUserName = userData.fullName;
    
    console.log('Current user data:', {
      userDataName: currentUserName,
      clientName: transaction.clientName,
      freelancerName: transaction.freelancerName,
      userRole: userRole
    });
    
    // Check if the current user is the client by comparing names
    if (currentUserName === transaction.clientName) {
      // User is the client, so they review the freelancer
      return transaction.freelancerName;
    } else if (currentUserName === transaction.freelancerName) {
      // User is the freelancer, so they review the client
      return transaction.clientName;
    } else {
      // Fallback to role-based logic if we can't match names
      return userRole === 'client' ? transaction.freelancerName : transaction.clientName;
    }
  };

  // Get the role title of the person being reviewed
  const getRevieweeRole = () => {
    // Logic fix: Similar approach as getRevieweeName 
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currentUserName = userData.fullName;
    
    if (currentUserName === transaction.clientName) {
      // User is the client, so they review the freelancer
      return 'Freelancer';
    } else if (currentUserName === transaction.freelancerName) {
      // User is the freelancer, so they review the client
      return 'Client';
    } else {
      // Fallback to role-based logic
      return userRole === 'client' ? 'Freelancer' : 'Client';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
        <p className="mt-4 text-gray-700">Loading...</p>
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
            onClick={() => navigate('/transaction-history')} 
            className="px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 transition-all flex items-center space-x-2 mx-auto"
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <Star size={48} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Review Submitted</h2>
          <p className="text-gray-600 mb-4">{successMessage}</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Transaction Not Found</h2>
          <p className="text-gray-600 mb-4">The transaction details could not be loaded.</p>
          <button 
            onClick={() => navigate('/transaction-history')} 
            className="px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 transition-all flex items-center space-x-2 mx-auto"
          >
            <ArrowLeft size={16} />
            <span>Back to Transaction History</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => navigate('/transaction-history')} 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-800">
                  Rate {getRevieweeRole()}: {getRevieweeName()}
                </h2>
              </div>
            </div>
            
            {/* Transaction Details */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg text-gray-800 mb-2">{transaction.serviceTitle}</h3>
              <div className="text-sm text-gray-600">
                <p>Transaction #{transaction.id}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-md">
                    <p className="font-medium">
                      <span className="font-bold">Your role:</span> {userRole === 'client' ? 'Client' : 'Freelancer'}
                    </p>
                  </div>
                  <div className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-md">
                    <p className="font-medium">
                      <span className="font-bold">You are rating:</span> {getRevieweeName()} 
                      ({getRevieweeRole()})
                    </p>
                  </div>
                  {transaction.postType && (
                    <div className={`${transaction.postType === 'client' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'} px-3 py-2 rounded-md`}>
                      <p className="font-medium">
                        <span className="font-bold">Post type:</span> {transaction.postType === 'client' ? 'Client Request' : 'Freelancer Service'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Review Form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Rating for {getRevieweeName()}</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((starValue) => (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => handleStarClick(starValue)}
                      className="focus:outline-none transition-all"
                    >
                      <Star
                        size={32}
                        fill={starValue <= rating ? '#FFC107' : 'none'}
                        stroke={starValue <= rating ? '#FFC107' : 'currentColor'}
                        className={`text-gray-400 ${starValue <= rating ? 'text-yellow-500' : ''}`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Review (Optional)</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={`Share your experience with this ${getRevieweeRole().toLowerCase()}...`}
                  className="w-full h-32 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                ></textarea>
              </div>
              
              <div className="mt-8">
                <button
                  type="submit"
                  disabled={isSubmitting || rating === 0}
                  className={`w-full py-3 px-4 flex items-center justify-center space-x-2 rounded-md transition-all ${
                    isSubmitting || rating === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#800000] text-white hover:bg-opacity-90'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Submit Review</span>
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
