const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// Middleware to verify JWT token
const isAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(">>>>>>!@#!@"); console.log(token, decoded);
    const user = await User.findById(decoded._id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// Middleware to check if user is super admin
const isSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// Middleware to check if user is dealer
const isDealer = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role !== 'dealer' && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied. Dealer privileges required.' });
    }

    next();
  } catch (error) {
    console.error('Dealer middleware error:', error);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-passwordHash');
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

module.exports = {
  isAuth,
  isAdmin,
  isSuperAdmin,
  isDealer,
  optionalAuth
}; 