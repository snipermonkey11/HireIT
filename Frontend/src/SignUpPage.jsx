import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import backgroundImage from './assets/GLE-Building.jpg';
import { authService } from './services/api';
import { Eye, EyeOff, UserPlus, Mail, Lock, User, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const evaluatePasswordStrength = useCallback((password) => {
    if (password.length === 0) {
      setPasswordStrength('');
      return;
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.match(/[a-z]/)) score++;
    if (password.match(/[A-Z]/)) score++;
    if (password.match(/[0-9]/)) score++;
    if (password.match(/[^a-zA-Z0-9]/)) score++;

    if (score <= 2) setPasswordStrength('Weak');
    else if (score <= 4) setPasswordStrength('Good');
    else setPasswordStrength('Strong');
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'password') {
      evaluatePasswordStrength(value);
    }
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return false;
    }

    if (!formData.email.endsWith('@cit.edu') && !formData.email.endsWith('@citu.edu')) {
      setError('Please use your institutional email (@cit.edu or @citu.edu)');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.register(formData);
      
      // Store registration data in localStorage
      const registrationData = {
        id: response.userId,
        email: formData.email,
        fullName: formData.fullName,
        isInSignupFlow: true,
        isEmailVerified: false,
        hasCompletedProfile: false,
        token: response.token
      };
      localStorage.setItem('userData', JSON.stringify(registrationData));
      
      // Navigate to profile creation with user data
      navigate('/profile-creation', { 
        replace: true,
        state: {
          fullName: formData.fullName,
          email: formData.email
        }
      });
      
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = (strength) => {
    switch (strength) {
      case 'Weak': return 'text-red-500';
      case 'Good': return 'text-amber-500';
      case 'Strong': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  const getStrengthIcon = (strength) => {
    switch (strength) {
      case 'Weak': return <AlertTriangle size={16} className="mr-1" />;
      case 'Good': return <ShieldCheck size={16} className="mr-1" />;
      case 'Strong': return <ShieldCheck size={16} className="mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
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
          HIREIT
        </h1>
      </div>

      {/* Sign Up form card */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md z-10 relative overflow-hidden mx-4 my-8">
        {/* Gold accent bar */}
        <div className="h-2 bg-[#ffd700]"></div>
        
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-2 text-[#800000]">Create an account</h2>
          <p className="text-gray-600 mb-6">Join our community and start exploring</p>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-red-700 text-sm flex items-center">
                <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fullName">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200"
                  placeholder="Enter your full name"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200"
                  placeholder="your.email@citu.edu"
                  disabled={isLoading}
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Please use your institutional email (@citu.edu)</p>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200"
                  placeholder="Create a strong password"
                  disabled={isLoading}
                  required
                />
                {passwordStrength && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                    <span className={`text-xs font-medium ${getStrengthColor(passwordStrength)} flex items-center`}>
                      {getStrengthIcon(passwordStrength)}
                      {passwordStrength}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#800000] transition-colors"
                  onClick={() => setShowPassword(prev => !prev)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full flex items-center justify-center py-3 px-4 bg-[#800000] text-white rounded-lg transition-all duration-300 mt-6 ${
                isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-opacity-90 shadow-md hover:shadow-lg'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} className="mr-2" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <span className="text-gray-600">Already have an account? </span>
            <Link to="/login" className="font-medium text-[#800000] hover:text-[#600000] transition-all duration-300 flex items-center justify-center mt-2">
              <ArrowLeft size={16} className="mr-1" />
              Back to Login
            </Link>
          </div>

          {/* Legal/Privacy Links */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p className="mb-2">By signing up, you agree to our</p>
            <div>
              <Link to="/terms" className="hover:text-[#800000] transition-colors mr-2">Terms & Condition</Link>
              <span className="text-gray-400">|</span>
              <Link to="/privacy" className="hover:text-[#800000] transition-colors ml-2">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
