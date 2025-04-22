import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './services/api';
import { User, QrCode, School, IdCard, Folder, Camera, Upload, CheckCircle, AlertCircle, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Default avatar image (data URI of a simple avatar)
const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGUwZTAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzgwMDAwMCIvPjxwYXRoIGQ9Ik0yMCA4MEMyMCA2MCAzMCA1MCA1MCA1MEM3MCA1MCA4MCA2MCA4MCA4MEw4MCA5MEwyMCA5MEwyMCA4MFoiIGZpbGw9IiM4MDAwMDAiLz48L3N2Zz4=";

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    studentId: '',
    grade: '',
    section: '',
    photo: null,
    gcashQr: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');
  const [showAlert, setShowAlert] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [gcashQR, setGcashQR] = useState(null);
  const [gcashQRPreview, setGcashQRPreview] = useState(null);
  const [updatingGcashQR, setUpdatingGcashQR] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (!userData.token) {
          navigate('/login');
          return;
        }

        // Set authorization header with the token
        api.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
        
        // Fetch profile data from the database
        const response = await api.get('/users/profile');
        
        if (!response.data) {
          throw new Error('No profile data received');
        }

        // Update profile state with the fetched data
        setProfile(response.data);
        
        // If there's a GCash QR code, set it to the preview
        if (response.data.gcashQr) {
          setGcashQRPreview(response.data.gcashQr);
        }
        
        setError(null);
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Failed to load profile data';
        setError(errorMessage);
        
        // If there's an error, try to use data from localStorage as fallback
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (userData) {
          setProfile(prevProfile => ({
            ...prevProfile,
            fullName: userData.fullName || '',
            email: userData.email || '',
            studentId: userData.studentId || '',
            grade: userData.grade || '',
            section: userData.section || '',
            photo: userData.photo || null,
            gcashQr: userData.gcashQr || null
          }));
          
          // Set GCash QR preview from localStorage if available
          if (userData.gcashQr) {
            setGcashQRPreview(userData.gcashQr);
          }
        }
        
        // If unauthorized, redirect to login
        if (err.response?.status === 401) {
          localStorage.removeItem('userData');
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleGcashQrChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setLoading(true);
        const formData = new FormData();
        formData.append('gcashQr', file);
        
        const response = await api.post('/users/profile/gcash-qr', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // Update both profile state and localStorage
        setProfile(prev => ({
          ...prev,
          gcashQr: response.data.gcashQr
        }));

        // Update localStorage
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        localStorage.setItem('userData', JSON.stringify({
          ...userData,
          gcashQr: response.data.gcashQr
        }));
        
        showMessage('GCash QR code updated successfully', 'success');
      } catch (err) {
        showMessage(err.response?.data?.message || 'Failed to upload GCash QR code', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setLoading(true);
        const formData = new FormData();
        formData.append('photo', file);
        
        const response = await api.post('/users/profile/photo', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // Update both profile state and localStorage
        setProfile(prev => ({
          ...prev,
          photo: response.data.photo
        }));

        // Update localStorage
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        localStorage.setItem('userData', JSON.stringify({
          ...userData,
          photo: response.data.photo
        }));
        
        showMessage('Profile photo updated successfully', 'success');
      } catch (err) {
        showMessage(err.response?.data?.message || 'Failed to upload profile photo', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const showMessage = (msg, sev) => {
    setMessage(msg);
    setSeverity(sev);
    setShowAlert(true);
    
    // Auto-hide the alert after 5 seconds
    setTimeout(() => {
      setShowAlert(false);
    }, 5000);
  };

  // Add delete account handler
  const handleDeleteAccount = async () => {
    if (deleteConfirmation.toLowerCase() !== 'delete') {
      showMessage('Please type "delete" to confirm', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/users/${profile.userId}`);
      localStorage.removeItem('userData');
      navigate('/login');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to delete account', 'error');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  // Add function to handle GCash QR code upload
  const handleGcashQRUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGcashQR(file);
        setGcashQRPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add function to save GCash QR code
  const saveGcashQR = async () => {
    if (!gcashQR) {
      toast.error('Please select a QR code image first');
      return;
    }
    
    try {
      setUpdatingGcashQR(true);
      
      const reader = new FileReader();
      reader.readAsDataURL(gcashQR);
      reader.onloadend = async () => {
        const base64data = reader.result;
        
        try {
          const response = await api.post('/users/gcash-qr', { 
            qrCodeImage: base64data 
          });
          
          // Update both the profile state and localStorage with the QR code
          setProfile(prev => ({
            ...prev,
            gcashQr: base64data
          }));
          
          // Update localStorage to persist the GCash QR code
          const userData = JSON.parse(localStorage.getItem('userData') || '{}');
          localStorage.setItem('userData', JSON.stringify({
            ...userData,
            gcashQr: base64data
          }));
          
          // Also update the preview state
          setGcashQRPreview(base64data);
          
          toast.success('GCash QR code updated successfully');
        } catch (err) {
          console.error('API call error:', err);
          toast.error('Server error: Failed to save GCash QR code');
        } finally {
          setUpdatingGcashQR(false);
        }
      };
    } catch (error) {
      console.error('Error updating GCash QR code:', error);
      toast.error('Failed to update GCash QR code');
      setUpdatingGcashQR(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f5f0]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#800000] border-opacity-20 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-t-[#800000] rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  const InfoCard = ({ icon: Icon, label, value }) => (
    <div className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-[#800000]">
      <div className="flex items-center mb-2">
        <div className="bg-[#800000] bg-opacity-10 p-2 rounded-lg mr-3">
          <Icon size={18} className="text-[#800000]" />
        </div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-800 pl-1">{value || 'Not provided'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f5f0] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-lg animate-pulse">
            <div className="flex items-center">
              <AlertCircle className="text-red-500 mr-3" size={20} />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Profile Header */}
        <div className="p-6 bg-[#800000] text-white rounded-xl shadow-xl mb-8">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="mt-2 opacity-90">View and manage your personal information</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="md:flex">
            {/* Profile Photo Section */}
            <div className="md:w-1/3 bg-gradient-to-br from-[#800000] to-[#a33333] p-8 text-white">
              <div className="text-center space-y-4">
                <div className="relative inline-block group">
                  {/* Profile Photo with Border */}
                  <div className="relative w-48 h-48 mx-auto rounded-full p-1 bg-white/30 backdrop-blur-sm">
                    <img
                      src={profile.photo || DEFAULT_AVATAR}
                      alt={profile.fullName || 'User'}
                      className="w-full h-full object-cover rounded-full cursor-pointer transition-all duration-300 hover:opacity-90"
                      onClick={() => document.getElementById('photoInput').click()}
                    />
                    {/* Camera Icon */}
                    <button 
                      className="absolute bottom-2 right-2 bg-[#ffd700] p-2 rounded-full text-[#800000] hover:bg-opacity-80 transition-all duration-300 shadow-lg"
                      onClick={() => document.getElementById('photoInput').click()}
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                  <input
                    type="file"
                    id="photoInput"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>
                
                <div>
                  <h2 className="text-3xl font-bold mb-1">
                    {profile.fullName || 'Your Name'}
                  </h2>
                  
                  <div className="inline-flex items-center bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <User size={14} className="mr-2" />
                    <p className="text-sm">{profile.email || 'email@example.com'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Information Section */}
            <div className="md:w-2/3 p-8">
              <div className="flex items-center mb-6">
                <School className="text-[#800000] mr-3" size={24} />
                <h3 className="text-2xl font-bold text-gray-800">Student Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <InfoCard 
                  icon={IdCard} 
                  label="Student ID" 
                  value={profile.studentId}
                />
                <InfoCard 
                  icon={Folder} 
                  label="Grade" 
                  value={profile.grade}
                />
                <InfoCard 
                  icon={School} 
                  label="Section" 
                  value={profile.section}
                />
              </div>

              {/* Payment Settings Section */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6 border border-[#ffd700]/20">
                <div className="p-6 bg-gradient-to-r from-[#800000] to-[#9a0000]">
                  <h3 className="text-xl font-bold text-[#ffd700] flex items-center">
                    <QrCode className="h-6 w-6 mr-2" />
                    Payment Settings
                  </h3>
                  <p className="text-white/80 text-sm mt-1">Set up your payment information for freelance work</p>
                </div>
                
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-[#800000] mb-3 border-b-2 border-[#ffd700]/50 pb-2">GCash QR Code</h4>
                    
                    {/* Steps Indicator */}
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#800000] text-white text-xs font-bold">1</div>
                      <div className="h-0.5 w-8 bg-[#800000]"></div>
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#800000] text-white text-xs font-bold">2</div>
                      <div className="h-0.5 w-8 bg-[#800000]"></div>
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#800000] text-white text-xs font-bold">3</div>
                      <div className="ml-2 text-sm text-[#800000] font-medium">Easy Setup</div>
                    </div>
                    
                    <div className="bg-[#ffd700]/5 p-4 rounded-lg border border-[#ffd700]/20 mb-6">
                      <p className="text-gray-700">
                        Upload your GCash QR code to allow clients to pay you directly through GCash. 
                        This QR code will be shown to clients when they choose to pay via GCash.
                      </p>
                      
                      <div className="flex flex-wrap gap-4 mt-3">
                        <div className="flex items-center text-sm text-[#800000]">
                          <div className="w-4 h-4 rounded-full bg-[#800000] flex items-center justify-center mr-2">
                            <span className="text-white text-xs">1</span>
                          </div>
                          <span>Open GCash app</span>
                        </div>
                        <div className="flex items-center text-sm text-[#800000]">
                          <div className="w-4 h-4 rounded-full bg-[#800000] flex items-center justify-center mr-2">
                            <span className="text-white text-xs">2</span>
                          </div>
                          <span>Go to Profile → QR Code</span>
                        </div>
                        <div className="flex items-center text-sm text-[#800000]">
                          <div className="w-4 h-4 rounded-full bg-[#800000] flex items-center justify-center mr-2">
                            <span className="text-white text-xs">3</span>
                          </div>
                          <span>Save QR image & upload here</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-6">
                      {/* QR Code Preview */}
                      <div className="sm:w-1/3 flex flex-col items-center">
                        <div className="bg-gradient-to-br from-[#800000]/5 to-[#ffd700]/5 border-2 border-[#800000]/20 rounded-lg w-48 h-48 flex items-center justify-center overflow-hidden mb-2 p-3 shadow-inner">
                          {gcashQRPreview ? (
                            <img 
                              src={gcashQRPreview} 
                              alt="GCash QR Preview" 
                              className="w-full h-full object-contain"
                            />
                          ) : profile.gcashQr ? (
                            <img 
                              src={profile.gcashQr} 
                              alt="Existing GCash QR" 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-center p-4 flex flex-col items-center">
                              <QrCode className="h-16 w-16 text-[#800000]/30 mb-2" />
                              <p className="text-sm text-[#800000]/70">No QR code uploaded</p>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">
                            {gcashQRPreview || profile.gcashQr ? 'QR code preview' : 'Upload your GCash QR code'}
                          </p>
                          {(gcashQRPreview || profile.gcashQr) && (
                            <span className="inline-flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Ready for payments
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Upload Controls */}
                      <div className="sm:w-2/3">
                        <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1.586l-.293-.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414l-.293.293V9z" clipRule="evenodd" />
                            </svg>
                            <label htmlFor="qrUpload" className="block text-sm font-medium text-[#800000]">
                              Upload QR Code Image
                            </label>
                          </div>
                          <input
                            type="file"
                            id="qrUpload"
                            accept="image/*"
                            onChange={handleGcashQRUpload}
                            className="block w-full text-sm text-gray-500 
                                      file:mr-4 file:py-2 file:px-4 file:rounded-md
                                      file:border-0 file:text-sm file:font-semibold
                                      file:bg-[#800000] file:text-[#ffd700]
                                      hover:file:bg-[#9a0000] transition-all duration-300"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Upload a clear image of your GCash QR code. Supported formats: PNG, JPG, JPEG.
                          </p>
                        </div>
                        
                        <button
                          onClick={saveGcashQR}
                          disabled={!gcashQR || updatingGcashQR}
                          className={`w-full py-3 px-4 rounded-md text-sm font-medium shadow-md transition-all duration-300 flex items-center justify-center ${
                            !gcashQR || updatingGcashQR ? 
                            'bg-gray-300 text-gray-500 cursor-not-allowed' : 
                            'bg-[#800000] text-[#ffd700] hover:bg-[#9a0000] transform hover:-translate-y-0.5'
                          }`}
                        >
                          {updatingGcashQR ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#ffd700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Updating...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                              Save QR Code
                            </span>
                          )}
                        </button>
                        
                        <div className="mt-4 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <div className="flex items-start">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-1 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span>
                              Once your QR code is saved, clients will see it as a payment option when booking your services.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#ffd700]/10 border border-[#ffd700]/30 rounded-lg p-4 mt-6">
                    <div className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#800000] mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm text-[#800000] font-medium">Security Notice</p>
                        <p className="text-sm text-[#800000] mt-1">
                          Your GCash QR code contains your account information. 
                          Only upload a QR code for an account that you own and control.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center mb-6">
            <Trash2 className="text-red-600 mr-3" size={24} />
            <h3 className="text-2xl font-bold text-gray-800">Delete Account</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 mb-2">Once you delete your account, there is no going back. Please be certain.</p>
              <p className="text-sm text-gray-500">All your data will be permanently removed.</p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-300 flex items-center gap-2"
            >
              <Trash2 size={18} />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#800000] mb-2">Delete Account</h3>
              <p className="text-gray-600">This action cannot be undone. Please type <span className="font-mono bg-gray-100 px-2 py-1 rounded text-[#800000]">delete</span> to confirm.</p>
            </div>

            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation.toLowerCase() !== 'delete'}
                className={`flex-1 px-4 py-3 rounded-lg text-white transition-colors duration-300 ${
                  deleteConfirmation.toLowerCase() === 'delete'
                    ? 'bg-[#800000] hover:bg-opacity-90'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showAlert && (
        <div className={`fixed bottom-4 right-4 max-w-md p-4 rounded-xl shadow-lg transition-all transform animate-slide-up ${
          severity === 'success' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'
        }`}>
          <div className="flex items-center gap-3">
            {severity === 'success' ? (
              <CheckCircle className="text-green-500 shrink-0" size={20} />
            ) : (
              <AlertCircle className="text-red-500 shrink-0" size={20} />
            )}
            <p className={severity === 'success' ? 'text-green-800' : 'text-red-800'}>{message}</p>
            <button 
              onClick={() => setShowAlert(false)}
              className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
