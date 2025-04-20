const jwt = require('jsonwebtoken');

// Helper function to extract token from header
const extractToken = (authHeader) => {
    if (!authHeader) return null;
    
    // Try Bearer token format first
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
    }
    
    // If not Bearer format, check if it's just the token
    if (parts.length === 1 && parts[0].length > 0) {
        return parts[0];
    }
    
    return null;
};

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        // Debug log the headers
        console.log('Auth Debug:', {
            hasAuthHeader: !!req.headers.authorization,
            authHeader: req.headers.authorization ? 'exists' : 'missing',
            method: req.method,
            path: req.path
        });

        // Check if the Authorization header exists
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.log('Request denied: No Authorization header provided');
            return res.status(401).json({ 
                error: 'Please log in to continue', 
                code: 'NO_TOKEN'
            });
        }

        // Extract the token
        const token = extractToken(authHeader);
        if (!token) {
            console.log('Request denied: No valid token found in header');
            return res.status(401).json({ 
                error: 'Invalid authentication token', 
                code: 'INVALID_TOKEN_FORMAT'
            });
        }

        // Debug log token format
        console.log('Token format check:', {
            length: token.length,
            hasThreeParts: token.split('.').length === 3,
            isBase64: /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]*$/.test(token)
        });

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Debug log decoded token (without sensitive info)
        console.log('Token decoded successfully:', {
            hasUserId: !!decoded.userId,
            hasEmail: !!decoded.email,
            exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'no expiration'
        });

        // Validate decoded token contents
        if (!decoded.userId) {
            console.log('Request denied: Token missing userId');
            return res.status(401).json({ 
                error: 'Invalid authentication token', 
                code: 'INVALID_TOKEN_CONTENT'
            });
        }

        // Attach user information to the request object
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            ...decoded
        };
        
        console.log('Request authorized:', {
            userId: decoded.userId,
            path: req.path,
            method: req.method
        });
        
        // Continue to the next middleware or route handler
        next();
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            console.log('Request denied: Token expired');
            return res.status(401).json({ 
                error: 'Your session has expired. Please log in again.', 
                code: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            console.log('Token validation error:', {
                error: error.message,
                tokenExists: !!req.headers.authorization
            });
            return res.status(401).json({ 
                error: 'Invalid authentication token', 
                code: 'INVALID_TOKEN'
            });
        }
        
        // Log any other errors
        console.error('Authentication error:', {
            name: error.name,
            message: error.message,
            path: req.path,
            method: req.method
        });
        
        return res.status(401).json({ 
            error: 'Authentication failed. Please try logging in again.', 
            code: 'AUTH_FAILED'
        });
    }
};

module.exports = verifyToken; 