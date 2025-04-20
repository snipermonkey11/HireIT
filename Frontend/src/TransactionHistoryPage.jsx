import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { transactionHistoryService } from './services/api';

const TransactionHistoryPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTransactionHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const data = await transactionHistoryService.getTransactionHistory();
        console.log('Transaction history data:', data);
        
        if (data && data.length > 0) {
          // Log the first transaction to see its structure
          console.log('Sample transaction:', {
            id: data[0].id,
            userRole: data[0].userRole,
            postType: data[0].postType,
            clientName: data[0].clientName,
            freelancerName: data[0].freelancerName,
            status: data[0].status
          });
        }
        
        // Use the data directly from the API without additional processing
        setTransactions(data);
        setFilteredTransactions(data);
      } catch (err) {
        setError('Failed to load transaction history. Please try again later.');
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactionHistory();
  }, []);

  useEffect(() => {
    if (selectedFilter === 'all') {
      setFilteredTransactions(transactions);
    } else if (selectedFilter === 'client') {
      setFilteredTransactions(transactions.filter(t => t.userRole === 'client'));
    } else if (selectedFilter === 'freelancer') {
      setFilteredTransactions(transactions.filter(t => t.userRole === 'freelancer'));
    } else if (selectedFilter === 'completed') {
      setFilteredTransactions(transactions.filter(t => 
        t.status === 'Completed' || t.status === 'completed'
      ));
    } else if (selectedFilter === 'pending') {
      setFilteredTransactions(transactions.filter(t => 
        t.status !== 'Completed' && t.status !== 'completed'
      ));
    }
  }, [selectedFilter, transactions]);

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  const handleLeaveReview = (applicationId) => {
    if (!applicationId) {
      return;
    }
    navigate(`/leave-review/${applicationId}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    if (!status) return 'bg-gray-100 text-gray-800';
    
    if (statusLower === 'completed' || statusLower === 'approved') {
      return 'bg-green-100 text-green-800';
    } else if (statusLower === 'pending' || statusLower === 'service started') {
      return 'bg-blue-100 text-blue-800';
    } else if (statusLower === 'waiting for approval') {
      return 'bg-yellow-100 text-yellow-800';
    } else if (statusLower === 'rejected' || statusLower === 'proof rejected') {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  /* Add helper function to ensure safe rendering */
  const SafeRender = ({ value, fallback = 'N/A' }) => {
    return value !== undefined && value !== null ? value : fallback;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#800000]">Transaction History</h2>
          <p className="text-gray-600 mt-2">View your completed transactions and leave reviews</p>
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedFilter === 'all' 
                  ? 'bg-[#800000] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => handleFilterChange('client')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedFilter === 'client' 
                  ? 'bg-[#800000] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              My Client Requests
            </button>
            <button 
              onClick={() => handleFilterChange('freelancer')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedFilter === 'freelancer' 
                  ? 'bg-[#800000] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              My Freelancer Work
            </button>
            <button 
              onClick={() => handleFilterChange('completed')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedFilter === 'completed' 
                  ? 'bg-[#800000] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed
            </button>
            <button 
              onClick={() => handleFilterChange('pending')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedFilter === 'pending' 
                  ? 'bg-[#800000] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Progress
            </button>
          </div>
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Transactions Found</h3>
            <p className="text-gray-500 mb-4">
              {selectedFilter !== 'all' 
                ? `No ${selectedFilter} transactions found.` 
                : "You don't have any transactions yet."}
            </p>
            <Link 
              to="/discover" 
              className="inline-block px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 transition-all"
            >
              Explore Services
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-[#800000]"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{transaction.serviceTitle}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Transaction #{transaction.id} • {formatDate(transaction.completedDate || transaction.createdAt)}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full font-medium text-sm ${getStatusColor(transaction.status)}`}>
                      {transaction.status || 'Unknown Status'}
                    </div>
                  </div>
                  
                  {/* Transaction Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="text-sm text-gray-500">Client:</div>
                          <div className="font-medium">{transaction.clientName}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <div className="font-medium text-[#800000]">
                          {transaction.userRole === 'client' 
                            ? 'You are the Client' 
                            : transaction.userRole === 'freelancer'
                              ? 'You are the Freelancer'
                              : 'Unknown Role'}
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="text-sm text-gray-500">Method:</div>
                          <div className="font-medium">{transaction.paymentMethod || 'Face to Face'}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Column */}
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="text-sm text-gray-500">Freelancer:</div>
                          <div className="font-medium">{transaction.freelancerName}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V5z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="text-sm text-gray-500">Amount:</div>
                          <div className="font-medium">₱{transaction.amount || transaction.price}</div>
                        </div>
                      </div>
                      
                      {transaction.referenceNumber && (
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <div className="text-sm text-gray-500">Reference #:</div>
                            <div className="font-medium">{transaction.referenceNumber}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Type Indicator - show if it's a client request */}
                  {transaction.postType === 'client' && (
                    <div className="mb-4 bg-blue-50 text-blue-800 px-3 py-1 rounded-md inline-block text-sm font-medium">
                      Client Request
                    </div>
                  )}

                  {/* Review Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-gray-700">
                        {transaction.hasReviewed 
                          ? 'You left a review' 
                          : 'No review submitted yet'}
                      </span>
                    </div>
                    
                    {/* Show review button for any user role if they haven't reviewed yet and transaction is completed */}
                    {!transaction.hasReviewed && 
                     (transaction.status === 'Completed' || transaction.status === 'completed') && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLeaveReview(transaction.applicationId)}
                          className="px-4 py-2 bg-[#800000] text-white rounded-md hover:bg-opacity-90 flex items-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                          </svg>
                          <span>
                            {transaction.userRole === 'client' 
                              ? 'Rate Freelancer' 
                              : transaction.userRole === 'freelancer' 
                                ? 'Rate Client' 
                                : 'Leave Review'}
                          </span>
                        </button>
                      </div>
                    )}
                    
                    {/* Show link to project status for in-progress transactions */}
                    {transaction.status !== 'Completed' && transaction.status !== 'completed' && (
                      <Link
                        to="/project-status"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-opacity-90"
                      >
                        View Project Status
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistoryPage;
