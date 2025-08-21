const User = require('../models/User.model');
const Company = require('../models/Company.model');
const { asyncHandler } = require('../middlewares/error.middleware');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, companyId } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (companyId) filter.companyId = companyId;

    const users = await User.find(filter)
      .populate('companyId', 'name')
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .populate('companyId', 'name logoUrl')
      .select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields from update
    delete updateData.passwordHash;
    delete updateData.email; // Email should be updated through separate endpoint

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('companyId', 'name logoUrl');

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
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deletion of superadmin users
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot delete superadmin users' });
    }

    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get user profile (user's own profile)
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('companyId', 'name logoUrl plan modulesEnabled')
      .select('-passwordHash');

    res.json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};

// Update user profile (user's own profile)
const updateUserProfile = async (req, res) => {
  try {
    const { name, defaultCurrency, region, whatsappConnected } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (defaultCurrency) updateData.defaultCurrency = defaultCurrency;
    if (region) updateData.region = region;
    if (typeof whatsappConnected === 'boolean') updateData.whatsappConnected = whatsappConnected;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).populate('companyId', 'name logoUrl plan modulesEnabled');

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Change user password
const changeUserPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await User.findById(req.user._id);
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.passwordHash = await user.hashPassword(newPassword);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword
}; 