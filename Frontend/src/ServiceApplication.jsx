import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "./services/api";
import { toast } from 'react-toastify';

// Helper function to format image URL properly
const formatImageUrl = (imageData) => {
  if (!imageData) return null;
  if (typeof imageData !== 'string') return null;
  
  // If it's already a complete data URL
  if (imageData.startsWith('data:image')) {
    return imageData;
  }
  
  // If it's a base64 string without the prefix
  if (imageData.startsWith('/9j/') || imageData.match(/^[A-Za-z0-9+/=]+$/)) {
    return `data:image/jpeg;base64,${imageData}`;
  }
  
  // If it's a URL
  if (imageData.startsWith('http')) {
    return imageData;
  }
  
  // Default case, assume it's base64
  return `data:image/jpeg;base64,${imageData}`;
};

// Function to add notification to localStorage
const addNotification = (message, type, timestamp, userId) => {
  const newNotification = { message, type, timestamp };
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push({ ...newNotification, userId });
  localStorage.setItem("notifications", JSON.stringify(notifications));
};

const ServiceApplication = () => {
  const { serviceId } = useParams();
  const [service, setService] = useState(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('userData'));
  const token = userData?.token || localStorage.getItem('token');

  // Fetch the service data
  useEffect(() => {
    const fetchService = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/services/${serviceId}`);
        setService(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load service details');
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [serviceId]);

  // Handle application submission
  const handleApplicationSubmit = async () => {
    try {
      if (applicationMessage.trim() === "") {
        toast.error("Please provide an application message!");
        return;
      }

      // Get the latest token and ensure we're logged in
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const token = userData.token || localStorage.getItem('token');
      
      if (!token) {
        toast.error("Please log in to submit an application.");
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        navigate('/login');
        return;
      }

      setSubmitting(true);
      
      // Clean up serviceId and ensure it's a number
      const cleanServiceId = parseInt(serviceId);
      if (isNaN(cleanServiceId)) {
        throw new Error('Invalid service ID');
      }
      
      // Submit the application
      const response = await api.post('/applications', {
        serviceId: cleanServiceId,
        message: applicationMessage.trim()
      });

      // Debug log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Application submission response:', {
          status: response.status,
          hasData: !!response.data,
          applicationId: response.data?.application?.id
        });
      }
      
      // Only proceed if we got a successful response
      if (!response.data || !response.data.application) {
        throw new Error('No application data returned from server');
      }

      // Get the seller ID for the notification
      const sellerId = response.data.application.ServiceOwnerId;
      
      // Add notifications for both the user and the service owner
      addNotification(
        `You have submitted an application for "${service.Title}"`,
        "APPLICATION_SUBMITTED",
        new Date().toISOString(),
        userData.userId
      );
      
      if (sellerId) {
        addNotification(
          `You received a new application for your service "${service.Title}"`,
          "APPLICATION_RECEIVED",
          new Date().toISOString(),
          sellerId
        );
      }

      toast.success("Your application has been submitted successfully!");
      
      setTimeout(() => {
        navigate("/my-applications");
      }, 1500);

    } catch (err) {
      console.error('Application submission error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        url: err.config?.url
      });

      if (err.response?.status === 400) {
        toast.error(err.response.data.error || "Please check your application details");
      } else if (err.response?.status === 401) {
        // Check if we actually have a token before redirecting
        const hasToken = !!(localStorage.getItem('token') || JSON.parse(localStorage.getItem('userData') || '{}').token);
        
        if (!hasToken) {
          toast.error("Please log in to submit an application.");
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
          navigate('/login');
        } else {
          // If we have a token but got 401, it might be expired or invalid
          toast.error("Your session may have expired. Please try logging in again.");
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
          navigate('/login');
        }
      } else {
        toast.error(
          err.response?.data?.error || 
          err.message || 
          "Failed to submit application. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Add an effect to check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const token = userData.token || localStorage.getItem('token');
      
      if (!token) {
        toast.error("Please log in to submit applications.");
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

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
          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-200 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xl text-gray-700 font-medium">Service not found</p>
          <button 
            onClick={() => navigate('/services')}
            className="mt-6 px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
          >
            Browse Services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] py-10 px-4 sm:px-6">
      <div className="container mx-auto max-w-4xl animate-fadeIn">
        {/* Header */}
        <div className="bg-[#800000] text-white p-6 sm:p-8 rounded-t-2xl shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-wider flex items-center">
              <span className="text-[#ffd700] mr-2">|</span> 
              {service?.PostType === 'client' ? 'Offer Your Services' : 'Apply for Service'}
              <span className="ml-2 text-[#ffd700]">|</span>
            </h2>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 md:mt-0 px-4 py-2 bg-[#ffd700] text-[#800000] rounded-full font-semibold hover:bg-opacity-90 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-white p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Service Image */}
            <div className="md:w-1/2">
              {service.Photo ? (
                <img
                  src={formatImageUrl(service.Photo)}
                  alt={service.Title}
                  className="w-full h-64 object-cover rounded-xl shadow-md transition-all duration-500 transform hover:scale-[1.02] hover:shadow-lg"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-service.png';
                  }}
                />
              ) : (
                <div className="w-full h-64 bg-gray-200 rounded-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Service Info */}
            <div className="md:w-1/2">
              <h3 className="text-2xl font-bold text-[#800000]">{service.Title}</h3>
              
              <div className="mt-4 flex items-center">
                <span className="inline-flex items-center justify-center px-3 py-1 bg-[#800000] bg-opacity-10 text-[#800000] rounded-full font-semibold text-sm">
                  {service.Category}
                </span>
                <span className="ml-4 text-xl font-bold text-[#800000]">₱{service.Price}</span>
                <span className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
                  service.PostType === 'client' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-[#fff3cd] text-[#800000]'
                }`}>
                  {service.PostType === 'client' ? '👥 Client Need' : '💼 Freelancer Service'}
                </span>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm uppercase tracking-wider text-gray-500 font-medium">Description</h4>
                <p className="mt-2 text-gray-700">{service.Description}</p>
              </div>

              {/* Post Type Information */}
              <div className="mt-4 p-4 rounded-lg bg-gray-50">
                <h4 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-2">
                  {service.PostType === 'client' ? 'Client Looking For' : 'Service Offered By'}
                </h4>
                <p className="text-gray-700">
                  {service.PostType === 'client' 
                    ? 'A freelancer to help with this project/task'
                    : 'A freelancer offering their expertise'}
                </p>
              </div>
            </div>
          </div>

          {/* Application Form */}
          <div className="mt-10">
            <h3 className="text-xl font-bold text-[#800000] mb-4">
              {service.PostType === 'client' 
                ? 'Offer Your Services to this Client'
                : 'Apply for this Service'}
            </h3>
            
            <div className="bg-[#f8f5f0] p-6 rounded-xl">
              <label htmlFor="applicationMessage" className="block text-sm font-medium text-gray-700 mb-2">
                {service.PostType === 'client' 
                  ? 'Explain how you can help with this project:'
                  : 'Tell us why you\'re interested in this service:'}
              </label>
              <textarea
                id="applicationMessage"
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                placeholder={service.PostType === 'client' 
                  ? "Introduce yourself and explain your expertise and how you can help with this project..."
                  : "Introduce yourself and explain why you're interested in this service..."}
                className="w-full p-4 border border-gray-300 rounded-lg bg-white text-gray-800 shadow-inner focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-all duration-300"
                rows="6"
                disabled={submitting}
              />
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleApplicationSubmit}
                  disabled={submitting}
                  className={`py-3 px-8 rounded-full font-bold focus:ring-2 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                    service.PostType === 'client'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                      : 'bg-[#800000] hover:bg-[#600000] text-white focus:ring-[#800000]'
                  }`}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      {service.PostType === 'client' ? 'Submit Service Offer' : 'Submit Application'}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceApplication;
