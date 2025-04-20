import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./services/api";
import { toast } from 'react-toastify';

// Function to add notification to localStorage
const addNotification = (message, type, timestamp, userId) => {
  const newNotification = { message, type, timestamp };
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push({ ...newNotification, userId });
  localStorage.setItem("notifications", JSON.stringify(notifications));
};

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

const ServiceConfirmationPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedPostType, setSelectedPostType] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData'));
      
      if (!userData?.token) {
        toast.error("Authentication required. Please log in again.");
        navigate('/login');
        return;
      }
      
      const response = await api.get('/service-confirmations', {
        headers: {
          'Authorization': `Bearer ${userData?.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!Array.isArray(response.data)) {
        setError('Received invalid data from server');
        return;
      }
      
      setApplications(response.data);
      setError(null);
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        navigate('/login');
        return;
      }
      setError(err.response?.data?.error || 'Failed to load applications');
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const getPostTypeLabel = (postType) => {
    return postType === 'client' ? 'Client Request' : 'Freelancer Offer';
  };

  const getPostTypeColor = (postType) => {
    return postType === 'client' ? 'bg-[#800000] bg-opacity-80' : 'bg-[#800000]';
  };

  const handleUpdateStatus = async (applicationId, status) => {
    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} this application?`)) {
      return;
    }

    try {
      setUpdatingId(applicationId);
      const userData = JSON.parse(localStorage.getItem('userData'));
      
      const endpoint = status === "Accepted" 
        ? `/service-confirmations/${applicationId}/accept` 
        : `/service-confirmations/${applicationId}/reject`;
        
      const response = await api.patch(endpoint, {}, {
        headers: {
          'Authorization': `Bearer ${userData?.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setApplications(prevApplications => 
        prevApplications.map(app => 
          app.ApplicationId === applicationId 
            ? { ...app, Status: status }
            : app
        )
      );
      
      const application = applications.find(app => app.ApplicationId === applicationId);
      if (application) {
        // Add notification for the applicant
        addNotification(
          `Your application for "${application.ServiceTitle}" has been ${status.toLowerCase()}.`,
          status === "Accepted" ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED",
          new Date().toISOString(),
          application.ApplicantId
        );

        // If accepted, automatically start the service/project
        if (status === "Accepted") {
          try {
            const startResponse = await api.patch(`/my-applications/${applicationId}/start`, {}, {
              headers: {
                'Authorization': `Bearer ${userData?.token}`,
                'Content-Type': 'application/json'
              }
            });

            // Determine the user role based on post type
            // If it's a client post and you're the seller, you are the client
            // If it's a freelancer post and you're the seller, you are the freelancer
            const isSeller = application.ServiceOwnerId === userData.userId;
            
            // For the service owner perspective:
            // - If owner of client post (client): Go to project status to monitor freelancers
            // - If owner of freelancer post (freelancer): Go to active projects to do client work
            const redirectPath = application.PostType === 'client' 
              ? '/projectstatus'  // Client post owner goes to Project Status
              : '/active';        // Freelancer post owner goes to Active Projects
            
            const successMessage = application.PostType === 'client'
              ? 'Project started! Redirecting to Project Status...'
              : 'Service started! Redirecting to Active Projects...';

            toast.success(successMessage);
            
            // Short delay before navigation
            setTimeout(() => {
              navigate(redirectPath);
            }, 1500);
          } catch (startError) {
            toast.error('Failed to start the service. Please try again from My Applications.');
          }
        }
      }
      
      toast.success(`Application ${status.toLowerCase()} successfully`);
      fetchApplications();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update application');
    } finally {
      setUpdatingId(null);
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full transform hover:scale-105 transition-all duration-500">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#800000] rounded-full flex items-center justify-center animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <p className="text-lg text-[#800000] text-center font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  // Group applications by service
  const applicationsByService = applications.reduce((acc, app) => {
    if (!acc[app.ServiceId]) {
      acc[app.ServiceId] = {
        serviceDetails: {
          title: app.ServiceTitle,
          description: app.ServiceDescription,
          price: app.ServicePrice,
          category: app.ServiceCategory,
          image: app.ServiceImage,
          id: app.ServiceId,
          postType: app.PostType,
          ServiceDeleted: app.ServiceDeleted
        },
        applications: []
      };
    }
    
    if (app.ServiceImage) {
      app.ServiceImage = formatImageUrl(app.ServiceImage);
    }
    if (app.ApplicantPhoto) {
      app.ApplicantPhoto = formatImageUrl(app.ApplicantPhoto);
    }
    
    acc[app.ServiceId].applications.push(app);
    return acc;
  }, {});

  // Filter applications based on post type
  const filteredApplicationsByService = Object.entries(applicationsByService).filter(([_, { serviceDetails }]) => {
    if (selectedPostType === 'all') return true;
    return serviceDetails.postType === selectedPostType;
  });

  // Get total counts
  const getTotalCounts = () => {
    const counts = {
      all: Object.keys(applicationsByService).length,
      client: Object.values(applicationsByService).filter(({ serviceDetails }) => serviceDetails.postType === 'client').length,
      freelancer: Object.values(applicationsByService).filter(({ serviceDetails }) => serviceDetails.postType === 'freelancer').length
    };
    return counts;
  };

  if (applications.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full transform hover:scale-105 transition-all duration-500 text-center">
          <div className="w-24 h-24 bg-[#f8f5f0] rounded-full mx-auto flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-xl text-[#800000] font-medium">No applications received yet.</p>
          <button 
            onClick={() => navigate('/services')}
            className="mt-6 px-6 py-3 bg-[#800000] text-white rounded-full transition-all duration-300 hover:bg-[#600000] hover:shadow-lg transform hover:-translate-y-1"
          >
            View Your Services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="container mx-auto max-w-6xl animate-fadeIn">
        {/* Header */}
        <div className="bg-[#800000] text-white p-8 rounded-t-2xl shadow-xl mb-8">
          <h2 className="text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-2">|</span> 
            Service Applications
            <span className="ml-2 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-80">
            Review and manage applications for your services
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-8">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setSelectedPostType('all')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                selectedPostType === 'all'
                  ? 'bg-[#800000] text-white'
                  : 'bg-gray-100 text-[#800000] hover:bg-gray-200'
              }`}
            >
              All Applications ({getTotalCounts().all})
            </button>
            <button
              onClick={() => setSelectedPostType('client')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                selectedPostType === 'client'
                  ? 'bg-[#800000] bg-opacity-80 text-white'
                  : 'bg-gray-100 text-[#800000] hover:bg-gray-200'
              }`}
            >
              Client Requests ({getTotalCounts().client})
            </button>
            <button
              onClick={() => setSelectedPostType('freelancer')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                selectedPostType === 'freelancer'
                  ? 'bg-[#800000] text-white'
                  : 'bg-gray-100 text-[#800000] hover:bg-gray-200'
              }`}
            >
              Freelancer Offers ({getTotalCounts().freelancer})
            </button>
          </div>
        </div>

        {/* No Results Message */}
        {filteredApplicationsByService.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <div className="w-16 h-16 bg-[#800000] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[#800000] mb-2">
              No {selectedPostType !== 'all' ? `${selectedPostType} ` : ''}applications found
            </h3>
            <p className="text-[#800000] text-opacity-80">
              {selectedPostType === 'all' 
                ? 'You haven\'t received any applications yet.'
                : `You haven't received any ${selectedPostType} applications yet.`}
            </p>
          </div>
        )}

        {/* Services and Applications */}
        <div className="space-y-12">
          {filteredApplicationsByService.map(([serviceId, { serviceDetails, applications }], index) => (
            <div 
              key={serviceId} 
              className="bg-white rounded-2xl shadow-xl overflow-hidden animate-fadeIn"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              {/* Service Header */}
              <div className="relative">
                {serviceDetails.ServiceDeleted && (
                  <div className="absolute top-0 left-0 right-0 bg-red-500 text-white py-2 px-4 text-center z-10">
                    <p className="text-sm font-bold">Service has been deleted. Applications are kept for historical purposes.</p>
                  </div>
                )}
                {serviceDetails.image ? (
                  <div className="relative h-72 overflow-hidden">
                    <img
                      src={serviceDetails.image}
                      alt={serviceDetails.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/default-service.png';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#800000] to-transparent opacity-90"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-3xl font-bold text-white tracking-wide">{serviceDetails.title}</h2>
                        <span className={`${getPostTypeColor(serviceDetails.postType)} px-3 py-1 rounded-full text-white text-sm font-semibold`}>
                          {getPostTypeLabel(serviceDetails.postType)}
                        </span>
                      </div>
                      <p className="text-[#ffd700] text-xl font-medium">₱{serviceDetails.price}</p>
                      <div className="mt-2 inline-block px-3 py-1 bg-[#ffd700] text-[#800000] rounded-full text-sm font-bold">
                        {serviceDetails.category}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#800000] p-8">
                    <div className="flex items-center gap-4 mb-4">
                      <h2 className="text-3xl font-bold text-white tracking-wide">{serviceDetails.title}</h2>
                      <span className={`${getPostTypeColor(serviceDetails.postType)} px-3 py-1 rounded-full text-white text-sm font-semibold`}>
                        {getPostTypeLabel(serviceDetails.postType)}
                      </span>
                    </div>
                    <p className="text-[#ffd700] text-xl font-medium">₱{serviceDetails.price}</p>
                    <div className="mt-2 inline-block px-3 py-1 bg-[#ffd700] text-[#800000] rounded-full text-sm font-bold">
                      {serviceDetails.category}
                    </div>
                  </div>
                )}
              </div>

              {/* Service Description */}
              <div className="p-6 border-b border-gray-200">
                <p className="text-gray-700">{serviceDetails.description}</p>
              </div>

              {/* Applications Section */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-[#800000] mb-6 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Applications ({applications.length})
                </h3>

                <div className="space-y-6">
                  {applications.map((application, appIndex) => (
                    <div 
                      key={application.ApplicationId}
                      className="bg-[#f8f5f0] rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.01] overflow-hidden"
                      style={{animationDelay: `${(index * 0.1) + (appIndex * 0.05)}s`}}
                    >
                      {/* Application Header with Status */}
                      <div className="bg-[#800000] bg-opacity-10 p-4 flex justify-between items-center">
                        <div className="flex items-center">
                          {application.ApplicantPhoto ? (
                            <img
                              src={application.ApplicantPhoto}
                              alt={application.ApplicantFullName}
                              className="w-12 h-12 rounded-full object-cover border-2 border-[#800000]"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '/default-avatar.png';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[#800000] flex items-center justify-center text-white font-bold">
                              {application.ApplicantFullName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          
                          <div className="ml-4">
                            <Link 
                              to={`/userprofile/${application.ApplicantId}`}
                              className="text-[#800000] font-bold hover:text-[#600000] transition-colors"
                            >
                              {application.ApplicantFullName}
                            </Link>
                            <p className="text-sm text-gray-600">Student ID: {application.ApplicantStudentId}</p>
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        <div className={`px-4 py-1 rounded-full text-sm font-bold 
                          ${application.Status === 'Pending' ? 'bg-yellow-400 text-yellow-900' : 
                            application.Status === 'Accepted' ? 'bg-green-500 text-white' : 
                            application.Status === 'Rejected' ? 'bg-red-500 text-white' : 
                            'bg-[#ffd700] text-[#800000]'}`}
                        >
                          {application.Status}
                        </div>
                      </div>

                      {/* Application Message */}
                      <div className="p-6">
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-500 mb-2">Message:</h4>
                          <p className="text-gray-700">{application.ApplicationMessage}</p>
                        </div>
                        
                        <div className="text-sm text-gray-500">
                          Applied on: {new Date(application.CreatedAt).toLocaleDateString()}
                        </div>

                        {/* Accept/Reject Buttons */}
                        {application.Status === "Pending" && (
                          <div className="mt-6 flex gap-4">
                            <button
                              onClick={() => handleUpdateStatus(application.ApplicationId, "Accepted")}
                              disabled={updatingId === application.ApplicationId}
                              className="py-2 px-6 bg-[#ffd700] text-[#800000] rounded-full font-bold 
                                      hover:bg-[#ffcc00] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md
                                      disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                            >
                              {updatingId === application.ApplicationId ? (
                                <span className="flex items-center justify-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#800000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing...
                                </span>
                              ) : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(application.ApplicationId, "Rejected")}
                              disabled={updatingId === application.ApplicationId}
                              className="py-2 px-6 bg-[#800000] text-white rounded-full font-bold 
                                      hover:bg-[#600000] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md
                                      disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                            >
                              {updatingId === application.ApplicationId ? (
                                <span className="flex items-center justify-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing...
                                </span>
                              ) : 'Reject'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Add these animations to your Tailwind CSS config or add them inline if not already added
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

export default ServiceConfirmationPage;
