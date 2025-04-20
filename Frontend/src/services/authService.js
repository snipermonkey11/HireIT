import axios from 'axios';

// Using the correct port that matches your backend
const API_BASE_URL = 'http://localhost:3000/api';

export const verifyEmail = async (token) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/verify-email`, {
      params: { token },
      withCredentials: true
    });

    // Update local storage with verification status and user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    userData.isEmailVerified = true;
    userData.isInSignupFlow = false;
    userData.verificationEmailSent = false;
    userData.email = response.data.email;
    localStorage.setItem('userData', JSON.stringify(userData));

    return {
      success: true,
      message: response.data.message || 'Email verified successfully!',
      email: response.data.email
    };
  } catch (error) {
    console.error('Verification error:', error);
    throw new Error(error.response?.data?.error || 'Failed to verify email. Please try again.');
  }
};

export const resendVerification = async (email) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/users/resend-verification`, 
      { email },
      { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      message: response.data.message || 'Verification email sent successfully!'
    };
  } catch (error) {
    console.error('Resend verification error:', error);
    throw new Error(error.response?.data?.error || 'Failed to send verification email. Please try again.');
  }
}; 