import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user from database
    const user = await User.findById(decoded.userId)
      .select('-password -refreshToken');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token or inactive user' });
    }

    // Attach user info to request
    req.user = user;
    req.userId = user._id;
    req.organizationId = user.organizationId;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.userId).select('-password -refreshToken');

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
        req.organizationId = user.organizationId;
        req.userRole = user.role;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

export default { authenticate, optionalAuth };

