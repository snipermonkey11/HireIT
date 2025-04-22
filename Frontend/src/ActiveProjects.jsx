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
            isClient: !(isFreelancerForClientPost || isFreelancerServiceOwner),
            isFreelancer: isFreelancerForClientPost || isFreelancerServiceOwner,
            isFreelancerServiceOwner: isFreelancerServiceOwner,
            userRole: (isFreelancerForClientPost || isFreelancerServiceOwner) ? 'Freelancer' : 'Client'
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
        return 'bg-[#800000] text-[#ffd700]';
      case 'Service Started':
        return 'bg-[#ffd700] text-[#800000]';
      case 'Completed':
        return 'bg-[#800000] text-[#ffd700]';
      case 'Waiting for Approval':
        return 'bg-[#800000] text-[#ffd700]';
      case 'Proof Rejected':
        return 'bg-[#800000] text-[#ffd700]';
      case 'Approved':
        return 'bg-[#ffd700] text-[#800000]';
      case 'Payment Sent':
        return 'bg-[#ffd700] text-[#800000]';
      case 'Payment Received':
        return 'bg-[#800000] text-[#ffd700]';
      default:
        return 'bg-[#800000] text-[#ffd700]';
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
          <div>
            <div className="bg-[#ffd700]/10 border border-[#ffd700]/30 rounded-lg p-3 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3 3a1 1 0 01-1.414 0l-1.5-1.5a1 1 0 011.414-1.414l.793.793 2.293-2.293a1 1 0 011.414 1.414z" clipRule="evenodd" />
              </svg>
              <p className="text-[#800000] text-sm">Project in progress. Mark as completed when done.</p>
            </div>
            <button
              onClick={() => handleMarkCompleted(ApplicationId)}
              className="w-full py-3 px-4 bg-[#800000] text-[#ffd700] rounded-lg font-semibold hover:bg-[#9a0000] transition-all flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mark as Completed
            </button>
          </div>
        );
      case 'Completed':
        return (
          <div>
            <p className="text-[#800000] mb-2 text-sm">Upload proof of the completed work:</p>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadProof(ApplicationId, e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={!!uploading}
              />
              <button
                className={`w-full py-3 px-4 ${uploading === ApplicationId ? 'bg-gray-400' : 'bg-[#800000] hover:bg-[#9a0000]'} text-[#ffd700] rounded-lg font-semibold transition-all flex items-center justify-center`}
                disabled={!!uploading}
              >
                {uploading === ApplicationId ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            <div className="bg-[#800000]/10 border border-[#800000]/30 rounded-lg p-3 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-[#800000] text-sm">Your proof was rejected. Please upload a new one.</p>
            </div>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadProof(ApplicationId, e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={!!uploading}
              />
              <button
                className={`w-full py-3 px-4 ${uploading === ApplicationId ? 'bg-gray-400' : 'bg-[#800000] hover:bg-[#9a0000]'} text-[#ffd700] rounded-lg font-semibold transition-all flex items-center justify-center`}
                disabled={!!uploading}
              >
                {uploading === ApplicationId ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="py-4 px-4 bg-[#ffd700]/5 rounded-lg text-center border border-[#ffd700]/30">
            <p className="text-[#800000] mb-3">Your proof has been submitted and is waiting for client review</p>
            <div className="mx-auto w-20 h-20 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-12 h-12 text-[#800000]" fill="none">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="absolute inset-0 animate-spin-slow">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-20 h-20 text-[#ffd700]" fill="none">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <p className="text-[#800000]/70 mt-3 text-sm italic">Waiting for client review</p>
          </div>
        );
      case 'Approved':
        return (
          <div className="py-4 px-4 bg-[#ffd700]/10 rounded-lg text-center border border-[#ffd700]/30">
            <div className="flex items-center justify-center mb-3">
              <div className="w-8 h-8 rounded-full bg-[#800000] flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#ffd700]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-semibold text-[#800000] ml-2">Proof approved successfully!</span>
            </div>
            <p className="text-[#800000]/80 text-sm">Waiting for client to process payment. You'll be notified when payment is sent.</p>
          </div>
        );
      case 'Payment Sent':
        return (
          <button
            onClick={() => handlePaymentReceived(ApplicationId)}
            disabled={!!uploading}
            className={`w-full py-3 px-4 ${uploading === ApplicationId ? 'bg-gray-400' : 'bg-[#800000] hover:bg-[#9a0000]'} text-[#ffd700] rounded-lg font-semibold transition-all flex items-center justify-center`}
          >
            {uploading === ApplicationId ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="py-4 px-4 bg-[#ffd700]/10 rounded-lg text-center border border-[#ffd700]/30">
            <div className="flex items-center justify-center mb-2">
              <div className="w-8 h-8 rounded-full bg-[#800000] flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#ffd700]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-semibold text-[#800000] ml-2">Payment received successfully!</span>
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-[#800000]/10 text-[#800000] text-xs font-medium">
              Project completed
            </div>
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
        <div className="bg-gradient-to-r from-[#800000] to-[#9a0000] text-white p-6 sm:p-8 rounded-t-2xl shadow-xl mb-8 border-b-4 border-[#ffd700]">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-3">|</span> 
            <span className="text-[#ffd700]">Active Projects</span>
            <span className="ml-3 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-90 pl-4 border-l-2 border-[#ffd700]/50">
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
                className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 border border-[#ffd700]/10"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Project Header with Image */}
                <div className="relative">
                  {project.ServiceImage ? (
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={project.ServiceImage}
                        alt={project.ServiceTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/default-service.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#800000] to-transparent opacity-50"></div>
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-r from-[#800000] to-[#9a0000]"></div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-xl font-bold">{project.ServiceTitle}</h3>
                    <div className="flex items-center mt-1">
                      <span className="ml-1 bg-[#ffd700] text-[#800000] text-xs px-2 py-0.5 rounded-full font-bold">
                        {project.PostType === 'client' ? 'Client Request' : 'Freelancer Service'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Status and Price Bar */}
                <div className="px-4 py-3 border-b border-[#ffd700]/10 flex items-center justify-between bg-[#ffd700]/5">
                  <div className="flex items-center">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(project.Status)}`}>
                      {getStatusText(project)}
                    </div>
                    <div className="ml-2 px-2 py-0.5 bg-[#800000] text-[#ffd700] rounded-full text-xs font-semibold shadow-sm">
                      {project.userRole}
                    </div>
                  </div>
                  <p className="text-[#800000] text-sm font-bold">₱{project.ServicePrice}</p>
                </div>
                
                {/* Main Action Area */}
                <div className="p-4">
                  {/* Action Button */}
                  {getActionButton(project)}
                  
                  {/* Proof Image (if available) */}
                  {project.isFreelancer && project.ProofImage && 
                   ['Waiting for Approval', 'Proof Rejected', 'Approved', 'Payment Sent', 'Payment Received'].includes(project.Status) && (
                    <div className="mt-4">
                      <div className="bg-[#ffd700]/5 p-2 rounded-md border border-[#ffd700]/20">
                        <img 
                          src={project.ProofImage} 
                          alt="Proof" 
                          className="w-full h-24 object-contain rounded"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-service.png';
                          }}
                        />
                        <p className="text-xs text-[#800000] mt-1 italic text-center">
                          {project.Status === 'Waiting for Approval' && "Waiting for client review"}
                          {project.Status === 'Proof Rejected' && "Rejected by client - Please upload new proof"}
                          {project.Status === 'Approved' && "Proof approved by client"}
                          {(project.Status === 'Payment Sent' || project.Status === 'Payment Received') && "Completed proof"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Project Details (Collapsible) */}
                <div className="px-4 pb-4">
                  <details className="group">
                    <summary className="list-none flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-[#800000]">View Project Details</span>
                      <span className="text-[#800000] transition-transform duration-300 group-open:rotate-180">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </span>
                    </summary>
                    
                    <div className="mt-3 pt-3 border-t border-[#ffd700]/10">
                      {/* Project relationship info - Enhanced */}
                      <div className="mb-3 rounded-lg overflow-hidden border border-[#ffd700]/30 shadow-sm">
                        <div className="bg-gradient-to-r from-[#800000] to-[#9a0000] px-3 py-2 text-[#ffd700] text-sm font-semibold">
                          Project Relationship
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-[#ffd700]/20">
                          <div className="p-3 bg-gradient-to-b from-[#ffd700]/10 to-transparent">
                            <div className="flex items-center mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#800000] mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                              <p className="text-xs font-semibold text-[#800000]">PROJECT POSTED BY</p>
                            </div>
                            <p className="font-medium text-sm">{project.postedByName || project.ServiceOwnerName}</p>
                            <p className="text-xs mt-1 inline-block px-2 py-0.5 rounded-full bg-[#800000]/10 text-[#800000]">
                              {project.PostType === 'client' ? 'Client' : 'Freelancer'}
                            </p>
                          </div>
                          
                          <div className="p-3 bg-gradient-to-b from-[#ffd700]/10 to-transparent">
                            <div className="flex items-center mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#800000] mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8z" />
                                <path d="M12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
                              </svg>
                              <p className="text-xs font-semibold text-[#800000]">APPLIED BY</p>
                            </div>
                            <p className="font-medium text-sm">{project.appliedByName || project.FreelancerName}</p>
                            <p className="text-xs mt-1 inline-block px-2 py-0.5 rounded-full bg-[#800000]/10 text-[#800000]">
                              {project.PostType === 'client' ? 'Freelancer' : 'Client'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {project.ApplicationMessage && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold text-[#800000]">Your Application:</span> {project.ApplicationMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Add custom animation for spinner
const spinStyle = document.createElement('style');
spinStyle.textContent = `
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow {
    animation: spin-slow 3s linear infinite;
  }
`;
document.head.appendChild(spinStyle);

export default ActiveProjects;
