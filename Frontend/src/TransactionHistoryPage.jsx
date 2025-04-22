import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { transactionHistoryService } from './services/api';
import { Loader2, AlertCircle, Filter, Calendar, Users, CreditCard, Clock, Star, DollarSign, FileText, Tag, ArrowRight, Search, UserCheck, UserIcon } from 'lucide-react';

const TransactionHistoryPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTransactionHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const data = await transactionHistoryService.getTransactionHistory();
        console.log('Transaction history data:', data);
        
        if (data && data.length > 0) {
          console.log('Sample transaction:', {
            id: data[0].id,
            userRole: data[0].userRole,
            postType: data[0].postType,
            clientName: data[0].clientName,
            freelancerName: data[0].freelancerName,
            status: data[0].status
          });
        }
        
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
    let filtered = [...transactions];
    
    // Apply filter
    if (selectedFilter === 'client') {
      filtered = filtered.filter(t => t.userRole === 'client');
    } else if (selectedFilter === 'freelancer') {
      filtered = filtered.filter(t => t.userRole === 'freelancer');
    } else if (selectedFilter === 'completed') {
      filtered = filtered.filter(t => 
        t.status === 'Completed' || t.status === 'completed'
      );
    } else if (selectedFilter === 'pending') {
      filtered = filtered.filter(t => 
        t.status !== 'Completed' && t.status !== 'completed'
      );
    }
    
    // Apply search
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        (t.serviceTitle && t.serviceTitle.toLowerCase().includes(searchLower)) ||
        (t.clientName && t.clientName.toLowerCase().includes(searchLower)) ||
        (t.freelancerName && t.freelancerName.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredTransactions(filtered);
  }, [selectedFilter, transactions, searchTerm]);

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
      return 'bg-[#800000] text-[#FFD700] border border-[#FFD700]/30';
    } else if (statusLower === 'pending' || statusLower === 'service started') {
      return 'bg-[#FFF9E6] text-[#800000] border border-[#800000]/30';
    } else if (statusLower === 'waiting for approval') {
      return 'bg-[#FFD700]/20 text-[#800000] border border-[#800000]/30';
    } else if (statusLower === 'rejected' || statusLower === 'proof rejected') {
      return 'bg-red-100 text-[#800000] border border-[#800000]/30';
    } else {
      return 'bg-gray-100 text-[#800000] border border-[#800000]/30';
    }
  };

  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase();
    if (!status) return <AlertCircle size={14} />;
    
    if (statusLower === 'completed' || statusLower === 'approved') {
      return <UserCheck size={14} className="mr-1" />;
    } else if (statusLower === 'pending' || statusLower === 'service started') {
      return <Clock size={14} className="mr-1" />;
    } else if (statusLower === 'waiting for approval') {
      return <Users size={14} className="mr-1" />;
    } else if (statusLower === 'rejected' || statusLower === 'proof rejected') {
      return <AlertCircle size={14} className="mr-1" />;
    } else {
      return <FileText size={14} className="mr-1" />;
    }
  };

  /* Add helper function to ensure safe rendering */
  const SafeRender = ({ value, fallback = 'N/A' }) => {
    return value !== undefined && value !== null ? value : fallback;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full border-4 border-t-4 border-[#800000] border-t-[#FFD700] animate-spin"></div>
          <div className="absolute w-10 h-10 rounded-full border-4 border-t-4 border-[#800000]/30 border-t-[#FFD700]/30 animate-spin-reverse"></div>
        </div>
        <p className="mt-6 text-[#800000] font-medium animate-pulse">Loading your transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border-t-4 border-[#800000] transform transition-all hover:scale-105 duration-300">
          <AlertCircle size={48} className="mx-auto text-[#800000] mb-4" />
          <h2 className="text-2xl font-bold text-[#800000] mb-2">Error</h2>
          <p className="text-[#800000]/80 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-[#800000] text-[#FFD700] rounded-full hover:bg-[#800000]/90 transition-all shadow-md flex items-center justify-center mx-auto space-x-2"
          >
            <Loader2 size={16} className="mr-2" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6 transition-all duration-300">
      <div className="container mx-auto max-w-5xl">
        {/* Header Section with Animated Underline */}
        <div className="mb-10 relative">
          <h2 className="text-3xl font-bold text-[#800000] relative inline-block">
            Transaction History
            <span className="absolute bottom-0 left-0 w-1/2 h-1 bg-[#FFD700] transform transition-all duration-500 group-hover:w-full animate-pulse-slow rounded-full"></span>
          </h2>
          <p className="text-[#800000]/80 mt-2 max-w-2xl">
            Track your transactions, manage payments, and leave reviews for your freelance work and client requests
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-[#FFD700]/20 transform transition-all hover:shadow-xl duration-300">
          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-[#800000]/60" />
            </div>
            <input
              type="text"
              placeholder="Search by service name, client or freelancer..."
              className="w-full bg-[#f8f5f0] border border-[#FFD700]/30 text-[#800000] rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-[#FFD700]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-full transition-all duration-300 flex items-center ${
                selectedFilter === 'all' 
                  ? 'bg-[#800000] text-[#FFD700] shadow-md transform scale-105' 
                  : 'bg-[#FFF9E6] text-[#800000] hover:bg-[#FFD700]/20 hover:scale-105'
              }`}
            >
              <Filter size={16} className="mr-2" />
              All Transactions
            </button>
            <button 
              onClick={() => handleFilterChange('client')}
              className={`px-4 py-2 rounded-full transition-all duration-300 flex items-center ${
                selectedFilter === 'client' 
                  ? 'bg-[#800000] text-[#FFD700] shadow-md transform scale-105' 
                  : 'bg-[#FFF9E6] text-[#800000] hover:bg-[#FFD700]/20 hover:scale-105'
              }`}
            >
              <UserIcon size={16} className="mr-2" />
              Client Requests
            </button>
            <button 
              onClick={() => handleFilterChange('freelancer')}
              className={`px-4 py-2 rounded-full transition-all duration-300 flex items-center ${
                selectedFilter === 'freelancer' 
                  ? 'bg-[#800000] text-[#FFD700] shadow-md transform scale-105' 
                  : 'bg-[#FFF9E6] text-[#800000] hover:bg-[#FFD700]/20 hover:scale-105'
              }`}
            >
              <UserCheck size={16} className="mr-2" />
              Freelancer Work
            </button>
            <button 
              onClick={() => handleFilterChange('completed')}
              className={`px-4 py-2 rounded-full transition-all duration-300 flex items-center ${
                selectedFilter === 'completed' 
                  ? 'bg-[#800000] text-[#FFD700] shadow-md transform scale-105' 
                  : 'bg-[#FFF9E6] text-[#800000] hover:bg-[#FFD700]/20 hover:scale-105'
              }`}
            >
              <UserCheck size={16} className="mr-2" />
              Completed
            </button>
            <button 
              onClick={() => handleFilterChange('pending')}
              className={`px-4 py-2 rounded-full transition-all duration-300 flex items-center ${
                selectedFilter === 'pending' 
                  ? 'bg-[#800000] text-[#FFD700] shadow-md transform scale-105' 
                  : 'bg-[#FFF9E6] text-[#800000] hover:bg-[#FFD700]/20 hover:scale-105'
              }`}
            >
              <Clock size={16} className="mr-2" />
              In Progress
            </button>
          </div>
        </div>

        {/* Transaction Count */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-[#800000]/80 font-medium">
            Showing {filteredTransactions.length} 
            {selectedFilter !== 'all' ? ` ${selectedFilter}` : ''} 
            {filteredTransactions.length === 1 ? ' transaction' : ' transactions'}
          </p>
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-10 text-center border border-[#FFD700]/20 transform transition-all hover:shadow-2xl duration-300">
            <div className="w-20 h-20 mx-auto bg-[#FFF9E6] rounded-full flex items-center justify-center mb-6 border-2 border-[#FFD700]/30">
              <FileText size={32} className="text-[#800000]" />
            </div>
            <h3 className="text-2xl font-bold text-[#800000] mb-3">No Transactions Found</h3>
            <p className="text-[#800000]/70 mb-6 max-w-md mx-auto">
              {searchTerm 
                ? `No results found for "${searchTerm}". Try another search term.` 
                : selectedFilter !== 'all' 
                  ? `No ${selectedFilter} transactions found. Try another filter.` 
                  : "You don't have any transactions yet. Start by exploring available services!"}
            </p>
            <Link 
              to="/discover" 
              className="inline-flex items-center px-6 py-3 bg-[#800000] text-[#FFD700] rounded-full hover:bg-[#800000]/90 transition-all shadow-md transform hover:translate-y-[-2px]"
            >
              <Tag size={18} className="mr-2" />
              Explore Services
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTransactions.map((transaction, index) => (
              <div
                key={transaction.id}
                className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-[#800000] transform transition-all hover:shadow-xl hover:translate-y-[-2px] duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-6">
                  {/* Header with gradient text */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#800000]/80">
                        {transaction.serviceTitle}
                      </h3>
                      <div className="flex items-center mt-2 text-sm text-[#800000]/70">
                        <FileText size={14} className="mr-1.5" />
                        <span>Transaction #{transaction.id}</span>
                        <span className="mx-2">•</span>
                        <Calendar size={14} className="mr-1.5" />
                        <span>{formatDate(transaction.completedDate || transaction.createdAt)}</span>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full font-medium text-sm ${getStatusColor(transaction.status)} flex items-center shadow-sm`}>
                      {getStatusIcon(transaction.status)}
                      <span>{transaction.status || 'Unknown Status'}</span>
                    </div>
                  </div>
                  
                  {/* Transaction Details Card */}
                  <div className="bg-[#f8f5f0] rounded-lg p-4 border border-[#FFD700]/20 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div className="flex items-center group">
                          <div className="w-10 h-10 bg-[#800000]/10 rounded-full flex items-center justify-center mr-3 group-hover:bg-[#800000]/20 transition-all">
                            <Users size={18} className="text-[#800000]" />
                          </div>
                          <div>
                            <div className="text-sm text-[#800000]/70">Client:</div>
                            <div className="font-medium text-[#800000]">{transaction.clientName}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center group">
                          <div className="w-10 h-10 bg-[#800000]/10 rounded-full flex items-center justify-center mr-3 group-hover:bg-[#800000]/20 transition-all">
                            <UserCheck size={18} className="text-[#800000]" />
                          </div>
                          <div>
                            <div className="text-sm text-[#800000]/70">Your Role:</div>
                            <div className="font-medium text-[#800000] flex items-center">
                              {transaction.userRole === 'client' 
                                ? <><UserIcon size={16} className="mr-1 text-[#FFD700]" /> Client</>
                                : transaction.userRole === 'freelancer'
                                  ? <><UserCheck size={16} className="mr-1 text-[#FFD700]" /> Freelancer</>
                                  : 'Unknown Role'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center group">
                          <div className="w-10 h-10 bg-[#800000]/10 rounded-full flex items-center justify-center mr-3 group-hover:bg-[#800000]/20 transition-all">
                            <CreditCard size={18} className="text-[#800000]" />
                          </div>
                          <div>
                            <div className="text-sm text-[#800000]/70">Payment Method:</div>
                            <div className="font-medium text-[#800000]">{transaction.paymentMethod || 'Face to Face'}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Column */}
                      <div className="space-y-4">
                        <div className="flex items-center group">
                          <div className="w-10 h-10 bg-[#800000]/10 rounded-full flex items-center justify-center mr-3 group-hover:bg-[#800000]/20 transition-all">
                            <UserCheck size={18} className="text-[#800000]" />
                          </div>
                          <div>
                            <div className="text-sm text-[#800000]/70">Freelancer:</div>
                            <div className="font-medium text-[#800000]">{transaction.freelancerName}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center group">
                          <div className="w-10 h-10 bg-[#800000]/10 rounded-full flex items-center justify-center mr-3 group-hover:bg-[#800000]/20 transition-all">
                            <DollarSign size={18} className="text-[#800000]" />
                          </div>
                          <div>
                            <div className="text-sm text-[#800000]/70">Amount:</div>
                            <div className="font-medium text-[#800000]">₱{transaction.amount || transaction.price}</div>
                          </div>
                        </div>
                        
                        {transaction.referenceNumber && (
                          <div className="flex items-center group">
                            <div className="w-10 h-10 bg-[#800000]/10 rounded-full flex items-center justify-center mr-3 group-hover:bg-[#800000]/20 transition-all">
                              <FileText size={18} className="text-[#800000]" />
                            </div>
                            <div>
                              <div className="text-sm text-[#800000]/70">Reference #:</div>
                              <div className="font-medium text-[#800000]">{transaction.referenceNumber}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Post Type Badge */}
                  {transaction.postType && (
                    <div className="mb-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        transaction.postType === 'client' 
                          ? 'bg-[#FFF9E6] text-[#800000] border border-[#FFD700]/30' 
                          : 'bg-[#800000]/10 text-[#800000] border border-[#800000]/30'
                      }`}>
                        <Tag size={14} className="mr-1.5" />
                        {transaction.postType === 'client' ? 'Client Request' : 'Freelancer Service'}
                      </div>
                    </div>
                  )}

                  {/* Review & Action Section */}
                  <div className="mt-6 pt-4 border-t border-[#FFD700]/20 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-[#800000]/10 rounded-full flex items-center justify-center mr-2">
                        <Star size={16} className="text-[#FFD700]" />
                      </div>
                      <span className="text-[#800000]/80">
                        {transaction.hasReviewed 
                          ? 'You left a review' 
                          : 'No review submitted yet'}
                      </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      {/* Review Button */}
                      {!transaction.hasReviewed && 
                       (transaction.status === 'Completed' || transaction.status === 'completed') && (
                        <button
                          onClick={() => handleLeaveReview(transaction.applicationId)}
                          className="px-4 py-2 bg-[#800000] text-[#FFD700] rounded-full hover:bg-[#800000]/90 flex items-center gap-2 shadow-md transition-all hover:shadow-lg transform hover:translate-y-[-2px]"
                        >
                          <Star size={16} fill="#FFD700" />
                          <span>
                            {transaction.userRole === 'client' 
                              ? 'Rate Freelancer' 
                              : transaction.userRole === 'freelancer' 
                                ? 'Rate Client' 
                                : 'Leave Review'}
                          </span>
                        </button>
                      )}
                      
                      {/* Project Status Link */}
                      {transaction.status !== 'Completed' && transaction.status !== 'completed' && (
                        <Link
                          to="/project-status"
                          className="px-4 py-2 bg-[#800000] text-[#FFD700] rounded-full hover:bg-[#800000]/90 flex items-center gap-2 shadow-md transition-all hover:shadow-lg transform hover:translate-y-[-2px]"
                        >
                          <Clock size={16} />
                          <span>Project Status</span>
                          <ArrowRight size={16} />
                        </Link>
                      )}
                    </div>
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

// Add the necessary CSS animations globally
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes fade-in {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes pulse-slow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  @keyframes spin-reverse {
    to {
      transform: rotate(-360deg);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.5s ease-out forwards;
  }
  
  .animate-pulse-slow {
    animation: pulse-slow 3s infinite;
  }
  
  .animate-spin-reverse {
    animation: spin-reverse 1.5s linear infinite;
  }
`;
document.head.appendChild(styleTag);

export default TransactionHistoryPage;
