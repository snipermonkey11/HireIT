import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './services/api';
import { toast } from 'react-toastify';

// Helper function to format image URL properly
const formatImageUrl = (imageData) => {
  console.log('Raw image data received:', typeof imageData, imageData?.substring?.(0, 50));
  
  if (!imageData) {
    console.log('No image data provided');
    return null;
  }
  
  if (typeof imageData !== 'string') {
    console.log('Image data is not a string:', typeof imageData);
    return null;
  }
  
  try {
    // If it's already a complete data URL
    if (imageData.startsWith('data:image')) {
      console.log('Image is already a data URL');
      return imageData;
    }
    
    // If it appears to be a base64 string
    if (/^[A-Za-z0-9+/=]+$/.test(imageData)) {
      console.log('Image appears to be a base64 string, adding prefix');
      return `data:image/jpeg;base64,${imageData}`;
    }
    
    // If it's a URL
    if (imageData.startsWith('http')) {
      console.log('Image is a URL');
      return imageData;
    }
    
    // For image paths without full URL
    if (imageData.startsWith('/')) {
      console.log('Image is a relative path');
      return imageData;
    }
    
    // Default case, assume it's base64
    console.log('Assuming image is base64, adding prefix');
    return `data:image/jpeg;base64,${imageData}`;
  } catch (error) {
    console.error('Error formatting image URL:', error);
    return null;
  }
};

// Function to handle image load errors
const handleImageError = (e, title) => {
  console.log('Image failed to load for service:', title);
  console.log('Image data type:', typeof e.target.src);
  
  e.target.onerror = null;
  e.target.style.display = 'none'; // Hide the broken image
  
  // Add fallback visual
  const fallbackEl = document.createElement('div');
  fallbackEl.className = "w-full h-full flex items-center justify-center";
  fallbackEl.innerHTML = `<span class="text-[#800000] font-medium">No Image Available</span>`;
  e.target.parentNode.appendChild(fallbackEl);
};

// Predefined categories
const CATEGORIES = ['Art', 'Editing', 'Photography', 'Writing', 'Tutoring'];

const Discover = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'client', or 'freelancer'
  const [newService, setNewService] = useState({
    title: '',
    description: '',
    price: '',
    photo: null,
    category: '',
    postType: 'freelancer' // or 'client'
  });

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isPostServiceOpen, setPostServiceOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch services from backend
  const fetchServices = async (query = searchQuery, category = selectedCategory, mode = viewMode) => {
      try {
        setLoading(true);
        setError(null);
        
        // Create the endpoint URL based on filters
        let endpoint = '/services';
        
        // Add query parameters if they exist
        const params = [];
        if (query) params.push(`search=${encodeURIComponent(query)}`);
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        if (mode !== 'all') params.push(`type=${encodeURIComponent(mode)}`);
        
        if (params.length > 0) {
          endpoint += `?${params.join('&')}`;
        }
        
        console.log('Fetching services from endpoint:', endpoint);
        const response = await api.get(endpoint);
        
        // Enhanced debug for received services images
        if (response.data && Array.isArray(response.data)) {
          console.log(`Received ${response.data.length} services`);
          
          // Process the photos before setting state
          const processedServices = response.data.map(service => {
            let processedService = { ...service };
            
            if (service.Photo) {
              console.log(`Service ${service.ServiceId || 'unknown'} has an image of length ${service.Photo.length}`);
              
              // Make sure the photo has the proper prefix
              if (typeof service.Photo === 'string' && !service.Photo.startsWith('data:image')) {
                processedService.Photo = `data:image/jpeg;base64,${service.Photo}`;
                console.log(`Added prefix to service image`);
              }
            } else {
              console.log(`Service ${service.ServiceId || 'unknown'} has no image`);
            }
            
            return processedService;
          });
          
          setServices(processedServices);
        } else {
          console.warn('Unexpected response format:', response.data);
          setServices([]);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        setError('Failed to load services. Please try again.');
        toast.error('Failed to load services');
      } finally {
        setLoading(false);
      }
    };

  // Initial fetch of services
  useEffect(() => {
    fetchServices();
  }, []);
  
  // Handle search
  const handleSearch = () => {
    fetchServices(searchQuery, selectedCategory);
  };

  // Handle category change
  const handleCategoryChange = (category) => {
    setSelectedCategory(category === selectedCategory ? '' : category);
    setError(null);
    
    // Use the updated category (toggle behavior)
    const newCategory = category === selectedCategory ? '' : category;
    fetchServices(searchQuery, newCategory);
  };

  // Get the logged-in user's ID from localStorage
  const userData = JSON.parse(localStorage.getItem('userData')) || { id: null };

  // Handle form changes for the new service
  const handleServiceChange = (e) => {
    const { name, value } = e.target;
    setNewService({ ...newService, [name]: value });
  };

  // Handle image change for the new service
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPG, JPEG or PNG image.');
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 5MB.');
      return;
    }
    
    console.log('Image selected:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Create a test load to ensure the image is valid
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        console.log('Image validated successfully:', img.width, 'x', img.height);
        setNewService({ ...newService, photo: file });
      };
      img.onerror = () => {
        toast.error('The selected file is not a valid image. Please try another file.');
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      toast.error('Failed to read the image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  // Handle posting the new service
  const handlePostService = async () => {
    try {
      if (!newService.title || !newService.description || !newService.price || !newService.category || !newService.postType) {
        toast.error("All fields are required!");
        return;
      }

      // Validate price is a number
      if (isNaN(parseFloat(newService.price)) || parseFloat(newService.price) <= 0) {
        toast.error("Price must be a valid positive number");
        return;
      }

      setUploading(true);

      // Create a simple FormData object
      const formData = new FormData();
      formData.append('title', newService.title);
      formData.append('description', newService.description);
      formData.append('price', newService.price);
      formData.append('category', newService.category);
      formData.append('postType', newService.postType);
      
      // Only append photo if it exists - keep this simple
      if (newService.photo && newService.photo.size > 0) {
        console.log('Adding photo to form:', newService.photo.name);
        formData.append('photo', newService.photo);
      }

      try {
        // Make POST request with minimal configuration
        const response = await api.post('/services', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Service created successfully:', response.data);

        // Clear form and close modal
        setNewService({
          title: '',
          description: '',
          price: '',
          photo: null,
          category: '',
          postType: 'freelancer'
        });
        
        setPostServiceOpen(false);
        toast.success('Service posted successfully!');

        // Refresh services list with current filters
        fetchServices(searchQuery, selectedCategory, viewMode);
      } catch (innerError) {
        console.error('API request failed:', innerError);
        toast.error(innerError.response?.data?.error || 'Failed to post service. Server error.');
      }
    } catch (error) {
      console.error('Error in form processing:', error);
      toast.error('Failed to process form. Please try again.');
    } finally { 
      setUploading(false);
    }
  };

  // Toggle visibility of the post service form
  const togglePostService = () => {
    setPostServiceOpen(!isPostServiceOpen);
  };

  if (loading && services.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="w-16 h-16 relative animate-spin">
          <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-4 border-[#800000] border-t-[#ffd700] animate-pulse"></div>
          <div className="absolute top-2 left-2 right-2 bottom-2 rounded-full border-4 border-t-4 border-[#800000] border-opacity-60 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error && services.length === 0) {
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
              onClick={() => fetchServices()}
              className="px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
            >
              Try Again
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
        <div className="bg-[#800000] text-white p-6 sm:p-8 rounded-t-2xl shadow-xl mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-2">|</span> 
            Discover Services/Projects
            <span className="ml-2 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-80">
            Find and apply for services/projects offered by students
          </p>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full shadow-lg p-1 flex space-x-1">
            <button
              onClick={() => {
                setViewMode('all');
                fetchServices(searchQuery, selectedCategory, 'all');
              }}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                viewMode === 'all'
                  ? 'bg-[#800000] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Posts
            </button>
            <button
              onClick={() => {
                setViewMode('client');
                fetchServices(searchQuery, selectedCategory, 'client');
              }}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                viewMode === 'client'
                  ? 'bg-[#800000] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Client Posts
            </button>
            <button
              onClick={() => {
                setViewMode('freelancer');
                fetchServices(searchQuery, selectedCategory, 'freelancer');
              }}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                viewMode === 'freelancer'
                  ? 'bg-[#800000] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Freelancer Posts
            </button>
          </div>
        </div>

        {/* Search and Filters Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-grow max-w-md">
        <input
          type="text"
                className="w-full p-3 pl-10 pr-4 rounded-full border-2 border-gray-200 focus:border-[#800000] focus:ring-2 focus:ring-[#800000] transition-all duration-300"
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button 
                onClick={handleSearch}
                className="absolute inset-y-0 right-0 mr-1 flex items-center px-4 bg-[#800000] text-white rounded-r-full hover:bg-[#600000] transition-all duration-300"
              >
                Search
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCategoryChange('')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === '' 
                    ? 'bg-[#800000] text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              
            {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedCategory === category 
                      ? 'bg-[#800000] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                {category}
                </button>
            ))}
            </div>
          </div>
      </div>

      {/* Post Service Button */}
        <div className="flex justify-end mb-6">
        <button
          onClick={togglePostService}
            className="py-3 px-6 bg-[#ffd700] text-[#800000] rounded-full font-semibold hover:bg-[#ffcc00] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md flex items-center"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Post a Service
        </button>
      </div>

      {/* Post Service Form */}
      {isPostServiceOpen && (
          <div className="bg-white rounded-xl shadow-xl p-8 mb-8 animate-fadeIn">
            <h3 className="text-2xl font-bold text-[#800000] mb-6 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Post a New Service
            </h3>

            {/* Post Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Post Type *</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setNewService({ ...newService, postType: 'client' })}
                  className={`flex-1 py-2 px-4 rounded-full font-medium transition-all duration-300 ${
                    newService.postType === 'client'
                      ? 'bg-[#800000] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  I'm a Client
                </button>
                <button
                  onClick={() => setNewService({ ...newService, postType: 'freelancer' })}
                  className={`flex-1 py-2 px-4 rounded-full font-medium transition-all duration-300 ${
                    newService.postType === 'freelancer'
                      ? 'bg-[#800000] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  I'm a Freelancer
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Title *</label>
          <input
            type="text"
            name="title"
                  placeholder="E.g., Logo Design, Photo Editing, Math Tutoring"
            value={newService.title}
            onChange={handleServiceChange}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000] transition-all duration-300"
            required
                  disabled={uploading}
          />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            name="description"
                  placeholder="Describe your service in detail..."
            value={newService.description}
            onChange={handleServiceChange}
            rows="4"
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000] transition-all duration-300"
            required
                  disabled={uploading}
          />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱) *</label>
          <input
            type="number"
            name="price"
                  placeholder="Enter price in PHP"
            value={newService.price}
            onChange={handleServiceChange}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000] transition-all duration-300"
            required
                  disabled={uploading}
          />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            name="category"
            value={newService.category}
            onChange={handleServiceChange}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000] transition-all duration-300"
            required
                  disabled={uploading}
          >
            <option value="">Select Category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Image</label>
                <div className="flex flex-col items-center justify-center w-full">
                  {newService.photo ? (
                    <div className="w-full flex flex-col items-center">
                      <div className="relative w-full h-40 mb-2 border border-gray-200 rounded-lg overflow-hidden">
                        <img 
                          src={URL.createObjectURL(newService.photo)} 
                          alt="Image preview" 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            console.error('Error previewing image');
                          }}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setNewService({ ...newService, photo: null })}
                          className="py-1 px-3 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm"
                          type="button"
                        >
                          Remove
                        </button>
                        <label className="py-1 px-3 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm cursor-pointer">
                          Change
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all duration-300">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-600">Upload a service image (optional)</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG or JPEG (max 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setPostServiceOpen(false)}
                className="py-3 px-6 bg-gray-200 text-gray-700 rounded-full font-medium hover:bg-gray-300 transition-all duration-300"
                disabled={uploading}
              >
                Cancel
              </button>
          <button
            onClick={handlePostService}
                disabled={uploading}
                className="py-3 px-6 bg-[#800000] text-white rounded-full font-medium hover:bg-[#600000] transition-all duration-300 flex items-center"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Posting...
                  </>
                ) : (
                  <>
            Post Service
                  </>
                )}
          </button>
            </div>
        </div>
      )}

      {/* Service Cards */}
        {loading && services.length > 0 && (
          <div className="flex justify-center my-8">
            <div className="w-12 h-12 relative animate-spin">
              <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-4 border-[#800000] border-t-[#ffd700] animate-pulse"></div>
            </div>
          </div>
        )}
        
        {services.length === 0 && !loading ? (
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-24 h-24 mx-auto bg-[#f8f5f0] rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#800000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-xl text-gray-700 font-medium">No services found</p>
            <p className="text-gray-500 mt-2">
              {searchQuery || selectedCategory ? 
                'Try different search terms or categories' : 
                'Be the first to post a service!'}
            </p>
            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  fetchServices('', '', 'all');
                }}
                className="mt-6 px-6 py-2 bg-[#800000] text-white rounded-full hover:bg-[#600000] transition-all duration-300"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {services.map((service) => (
          <div
            key={service.ServiceId}
                className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
          >
                {/* Service Image */}
                <div className="relative h-48 bg-gradient-to-r from-[#ffcecb] to-[#ffb9b5] overflow-hidden">
                  {service.Photo ? (
                    <>
                      <div className="debug-info hidden">
                        {console.log(`Rendering image for service ${service.ServiceId} - ${service.Title}`)}
                        {console.log(`Image data type: ${typeof service.Photo}, starts with 'data:image': ${service.Photo.startsWith('data:image')}`)}
                        {typeof service.Photo === 'string' && console.log(`Image length: ${service.Photo.length}`)}
                      </div>
                      <img 
                        src={
                          // Directly use the image data with proper prefix
                          typeof service.Photo === 'string' && service.Photo.startsWith('data:image') 
                            ? service.Photo 
                            : typeof service.Photo === 'string'
                              ? `data:image/jpeg;base64,${service.Photo.replace(/[^A-Za-z0-9+/=]/g, '')}`
                              : null
                        }
                        alt={service.Title} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          console.log('Image failed to load for service:', service.Title);
                          console.log('Image data type:', typeof service.Photo);
                          if (typeof service.Photo === 'string') {
                            console.log('Image data length:', service.Photo.length);
                            console.log('Image data preview:', service.Photo.substring(0, 50));
                          }
                          e.target.onerror = null;
                          e.target.style.display = 'none'; // Hide the broken image
                          
                          // Add fallback visual
                          const fallbackEl = document.createElement('div');
                          fallbackEl.className = "w-full h-full flex items-center justify-center";
                          fallbackEl.innerHTML = `<span class="text-[#800000] font-medium">No Image Available</span>`;
                          e.target.parentNode.appendChild(fallbackEl);
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[#ffcecb] to-[#ffb9b5] flex items-center justify-center">
                      <span className="text-[#800000] font-medium">No Image Available</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#800000] to-transparent opacity-40"></div>
                  
                  {/* Category Badge */}
                  <div className="absolute top-0 right-0 m-4">
                    <span className="inline-flex items-center justify-center px-3 py-1 bg-[#ffd700] text-[#800000] rounded-full font-semibold text-xs">
                      {service.Category}
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-[#800000] hover:text-[#600000] transition-all duration-300">
              {service.Title}
            </h3>
                    <p className="text-lg font-bold text-[#800000]">₱{service.Price}</p>
                  </div>
                  
                  <p className="text-sm text-gray-600 h-16 overflow-hidden">{service.Description}</p>

            {/* Seller's Information */}
            <div className="flex items-center justify-between mt-4">
              <Link
                to={`/userprofile/${service.SellerId}`}
                      className="flex items-center text-gray-700 hover:text-[#800000] transition-all duration-200"
              >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium">{service.SellerName}</span>
              </Link>
              <span className={`text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wide ${
                service.PostType === 'client'
                  ? 'bg-[#800000] text-[#ffd700] border-2 border-[#ffd700]'
                  : 'bg-[#ffd700] text-[#800000] border-2 border-[#800000]'
              }`}>
                {service.PostType === 'client' ? 'Looking for Freelancer' : 'Offering Service'}
              </span>
            </div>

            {/* Apply button or Your Post label */}
                  <div className="mt-4">
                    {service.SellerId === userData.id ? (
                      <div className="py-2 px-4 bg-gray-100 text-gray-600 rounded-full text-center font-medium">
                        Your {service.PostType === 'client' ? 'Request' : 'Service'}
                      </div>
                    ) : (
                      <Link
                        to={`/apply/${service.ServiceId}`}
                        className={`block w-full text-center py-3 px-4 rounded-full font-medium uppercase tracking-wide transition-colors duration-300 shadow-lg ${
                          service.PostType === 'client'
                            ? 'bg-[#800000] text-[#ffd700] hover:bg-[#600000]'
                            : 'bg-[#ffd700] text-[#800000] hover:bg-[#e6c200]'
                        }`}
                      >
                        {service.PostType === 'client' ? 'Offer Your Services' : 'Apply Now'}
                      </Link>
                    )}
                  </div>
            </div>
          </div>
        ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
