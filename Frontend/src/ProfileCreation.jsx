import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import backgroundImage from './assets/GLE-Building.jpg';
import { profileService } from './services/api';
import { User, Mail, BookOpen, Users, School, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const ProfileCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if there's data passed from the previous page (signup page)
  const { fullName: initialFullName = '', email: initialEmail = '' } = location.state || {};

  const [formData, setFormData] = useState({
    fullName: initialFullName,
    email: initialEmail,
    studentId: '',
    grade: '11',
    section: 'ALTRUISM'
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sections = [
    'ALTRUISM', 'BENEVOLENCE', 'COMPETENCE', 'DILIGENCE', 'ENHUSIASM',
    'FRIENDSHIP', 'GENEROSITY', 'HUMILITY', 'INTEGRITY', 'JUSTICE', 'KINDNESS',
    'LOYALTY', 'MODESTY', 'NOBILITY', 'OBEDIENCE', 'PEACE', 'QUALITY', 'RESPECT',
    'RESPONSIBILITY', 'SINCERITY', 'TENACITY', 'WISDOM'
  ];

  // Check if user is authenticated
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    // Check if user is in signup flow
    if (!userData.isInSignupFlow) {
      navigate('/login', { replace: true });
      return;
    }

    // Pre-fill form with user data
    setFormData(prev => ({
      ...prev,
      fullName: userData.fullName || '',
      email: userData.email || ''
    }));
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};
    
    // Full Name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.endsWith('@cit.edu')) {
      newErrors.email = 'Please enter a valid institutional email (e.g., example@cit.edu)';
    }
    
    // Student ID validation
    const studentIdRegex = /^\d{2}-\d{4}-\d{3}$/;
    if (!formData.studentId.trim()) {
      newErrors.studentId = 'Student ID is required';
    } else if (!studentIdRegex.test(formData.studentId)) {
      newErrors.studentId = 'Student ID must be in XX-XXXX-XXX format (e.g., 21-1234-567)';
    }
    
    // Grade validation
    if (!formData.grade) {
      newErrors.grade = 'Grade is required';
    }
    
    // Section validation
    if (!formData.section.trim()) {
      newErrors.section = 'Section is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      setIsSubmitting(false);
      return;
    }

    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      if (!userData.id) {
        throw new Error('User ID not found. Please try logging in again.');
      }

      // Check that studentId format is valid
      const studentIdRegex = /^\d{2}-\d{4}-\d{3}$/;
      if (!studentIdRegex.test(formData.studentId)) {
        setError('Student ID must be in XX-XXXX-XXX format (e.g., 21-1234-567)');
        setIsLoading(false);
        setIsSubmitting(false);
        return;
      }
      
      // Convert grade to number and prepare userId as integer
      const gradeNumber = parseInt(formData.grade, 10);
      const userId = parseInt(userData.id, 10);
      
      console.log('Submitting profile with values:', {
        userId: userId,
        studentId: formData.studentId, // Keep as formatted string
        grade: gradeNumber,
        section: formData.section
      });
      
      const profileData = {
        userId: userId,
        fullName: formData.fullName,
        email: formData.email,
        studentId: formData.studentId, // Keep as formatted string
        grade: gradeNumber,
        section: formData.section
      };

      const response = await profileService.createProfile(profileData);
      
      if (!response) {
        throw new Error('No response received from server');
      }

      // Check if token is included in the response (for reactivated accounts)
      if (response.token) {
        userData.token = response.token;
        userData.isLoggedIn = true;
        localStorage.setItem('token', response.token);
        console.log('Token received from profile creation, stored in localStorage');
      }

      // Update user data in localStorage
      const updatedUserData = {
        ...userData,
        hasCompletedProfile: true,
        fullName: formData.fullName,
        email: formData.email,
        studentId: formData.studentId,
        grade: formData.grade,
        section: formData.section
      };
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      
      navigate('/verify-email', { replace: true });
    } catch (err) {
      // Check for specific error messages
      if (err.message && err.message.includes('Invalid data types')) {
        setError('Server error: Student ID should be a valid number without any special characters.');
      } else {
        setError(err.message || 'Failed to create profile. Please check your information and try again.');
      }
      console.error('Profile creation error:', err);
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleStudentIdChange = (e) => {
    let value = e.target.value;
    
    // Remove any non-digit or non-dash characters
    value = value.replace(/[^\d-]/g, '');
    
    // Remove extra dashes if user manually entered them
    value = value.replace(/-+/g, '-');
    
    // If the user is deleting characters, just update with the cleaned value
    if (value.length < formData.studentId.length) {
      setFormData(prev => ({
        ...prev,
        studentId: value
      }));
      return;
    }
    
    // Extract just the digits for formatting
    const digits = value.replace(/-/g, '');
    
    // Format as XX-XXXX-XXX
    let formattedValue = '';
    if (digits.length <= 2) {
      formattedValue = digits;
    } else if (digits.length <= 6) {
      formattedValue = `${digits.slice(0,2)}-${digits.slice(2)}`;
    } else if (digits.length <= 9) {
      formattedValue = `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,9)}`;
    } else {
      // Limit to 9 digits total
      formattedValue = `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,9)}`;
    }
    
    setFormData(prev => ({
      ...prev,
      studentId: formattedValue
    }));
    
    // Clear error when user starts typing
    if (errors.studentId) {
      setErrors(prev => ({
        ...prev,
        studentId: ''
      }));
    }
  };

  if (isLoading && !isSubmitting) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#800000] border-t-transparent animate-spin mb-4"></div>
          <p className="text-[#800000] font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 bg-center bg-cover z-0"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-[#800000] opacity-60"></div>
      </div>

      {/* Brand logo/name on top */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <h1 className="text-[#ffd700] text-4xl font-bold tracking-wider">
          
        </h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md z-10 relative overflow-hidden mx-4 my-8">
        {/* Gold accent bar */}
        <div className="h-2 bg-[#ffd700]"></div>

        <div className="p-8">
          <h2 className="text-2xl font-bold mb-2 text-[#800000]">Complete Your Profile</h2>
          <p className="text-gray-600 mb-6">Let's get to know you better</p>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-red-700 text-sm flex items-center">
                <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fullName">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  placeholder="Enter your full name"
                  className={`pl-10 w-full px-4 py-3 border ${
                    errors.fullName ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200`}
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Institutional Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your.email@cit.edu"
                  className={`pl-10 w-full px-4 py-3 border ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200`}
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Student ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="studentId">
                Student ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <School size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="studentId"
                  name="studentId"
                  placeholder="XX-XXXX-XXX"
                  className={`pl-10 w-full px-4 py-3 border ${
                    errors.studentId ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200`}
                  value={formData.studentId}
                  onChange={handleStudentIdChange}
                  maxLength={11}
                  disabled={isSubmitting}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Format: XX-XXXX-XXX (e.g., 21-1234-567)</p>
              {errors.studentId && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
                  {errors.studentId}
                </p>
              )}
            </div>

            {/* Grade Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="grade">
                Grade
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BookOpen size={18} className="text-gray-400" />
                </div>
                <select
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  className={`pl-10 w-full px-4 py-3 border ${
                    errors.grade ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200 appearance-none bg-white`}
                  disabled={isSubmitting}
                >
                  <option value="">Select Grade</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              {errors.grade && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
                  {errors.grade}
                </p>
              )}
            </div>

            {/* Section Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="section">
                Section
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users size={18} className="text-gray-400" />
                </div>
                <select
                  id="section"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  className={`pl-10 w-full px-4 py-3 border ${
                    errors.section ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200 appearance-none bg-white`}
                  disabled={isSubmitting}
                >
                  <option value="">Select Section</option>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              {errors.section && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
                  {errors.section}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center py-3 px-4 bg-[#800000] text-white rounded-lg transition-all duration-300 mt-6 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-opacity-90 shadow-md hover:shadow-lg'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  <span>Creating Profile...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} className="mr-2" />
                  <span>Complete Profile</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileCreation;