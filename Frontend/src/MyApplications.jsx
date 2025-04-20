import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "./services/api";
import { toast } from 'react-toastify';

// Helper function to format image URL properly
const formatImageUrl = (imageData) => {
  if (!imageData) return null;
  if (typeof imageData !== 'string') return null;
  
  if (imageData.startsWith('data:image')) return imageData;
  if (imageData.startsWith('/9j/') || imageData.match(/^[A-Za-z0-9+/=]+$/)) {
    return `data:image/jpeg;base64,${imageData}`;
  }
  if (imageData.startsWith('http')) return imageData;
  return `data:image/jpeg;base64,${imageData}`;
};

// Function to add notification to localStorage
const addNotification = (message, type, timestamp, userId) => {
  const newNotification = { message, type, timestamp };
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push({ ...newNotification, userId });
  localStorage.setItem("notifications", JSON.stringify(notifications));
};

const MyApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  // Check authentication on mount
  useEffect(() => {
    if (!userData.token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  // Fetch applications from API
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get('/user/applications');
        
        if (Array.isArray(response.data)) {
          // Process images in applications
          const processedApplications = response.data.map(app => {
            if (app.Photo) {
              app.Photo = formatImageUrl(app.Photo);
            }
            return app;
          });
          
          setApplications(processedApplications);
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (err) {
        console.error('Error fetching applications:', err);
        if (err.response?.status === 401) {
          setError('Please log in to view your applications');
          navigate('/login');
          return;
        }
        setError(err.response?.data?.error || 'Failed to load your applications. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [navigate]);

  // Helper functions
  const getPostTypeLabel = (postType) => {
    return postType === 'client' ? 'Client Request' : 'Freelancer Service';
  };

  const getPostTypeColor = (postType) => {
    return postType === 'client' ? 'bg-blue-500' : 'bg-[#800000]';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'service started':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Determine if the user is acting as a freelancer or client for this application
  const getUserRole = (postType) => {
    // If it's a client post (client needs help), then user is applying as a freelancer
    // If it's a freelancer post (freelancer offering services), then user is applying as a client
    return postType === 'client' ? 'freelancer' : 'client';
  };

  // Handle status change to "Started"
  const handleStartService = async (applicationId) => {
    try {
      setLoading(true);
      
      const response = await api.patch(`/user/applications/${applicationId}/start`);
      
      if (response.data) {
        // Update the application in the list
        setApplications(prevApplications => 
          prevApplications.map(app => 
            app.ApplicationId === applicationId 
              ? { ...app, Status: 'Service Started' }
              : app
          )
        );

        const application = applications.find(app => app.ApplicationId === applicationId);
        if (!application) return;

        // Determine which page to redirect to based on the user's role in this application
        const userRole = getUserRole(application.PostType);
        
        // FIXED: Redirect logic based on correct workflow
        // For client applications, redirect to project status (monitoring the freelancer's work)
        // For freelancer applications, redirect to active projects (doing the work for clients)
        const redirectPath = userRole === 'client' 
          ? "/status"  // Clients who applied to freelancer posts go to project status
          : "/active";        // Freelancers who applied to client posts go to active projects
        
        // Show success message based on user role
        const successMessage = userRole === 'client'
          ? 'Service started! Redirecting to Project Status...'
          : 'Project started! Redirecting to Active Projects...';
        
        toast.success(successMessage);
        
        // Short delay before navigation
        setTimeout(() => {
          navigate(redirectPath);
        }, 1500);
      }
      
    } catch (err) {
      console.error('Error starting service:', err.response || err);
      
      if (err.response?.status === 401) {
        toast.error('Please log in to start the service');
        navigate('/login');
        return;
      }
      
      if (err.response?.status === 404) {
        toast.error('This application cannot be started. It may have already been started or rejected.');
        return;
      }
      
      toast.error(err.response?.data?.error || 'Failed to start service. Please try again.');
      
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (applicationId) => {
    if (!window.confirm('Are you sure you want to cancel this application?')) {
      return;
    }

    try {
      setDeletingId(applicationId);
      
      const response = await api.delete(`/user/applications/${applicationId}`);
      
      // Remove the deleted application from state
      setApplications(prevApplications => 
        prevApplications.filter(app => app.ApplicationId !== applicationId)
      );
      
      toast.success('Application cancelled successfully');
    } catch (error) {
      // Check if it's a server or connection error
      if (!error.response) {
        toast.error('Network error. Please check your connection.');
      } else if (error.response.status === 403) {
        toast.error('You do not have permission to cancel this application');
      } else if (error.response.status === 404) {
        // If the application doesn't exist anymore, remove it from the UI anyway
        setApplications(prevApplications => 
          prevApplications.filter(app => app.ApplicationId !== applicationId)
        );
        toast.warn('This application no longer exists');
      } else {
        toast.error(error.response?.data?.error || 'Failed to cancel application');
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Get applications where user is acting as freelancer (applied to client posts)
  const freelancerApplications = applications.filter(app => 
    getUserRole(app.PostType) === 'freelancer'
  );
  
  // Get applications where user is acting as client (applied to freelancer posts)
  const clientApplications = applications.filter(app => 
    getUserRole(app.PostType) === 'client'
  );

  // Get total counts for filters
  const getTotalCounts = () => {
    const counts = {
      all: applications.length,
      freelancer: freelancerApplications.length,
      client: clientApplications.length
    };
    return counts;
  };

  // Filter applications based on selected role filter
  const filteredApplications = (() => {
    switch(selectedRoleFilter) {
      case 'freelancer':
        return freelancerApplications;
      case 'client':
        return clientApplications;
      default:
        return applications;
    }
  })();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="w-16 h-16 relative animate-spin">
          <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-4 border-[#800000] border-t-[#ffd700] animate-pulse"></div>
          <div className="absolute top-2 left-2 right-2 bottom-2 rounded-full border-4 border-t-4 border-[#800000] border-opacity-60 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Applications</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (applications.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-[#800000] text-white p-6 rounded-t-2xl shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-wider flex items-center">
              <span className="text-[#ffd700] mr-2">|</span> 
              My Applications
              <span className="ml-2 text-[#ffd700]">|</span>
            </h2>
            <p className="text-gray-200 mt-2 opacity-80">
              Track your service requests and manage your ongoing applications
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-b-lg shadow-2xl text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f8f5f0] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[#800000] mb-2">No Applications Found</h3>
            <p className="text-gray-600 mb-6">You haven't submitted any applications yet.</p>
            <button
              onClick={() => navigate('/services')}
              className="px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
            >
              Browse Services
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="container mx-auto max-w-6xl animate-fadeIn">
        {/* Header */}
        <div className="bg-[#800000] text-white p-8 rounded-t-2xl shadow-xl">
          <h2 className="text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-2">|</span> 
            My Applications
            <span className="ml-2 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-80">
            Track your service requests and manage your ongoing applications
          </p>
        </div>

        {/* Filter Tabs - UPDATED to show role-based filters */}
        <div className="bg-white p-4 rounded-b-lg shadow-md mb-8">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setSelectedRoleFilter('all')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                selectedRoleFilter === 'all'
                  ? 'bg-[#800000] text-white'
                  : 'bg-gray-100 text-[#800000] hover:bg-gray-200'
              }`}
            >
              All Applications ({getTotalCounts().all})
            </button>
            <button
              onClick={() => setSelectedRoleFilter('freelancer')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                selectedRoleFilter === 'freelancer'
                  ? 'bg-[#800000] text-white'
                  : 'bg-gray-100 text-[#800000] hover:bg-gray-200'
              }`}
            >
              My Freelancer Applications ({getTotalCounts().freelancer})
            </button>
            <button
              onClick={() => setSelectedRoleFilter('client')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                selectedRoleFilter === 'client'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-[#800000] hover:bg-gray-200'
              }`}
            >
              My Client Applications ({getTotalCounts().client})
            </button>
          </div>
        </div>

        {/* No Results Message */}
        {filteredApplications.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <div className="w-16 h-16 bg-[#800000] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[#800000] mb-2">
              No {selectedRoleFilter !== 'all' ? `${selectedRoleFilter} ` : ''}applications found
            </h3>
            <p className="text-[#800000] text-opacity-80">
              {selectedRoleFilter === 'all' 
                ? 'You haven\'t submitted any applications yet.'
                : `You haven't submitted any applications as a ${selectedRoleFilter} yet.`}
            </p>
          </div>
        )}

        {/* Applications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredApplications.map((application, index) => {
            // Determine if user is acting as client or freelancer for this application
            const userRole = getUserRole(application.PostType);
            
            return (
              <div 
                key={application.ApplicationId} 
                className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl hover:scale-[1.02]"
                style={{animationDelay: `${index * 0.1}s`}}
              >
                {/* Card Header with Status Indicator - Updated with Role Badge */}
                <div className={`relative h-40 ${application.PostType === 'client'
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#1e40af]' 
                  : 'bg-gradient-to-r from-[#9b2226] to-[#ae2012]'}`}>
                  {application.Photo ? (
                    <img 
                      src={application.Photo}
                      alt={application.Title} 
                      className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                  ) : null}
                  
                  <div className="absolute inset-0 flex flex-col justify-end p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(application.Status)}`}>
                        {application.Status}
                      </span>
                      {/* Post Type Label */}
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        application.PostType === 'client' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-[#ffd700] text-[#800000]'
                      }`}>
                        {application.PostType === 'client' ? '👥 Client Need' : '💼 Freelancer Service'}
                      </span>
                      {/* Your Role Badge - NEW */}
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        userRole === 'freelancer' 
                          ? 'bg-[#800000] text-white' 
                          : 'bg-blue-500 text-white'
                      }`}>
                        You as {userRole === 'freelancer' ? 'Freelancer' : 'Client'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-wide">{application.Title}</h3>
                    <p className="text-[#ffd700] font-medium mt-1">₱{application.Price}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Application Message:</h4>
                    <p className="text-gray-700">{application.Message}</p>
                  </div>
                  
                  {/* Application Details */}
                  <div className="space-y-2">
                    <div className="flex items-center text-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">Applied on:</span>
                      <span className="ml-2">{formatDate(application.CreatedAt)}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">
                        {userRole === 'freelancer' 
                          ? 'Client:' 
                          : 'Freelancer:'}
                      </span>
                      <span className="ml-2">{application.SellerName}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="font-medium">Category:</span>
                      <span className="ml-2">{application.Category}</span>
                    </div>
                  </div>

                  {/* Action Buttons - UPDATED with correct redirect information */}
                  <div className="mt-6 flex flex-wrap gap-3 justify-between items-center">
                    {(application.Status?.toLowerCase() === 'approved' || application.Status?.toLowerCase() === 'accepted' || application.Status === 'Accepted') && (
                      <button
                        onClick={() => handleStartService(application.ApplicationId)}
                        className="py-2 px-4 bg-[#ffd700] text-[#800000] rounded-full font-bold 
                                  hover:bg-[#ffcc00] transition-all duration-300 shadow-md hover:shadow-xl
                                  transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#800000]
                                  flex-1"
                      >
                        {userRole === 'freelancer' 
                          ? 'Start Project as Freelancer → Active'
                          : 'Start Service as Client → Project Status'}
                      </button>
                    )}
                    
                    {application.Status?.toLowerCase() === 'service started' && (
                      <div className="flex flex-wrap gap-2 w-full">
                        {application.canUploadProof && (
                          <button
                            onClick={() => navigate(`/upload-proof/${application.ApplicationId}`)}
                            className="py-2 px-4 bg-blue-600 text-white rounded-full font-bold 
                                    hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-xl
                                    transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500
                                    flex-1"
                          >
                            {userRole === 'freelancer' ? 'Upload Project Delivery' : 'Upload Service Proof'}
                          </button>
                        )}
                        {application.canMarkComplete && (
                          <button
                            onClick={() => navigate(`/mark-complete/${application.ApplicationId}`)}
                            className="py-2 px-4 bg-purple-600 text-white rounded-full font-bold 
                                    hover:bg-purple-700 transition-all duration-300 shadow-md hover:shadow-xl
                                    transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500
                                    flex-1"
                          >
                            {userRole === 'freelancer' ? 'Mark Project Complete' : 'Approve Service'}
                          </button>
                        )}
                      </div>
                    )}
                    
                    {application.Status === 'Pending' && (
                      <button
                        onClick={() => handleDelete(application.ApplicationId)}
                        disabled={deletingId === application.ApplicationId}
                        className="py-2 px-4 bg-[#800000] text-white rounded-full font-bold
                                hover:bg-[#600000] transition-all duration-300 shadow-md hover:shadow-xl
                                transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#ffd700]
                                disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                      >
                        {deletingId === application.ApplicationId ? 
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Cancelling...
                          </span> : 
                          'Cancel Application'
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Add these animations to your Tailwind CSS config or add them inline
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out forwards;
  }
`;
document.head.appendChild(style);

export default MyApplications;
