const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { isAuth } = require('../middlewares/auth.middleware');
const authenticateToken = require('../middleware/auth');

// Public routes - Role-based registration
router.post('/agent-register', authController.dealerRegister); // Regular user registration (role: 'user')
router.post('/super-admin/register', authController.registerSuperAdmin); // Super admin registration (role: 'superadmin')
router.post('/dealer-register', authController.registerCompanyAdmin); // Company admin registration (role: 'admin')
router.post('/login', authController.login);

// Protected routes
router.get('/verify', authenticateToken, authController.verifyToken);
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)

module.exports = router; 