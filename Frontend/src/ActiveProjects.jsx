import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const ActiveProjects = () => {
  const [activeProjects, setActiveProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveProjects();
  }, []);

  const fetchActiveProjects = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData'));
      console.log('User data:', userData);
      console.log('Auth token:', userData?.token);
      
      const response = await api.get('/active');
      console.log('==== ACTIVE PROJECTS DATA ====');
      console.log('Active projects raw data:', response.data);
      console.log('Number of projects returned:', response.data.length);
      
      // Log each project's key information
      if (response.data.length > 0) {
        response.data.forEach((project, index) => {
          console.log(`Project ${index + 1}:`);
          console.log(`- ID: ${project.ApplicationId}`);
          console.log(`- Title: ${project.ServiceTitle}`);
          console.log(`- Status: ${project.Status}`);
          console.log(`- PostType: ${project.PostType}`);
          console.log(`- FreelancerId: ${project.FreelancerId} (User: ${userData.userId})`);
          console.log(`- ServiceOwnerId: ${project.ServiceOwnerId}`);
        });
      } else {
        console.log('No active projects found in server response');
      }
      console.log('=============================');
      
      // Filter and process projects - show projects where user is the freelancer OR the service owner for freelancer posts
      const processedProjects = response.data
        .filter(project => {
          const userData = JSON.parse(localStorage.getItem('userData'));
          // Case 1: User is the freelancer who applied to a client post
          const isFreelancerForClientPost = project.FreelancerId === userData.userId && project.PostType === 'client';
          
          // Case 2: User is the service owner who posted a freelancer service
          const isFreelancerServiceOwner = project.ServiceOwnerId === userData.userId && project.PostType === 'freelancer';
          
          console.log(`Project ${project.ApplicationId} - isFreelancerForClientPost: ${isFreelancerForClientPost}, isFreelancerServiceOwner: ${isFreelancerServiceOwner}`);
          
          // Include the project if either condition is true
          return isFreelancerForClientPost || isFreelancerServiceOwner;
        })
        .map(project => {
          if (project.ServiceImage) {
            project.ServiceImage = formatImageUrl(project.ServiceImage);
          }
          if (project.ProofImage) {
            project.ProofImage = formatImageUrl(project.ProofImage);
          }
          
          // Determine if the user is the freelancer (applied to client post) or the service owner (posted a freelancer service)
          const userData = JSON.parse(localStorage.getItem('userData'));
          const isFreelancerForClientPost = project.FreelancerId === userData.userId && project.PostType === 'client';
          const isFreelancerServiceOwner = project.ServiceOwnerId === userData.userId && project.PostType === 'freelancer';
          
          return {
            ...project,
            isClient: false,
            isFreelancer: true,
            isFreelancerServiceOwner: isFreelancerServiceOwner,
            userRole: 'Freelancer'
          };
        });
      
      console.log('Total active projects after processing:', processedProjects.length);
      setActiveProjects(processedProjects);
      setError(null);
    } catch (err) {
      console.error('Error fetching active projects:', err);
      console.error('Error details:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setError('Failed to load active projects. Please try again later.');
      toast.error('Failed to load active projects');
    } finally {
      setLoading(false);
    }
  };

  // Handle navigation to the payment page
  const navigateToPaymentPage = (projectId, status) => {
    if (status === "Approved") {
      navigate(`/payment/${projectId}`);
    } else if (status === "Payment Sent") {
      navigate(`/received-payment/${projectId}`);
    }
  };

  // Mark service as completed
  const handleMarkCompleted = async (projectId) => {
    try {
      console.log(`Marking project ${projectId} as completed...`);
      const response = await api.patch(`/active/${projectId}/complete`);
      console.log('Mark completed response:', response.data);
      
      toast.success('Project marked as completed');
      // Update the project in the list
      setActiveProjects(prevProjects => 
        prevProjects.map(project => 
          project.ApplicationId === projectId 
            ? { ...project, Status: 'Completed' }
            : project
        )
      );
    } catch (err) {
      console.error('Error marking project as completed:', err);
      toast.error(err.response?.data?.error || 'Failed to mark project as completed');
    }
  };

  // Handle proof upload
  const handleUploadProof = async (projectId, file) => {
    if (!file) {
      toast.error('Please select an image to upload');
      return;
    }

    try {
      setUploading(projectId);
      console.log(`Uploading proof for project ${projectId}...`, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      });
      
      // Verify file is valid
      if (file.size === 0) {
        toast.error('File is empty. Please select a valid image.');
        return;
      }
      
      // Check file type to ensure it's an image
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed.');
        return;
      }
      
      const formData = new FormData();
      formData.append('proof', file);
      
      // Ensure form data is correctly populated
      if (formData.get('proof') === 'undefined' || formData.get('proof') === 'null') {
        toast.error('Error creating form data. Please try again with a different image.');
        return;
      }

      // Log form data details
      for (let [key, value] of formData.entries()) {
        console.log(`FormData: ${key} = ${value instanceof File ? 
          `${value.name} (${value.size} bytes, ${value.type})` : value}`);
      }

      // Get the current token
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const token = userData.token;
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      console.log('Sending API request with form data...');
      
      // Remove any extra options that might interfere
      const response = await api.post(`/active/${projectId}/proof`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        transformRequest: [function (data) {
          // Do not transform the formData
          return data;
        }],
        timeout: 30000 // Increase timeout for large files
      });
      
      console.log('Upload proof response:', response.data);
      toast.success('Proof uploaded successfully');
      
      // Update the project in the list
      setActiveProjects(prevProjects => 
        prevProjects.map(project => 
          project.ApplicationId === projectId 
            ? { 
                ...project, 
                Status: 'Waiting for Approval',
                ProofImage: URL.createObjectURL(file) // Create temporary URL for the image
              }
            : project
        )
      );
    } catch (err) {
      console.error('Error uploading proof:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message;
      toast.error(`Failed to upload proof: ${errorMessage}`);
    } finally {
      setUploading(null);
    }
  };

  // Add this new function to handle marking payment as received
  const handlePaymentReceived = async (projectId) => {
    try {
      setUploading(projectId); // Reuse uploading state for processing indicator
      
      console.log(`Marking payment as received for project ${projectId}...`);
      const response = await api.patch(`/active/${projectId}/payment-received`);
      console.log('Payment received response:', response.data);
      
      if (response.data.success) {
        toast.success('Payment marked as received!');
        
        // Update the project in the list
        setActiveProjects(prevProjects => 
          prevProjects.map(project => 
            project.ApplicationId === projectId 
              ? { ...project, Status: 'Payment Received' }
              : project
          )
        );
      } else {
        toast.error(response.data.message || 'Failed to mark payment as received');
      }
    } catch (err) {
      console.error('Error marking payment as received:', err);
      toast.error(err.response?.data?.error || 'Failed to mark payment as received');
    } finally {
      setUploading(null);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-500 text-white';
      case 'Service Started':
        return 'bg-yellow-400 text-yellow-800';
      case 'Completed':
        return 'bg-indigo-500 text-white';
      case 'Waiting for Approval':
        return 'bg-purple-500 text-white';
      case 'Proof Rejected':
        return 'bg-red-500 text-white';
      case 'Payment Sent':
        return 'bg-green-500 text-white';
      case 'Payment Received':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-[#800000] text-white';
    }
  };

  const getStatusText = (project) => {
    const { Status } = project;
    
    switch (Status) {
      case 'Accepted':
        return 'Ready to Start';
      case 'Service Started':
        return 'Service In Progress';
      case 'Completed':
        return 'Pending Proof';
      case 'Waiting for Approval':
        return 'Proof Ready for Review';
      case 'Proof Rejected':
        return 'Proof Rejected';
      case 'Approved':
        return 'Proof Approved - Awaiting Payment';
      case 'Payment Sent':
        return 'Payment Sent - Confirm Receipt';
      case 'Payment Received':
        return 'Payment Received - Completed';
      default:
        return Status;
    }
  };

  const getActionButton = (project) => {
    const { Status, ApplicationId, PostType } = project;

    // Handle actions for freelancers - this includes both client posts and freelancer posts
    switch (Status) {
      case 'Service Started':
        return (
          <button
            onClick={() => handleMarkCompleted(ApplicationId)}
            className="w-full py-3 px-4 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-all flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mark as Completed
          </button>
        );
      case 'Completed':
        return (
          <div>
            <p className="text-gray-700 mb-2 text-sm">Upload proof of the completed work:</p>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadProof(ApplicationId, e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={!!uploading}
              />
              <button
                className={`w-full py-3 px-4 ${uploading === ApplicationId ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg font-semibold transition-all flex items-center justify-center`}
                disabled={!!uploading}
              >
                {uploading === ApplicationId ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Proof Image
                  </>
                )}
              </button>
            </div>
          </div>
        );
      case 'Proof Rejected':
        return (
          <div>
            <p className="text-red-600 mb-2 text-sm">Your proof was rejected. Please upload a new one:</p>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadProof(ApplicationId, e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={!!uploading}
              />
              <button
                className={`w-full py-3 px-4 ${uploading === ApplicationId ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg font-semibold transition-all flex items-center justify-center`}
                disabled={!!uploading}
              >
                {uploading === ApplicationId ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload New Proof
                  </>
                )}
              </button>
            </div>
          </div>
        );
      case 'Waiting for Approval':
        return (
          <div className="py-3 px-4 bg-purple-50 text-purple-700 rounded-lg text-center border border-purple-200">
            <p>Your proof has been submitted and is waiting for client review</p>
          </div>
        );
      case 'Approved':
        return (
          <div className="py-3 px-4 bg-green-100 text-green-800 rounded-lg text-center border border-green-200">
            <div className="flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Proof approved successfully!</span>
            </div>
            <p className="text-sm">Waiting for client to process payment. You'll be notified when payment is sent.</p>
          </div>
        );
      case 'Payment Sent':
        return (
          <button
            onClick={() => handlePaymentReceived(ApplicationId)}
            disabled={!!uploading}
            className={`w-full py-3 px-4 ${uploading === ApplicationId ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg font-semibold transition-all flex items-center justify-center`}
          >
            {uploading === ApplicationId ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark Payment Received
              </>
            )}
          </button>
        );
      case 'Payment Received':
        return (
          <div className="py-3 px-4 bg-green-100 text-green-800 rounded-lg text-center border border-green-200">
            <p className="font-semibold">Payment received successfully!</p>
            <p className="text-xs mt-1">Project completed</p>
          </div>
        );
      default:
        return (
          <div className="py-3 px-4 bg-gray-100 text-gray-700 rounded-lg text-center">
            <p>Status: {getStatusText(project)}</p>
          </div>
        );
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
          <div className="flex justify-center mt-6">
            <button
              onClick={() => fetchActiveProjects()}
              className="px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userData = JSON.parse(localStorage.getItem('userData'));

  return (
    <div className="min-h-screen bg-[#f8f5f0] py-10 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl animate-fadeIn">
        {/* Header */}
        <div className="bg-[#800000] text-white p-6 sm:p-8 rounded-t-2xl shadow-xl mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-2">|</span> 
            Active Projects
            <span className="ml-2 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-80">
            Manage your active projects as a freelancer
          </p>
        </div>

        {activeProjects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-24 h-24 mx-auto bg-[#f8f5f0] rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-xl text-gray-700 font-medium">No active projects yet</p>
            <p className="text-gray-500 mt-2">When you are hired for a project, it will appear here</p>
            <button 
              onClick={() => navigate('/services')}
              className="mt-6 px-6 py-3 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300 transform hover:-translate-y-1 shadow-md"
            >
              Browse Services
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {activeProjects.map((project, index) => (
              <div
                key={project.ApplicationId}
                className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Project Header */}
                <div className="relative">
                  {project.ServiceImage ? (
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={project.ServiceImage}
                        alt={project.ServiceTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/default-service.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#800000] to-transparent opacity-80"></div>
                    </div>
                  ) : (
                    <div className="h-32 bg-gradient-to-r from-[#800000] to-[#600000]"></div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-xl font-bold">{project.ServiceTitle}</h3>
                    <div className="flex items-center mt-1">
                      <span className="text-sm opacity-90 mr-2">
                        Client: {project.ServiceOwnerName}
                      </span>
                      <span className="ml-1 bg-white text-[#800000] text-xs px-2 py-0.5 rounded-full font-bold">
                        {project.PostType === 'client' ? 'Client Request' : 'Freelancer Service'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Project Body */}
                <div className="p-6">
                  {/* Status Badge */}
                  <div className="flex items-center mb-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusBadgeColor(project.Status)}`}>
                      {getStatusText(project)}
                    </div>
                    <div className="ml-2 px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-semibold">
                      Freelancer
                    </div>
                  </div>
                  
                  {/* Project Details */}
                  <div className="mb-4">
                    <p className="text-gray-600 mb-2">Price: ₱{project.ServicePrice}</p>
                    
                    {/* Improved project relationship info */}
                    <div className="bg-gray-50 p-3 rounded-lg mb-3 border border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Project Relationship:</h4>
                      {project.relationshipDescription && (
                        <p className="text-sm text-gray-700 mb-2">{project.relationshipDescription}</p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white p-2 rounded border border-gray-200">
                          <p className="text-xs text-gray-500 uppercase">PROJECT POSTED BY</p>
                          <p className="font-medium text-sm">{project.postedByName || project.ServiceOwnerName}</p>
                          <p className="text-xs text-blue-600">
                            {/* If it's a client post, the poster is a client */}
                            ({project.PostType === 'client' ? 'client' : 'freelancer'})
                          </p>
                        </div>
                        
                        <div className="bg-white p-2 rounded border border-gray-200">
                          <p className="text-xs text-gray-500 uppercase">APPLIED BY</p>
                          <p className="font-medium text-sm">{project.appliedByName || project.FreelancerName}</p>
                          <p className="text-xs text-green-600">
                            {/* If it's a client post, the applicant is a freelancer */}
                            ({project.PostType === 'client' ? 'freelancer' : 'client'})
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {project.ApplicationMessage && (
                      <p className="text-gray-600 mb-2">
                        <span className="font-semibold">Your Application:</span> {project.ApplicationMessage}
                      </p>
                    )}
                  </div>

                  {/* Show proof image for freelancers when proof is available */}
                  {project.isFreelancer && project.ProofImage && ['Waiting for Approval', 'Proof Rejected', 'Approved', 'Payment Sent', 'Payment Received'].includes(project.Status) && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Submitted Proof:</h4>
                      <div className="bg-gray-100 p-2 rounded-md">
                        <img 
                          src={project.ProofImage} 
                          alt="Proof of completion" 
                          className="w-full h-32 object-contain rounded"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-service.png';
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {project.Status === 'Waiting for Approval' && "Waiting for client review"}
                        {project.Status === 'Proof Rejected' && "Rejected by client"}
                        {project.Status === 'Approved' && "Approved by client"}
                        {(project.Status === 'Payment Sent' || project.Status === 'Payment Received') && "Completed proof"}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  {getActionButton(project)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveProjects;
