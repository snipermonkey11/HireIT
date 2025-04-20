import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Bell, Clock, PlayCircle, FileText, Activity, CreditCard, Star, Loader, AlertCircle, Upload, Save, Trash2, Eye, ArrowRight } from 'lucide-react';
import { dashboardService, reviewService } from './services/api';
import axios from 'axios';
import { toast } from 'react-toastify';

// Use a direct URL instead of process.env
const API_URL = 'http://localhost:3000';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    photo: '',
    fullName: '',
    bio: '',
    studentId: '',
    grade: '',
    section: '',
    email: '',
  });

  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isBioEditMode, setIsBioEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [userRole, setUserRole] = useState('client'); // Default is client, will be updated if services exist
  
  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
      // Redirect to login page if not logged in
      navigate('/login');
    }
  }, [navigate]);
  
  // Function to fetch user profile data from the backend
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      // If we already have userData, start with that
      if (userData) {
        return {
          fullName: userData.fullName,
          email: userData.email,
          photo: userData.photo || '',
          bio: userData.bio || '',
          studentId: userData.studentId || '',
          grade: userData.grade || '',
          section: userData.section || ''
        };
      }
      
      // Otherwise try the API
      const response = await axios.get(`${API_URL}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      return null;
    }
  };

  const toggleBioEditMode = () => {
    if (isBioEditMode) {
      updateUserProfile({ bio: profile.bio });
    }
    setIsBioEditMode(!isBioEditMode);
  };
  
  const handleBioChange = (e) => {
    setProfile({ ...profile, bio: e.target.value });
  };
  
  const updateUserProfile = async (data) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      await axios.patch(`${API_URL}/api/users/profile`, data, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Update local storage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const updatedUserData = { ...userData, ...data };
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      
      // Update local storage with new profile data
      const storedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      localStorage.setItem('userProfile', JSON.stringify({...storedProfile, ...data}));
      
    } catch (error) {
      alert('Failed to update profile');
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Get profile info
        await fetchUserProfile();
        
        // Get services posted by the user
        const userServices = await dashboardService.getMyServices();
        setServices(userServices);
        
        // Get reviews of services posted by the user
        const userReviews = await dashboardService.getMyReviews();
        
        // Get reviews submitted by the user
        const submittedReviews = await reviewService.getUserReviews();
        
        // Get reviews received by the user (as a freelancer)
        const receivedReviews = await reviewService.getReceivedReviews();
        
        // Combine and process reviews for display
        const combinedReviews = [];
        
        // Process reviews received
        if (receivedReviews && receivedReviews.length > 0) {
          receivedReviews.forEach(review => {
            combinedReviews.push({
              ...review,
              reviewType: 'received',
              displayName: review.ReviewerName || 'Client',
              displayText: `${review.ReviewerName || 'A client'} reviewed your service`
            });
          });
        }
        
        // Process reviews submitted
        if (submittedReviews && submittedReviews.length > 0) {
          submittedReviews.forEach(review => {
            // Extract reviewer data from metadata if available
            let revieweeName = review.RevieweeName || 'Service Provider';
            
            // Try to parse metadata for more information
            if (review.Metadata) {
              try {
                const metadata = JSON.parse(review.Metadata);
                revieweeName = metadata.revieweeName || revieweeName;
              } catch (err) {
                console.warn('Could not parse review metadata:', err);
              }
            }
            
            combinedReviews.push({
              ...review,
              reviewType: 'submitted',
              revieweeName: revieweeName,
              displayText: `You reviewed ${revieweeName}`
            });
          });
        }
        
        // Sort reviews by date (newest first)
        combinedReviews.sort((a, b) => {
          return new Date(b.CreatedAt || b.createdAt) - new Date(a.CreatedAt || a.createdAt);
        });
        
        // Take the most recent 3 reviews
        setReviews(combinedReviews.slice(0, 3));
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load your dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleServiceChange = (id, field, value) => {
    const updatedServices = services.map(service =>
      service.id === id ? { ...service, [field]: value } : service
    );
    setServices(updatedServices);
  };

  const handleImageUpload = async (id, event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImageUploading(true);
    try {
      // Convert file to base64
      const base64 = await convertToBase64(file);
      
      // Update local state
      const updatedServices = services.map(service =>
        service.id === id ? { ...service, image: base64 } : service
      );
      setServices(updatedServices);
      
      // Also call the API immediately to update the service image
      const serviceToUpdate = updatedServices.find(service => service.id === id);
      if (serviceToUpdate) {
        try {
          await dashboardService.updateService(id, {
            ...serviceToUpdate,
            image: base64
          });
        } catch (error) {
          // Silently handle error
        }
      }
      
      alert('Image uploaded successfully');
    } catch (error) {
      alert('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  // Helper function to convert file to base64
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSaveService = async (id) => {
    try {
      const serviceToSave = services.find(service => service.id === id);
      if (!serviceToSave) return;
      
      // Format data for API
      const serviceData = {
        title: serviceToSave.title,
        description: serviceToSave.description,
        price: serviceToSave.price,
        category: serviceToSave.category,
        image: serviceToSave.image,
        status: serviceToSave.status || 'Active'
      };
      
      // Call API to update service
      await dashboardService.updateService(id, serviceData);
      alert('Service updated successfully!');
    } catch (error) {
      alert('Failed to save service: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleDeleteService = async (id) => {
    try {
      if (window.confirm('Are you sure you want to delete this service? It will be hidden from your dashboard and from service searches, but transaction history and reviews will be preserved.')) {
        // Call API to mark service as deleted
        await dashboardService.deleteService(id);
        
        // Update local state by removing the service from the displayed list
        const updatedServices = services.filter(service => service.id !== id);
        setServices(updatedServices);
        
        toast.success('Service deleted successfully! All transaction history and reviews have been preserved.');
      }
    } catch (error) {
      toast.error('Failed to delete service: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleViewService = (id) => {
    window.location.href = `/services/${id}`;
  };

  const NavButton = ({ to, icon: Icon, text }) => (
    <Link
      to={to}
      className="flex items-center py-3 px-6 bg-white rounded-xl shadow hover:shadow-lg transition-all duration-300 
                 transform hover:-translate-y-1 border-l-4 border-[#800000] group"
    >
      <div className="flex items-center justify-center bg-[#800000] bg-opacity-10 p-2 rounded-lg mr-4 
                      group-hover:bg-[#800000] group-hover:text-white transition-colors duration-300">
        <Icon size={20} className="text-[#800000] group-hover:text-white" />
      </div>
      <span className="font-medium">{text}</span>
    </Link>
  );

  // Loading state for the entire dashboard
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="text-center">
          <Loader size={40} className="mx-auto text-[#800000] animate-spin mb-4" />
          <p className="text-gray-700">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="py-2 px-6 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] py-8 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto space-y-8 max-w-6xl">
        {/* Profile Overview */}
        <div className="p-6 bg-[#800000] text-white rounded-xl shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-6">
            <div className="flex-shrink-0 mb-4 md:mb-0">
              <img
                className="w-24 h-24 rounded-full border-4 border-[#ffd700] object-cover shadow-lg"
                src={profile.photo || 'https://via.placeholder.com/150'}
                alt="Profile"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold">{profile.fullName || 'Your Name'}</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.grade && profile.section && (
                  <span className="bg-[#ffd700] bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                    {profile.grade} - {profile.section}
                  </span>
                )}
                {profile.email && (
                  <span className="bg-[#ffd700] bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                    {profile.email}
                  </span>
                )}
              </div>

              {/* Bio Section */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold">Bio</h4>
                  <button
                    onClick={toggleBioEditMode}
                    className="py-1 px-4 bg-[#ffd700] text-[#800000] rounded-lg hover:bg-opacity-80 
                              transition-all duration-300 text-sm font-medium"
                  >
                    {isBioEditMode ? 'Save Bio' : 'Edit Bio'}
                  </button>
                </div>
                
                {isBioEditMode ? (
                  <textarea
                    value={profile.bio || ''}
                    onChange={handleBioChange}
                    className="w-full p-3 border border-[#ffd700] rounded-lg mt-2 text-black bg-white 
                              placeholder-gray-400 focus:ring-2 focus:ring-[#ffd700] focus:outline-none"
                    placeholder="Write something about yourself..."
                    rows={3}
                  />
                ) : (
                  <p className="text-white opacity-90 border-l-4 border-[#ffd700] pl-4 py-2">
                    {profile.bio || 'No bio available. Click "Edit Bio" to add information about yourself.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NavButton to="/messages" icon={MessageSquare} text="Messages" />
          <NavButton to="/notifications" icon={Bell} text="Notifications" />
          <NavButton to="/my-applications" icon={FileText} text="My Applications" />
          <NavButton to="/active" icon={PlayCircle} text="Active Projects" />
          <NavButton to="/view-application" icon={Clock} text="View Applications" />
          <NavButton to="/status" icon={Activity} text="Project Status" />
          <NavButton to="/transaction-history" icon={CreditCard} text="Transaction History" />
          <NavButton to="/reviews" icon={Star} text="My Reviews" />
        </div>

        {/* Posted Services/Projects */}
        <div className="p-6 bg-white rounded-xl shadow-lg border-t-4 border-[#800000]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FileText className="text-[#800000] mr-3" size={24} />
              <h2 className="text-2xl font-bold text-gray-800">Posted Services/Projects</h2>
            </div>
            <Link 
              to="/post-service" 
              className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all text-sm"
            >
              + Post New Service
            </Link>
          </div>
          
          <div className="space-y-6">
            {services.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">You haven't posted any services yet.</p>
                <Link to="/post-service" className="mt-4 inline-block py-2 px-6 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all duration-300">
                  Post a Service
                </Link>
              </div>
            ) : (
              services
                .filter(service => service.status !== 'Deleted')
                .map((service) => (
                  <div key={service.id} className="p-6 bg-gray-50 rounded-lg shadow-md hover:shadow-xl transition-all duration-300">
                    <div className="flex justify-between">
                      <h3 className="text-xl font-medium text-[#800000] mb-4">
                        <input
                          type="text"
                          value={service.title}
                          onChange={(e) => handleServiceChange(service.id, 'title', e.target.value)}
                          className="bg-transparent border-b-2 border-[#800000] text-xl focus:outline-none focus:ring-2 focus:ring-[#ffd700] w-full px-2 py-1"
                        />
                      </h3>
                      <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                        {service.applicationCount || 0} Applications
                      </div>
                    </div>

                    <div className="mb-4">
                      <textarea
                        value={service.description}
                        onChange={(e) => handleServiceChange(service.id, 'description', e.target.value)}
                        className="bg-transparent border-2 border-gray-300 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#ffd700] p-3"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center mb-4">
                      <span className="text-xl font-bold text-[#800000] mr-2">₱</span>
                      <input
                        type="number"
                        value={service.price}
                        onChange={(e) => handleServiceChange(service.id, 'price', e.target.value)}
                        className="bg-transparent border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#ffd700] px-3 py-1"
                      />
                    </div>

                    {/* Display Image if uploaded */}
                    {service.image && (
                      <div className="mb-4 border rounded-lg overflow-hidden bg-white p-2">
                        <img src={service.image} alt="Service" className="w-full h-auto max-h-60 object-contain rounded" />
                      </div>
                    )}

                    {/* File Upload */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Upload size={16} className="mr-1" /> Service Image
                      </label>
                      <input
                        type="file"
                        onChange={(e) => handleImageUpload(service.id, e)}
                        className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#800000] file:text-white hover:file:bg-opacity-80"
                        disabled={imageUploading}
                        accept="image/*"
                      />
                      {imageUploading && <p className="text-sm text-gray-500 mt-1">Uploading image...</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSaveService(service.id)}
                        className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-300 flex items-center"
                      >
                        <Save size={16} className="mr-2" /> Save
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-300 flex items-center"
                      >
                        <Trash2 size={16} className="mr-2" /> Delete
                      </button>
                      <button
                        onClick={() => handleViewService(service.id)}
                        className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 flex items-center"
                      >
                        <Eye size={16} className="mr-2" /> View
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Client Reviews Section */}
        <div className="p-6 bg-white rounded-xl shadow-lg border-t-4 border-[#ffd700]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Star className="text-[#ffd700] mr-3" size={24} />
              <h2 className="text-2xl font-bold text-gray-800">Reviews</h2>
            </div>
            <Link 
              to="/reviews" 
              className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-opacity-90 transition-all text-sm"
            >
              View All Reviews
            </Link>
          </div>
          
          <div className="space-y-6">
            {/* Show reviews if user has received any as a freelancer */}
            {reviews.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">Recent Reviews</h3>
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div 
                      key={review.ReviewId || review.id} 
                      className={`p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 
                                 ${review.reviewType === 'received' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-green-50 border-l-4 border-green-500'}`}
                    >
                      {/* Service Title */}
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-[#800000]">{review.ServiceTitle || review.serviceTitle}</h3>
                        
                        {/* Rating */}
                        <div className="flex items-center bg-[#ffd700] bg-opacity-20 px-3 py-1 rounded-full">
                          <span className="text-sm font-semibold">{review.Rating || review.rating}</span>
                          <Star size={16} className="ml-1 text-[#ffd700] fill-current" />
                        </div>
                      </div>
                      
                      {/* Review info badge */}
                      <div className="mt-2 mb-3">
                        <span 
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                                    ${review.reviewType === 'received' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'}`}
                        >
                          {review.reviewType === 'received' ? 'Review Received' : 'Review Submitted'}
                        </span>
                      </div>
                      
                      {/* Who is involved in the review */}
                      <p className="text-sm text-gray-700 font-medium">
                        {review.displayText}
                        {(review.CreatedAt || review.date) && 
                          <span className="ml-2 text-gray-500">
                            ({formatDate(review.CreatedAt || review.date)})
                          </span>
                        }
                      </p>
                      
                      {/* Review Text */}
                      <div className="mt-4 bg-white p-4 rounded-lg border border-gray-100">
                        <p className="text-gray-800 italic">{review.ReviewText || review.reviewText || "No comment provided."}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* View all reviews link */}
                <div className="text-center mt-4">
                  <Link to="/reviews" className="text-[#800000] hover:underline font-medium inline-flex items-center">
                    See all your reviews <ArrowRight size={16} className="ml-1" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Star size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">You don't have any reviews yet.</p>
                <p className="text-gray-500 mt-2">Reviews will appear here after you complete transactions.</p>
              </div>
            )}
            
            {/* Message for all users about transaction history and submitting reviews */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-start">
                <CreditCard size={20} className="text-blue-500 mr-2 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-700">
                    You can leave reviews for completed transactions in your 
                    <Link to="/transaction-history" className="mx-1 text-[#800000] font-medium hover:underline">
                      Transaction History
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Format a date to readable format
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
};

export default Dashboard;
