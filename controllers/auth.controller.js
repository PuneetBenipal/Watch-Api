const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const Subscription = require('../models/Subscription');
const { createCustomer } = require('../config/stripe');
const crypto = require("crypto");


// Generate JWT token
const generateToken = (tokenData) => { // object data
  return jwt.sign({ ...tokenData }, process.env.JWT_SECRET);
};

// Register dealer (basic registration)
const dealerRegister = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    console.log('Dealer registration:', { email, fullName });

    // Check if user already exists  
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ state: 'error', msg: 'User already exists with this email' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    // Create user (dealer role)
    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password, // This will be hashed by the pre-save hook
      fullName,
      role: 'user',
      verificationCode: code,
      codeExpiresAt: expiry,
      isVerified: false,
    });
    await user.save();

    // Create Stripe customer
    let stripeCustomer = null;
    try {
      stripeCustomer = await createCustomer(email, fullName);
    } catch (stripeError) {
      console.error('Stripe customer creation failed:', stripeError);
    }

    // Create subscription
    const subscription = new Subscription({
      userId: user._id,
      stripeCustomerId: stripeCustomer?.id || 'temp_' + user._id,
      plan: 'Basic',
      status: 'active',
    });
    await subscription.save();

    // Generate token
    const token = generateToken({
      _id: user._id,
      companyId: user.companyId,
      role: user.role,

    });

    // Return user data without password
    const userResponse = user.toJSON();

    res.status(201).json({
      message: 'Dealer registered successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Dealer registration error:', error);
    res.status(500).json({ state: 'error', msg: error.message });
  }
};
// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).populate()
    if (!user) {
      return res.status(401).json({ state: 'error', msg: `Email doesn't exists.` });
    }
    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ state: 'error', msg: 'Password is not matched' });
    }

    // Generate token
    const token = generateToken(user.toJSON());

    // Return user data without password
    const userResponse = user.toJSON();

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ state: 'error', msg: 'Login failed' });
  }
};

// Verify token
const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ state: 'error', msg: 'User not found' });
    }

    const company = await Company.findOne({ _id: req.user.companyId });

    res.json({
      user: user.toJSON(),
      company: company.toJSON(),
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ state: 'error', msg: 'Token verification failed' });
  }
};

// Register admin user (simple registration)
const registerAdmin = async (req, res) => {
  try {
    const { email, password, fullName, adminCode } = req.body;
    console.log('Admin registration:', { email, fullName });

    // Verify admin code
    if (adminCode !== process.env.ADMIN_REGISTRATION_CODE) {
      return res.status(403).json({ state: 'error', msg: 'Invalid admin code' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ state: 'error', msg: 'User already exists with this email' });
    }

    // Create user with admin role (no company association initially)
    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      fullName,
      role: 'admin'
    });
    await user.save();

    // Create Stripe customer
    let stripeCustomer = null;
    try {
      stripeCustomer = await createCustomer(email, fullName);
    } catch (stripeError) {
      console.error('Stripe customer creation failed:', stripeError);
    }

    // Create subscription
    const subscription = new Subscription({
      userId: user._id,
      stripeCustomerId: stripeCustomer?.id || 'temp_' + user._id,
      plan: 'Pro',
      status: 'active'
    });
    await subscription.save();

    // Generate token
    const token = generateToken({
      _id: user._id,
      companyId: user.companyId,
      role: user.role,
    });

    // Return user data without password
    const userResponse = user.toJSON();

    res.status(201).json({
      message: 'Admin user registered successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ state: 'error', msg: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ state: 'error', msg: 'Current password is incorrect' });
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ state: 'error', msg: 'Password change failed' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash')
      .populate('companyId');

    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ state: 'error', msg: 'Failed to get profile' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phone, address, company, bio, defaultCurrency, region } = req.body;
    console.log(req.body, "req.body");

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ state: 'error', msg: 'Email already exists' });
      }
    }

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (company !== undefined) updateData.company = company;
    if (bio !== undefined) updateData.bio = bio;
    if (defaultCurrency) updateData.defaultCurrency = defaultCurrency;
    if (region) updateData.region = region;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-passwordHash').populate('companyId');

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ state: 'error', msg: 'Profile update failed' });
  }
};

// Register company admin user (with company details)
const registerCompanyAdmin = async (req, res) => {
  try {
    const { email, password, fullName, companyName, companyLogo } = req.body;
    console.log('Company Admin registration:', { email, fullName, companyName });

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ state: 'error', msg: 'User already exists with this email' });
    }

    // Create company for admin
    const company = new Company({
      name: companyName,
      logoUrl: companyLogo || null,
      planId: 'Basic',
      modulesEnabled: ['inventory', 'alerts', 'invoicing'],
      planStatus: 'trialing',          // or 'pending'
      seats: { purchased: 1, used: 1 },
      entitlements: [
        { feature: 'whatsapp_search', limits: 0, usage: 0 },
        { feature: 'inventory', limits: 0, usage: 0, isTrial: true, endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      ],
      featureFlags: {},
      defaultCurrency: 'USD',
      timezone: 'UTC',
    });
    // await company.save();

    // Create user with admin role
    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      fullName,
      role: "owner",
      userKind: "dealer",
      companyId: company._id,
      lastLoginAt: Date.now(),
      lastLoginIp: req.header.ip
    });

    company.teamMates.push(user._id);

    // Create Stripe customer
    let stripeCustomer = null;
    try {
      stripeCustomer = await createCustomer(
        email,
        fullName,
        { companyId: String(company._id), userId: String(user._id) }
      );
    } catch (stripeError) {
      console.error('Stripe customer creation failed:', stripeError);
    }
    console.log("stripeCustomer :", stripeCustomer)

    company.stripeCustomerId = stripeCustomer?.id || 'temp_' + user._id;
    await company.save();
    await user.save();
    // // Create subscription
    // const subscription = new Subscription({
    //   userId: user._id,
    //   stripeCustomerId: stripeCustomer?.id || 'temp_' + user._id,
    //   plan: 'Basic',
    //   status: 'active'
    // });
    // await subscription.save();

    // Generate token
    const token = generateToken({
      _id: user._id,
      companyId: user.companyId,
      role: user.role,
    });

    res.status(201).json({
      msg: 'Company Admin user registered successfully',
      token,
      user: user.toJSON(),
      company: company.toJSON()
    });
  } catch (error) {
    console.error('Company Admin registration error:', error);
    res.status(500).json({ state: 'error', msg: error.message });
  }
};

// Register super admin user (simple registration)
const registerSuperAdmin = async (req, res) => {
  try {
    const { email, password, fullName, superAdminCode } = req.body;
    console.log('Super Admin registration:', { email, fullName });
    console.log('Super admin code from env:', process.env.SUPER_ADMIN_REGISTRATION_CODE);

    // Verify super admin code
    if (superAdminCode !== process.env.SUPER_ADMIN_REGISTRATION_CODE) {
      return res.status(403).json({ state: 'error', msg: 'Invalid super admin code' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ state: 'error', msg: 'User already exists with this email' });
    }

    // Create user with superadmin role
    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      fullName,
      role: 'superadmin'
    });
    await user.save();

    // Generate token
    const token = generateToken({
      _id: user._id,
      companyId: user.companyId,
      role: user.role,
    });

    // Return user data without password
    const userResponse = user.toJSON();

    res.status(201).json({
      message: 'Super Admin user registered successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Super Admin registration error:', error);
    res.status(500).json({ state: 'error', msg: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("email", email)

    // Always respond 200 to avoid user enumeration
    const user = await User.findOne({ email });
    if (!user) throw new Error("Email doesn't registered.");

    // 1) create random token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // 2) store hashed token + expiry
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expiresAt;
    console.log(user)
    await User.findOneAndUpdate(
      { email },
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: expiresAt,
      }
    )

    // 3) email raw token in link
    const link = `${process.env.CLIENT_URL}/account/reset-password?token=${rawToken}&uid=${user._id}`;
    return res.json({ state: "success", msg: "We sent password reset link. Check you inbox.", data: link })

  } catch (error) {
    res.json({ state: "error", msg: error.message })
  }
}

const resetPassword = async (req, res) => {
  try {
    const { uid, token, password } = req.body;
    if (!uid || !token || !password) {
      return res.status(400).json({ state: 'error', msg: "Invalid request" });
    }

    const user = await User.findById(uid);
    if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpiresAt) {
      return res.status(400).json({ state: 'error', msg: "Invalid or expired token" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const isExpired = user.resetPasswordExpiresAt.getTime() < Date.now();
    const isMatch = tokenHash === user.resetPasswordTokenHash;

    if (!isMatch || isExpired) {
      return res.status(400).json({ state: 'error', msg: "Invalid or expired token" });
    }

    user.passwordHash = password;
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    res.json({ ok: true, message: "Password has been reset." });
  } catch (error) {
    res.json({ state: 'error', msg: error.message })
  }
}

module.exports = {
  dealerRegister,
  login,
  verifyToken,
  registerAdmin,
  registerCompanyAdmin,
  registerSuperAdmin,
  changePassword,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
}; 