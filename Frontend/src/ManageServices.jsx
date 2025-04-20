import React, { useState, useEffect } from 'react';
import api from './services/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ManageServices = () => {
  const [services, setServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedService, setSelectedService] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch services from backend
  const fetchServices = async () => {
    try {
      setLoading(true);
      
      // Get user data for authentication
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      if (!userData || !userData.token) {
        setError('Authentication required. Please log in.');
        setLoading(false);
        return;
      }
      
      // Try to fetch services from admin API
      let response = await api.get('/services/admin/all');
      console.log('API response for services:', response);
      
      if (response.data && Array.isArray(response.data)) {
        // Ensure all services have consistent field names
        const normalizedServices = response.data.map(service => ({
          serviceId: service.serviceId || service.ServiceId,
          title: service.title || service.Title || '',
          description: service.description || service.Description || '',
          price: service.price || service.Price || 0,
          category: service.category || service.Category || '',
          status: service.status || service.Status || 'Active',
          createdAt: service.createdAt || service.CreatedAt,
          sellerId: service.sellerId || service.SellerId,
          sellerName: service.sellerName || service.SellerName || '',
        }));

        // Store all services for filtering
        setAllServices(normalizedServices);
        
        // Set services initially to all services
        setServices(normalizedServices);
        
        // Extract unique categories for the filter
        const uniqueCategories = [...new Set(normalizedServices.map(service => service.category))];
        setCategories(['All', ...uniqueCategories.filter(Boolean)]);
        
        setError(null);
      } else {
        throw new Error('Invalid data format received from API');
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setError('Failed to load services. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Apply filters whenever filter states change
  useEffect(() => {
    if (!allServices.length) return;
    
    // Apply filters to allServices
    let filtered = [...allServices];
    
    // Apply search query filter
    if (searchQuery) {
      filtered = filtered.filter(service => 
        service.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.sellerName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (categoryFilter && categoryFilter !== 'All') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'All') {
      filtered = filtered.filter(service => service.status === statusFilter);
    }
    
    // Update the services state with filtered results
    setServices(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, categoryFilter, statusFilter, allServices]);

  const handleDeleteService = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        setLoading(true);
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        // Instead of deleting, mark as deleted
        await api.put(`/services/${serviceId}/status`, 
          { status: 'Deleted' },
          {
            headers: {
              'Authorization': `Bearer ${userData?.token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Update lists after status change
        // Update the service locally
        setAllServices(prevServices => 
          prevServices.map(service => 
            service.serviceId === serviceId ? { ...service, status: 'Deleted' } : service
          )
        );
        
        // Also update the filtered services
        setServices(prevServices => 
          prevServices.map(service => 
            service.serviceId === serviceId ? { ...service, status: 'Deleted' } : service
          )
        );
        
        toast.success('Service marked as deleted');
      } catch (error) {
        console.error('Error deleting service:', error);
        toast.error('Failed to delete service. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleServiceStatusChange = async (serviceId, status) => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      // Update service status using the API
      await api.put(`/services/${serviceId}/status`, 
        { status },
        {
          headers: {
            'Authorization': `Bearer ${userData?.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Update the service locally
      setAllServices(prevServices => 
        prevServices.map(service => 
          service.serviceId === serviceId ? { ...service, status } : service
        )
      );
      
      // Also update the filtered services
      setServices(prevServices => 
        prevServices.map(service => 
          service.serviceId === serviceId ? { ...service, status } : service
        )
      );
      
      toast.success(`Service status updated to ${status}`);
    } catch (error) {
      console.error('Error updating service status:', error);
      toast.error('Failed to update service status');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('All');
    setStatusFilter('All');
  };

  const handleViewService = (service) => {
    setSelectedService(service);
    setShowModal(true);
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = services.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(services.length / itemsPerPage);

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
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        toastStyle={{ 
          background: '#fff5f5',
          color: '#800000',
          border: '1px solid #800000' 
        }}
        progressStyle={{ background: '#ffd700' }}
      />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-[#800000] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 mr-3 text-[#800000]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#800000] to-[#a52a2a]">
              Manage Services
            </span>
          </h2>
          <div className="text-sm font-semibold bg-[#800000] text-[#ffd700] px-4 py-2 rounded-full shadow-md">
            Total services: {services.length}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-6 rounded-2xl shadow-2xl border border-[#800000]/10 transition-all duration-300 hover:shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <h3 className="text-2xl font-bold text-[#800000] flex items-center whitespace-nowrap">
              <span className="border-b-4 border-[#ffd700] pb-1">Service Listings</span>
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
                  placeholder="Search by service name, category or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-3 w-full border border-[#800000]/30 rounded-lg focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-all duration-200"
                />
              </div>

              <button
                onClick={handleResetFilters}
                className="px-6 py-3 bg-[#ffd700] text-[#800000] font-semibold rounded-lg hover:bg-[#ffed8a] transition-colors duration-300 shadow-md whitespace-nowrap transform hover:translate-y-[-2px]"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-[#800000]/20 shadow-lg">
            <table className="min-w-full divide-y divide-[#800000]/10">
              <thead>
                <tr className="bg-gradient-to-r from-[#800000] to-[#8b0000] text-white">
                  <th className="py-4 px-6 text-left text-sm font-bold uppercase tracking-wider">Service</th>
                  <th className="py-4 px-6 text-left text-sm font-bold uppercase tracking-wider">Category</th>
                  <th className="py-4 px-6 text-left text-sm font-bold uppercase tracking-wider">Price</th>
                  <th className="py-4 px-6 text-left text-sm font-bold uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-left text-sm font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#800000]/10 bg-white">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 px-6">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="bg-[#fff5f5] p-4 rounded-full">
                          <svg className="w-16 h-16 text-[#800000]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-lg font-medium text-[#800000]">No services found</span>
                        <span className="text-sm text-[#800000]/60">Try adjusting your search criteria</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map(service => (
                    <tr key={service.serviceId} className="hover:bg-[#fff5f5] transition-colors duration-150">
                      <td className="py-4 px-6 text-gray-900 font-medium">{service.title}</td>
                      <td className="py-4 px-6 text-gray-600">{service.category || 'N/A'}</td>
                      <td className="py-4 px-6 text-gray-600">₱{service.price.toLocaleString()}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                          service.status === 'Active' ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-200' : 
                          service.status === 'Inactive' ? 'bg-[#fff8e1] text-[#ff8f00] border border-[#ffca28]' : 
                          service.status === 'Completed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          service.status === 'Deleted' ? 'bg-red-100 text-red-800 border border-red-200' :
                          'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${
                            service.status === 'Active' ? 'bg-green-500' :
                            service.status === 'Inactive' ? 'bg-[#ff8f00] animate-pulse' :
                            service.status === 'Completed' ? 'bg-blue-500' :
                            service.status === 'Deleted' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}></span>
                          {service.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleViewService(service)}
                            className="bg-[#ffd700] text-[#800000] py-1.5 px-3 rounded-md hover:bg-[#ffed8a] transition duration-300 shadow-md flex items-center text-sm transform hover:translate-y-[-2px]"
                          >
                            <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteService(service.serviceId)}
                            className="bg-[#800000] text-white py-1.5 px-3 rounded-md hover:bg-[#a52a2a] transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center text-sm transform hover:translate-y-[-2px]"
                            disabled={service.status === 'Deleted'}
                          >
                            <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
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
          <div className="px-6 py-4 mt-4 bg-white border border-[#800000]/10 rounded-xl shadow-md flex flex-col sm:flex-row justify-between items-center">
            <div className="text-sm text-[#800000] font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
            <div className="flex space-x-3 mt-3 sm:mt-0">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-[#800000]/30 rounded-md text-sm font-medium text-[#800000] hover:bg-[#fff5f5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 transform hover:translate-y-[-2px]"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-4 py-2 border border-[#800000]/30 rounded-md text-sm font-medium text-[#800000] hover:bg-[#fff5f5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 transform hover:translate-y-[-2px]"
              >
                Next
              </button>
            </div>
            <div className="flex items-center space-x-2 mt-3 sm:mt-0">
              <span className="text-sm text-[#800000] font-medium">Items per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="border border-[#800000]/30 rounded-md text-sm p-2 text-[#800000] focus:ring-2 focus:ring-[#800000] focus:border-[#800000]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Service View Modal */}
      {showModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-3xl w-full mx-4 overflow-hidden shadow-2xl transform transition-all duration-300 animate-scaleIn">
            <div className="flex justify-between items-center p-4 border-b border-[#800000]/20 bg-gradient-to-r from-[#800000] to-[#8b0000] text-white">
              <h3 className="text-xl font-semibold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#ffd700]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Service Details
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-[#ffd700] focus:outline-none p-1 rounded-full hover:bg-white/10 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 bg-[#fff5f5]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-[#800000] mb-4 border-b-2 border-[#ffd700] pb-2 inline-block">Service Information</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Title</span>
                      <span className="text-lg font-medium text-gray-900">{selectedService.title}</span>
                    </div>
                    
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Description</span>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {selectedService.description || 'No description available'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Category</span>
                      <span className="inline-block px-3 py-1 bg-[#800000]/10 text-[#800000] rounded-full text-sm">
                        {selectedService.category || 'N/A'}
                      </span>
                    </div>
                    
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Price</span>
                      <span className="text-lg font-bold text-[#800000]">₱{selectedService.price?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-[#800000] mb-4 border-b-2 border-[#ffd700] pb-2 inline-block">Additional Details</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Status</span>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                        selectedService.status === 'Active' ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-200' : 
                        selectedService.status === 'Inactive' ? 'bg-[#fff8e1] text-[#ff8f00] border border-[#ffca28]' : 
                        selectedService.status === 'Completed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        selectedService.status === 'Deleted' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${
                          selectedService.status === 'Active' ? 'bg-green-500' :
                          selectedService.status === 'Inactive' ? 'bg-[#ff8f00] animate-pulse' :
                          selectedService.status === 'Completed' ? 'bg-blue-500' :
                          selectedService.status === 'Deleted' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}></span>
                        {selectedService.status}
                      </span>
                    </div>
                    
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Seller</span>
                      <span className="text-gray-700">{selectedService.sellerName || 'Unknown seller'}</span>
                    </div>
                    
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Date Created</span>
                      <span className="text-gray-700">
                        {selectedService.createdAt ? new Date(selectedService.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Unknown date'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                
                {selectedService.status !== 'Deleted' && (
                  <button
                    onClick={() => {
                      handleDeleteService(selectedService.serviceId);
                      setShowModal(false);
                    }}
                    className="px-4 py-2 bg-[#800000] text-white font-medium rounded-lg hover:bg-[#a52a2a] transition-colors"
                  >
                    Mark as Deleted
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add custom animation keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ManageServices;
