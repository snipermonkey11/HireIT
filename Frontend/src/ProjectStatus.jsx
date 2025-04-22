import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from './services/api';
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

// Custom success notification component
const SuccessNotification = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black bg-opacity-30" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 relative animate-fadeIn transform transition-all duration-300 ease-in-out">
        <button 
          onClick={onClose} 
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-500"
        >
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="p-6 flex flex-col items-center">
          <div className="mb-4 bg-[#800000] p-3 rounded-full">
            <svg className="w-6 h-6 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg text-[#800000] font-bold mb-4">Success!</h3>
          <p className="text-center text-gray-700 mb-4">{message}</p>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2 bg-[#800000] text-[#ffd700] font-semibold rounded hover:bg-[#600000] transition-all duration-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

const ProjectStatus = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [selectedProof, setSelectedProof] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState({
    show: false,
    message: ''
  });

  console.log("========== PROJECT STATUS COMPONENT ==========");
  console.log("User details:", JSON.parse(localStorage.getItem('userData') || '{}'));
  console.log("==============================================");

  // Function to get friendly status message
  const getStatusMessage = (status) => {
    switch (status) {
      case 'Proof Rejected':
        return 'Waiting for new proof';
      case 'Waiting for Approval':
        return 'Proof ready for review';
      case 'Service Started':
        return 'Service in progress';
      case 'Payment Sent':
        return 'Payment sent';
      default:
        return status;
    }
  };

  // Function to get status badge class
  const getStatusClass = (status) => {
    switch (status) {
      case 'Proof Rejected':
        return 'bg-[#800000] text-[#ffd700]';
      case 'Waiting for Approval':
        return 'bg-[#800000] text-[#ffd700]';
      case 'Service Started':
        return 'bg-[#ffd700] text-[#800000]';
      case 'Payment Sent':
        return 'bg-[#ffd700] text-[#800000]';
      case 'Approved':
        return 'bg-[#ffd700] text-[#800000]';
      case 'Completed':
        return 'bg-[#800000] text-[#ffd700]';
      case 'Payment Received':
        return 'bg-[#800000] text-[#ffd700]';
      default:
        return 'bg-[#800000] text-[#ffd700]';
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // Get user data to log userId
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      console.log('Current user ID:', userData.userId);
      
      const response = await api.get('/status');
      console.log('Fetched projects:', response.data);
      console.log('Number of projects found:', response.data.length);
      
      // Check if any projects have "Waiting for Approval" status
      const waitingProjects = response.data.filter(p => p.Status === 'Waiting for Approval');
      console.log('Projects waiting for approval:', waitingProjects.length);
      if (waitingProjects.length > 0) {
        console.log('First waiting project proof image:', waitingProjects[0].ProofImage ? 'Present (length: ' + waitingProjects[0].ProofImage.length + ')' : 'Missing');
      }
      
      // Process images in the projects
      const processedProjects = response.data.map(project => {
        // Log each project's key details to help debug
        console.log(`Project ID: ${project.ApplicationId}, Status: ${project.Status}, PostType: ${project.PostType}, ServiceOwnerId: ${project.ServiceOwnerId}`);
        
        let formattedServiceImage = null;
        let formattedProofImage = null;
        
        try {
          if (project.ServiceImage) {
            formattedServiceImage = formatImageUrl(project.ServiceImage);
            console.log(`Formatted service image for project ${project.ApplicationId}`);
          }
          
          if (project.ProofImage) {
            formattedProofImage = formatImageUrl(project.ProofImage);
            console.log(`Formatted proof image for project ${project.ApplicationId}`);
          }
        } catch (err) {
          console.error('Error formatting images:', err);
        }
        
        return {
          ...project,
          ServiceImage: formattedServiceImage,
          ProofImage: formattedProofImage
        };
      });
      
      console.log('Processed projects:', processedProjects.map(p => ({
        id: p.ApplicationId,
        status: p.Status,
        hasProofImage: !!p.ProofImage
      })));
      
      setProjects(processedProjects);
      setError(null);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects. Please try again later.');
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Function to open the proof modal
  const openProofModal = (project) => {
    setSelectedProof(project);
    setModalOpen(true);
  }

  // Updated handle functions
  const handleApproveProof = async (applicationId) => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await api.patch(`/status/${applicationId}/approve`);
      
      if (response.data.success) {
        // Show custom success modal
        setSuccessModal({
          show: true,
          message: 'Proof approved successfully'
        });
        
        // Also show the toast for redundancy
        toast.success('Proof approved successfully!', {
          style: {
            background: '#800000',
            color: '#ffd700',
            fontWeight: 'bold'
          },
          progressStyle: {
            background: '#ffd700'
          },
          icon: '✓'
        });
        
        // Refresh the projects list
        fetchProjects();
      } else {
        const errorMsg = response.data.message || 'Failed to approve proof';
        toast.error(errorMsg, {
          style: {
            background: '#800000',
            color: 'white',
            fontWeight: 'bold'
          },
          progressStyle: {
            background: 'white'
          },
          icon: '⚠️'
        });
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error approving proof:', err);
      const errorMessage = err.response?.data?.message || 'Failed to approve proof';
      toast.error(errorMessage, {
        style: {
          background: '#800000',
          color: 'white',
          fontWeight: 'bold'
        },
        progressStyle: {
          background: 'white'
        },
        icon: '⚠️'
      });
      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectProof = async (applicationId) => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await api.patch(`/status/${applicationId}/reject`);
      
      if (response.data.message) {
        // Show custom success modal
        setSuccessModal({
          show: true,
          message: 'Proof rejected successfully'
        });
        
        // Also show the toast for redundancy
        toast.success('Proof rejected successfully', {
          style: {
            background: '#800000',
            color: '#ffd700',
            fontWeight: 'bold'
          },
          progressStyle: {
            background: '#ffd700'
          },
          icon: '✓'
        });
        
        // Refresh the projects list
        fetchProjects();
      } else {
        const errorMsg = response.data.message || 'Failed to reject proof';
        toast.error(errorMsg, {
          style: {
            background: '#800000',
            color: 'white',
            fontWeight: 'bold'
          },
          progressStyle: {
            background: 'white'
          },
          icon: '⚠️'
        });
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error rejecting proof:', err);
      const errorMessage = err.response?.data?.message || 'Failed to reject proof';
      toast.error(errorMessage, {
        style: {
          background: '#800000',
          color: 'white',
          fontWeight: 'bold'
        },
        progressStyle: {
          background: 'white'
        },
        icon: '⚠️'
      });
      setError(errorMessage);
    } finally {
      setProcessing(false);
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
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full border border-[#ffd700]/20">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#800000] rounded-full flex items-center justify-center shadow-md">
              {error.includes('successfully') ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#ffd700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#ffd700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>
          <h3 className="text-xl text-center font-bold text-[#800000] mb-2">
            {error.includes('successfully') ? 'Success!' : 'Error Occurred'}
          </h3>
          <p className="text-base text-gray-700 text-center mb-6 px-4 py-3 bg-[#800000]/5 rounded-md border border-[#800000]/10">{error}</p>
          <div className="flex justify-center">
            <button
              onClick={() => fetchProjects()}
              className="px-8 py-3 bg-[#800000] text-[#ffd700] font-bold rounded-md hover:bg-[#600000] transition-all duration-300 shadow-md flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {error.includes('successfully') ? 'Continue' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] py-10 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#800000] to-[#9a0000] text-white p-6 sm:p-8 rounded-t-2xl shadow-xl mb-8 border-b-4 border-[#ffd700]">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-3">|</span> 
            <span className="text-[#ffd700]">Client Project Status</span>
            <span className="ml-3 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-90 pl-4 border-l-2 border-[#ffd700]/50">
            Review and manage your client requests and approve freelancer submissions
          </p>
        </div>

        
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-24 h-24 mx-auto bg-[#f8f5f0] rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xl text-[#800000] font-medium">No projects to review yet</p>
            <p className="text-gray-500 mt-2">Your project status updates will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {projects.map((project, index) => {
              // Determine if user is client or freelancer for this project
              const userData = JSON.parse(localStorage.getItem('userData') || '{}');
              
              // Updated role detection logic
              let isClient = false;
              let isFreelancer = false;
              
              if (project.PostType === 'client') {
                // For client posts: the service owner is the client
                isClient = project.ServiceOwnerId === userData.userId;
                isFreelancer = project.FreelancerId === userData.userId;
              } else if (project.PostType === 'freelancer') {
                // For freelancer posts: the applicant is the client
                isClient = project.FreelancerId === userData.userId;
                isFreelancer = project.ServiceOwnerId === userData.userId;
              }
              
              console.log(`Project ${project.ApplicationId} - isClient: ${isClient}, isFreelancer: ${isFreelancer}, PostType: ${project.PostType}`);
              
              // Set the user role based on the calculated roles
              const userRole = isClient ? 'Client' : 'Freelancer';
              
              // Determine the role title for display based on post type
              let clientRoleTitle = project.PostType === 'client' ? 'Client (Posted Request)' : 'Client (Applied for Service)';
              let freelancerRoleTitle = project.PostType === 'client' ? 'Freelancer (Accepted Request)' : 'Freelancer (Posted Service)';
              
              return (
              <div
                key={project.ApplicationId}
                className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 border border-[#ffd700]/10"
                style={{animationDelay: `${index * 0.1}s`}}
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
                      <div className="absolute inset-0 bg-gradient-to-t from-[#800000] to-transparent opacity-60"></div>
                    </div>
                  ) : (
                    <div className="h-32 bg-gradient-to-r from-[#800000] to-[#9a0000]"></div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-xl font-bold">{project.ServiceTitle}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center">
                        <span className="text-sm opacity-90 mr-2">
                          {isClient ? `Freelancer: ${project.PostType === 'client' ? project.FreelancerName : project.ServiceOwnerName}` : 
                                     `Client: ${project.PostType === 'client' ? project.ServiceOwnerName : project.FreelancerName}`}
                        </span>
                        <span className="bg-[#ffd700] text-[#800000] text-xs px-2 py-0.5 rounded-full font-bold">
                          {project.PostType === 'client' ? 'Client Request' : 'Freelancer Service'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Project Body */}
                <div className="p-6">
                  {/* Status Badge */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <div className={`px-4 py-1 rounded-full text-sm font-bold ${getStatusClass(project.Status)}`}>
                        {getStatusMessage(project.Status)}
                      </div>
                      <div className="ml-2 px-3 py-1 bg-[#800000] text-[#ffd700] rounded-full text-xs font-semibold shadow-sm">
                        {userRole}
                      </div>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="mb-4">
                    <p className="text-[#800000] mb-2"><span className="font-semibold">Price:</span> ₱{project.ServicePrice}</p>
                    
                    {/* Improved project relationship info */}
                    <div className="bg-[#ffd700]/5 p-3 rounded-lg mb-2 border border-[#ffd700]/20">
                      <h4 className="text-sm font-semibold text-[#800000] mb-2">Project Participants:</h4>
                      {project.PostType === 'client' ? (
                        <div>
                          <p className="text-gray-700 mb-1">
                            <span className="font-semibold text-[#800000]">{clientRoleTitle}:</span> {project.ServiceOwnerName}
                            {project.ServiceOwnerId === userData.userId && <span className="ml-2 text-[#800000] text-xs bg-[#ffd700]/30 px-2 py-0.5 rounded-full">You</span>}
                          </p>
                          <p className="text-gray-700">
                            <span className="font-semibold text-[#800000]">{freelancerRoleTitle}:</span> {project.FreelancerName}
                            {project.FreelancerId === userData.userId && <span className="ml-2 text-[#800000] text-xs bg-[#ffd700]/30 px-2 py-0.5 rounded-full">You</span>}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-700 mb-1">
                            <span className="font-semibold text-[#800000]">{freelancerRoleTitle}:</span> {project.ServiceOwnerName}
                            {project.ServiceOwnerId === userData.userId && <span className="ml-2 text-[#800000] text-xs bg-[#ffd700]/30 px-2 py-0.5 rounded-full">You</span>}
                          </p>
                          <p className="text-gray-700">
                            <span className="font-semibold text-[#800000]">{clientRoleTitle}:</span> {project.FreelancerName}
                            {project.FreelancerId === userData.userId && <span className="ml-2 text-[#800000] text-xs bg-[#ffd700]/30 px-2 py-0.5 rounded-full">You</span>}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {project.Message && (
                      <p className="text-gray-700 mb-2"><span className="font-semibold text-[#800000]">Message:</span> {project.Message}</p>
                    )}
                  </div>

                  {/* Display proof image when available */}
                  {(project.Status === 'Waiting for Approval' || project.Status === 'Proof Rejected' || project.Status === 'Approved' || project.Status === 'Payment Sent' || project.Status === 'Payment Received') && project.ProofImage && (
                    <div className="mt-4">
                      <div className="bg-white p-4 border border-[#ffd700]/30 rounded-lg shadow-sm">
                        <h3 className="text-[#800000] font-semibold mb-3 border-b border-[#ffd700]/20 pb-2">
                          {project.Status === 'Waiting for Approval' && "Proof submitted - waiting for review"}
                          {project.Status === 'Proof Rejected' && "Proof rejected - waiting for new submission"}
                          {project.Status === 'Approved' && "Proof approved"}
                          {project.Status === 'Payment Sent' && "Completed proof"}
                          {project.Status === 'Payment Received' && "Completed proof"}
                        </h3>
                        
                        <div className="mb-3 p-1 border border-[#ffd700]/30 rounded bg-[#ffd700]/5">
                          <img 
                            src={project.ProofImage} 
                            alt="Proof of completion" 
                            className="w-full h-56 object-contain rounded"
                            onClick={() => openProofModal(project)}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/default-service.png';
                            }}
                          />
                        </div>
                        
                        <p className="text-sm text-[#800000]/70 text-center italic mb-3">
                          Click on the image to view in full size
                        </p>

                        {/* Message when waiting for approval */}
                        {project.Status === 'Waiting for Approval' && (
                          <div className="bg-pink-50 border-l-4 border-[#800000] p-3 text-[#800000]">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-[#800000]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <p className="text-sm">
                                  Your proof is under review. The client will approve or request changes soon.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Show approve/reject buttons only for clients when status is waiting for approval */}
                      {isClient && project.Status === 'Waiting for Approval' && (
                        <div className="mt-3 flex gap-3">
                          <button 
                            className="w-1/2 py-2 px-4 bg-[#800000] text-[#ffd700] rounded-md font-medium hover:bg-[#9a0000] transition-all flex items-center justify-center" 
                            onClick={() => handleApproveProof(project.ApplicationId)}
                            disabled={processing}
                          >
                            {processing ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve Proof
                              </>
                            )}
                          </button>
                          <button 
                            className="w-1/2 py-2 px-4 bg-[#800000] text-[#ffd700] rounded-md font-medium hover:bg-[#9a0000] transition-all flex items-center justify-center"
                            onClick={() => handleRejectProof(project.ApplicationId)}
                            disabled={processing}
                          >
                            {processing ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reject Proof
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status message for different states */}
                  {project.Status === 'Service Started' && (
                    <div className="mt-4 p-4 bg-[#ffd700]/10 border border-[#ffd700]/30 rounded-lg">
                      <p className="text-[#800000] flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Service is in progress. Waiting for freelancer to complete the work.
                      </p>
                    </div>
                  )}

                  {/* Show message when waiting for new proof */}
                  {project.Status === 'Completed' && (
                    <div className="mt-4 p-4 bg-[#800000]/10 border border-[#800000]/20 rounded-lg">
                      <p className="text-[#800000] flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Freelancer marked this as completed. Waiting for proof upload.
                      </p>
                    </div>
                  )}

                  {/* If the project status is "Approved", show the option to navigate to the transaction page */}
                  {project.Status === 'Approved' && (
                    <div className="mt-4">
                      <div className="p-4 mb-4 bg-[#FFF9E6] border border-[#ffd700]/30 rounded-lg">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 pt-0.5">
                            <svg className="h-5 w-5 text-[#800000]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <p className="ml-3 text-[#800000] font-medium">
                            Proof has been approved! You can now proceed to payment.
                          </p>
                        </div>
                      </div>
                      
                      <Link
                        to={`/transaction/${project.ApplicationId}`}
                        className="w-full py-3 px-6 bg-[#800000] text-[#ffd700] rounded-md font-semibold hover:bg-[#9a0000] transition-all flex items-center justify-center"
                      >
                        <span className="text-xl font-bold mr-2">₱</span>
                        Make Payment
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proof Image Modal */}
      {modalOpen && selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex justify-between items-center border-b border-[#ffd700]/20">
              <h3 className="text-lg font-semibold text-[#800000]">{selectedProof.ServiceTitle || 'Proof of Completion'}</h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-[#800000] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 bg-[#ffd700]/5 flex items-center justify-center max-h-[80vh] overflow-auto">
              <img 
                src={selectedProof.ProofImage} 
                alt="Proof of completion" 
                className="max-w-full max-h-[70vh] object-contain"
                onError={(e) => {
                  console.error("Failed to load proof image in modal");
                  e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Success Notification Modal */}
      {successModal.show && (
        <SuccessNotification 
          message={successModal.message} 
          onClose={() => setSuccessModal({ show: false, message: '' })} 
        />
      )}
    </div>
  );
};

export default ProjectStatus;
