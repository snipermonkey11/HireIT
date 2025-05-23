import axios from 'axios';

// Determine API base URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Function to validate and format token
const formatToken = (token) => {
    if (!token) return null;
    // Remove any existing Bearer prefix and trim
    token = token.replace(/^Bearer\s+/i, '').trim();
    // Validate token format (should be a JWT)
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
        console.warn('Invalid token format detected');
        return null;
    }
    return `Bearer ${token}`;
};

// Add request interceptor to include auth token
api.interceptors.request.use(
    (config) => {
        try {
            // Get the latest token from both possible sources
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const rawToken = userData.token || localStorage.getItem('token');
            
            if (rawToken) {
                const formattedToken = formatToken(rawToken);
                
                if (formattedToken) {
                    // Set token in headers
                    config.headers.Authorization = formattedToken;
                    api.defaults.headers.common.Authorization = formattedToken;
                    
                    // Debug log
                    console.log('Request details:', {
                        url: config.url,
                        method: config.method,
                        hasToken: true,
                        tokenPrefix: formattedToken.substring(0, 10) + '...'
                    });
                } else {
                    // Token validation failed
                    console.error('Token validation failed, clearing auth data');
                    localStorage.removeItem('token');
                    localStorage.removeItem('userData');
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                    return Promise.reject(new Error('Invalid token format'));
                }
            } else {
                console.warn('No token available for request:', {
                    url: config.url,
                    method: config.method
                });
                // Remove any stale Authorization headers
                delete config.headers.Authorization;
                delete api.defaults.headers.common.Authorization;
            }
            
            // Don't set Content-Type for multipart form data, let the browser set it automatically
            if (['post', 'put'].includes(config.method?.toLowerCase()) && 
                !(config.headers['Content-Type'] === 'multipart/form-data') &&
                !(config.data instanceof FormData)) {
                config.headers['Content-Type'] = 'application/json';
            }
            
            // If it's a FormData object, make sure Content-Type is handled by the browser
            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            }
            
            return config;
        } catch (error) {
            console.error('Request interceptor error:', {
                message: error.message,
                stack: error.stack,
                config: {
                    url: config.url,
                    method: config.method,
                    headers: config.headers
                }
            });
            return Promise.reject(error);
        }
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor for debugging and auth error handling
api.interceptors.response.use(
    (response) => {
        // Log successful requests in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Successful response:', {
                url: response.config.url,
                method: response.config.method,
                status: response.status,
                hasAuthHeader: !!response.config.headers.Authorization
            });
        }
        return response;
    },
    (error) => {
        // Enhanced error logging
        const errorDetails = {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            headers: {
                request: {
                    ...error.config?.headers,
                    Authorization: error.config?.headers?.Authorization ? 'Bearer [hidden]' : 'none'
                },
                response: error.response?.headers
            }
        };
        
        console.error('API Error Details:', errorDetails);
        
        // Handle authentication errors consistently
        if (error.response?.status === 401) {
            const currentToken = localStorage.getItem('token');
            console.warn('Authentication error:', {
                hasToken: !!currentToken,
                url: error.config?.url,
                errorMessage: error.response?.data?.error
            });
            
            // Clear auth data and redirect only if not already on login page
            if (window.location.pathname !== '/login') {
                sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                localStorage.removeItem('token');
                localStorage.removeItem('userData');
                window.location.href = '/login';
            }
        }
        
        return Promise.reject(error);
    }
);

// Auth Service
export const authService = {
    isAuthenticated: () => {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return !!(userData.token && userData.isLoggedIn);
        } catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    },

    register: async (userData) => {
        try {
            const response = await api.post('/users/register', userData);
            
            // Store user data with token (if available)
            const initialUserData = {
                id: response.data.userId,
                email: userData.email,
                fullName: userData.fullName,
                isAdmin: false,
                isEmailVerified: false,
                hasCompletedProfile: false,
                isInSignupFlow: true,
                verificationEmailSent: response.data.verificationEmailSent,
                token: response.data.token || null, // Handle token if it exists
                isLoggedIn: !!response.data.token // Only consider logged in if token exists
            };
            
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
            }
            
            localStorage.setItem('userData', JSON.stringify(initialUserData));
            
            return {
                userId: response.data.userId,
                token: response.data.token,
                message: response.data.message,
                verificationEmailSent: response.data.verificationEmailSent
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error.response?.data || { error: 'Registration failed. Please try again.' };
        }
    },

    login: async (email, password) => {
        try {
            const response = await api.post('/users/login', { email, password });
            const { token, user } = response.data;
            
            if (!token) {
                throw new Error('No token received from server');
            }
            
            // Store user data including verification and profile completion status
            const userData = {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                isAdmin: user.isAdmin,
                isEmailVerified: user.isVerified,
                hasCompletedProfile: !!(user.studentId && user.grade && user.section),
                studentId: user.studentId || '',
                grade: user.grade || '',
                section: user.section || '',
                token: token,
                isLoggedIn: true,
                userId: user.id
            };
            
            // Store both in userData and as separate token
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('token', token);
            
            // Set the token in axios defaults
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            return {
                user: userData,
                token
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error.response?.data || error.message;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        window.location.href = '/login';
    },

    verifyEmail: async (token) => {
        try {
            const response = await api.get('/users/verify-email', { 
                params: { token },
                withCredentials: true
            });
            
            // Update the stored user data to include verification status
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const updatedUserData = {
                ...userData,
                isEmailVerified: true,
                isInSignupFlow: false,
                verificationEmailSent: false,
                isLoggedIn: true
            };
            localStorage.setItem('userData', JSON.stringify(updatedUserData));
            localStorage.setItem('token', userData.token);

            return {
                success: true,
                message: response.data.message,
                email: response.data.email,
                isEmailVerified: true
            };
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    resendVerification: async (email) => {
        try {
            const response = await api.post('/users/resend-verification', { email });
            
            // Update verification email sent status
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const updatedUserData = {
                ...userData,
                verificationEmailSent: true
            };
            localStorage.setItem('userData', JSON.stringify(updatedUserData));
            
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

// Profile Service
export const profileService = {
    createProfile: async (profileData) => {
        try {
            // Validate and ensure data types are correct before sending
            if (!profileData.userId || !Number.isInteger(profileData.userId)) {
                throw new Error('Invalid userId: Must be an integer');
            }
            
            if (!profileData.studentId) {
                throw new Error('Invalid studentId: Student ID is required');
            }
            
            if (!profileData.grade || !Number.isInteger(profileData.grade)) {
                throw new Error('Invalid grade: Must be an integer');
            }
            
            if (!profileData.section || typeof profileData.section !== 'string') {
                throw new Error('Invalid section: Must be a string');
            }
            
            console.log('Sending profile data to server:', {
                userId: profileData.userId,
                studentId: profileData.studentId,
                grade: profileData.grade,
                section: profileData.section
            });
            
            const response = await api.post('/users/profile', profileData);
            console.log('Profile creation response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Profile creation error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                profileData: {
                    userId: profileData.userId,
                    studentId: profileData.studentId,
                    grade: profileData.grade,
                    section: profileData.section
                }
            });
            throw new Error(error.response?.data?.message || error.message || 'Profile creation failed');
        }
    },

    getProfile: async () => {
        try {
            const response = await api.get('/users/profile');
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch profile');
        }
    },

    updateProfile: async (profileData) => {
        try {
            const response = await api.put('/users/profile', profileData);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Profile update failed');
        }
    }
};

// Transaction History Service
export const transactionHistoryService = {
    getTransactionHistory: async () => {
        try {
            const response = await api.get('/transaction-history');
            return response.data;
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            throw new Error(error.response?.data?.error || 'Failed to fetch transaction history');
        }
    },

    getTransactionDetails: async (transactionId) => {
        try {
            const response = await api.get(`/transaction-history/${transactionId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transaction ${transactionId} details:`, error);
            throw new Error(error.response?.data?.error || 'Failed to fetch transaction details');
        }
    }
};

/**
 * Review service for submitting and managing reviews
 */
export const reviewService = {
    /**
     * Submit a review for a completed transaction
     * 
     * @param {number} applicationId - ID of the application being reviewed
     * @param {number} rating - Rating from 1-5
     * @param {string} reviewText - Optional text review
     * @param {string} userRole - Role of the current user ('client' or 'freelancer')
     * @param {Object} revieweeInfo - Information about who is being reviewed
     * @param {string} revieweeInfo.revieweeName - Name of the person being reviewed
     * @param {string} revieweeInfo.revieweeRole - Role of the person being reviewed ('client' or 'freelancer')
     * @param {number} revieweeInfo.revieweeId - User ID of the person being reviewed
     * @returns {Promise<Object>} - Review submission result
     */
    submitReview: async (applicationId, rating, reviewText, userRole, revieweeInfo) => {
        try {
            // Log the review details for debugging
            console.log('Review submission details:', {
                applicationId,
                rating,
                reviewText: reviewText ? `${reviewText.substring(0, 20)}...` : '',
                userRole,
                revieweeInfo
            });
            
            // Make sure we have all required information
            if (!applicationId || !rating || !userRole || !revieweeInfo || !revieweeInfo.revieweeId) {
                throw new Error('Missing required review information');
            }

            // Validate inputs
            if (isNaN(applicationId) || applicationId <= 0) {
                throw new Error('Invalid application ID');
            }
            
            if (isNaN(rating) || rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }
            
            if (userRole !== 'client' && userRole !== 'freelancer') {
                throw new Error('Invalid user role');
            }
            
            // Validate reviewee role matches expectations
            if (revieweeInfo.revieweeRole !== 'client' && revieweeInfo.revieweeRole !== 'freelancer') {
                throw new Error('Invalid reviewee role');
            }
            
            // Ensure reviewer and reviewee roles are opposite
            if (userRole === revieweeInfo.revieweeRole) {
                console.error('Role conflict detected:', {
                    userRole,
                    revieweeRole: revieweeInfo.revieweeRole
                });
                throw new Error('Reviewer and reviewee roles must be different');
            }

            // Check user authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('You must be logged in to submit a review');
            }
            
            // Get current user ID for additional validation
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const currentUserId = userData.userId || userData.id;
            
            // Validate that user is not reviewing themselves
            if (String(currentUserId) === String(revieweeInfo.revieweeId)) {
                console.error('Self-review attempt detected', {
                    currentUserId,
                    revieweeId: revieweeInfo.revieweeId
                });
                throw new Error('Self-review is not allowed');
            }

            // Submit the review
            const response = await api.post(
                '/reviews',
                {
                    applicationId,
                    rating,
                    reviewText: reviewText || '', // Changed from comment to reviewText to match backend
                    userRole,
                    revieweeInfo: {
                        revieweeName: revieweeInfo.revieweeName,
                        revieweeRole: revieweeInfo.revieweeRole,
                        revieweeId: revieweeInfo.revieweeId
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            
            console.log('Review submitted successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error submitting review:', error);
            
            // Handle different types of errors
            if (error.response) {
                // Server responded with an error
                console.error('Server error response:', error.response.data);
                throw error;
            } else if (error.request) {
                // Request was made but no response received
                throw new Error('No response from server. Please try again later.');
            } else {
                // Error in setting up the request
                throw error;
            }
        }
    },

    /**
     * Check if the current user is eligible to leave a review for a specific application
     * 
     * @param {number} applicationId - ID of the application to check eligibility for
     * @returns {Promise<Object>} - Eligibility check result containing:
     *   - eligible: boolean - Whether the user can leave a review
     *   - error: string - Error message if not eligible
     *   - transaction: Object - Transaction details if available
     */
    checkReviewEligibility: async (applicationId) => {
        try {
            if (!applicationId) {
                throw new Error('Application ID is required');
            }

            // Check user authentication
            const token = localStorage.getItem('token');
            if (!token) {
                return {
                    eligible: false,
                    error: 'You must be logged in to leave a review'
                };
            }

            // Send request to eligibility endpoint
            const response = await api.get(
                `/reviews/eligibility/${applicationId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            // Handle successful response
            const result = response.data;
            
            // Return standardized result
            return {
                eligible: result.eligible === true,
                error: result.error || null,
                transaction: result.transaction || null
            };
        } catch (error) {
            console.error('Error checking review eligibility:', error);
            
            // Handle different types of errors
            if (error.response) {
                // Server responded with an error
                return {
                    eligible: false,
                    error: error.response.data?.error || 'Not eligible to leave a review'
                };
            } else if (error.request) {
                // Request was made but no response was received
                return {
                    eligible: false,
                    error: 'No response from server. Please try again later.'
                };
            } else {
                // Error in setting up the request
                return {
                    eligible: false,
                    error: error.message || 'An unknown error occurred'
                };
            }
        }
    },

    /**
     * Get all reviews for a specific user
     * 
     * @param {number} userId - ID of the user to get reviews for (optional, defaults to current user)
     * @param {string} type - Type of reviews to get ('given' or 'received') (unused by backend)
     * @returns {Promise<Array>} - List of reviews
     */
    getUserReviews: async (userId = null) => {
        try {
            // Get current user ID if not provided
            if (!userId) {
                const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                userId = userData.userId || userData.id;
                
                if (!userId) {
                    console.error('No user ID available for getUserReviews');
                    return [];
                }
            }

            // Check user authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('You must be logged in to view reviews');
            }

            // Send request to reviews endpoint
            const response = await api.get(
                `/reviews/user`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            
            // Log response
            console.log('getUserReviews response:', response.data);

            return response.data;
        } catch (error) {
            console.error('Error getting user reviews:', error);
            throw error;
        }
    },
    
    // Get reviews received by the user (as a freelancer)
    getReceivedReviews: async () => {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userId = userData.userId || userData.id;
            
            if (!userId) {
                console.error('No user ID available for getReceivedReviews');
                return [];
            }
            
            // Get authentication token
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token available for getReceivedReviews');
                return [];
            }
            
            // Make the API call to get received reviews
            const response = await api.get(`/reviews/received`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            console.log('Received reviews response:', response.data);
            
            if (!response.data) {
                console.error('No data received from received reviews endpoint');
                return [];
            }
            
            return response.data;
        } catch (error) {
            console.error('Error fetching received reviews:', error);
            // Return empty array instead of throwing to handle gracefully
            return [];
        }
    },

    getReviewDetails: async (reviewId) => {
        try {
            const response = await api.get(`/reviews/${reviewId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching review details:', error);
            throw error;
        }
    }
};

// Error handling utility
export const handleApiError = (error) => {
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        return {
            message: error.response.data.message || 'An error occurred',
            status: error.response.status,
            data: error.response.data
        };
    } else if (error.request) {
        // The request was made but no response was received
        return {
            message: 'No response received from server',
            status: null
        };
    } else {
        // Something happened in setting up the request that triggered an Error
        return {
            message: error.message || 'An error occurred',
            status: null
        };
    }
};

// Dashboard service
export const dashboardService = {
    // Get all services for the current user
    getMyServices: async () => {
        try {
            console.log('Calling getMyServices API');
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token available for getMyServices');
                return [];
            }
            
            const response = await api.get('/dashboard/my-services');
            console.log('getMyServices response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error fetching user services:', error);
            // Return empty array instead of throwing to handle gracefully
            return [];
        }
    },
    
    // Update a service
    updateService: async (serviceId, serviceData) => {
        try {
            console.log(`Updating service ${serviceId}`, serviceData);
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token available for updateService');
                throw new Error('Authentication token not found');
            }
            
            const response = await api.put(`/dashboard/services/${serviceId}`, serviceData);
            return response.data;
        } catch (error) {
            console.error('Error updating service:', error);
            throw error;
        }
    },
    
    // Delete a service
    deleteService: async (serviceId) => {
        try {
            console.log(`Deleting service ${serviceId}`);
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token available for deleteService');
                throw new Error('Authentication token not found');
            }
            
            const response = await api.delete(`/dashboard/services/${serviceId}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting service:', error);
            throw error;
        }
    },
    
    // Get reviews for user's services
    getMyReviews: async () => {
        try {
            console.log('Calling getMyReviews API');
            const token = localStorage.getItem('token');
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (!token) {
                console.error('No token available for getMyReviews');
                return [];
            }
            
            // Get reviews where the user is the service provider (not the reviewer)
            const response = await api.get('/dashboard/my-reviews');
            console.log('getMyReviews response raw:', response.data);
            
            // Check if we got a proper array response
            if (!Array.isArray(response.data)) {
                console.error('Unexpected response format from my-reviews API:', response.data);
                return [];
            }
            
            // Return the original data structure without transforming it
            // This matches how Reviews.jsx expects the data
            console.log('Reviews count:', response.data.length);
            return response.data;
        } catch (error) {
            console.error('Error fetching user reviews:', error);
            console.error('Error details:', error.response?.data || error.message);
            // Return empty array instead of throwing to handle gracefully
            return [];
        }
    }
};

// Add the messaging service to the API
export const messageService = {
    // Get all conversations for the current user
    getConversations: async () => {
        try {
            const response = await api.get('/messages/conversations');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    
    // Get a specific conversation with messages
    getConversation: async (conversationId) => {
        try {
            const response = await api.get(`/messages/conversations/${conversationId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    
    // Send a message in a conversation
    sendMessage: async (conversationId, content) => {
        try {
            const response = await api.post(`/messages`, {
                conversationId,
                content
            });
            return response.data;
        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    },
    
    // Send message with image
    sendMessageWithImage: async (conversationId, formData) => {
        try {
            const response = await api.post(`/messages/with-image/${conversationId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error("Error sending message with image:", error);
            throw error;
        }
    },
    
    // Start a new conversation with another user
    startConversation: async (userId, initialMessage) => {
        try {
            const response = await api.post('/messages/conversations', {
                userId,
                message: initialMessage
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    
    // Mark all messages in a conversation as read
    markAsRead: async (conversationId) => {
        try {
            const response = await api.put(`/messages/conversations/${conversationId}/read`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    
    // Delete a conversation
    deleteConversation: async (conversationId) => {
        try {
            const response = await api.delete(`/messages/conversations/${conversationId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    }
};

// Add getUserProfile service to userService
export const userService = {
    // Existing methods...
    
    // Get user profile by ID
    getUserProfile: async (userId) => {
        try {
            console.log(`Fetching profile for user ${userId}`);
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token available for getUserProfile');
                throw new Error('Authentication token not found');
            }
            
            // Get basic profile info
            const profileResponse = await api.get(`/users/profile/${userId}`);
            const userProfile = profileResponse.data;
            
            // Try to get reviews for this user
            try {
                // Fetch reviews received by this user
                const reviewsResponse = await api.get(`/reviews/freelancer/${userId}`);
                
                // Process the reviews to extract reviewer info
                const processedReviews = reviewsResponse.data.map(review => {
                    // Try to parse metadata if available
                    let reviewerName = review.ReviewerName || 'Client';
                    let reviewerId = null;
                    
                    if (review.Metadata) {
                        try {
                            const metadata = JSON.parse(review.Metadata);
                            reviewerName = metadata.reviewerName || reviewerName;
                            reviewerId = metadata.reviewerId;
                        } catch (err) {
                            console.warn('Failed to parse review metadata:', err);
                        }
                    }
                    
                    return {
                        id: review.ReviewId,
                        rating: review.Rating,
                        text: review.ReviewText,
                        date: review.CreatedAt,
                        serviceTitle: review.ServiceTitle,
                        reviewer: {
                            id: reviewerId,
                            name: reviewerName
                        }
                    };
                });
                
                // Add reviews to the user profile
                userProfile.reviews = processedReviews;
            } catch (reviewError) {
                console.warn('Could not fetch reviews for user:', reviewError);
                userProfile.reviews = [];
            }
            
            return userProfile;
        } catch (error) {
            console.error(`Error fetching user profile ${userId}:`, error);
            throw error;
        }
    }
};

export default api;
