import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import backgroundImage from './assets/GLE-Building.jpg'; // Import the image from src/assets
import { authService } from './services/api';
import { Eye, EyeOff, LogIn, Mail, Lock, UserPlus } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setIsLoading(true);

      const response = await authService.login(email, password);
      
      // Store user data in localStorage with isLoggedIn flag
      localStorage.setItem('userData', JSON.stringify({
        id: response.user.id,
        email: response.user.email,
        fullName: response.user.fullName,
        isAdmin: response.user.isAdmin,
        token: response.token,
        isLoggedIn: true,
        userId: response.user.id
      }));
      
      // Store token separately as well for backward compatibility
      localStorage.setItem('token', response.token);

      // Store email if remember me is checked
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Check if there's a redirect URL in session storage
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
      if (redirectUrl) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectUrl);
      } else {
        // Default redirects based on user role
        if (response.user.isAdmin) {
          navigate('/admin/dashboard');
        } else {
          navigate('/home');
        }
      }

    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load remembered email if exists
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

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
          
        </h1>
      </div>

      {/* Login form card */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md z-10 relative overflow-hidden mx-4">
        {/* Gold accent bar */}
        <div className="h-2 bg-[#ffd700]"></div>
        
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-2 text-[#800000]">Welcome back</h2>
          <p className="text-gray-600 mb-6">Please sign in to your account</p>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200"
                  placeholder="your.email@cit.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link to="/forgot-password" className="text-sm text-[#800000] hover:text-[#600000] transition-colors duration-200">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#800000] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="h-4 w-4 text-[#800000] focus:ring-[#800000] border-gray-300 rounded transition duration-200"
                disabled={isLoading}
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                Remember me on this device
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className={`w-full flex items-center justify-center py-3 px-4 bg-[#800000] text-white rounded-lg transition-all duration-300 ${
                isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-opacity-90 shadow-md hover:shadow-lg'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} className="mr-2" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Get Started Link */}
          <div className="mt-8 text-center">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/signup" className="font-medium text-[#800000] hover:text-[#600000] transition-all duration-300 flex items-center justify-center mt-2">
              <UserPlus size={16} className="mr-1" />
              Create Account
            </Link>
          </div>

          {/* Legal/Privacy Links */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <Link to="/terms" className="hover:text-[#800000] transition-colors mr-2">Terms & Condition</Link>
            <span className="text-gray-400">|</span>
            <Link to="/privacy" className="hover:text-[#800000] transition-colors ml-2">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
