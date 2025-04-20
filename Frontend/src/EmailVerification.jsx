import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import backgroundImage from './assets/GLE-Building.jpg';
import { verifyEmail, resendVerification } from './services/authService';

const EmailVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const initializeVerification = async () => {
      try {
        // Get token from URL
        const token = searchParams.get('token');
        
        // Get user data from localStorage
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        // If no token and no email, redirect to login
        if (!token && !userData.email) {
          navigate('/login');
          return;
        }

        // If user is already verified and logged in, redirect to home
        if (userData.isEmailVerified && userData.isLoggedIn) {
          navigate('/');
          return;
        }

        if (userData.email) {
          setUserEmail(userData.email);
        }

        // If we have a token, attempt verification
        if (token) {
          await handleVerification(token);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeVerification();
  }, [searchParams, navigate]);

  const handleVerification = async (token) => {
    if (isVerifying) return;
    
    setIsVerifying(true);
    setError('');
    setMessage('');
    
    try {
      if (!token) {
        throw new Error('Verification token is missing');
      }

      const result = await verifyEmail(token);
      
      setVerificationStatus('success');
      setMessage(result.message || `Email ${result.email} has been successfully verified!`);
      
      // After successful verification, redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
      
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStatus('error');
      setError(error.message);
      
      // If token is invalid or expired, show resend option
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        setUserEmail(localStorage.getItem('userEmail') || '');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendVerification = async () => {
    if (!userEmail || isResending) return;

    setIsResending(true);
    setError('');
    setResendMessage('');

    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      if (userData.isEmailVerified) {
        throw new Error('Your email is already verified!');
      }

      await resendVerification(userEmail);
      setResendMessage('Verification email sent! Please check your inbox and spam folder. The link will expire in 24 hours.');
      setError('');

    } catch (error) {
      setError(error.message || 'Failed to send verification email. Please try again or contact support.');
      setResendMessage('');
    } finally {
      setIsResending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex justify-center items-center"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-3xl font-bold text-center text-maroon-700 mb-6">
          {verificationStatus === 'success' ? 'Email Verified!' : 'Verify Your Email'}
        </h2>
        
        {verificationStatus === 'success' ? (
          <div className="text-center mb-8">
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-600">{message}</p>
              <p className="text-sm text-gray-600 mt-2">Redirecting to home page...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              {userEmail && (
                <p className="text-gray-600 mb-4">
                  Please verify your email address:
                  <br />
                  <span className="font-semibold text-maroon-600">{userEmail}</span>
                </p>
              )}
              {!searchParams.get('token') && (
                <p className="text-sm text-gray-500">
                  Click the button below to send a verification email.
                </p>
              )}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {resendMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-600 text-sm">{resendMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              {(!searchParams.get('token') || error) && (
                <button
                  onClick={handleSendVerification}
                  disabled={isResending}
                  className={`w-full bg-maroon-600 text-gold-500 py-3 rounded-md transition-all duration-300 transform ${
                    isResending 
                      ? 'opacity-70 cursor-not-allowed' 
                      : 'hover:bg-maroon-700 hover:scale-105'
                  } border-2 border-gold-500 font-semibold`}
                >
                  {isResending ? 'Sending...' : 'Send Verification Email'}
                </button>
              )}

              <button
                onClick={() => navigate('/login')}
                className="w-full bg-gray-100 text-maroon-700 py-3 rounded-md hover:bg-gray-200 transition-all duration-300 border-2 border-maroon-600 font-semibold"
              >
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailVerification;
