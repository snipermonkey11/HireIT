import React, { useState, useEffect } from 'react';
import api from './services/api';
import { toast } from 'react-toastify';

const ManageTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch transactions from backend
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Try to fetch transactions from API
      let allTransactions = [];
      try {
        const response = await api.get('/transactions');
        console.log('API response for transactions:', response);
        allTransactions = response.data || [];
      } catch (err) {
        console.warn('Could not fetch from /transactions API:', err);
        allTransactions = []; // Set empty array if API fails
      }
      
      // Filter transactions based on search
      let filteredTransactions = [...allTransactions];
      if (searchQuery) {
        filteredTransactions = filteredTransactions.filter(transaction => 
          (transaction.UserName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
          (transaction.ServiceTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(transaction.TransactionId).includes(searchQuery)
        );
      }

      // Calculate pagination
      setTotalPages(Math.ceil(filteredTransactions.length / itemsPerPage));
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
      
      setTransactions(paginatedTransactions);
      setError(null);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load transactions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, itemsPerPage, searchQuery]);

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData'));
      
      await api.delete(`/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${userData?.token}`
        }
      });
      
      setTransactions(prev => prev.filter(t => t.TransactionId !== transactionId));
      toast.success('Transaction deleted successfully');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details || 
                          'Failed to delete transaction. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionStatusChange = async (transactionId, newStatus) => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData'));
      
      await api.patch(`/transactions/${transactionId}`, 
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${userData?.token}`
          }
        }
      );
      
      setTransactions(prev => 
        prev.map(t => t.TransactionId === transactionId ? { ...t, Status: newStatus } : t)
      );
      toast.success(`Transaction status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating transaction status:', error);
      toast.error('Failed to update transaction status');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#fff5f5]">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#800000] border-opacity-25 border-t-[#800000]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-[#ffd700] animate-ping opacity-75"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#fff5f5]">
        <div className="bg-red-50 border-l-4 border-[#800000] text-[#800000] p-6 rounded-md shadow-xl max-w-lg transform transition-all hover:scale-105">
          <div className="flex items-center">
            <svg className="h-8 w-8 text-[#800000] mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium text-lg">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff8f8] to-[#fff5e6] p-6">
      <div className="container mx-auto space-y-8 max-w-7xl">
        {/* Header Card */}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-[#800000] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 mr-3 text-[#800000]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#800000] to-[#a52a2a]">
              Manage Transactions
            </span>
          </h2>
          <div className="text-sm font-semibold bg-[#800000] text-[#ffd700] px-4 py-2 rounded-full shadow-md">
            Total transactions: {transactions.length}
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white p-6 rounded-2xl shadow-2xl border border-[#800000]/10 transition-all duration-300 hover:shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <h3 className="text-2xl font-bold text-[#800000] flex items-center whitespace-nowrap">
              <span className="border-b-4 border-[#ffd700] pb-1">Transaction List</span>
            </h3>
            
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-[#800000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by title, client, or reference number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-3 w-full border border-[#800000]/30 rounded-lg focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-all duration-200"
                />
              </div>

              <button
                onClick={resetFilters}
                className="px-6 py-3 bg-[#ffd700] text-[#800000] font-semibold rounded-lg hover:bg-[#ffed8a] transition-colors duration-300 shadow-md whitespace-nowrap transform hover:translate-y-[-2px]"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-hidden rounded-xl border border-[#800000]/20 shadow-lg">
          <table className="min-w-full divide-y divide-[#800000]/10">
            <thead>
              <tr className="bg-gradient-to-r from-[#800000] to-[#8b0000] text-white">
                <th className="py-4 px-4 text-left font-semibold">ID</th>
                <th className="py-4 px-4 text-left font-semibold">SERVICE</th>
                <th className="py-4 px-4 text-left font-semibold">CLIENT</th>
                <th className="py-4 px-4 text-left font-semibold">AMOUNT</th>
                <th className="py-4 px-4 text-left font-semibold">PAYMENT</th>
                <th className="py-4 px-4 text-left font-semibold">REFERENCE #</th>
                <th className="py-4 px-4 text-left font-semibold">STATUS</th>
                <th className="py-4 px-4 text-left font-semibold">DATE</th>
                <th className="py-4 px-4 text-left font-semibold">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#800000]/10 bg-white">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 px-6">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="bg-[#fff5f5] p-4 rounded-full">
                        <svg className="w-16 h-16 text-[#800000]/40" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM7 10.82C5.84 10.4 5 9.3 5 8V7h2v3.82zM19 8c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                        </svg>
                      </div>
                      <span className="text-lg font-medium text-[#800000]">No transactions found</span>
                      <span className="text-sm text-[#800000]/60">Try adjusting your search criteria</span>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map(transaction => (
                  <tr key={transaction.TransactionId} className="hover:bg-[#fff5f5] transition-colors duration-150">
                    <td className="py-4 px-4 font-medium text-gray-800">
                      {transaction.TransactionId}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {transaction.ServiceTitle}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {transaction.UserName}
                    </td>
                    <td className="py-4 px-4 font-medium text-gray-800">
                      ₱{transaction.Amount?.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {transaction.PaymentMethod || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {transaction.ReferenceNumber || 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                        transaction.Status === 'Completed' ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-200' : 
                        transaction.Status === 'Failed' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-[#fff8e1] text-[#ff8f00] border border-[#ffca28]'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${
                          transaction.Status === 'Completed' ? 'bg-green-500' :
                          transaction.Status === 'Failed' ? 'bg-red-500' :
                          'bg-[#ff8f00] animate-pulse'
                        }`}></span>
                        {transaction.Status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {new Date(transaction.CreatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                    <button
                          onClick={() => handleTransactionStatusChange(transaction.TransactionId, 'Completed')}
                          disabled={transaction.Status === 'Completed'}
                          className={`flex items-center text-sm font-medium rounded-md px-2 py-1 ${
                            transaction.Status === 'Completed'
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Complete
                    </button>
                    <button
                          onClick={() => handleTransactionStatusChange(transaction.TransactionId, 'Failed')}
                          disabled={transaction.Status === 'Failed'}
                          className={`flex items-center text-sm font-medium rounded-md px-2 py-1 ${
                            transaction.Status === 'Failed'
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:text-red-800'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Fail
                    </button>
                    <button
                          onClick={() => handleDeleteTransaction(transaction.TransactionId)}
                          className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-800 rounded-md px-2 py-1"
                    >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                      Delete
                    </button>
                      </div>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-t border-gray-200">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{currentPage}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div className="flex gap-x-2 items-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="relative inline-flex items-center px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium">
                <div className="flex items-center">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-transparent rounded-md border-none focus:ring-0 appearance-none pr-8"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                  <span className="ml-1">per page</span>
                  <svg className="w-5 h-5 text-gray-400 absolute right-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageTransactions;
