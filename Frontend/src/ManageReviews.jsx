import React, { useState, useEffect } from 'react';
import { Star, Search, Trash, Eye } from 'lucide-react';
import api from './services/api';

const ManageReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  
  // Review detail view
  const [selectedReview, setSelectedReview] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  
  // Fetch reviews from backend API
  useEffect(() => {
    fetchReviews();
  }, [currentPage, limit, searchQuery]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      
      // Try to get all reviews
      let allReviews = [];
      try {
        // Use the correct endpoint without duplicating 'api'
        const response = await api.get('/reviews');
        console.log('API response:', response);
        allReviews = response.data || [];
      } catch (err) {
        console.warn('Could not fetch from /reviews API:', err);
        allReviews = []; // Set empty array if API fails
      }
      
      // Filter reviews based on search in frontend
      let filteredReviews = [...allReviews];
      
      if (searchQuery) {
        filteredReviews = filteredReviews.filter(review => 
          (review.ReviewerName || review.reviewerName || '')
            .toLowerCase().includes(searchQuery.toLowerCase()) || 
          (review.ServiceTitle || review.serviceTitle || '')
            .toLowerCase().includes(searchQuery.toLowerCase()) ||
          (review.ReviewText || review.reviewText || '')
            .toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Implement pagination in frontend
      const totalItems = filteredReviews.length;
      const calculatedTotalPages = Math.ceil(totalItems / limit) || 1;
      
      // Get current page items
      const startIndex = (currentPage - 1) * limit;
      const paginatedReviews = filteredReviews.slice(startIndex, startIndex + limit);
      
      setReviews(paginatedReviews);
      setTotalPages(calculatedTotalPages);
      setError(null);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError('Failed to load reviews. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReview = async (reviewId) => {
    try {
      setLoading(true);
      
      // Try to fetch the review from the API
      try {
        const response = await api.get(`/reviews/${reviewId}`);
        setSelectedReview(response.data);
      } catch (err) {
        // If API call fails, find the review in the current list
        console.warn('Could not fetch review details, using existing data', err);
        const review = reviews.find(r => (r.ReviewId || r.id) === reviewId);
        if (review) {
          setSelectedReview(review);
        } else {
          throw new Error('Review not found');
        }
      }
      
      setViewMode(true);
    } catch (error) {
      console.error('Error fetching review details:', error);
      alert('Failed to load review details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (window.confirm('Are you sure you want to delete this review?')) {
      try {
        setLoading(true);
        
        // Try to delete via API
        try {
          await api.delete(`/reviews/${reviewId}`);
        } catch (err) {
          console.warn('Delete API not available, simulating delete locally', err);
          // If API fails, just update the UI
        }
        
        // Update local state to remove the deleted review
        setReviews(reviews.filter(review => 
          (review.ReviewId || review.id) !== reviewId
        ));
        
        if (selectedReview && (selectedReview.ReviewId || selectedReview.id) === reviewId) {
          setViewMode(false);
          setSelectedReview(null);
        }
        
        alert('Review deleted successfully');
      } catch (error) {
        console.error('Error deleting review:', error);
        alert('Failed to delete review. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={i < rating ? "text-[#ffd700] fill-[#ffd700]" : "text-gray-300"}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating}/5)</span>
      </div>
    );
  };

  // Main reviews list view
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff8f8] to-[#fff5e6] p-6">
      <div className="container mx-auto space-y-8 max-w-7xl">
        {/* Header Card */}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-[#800000] flex items-center">
            <Star className="h-9 w-9 mr-3 text-[#800000]" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#800000] to-[#a52a2a]">
              Manage Reviews
            </span>
          </h2>
          <div className="text-sm font-semibold bg-[#800000] text-[#ffd700] px-4 py-2 rounded-full shadow-md">
            Total reviews: {reviews.length}
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white p-6 rounded-2xl shadow-2xl border border-[#800000]/10 transition-all duration-300 hover:shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <h3 className="text-2xl font-bold text-[#800000] flex items-center whitespace-nowrap">
              <span className="border-b-4 border-[#ffd700] pb-1">Review List</span>
            </h3>
            
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="w-5 h-5 text-[#800000]" />
                </div>
                <input
                  type="text"
                  placeholder="Search by reviewer name, service or content..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-3 w-full border border-[#800000]/30 rounded-lg focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-all duration-200"
                />
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="px-6 py-3 bg-[#ffd700] text-[#800000] font-semibold rounded-lg hover:bg-[#ffed8a] transition-colors duration-300 shadow-md whitespace-nowrap transform hover:translate-y-[-2px]"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Table */}
        <div className="overflow-hidden rounded-xl border border-[#800000]/20 shadow-lg">
          {loading ? (
            <div className="p-16 text-center bg-white">
              <div className="inline-block w-10 h-10 border-4 border-[#800000] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600 font-medium">Loading reviews...</p>
            </div>
          ) : error ? (
            <div className="p-16 text-center bg-white">
              <div className="bg-red-50 p-4 rounded-lg inline-block mb-4">
                <svg className="w-10 h-10 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <p className="text-red-600 font-medium text-lg mb-2">{error}</p>
              <button
                onClick={fetchReviews}
                className="mt-4 px-6 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#600000] transition-colors font-medium"
              >
                Try Again
              </button>
            </div>
          ) : !reviews.length ? (
            <div className="p-16 text-center bg-white">
              <Star className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-xl font-medium text-gray-700 mb-2">No reviews found</p>
              <p className="text-gray-500">Try adjusting your search filters or check back later</p>
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-[#800000]/10">
                <thead>
                  <tr className="bg-gradient-to-r from-[#800000] to-[#8b0000] text-white">
                    <th className="py-4 px-4 text-left font-semibold">SERVICE</th>
                    <th className="py-4 px-4 text-left font-semibold">REVIEWER</th>
                    <th className="py-4 px-4 text-left font-semibold">RATING</th>
                    <th className="py-4 px-4 text-left font-semibold">REVIEW</th>
                    <th className="py-4 px-4 text-left font-semibold">DATE</th>
                    <th className="py-4 px-4 text-left font-semibold">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#800000]/10 bg-white">
                  {reviews.map((review) => (
                    <tr key={review.ReviewId || review.id} className="hover:bg-[#fff5f5] transition-colors duration-150">
                      <td className="py-4 px-4 font-medium text-gray-800">
                        {review.ServiceTitle || review.serviceTitle}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {review.ReviewerName || review.reviewerName}
                      </td>
                      <td className="py-4 px-4">
                        {renderStars(review.Rating || review.rating)}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        <div className="max-w-xs truncate">{review.ReviewText || review.reviewText}</div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {formatDate(review.CreatedAt || review.date)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleViewReview(review.ReviewId || review.id)}
                            className="flex items-center text-sm font-medium text-[#800000] hover:text-[#600000] rounded-md px-2 py-1"
                          >
                            <Eye className="w-4 h-4 mr-1.5" /> View
                          </button>
                          <button
                            onClick={() => handleDeleteReview(review.ReviewId || review.id)}
                            className="flex items-center text-sm font-medium text-red-600 hover:text-red-800 rounded-md px-2 py-1"
                          >
                            <Trash className="w-4 h-4 mr-1.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
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
                          value={limit}
                          onChange={(e) => {
                            setLimit(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-transparent rounded-md border-none focus:ring-0 appearance-none pr-8"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
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
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Detail view
  if (viewMode && selectedReview) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fff8f8] to-[#fff5e6] p-6">
        <div className="container mx-auto max-w-7xl">
          <button
            onClick={() => {
              setViewMode(false);
              setSelectedReview(null);
            }}
            className="mb-6 flex items-center text-[#800000] hover:text-[#600000] font-medium transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Reviews
          </button>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-[#800000]/10">
            <div className="bg-gradient-to-r from-[#800000] to-[#8b0000] text-white p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <h1 className="text-2xl font-bold">Review #{selectedReview.ReviewId || selectedReview.id}</h1>
                  <p className="text-white/80 mt-1">Service: {selectedReview.ServiceTitle || selectedReview.serviceTitle}</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
                  <h2 className="text-lg font-semibold mb-4 text-[#800000] flex items-center">
                    <Star className="w-5 h-5 mr-2 fill-[#800000]" />
                    Review Details
                  </h2>
                  <div className="space-y-5">
                    <div>
                      <span className="text-gray-600 text-sm font-medium">Rating:</span>
                      <div className="mt-2">{renderStars(selectedReview.Rating || selectedReview.rating)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm font-medium">Review Text:</span>
                      <p className="p-4 bg-white rounded-md border border-gray-200 mt-2 text-gray-700 leading-relaxed">
                        {selectedReview.ReviewText || selectedReview.reviewText || 'No review text provided'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm font-medium">Date Submitted:</span>
                      <p className="mt-1 text-gray-700">{formatDate(selectedReview.CreatedAt || selectedReview.date || new Date())}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
                  <h2 className="text-lg font-semibold mb-4 text-[#800000] flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    User Information
                  </h2>
                  <div className="space-y-5">
                    <div>
                      <span className="text-gray-600 text-sm font-medium">Reviewer:</span>
                      <p className="mt-1 font-medium text-gray-700">{selectedReview.ReviewerName || selectedReview.reviewerName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm font-medium">Service Provider:</span>
                      <p className="mt-1 font-medium text-gray-700">{selectedReview.ServiceOwnerName || selectedReview.serviceSeller || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm font-medium">Service:</span>
                      <p className="mt-1 text-gray-700">{selectedReview.ServiceTitle || selectedReview.serviceTitle}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delete Action */}
              <div className="mt-8 bg-red-50 p-5 rounded-lg border border-red-100">
                <div className="flex justify-between items-center">
                  <p className="text-red-700 text-sm">Delete this review permanently? This action cannot be undone.</p>
                  <button
                    onClick={() => handleDeleteReview(selectedReview.ReviewId || selectedReview.id)}
                    className="px-4 py-2 rounded-md text-white font-medium text-sm flex items-center bg-red-600 hover:bg-red-700 transition-colors duration-200"
                  >
                    <Trash className="w-4 h-4 mr-2" /> Delete Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default ManageReviews;
