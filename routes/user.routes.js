const express = require('express');
const router = express.Router();
const { isAuth, isAdmin } = require('../middlewares/auth.middleware');
const authController = require('../controllers/auth.controller');

// All routes require authentication
router.use(isAuth);

// Get user profile
router.get('/profile', authController.getProfile);

// Update user profile
router.put('/profile', authController.updateProfile);

// Change password
router.put('/change-password', authController.changePassword);

// Get all users (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const User = require('../models/User.model');
    const users = await User.find().select('-passwordHash').populate('companyId');
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID (admin only)
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const User = require('../models/User.model');
    const user = await User.findById(req.params.id).select('-passwordHash').populate('companyId');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});


// Update user (admin only)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const User = require('../models/User.model');
    const { name, role, status } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, status },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const User = require('../models/User.model');
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router; 