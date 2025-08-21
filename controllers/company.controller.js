const Company = require('../models/Company.model');
const User = require('../models/User.model');
const { asyncHandler } = require('../middlewares/error.middleware');


// Get all companies (admin only)
const getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 20, plan } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (plan) filter.plan = plan;

    const companies = await Company.find(filter)
      .populate('team', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Company.countDocuments(filter);

    res.json({
      companies,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get all companies error:', error);
    res.status(500).json({ error: 'Failed to get companies' });
  }
};

// Get company by ID (admin only)
const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id)
      .populate('team', 'name email role');

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Get company by ID error:', error);
    res.status(500).json({ error: 'Failed to get company' });
  }
};

// Create company (admin only)
const createCompany = async (req, res) => {
  try {
    const {
      name,
      logoUrl,
      plan = 'Basic',
      modulesEnabled = ['inventory']
    } = req.body;

    const company = new Company({
      name,
      logoUrl,
      plan,
      modulesEnabled,
      team: [],
      billingInfo: {}
    });

    await company.save();

    res.status(201).json({
      message: 'Company created successfully',
      company
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
};

// Update company (admin only)
const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const company = await Company.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('team', 'name email role');

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      message: 'Company updated successfully',
      company
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
};

// Delete company (admin only)
const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if company exists
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if company has users
    const userCount = await User.countDocuments({ companyId: id });
    if (userCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete company with active users. Please remove all users first.'
      });
    }

    await Company.findByIdAndDelete(id);

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
};

// Get company profile (user's company)
const getCompanyProfile = async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(404).json({ error: 'User not associated with any company' });
    }

    const company = await Company.findById(req.user.companyId)
      .populate('team', 'name email role');

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ error: 'Failed to get company profile' });
  }
};

// Update company profile (company admin only)
const updateCompanyProfile = async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(404).json({ error: 'User not associated with any company' });
    }

    const { name, logoUrl, modulesEnabled } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (logoUrl) updateData.logoUrl = logoUrl;
    if (modulesEnabled) updateData.modulesEnabled = modulesEnabled;

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      updateData,
      { new: true }
    ).populate('team', 'name email role');

    res.json({
      message: 'Company profile updated successfully',
      company
    });
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ error: 'Failed to update company profile' });
  }
};

// Add user to company team (admin only)
const addUserToTeam = async (req, res) => {
  try {
    const { companyId, userId } = req.body;

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already in the team
    if (company.team.includes(userId)) {
      return res.status(400).json({ error: 'User is already in the team' });
    }

    // Add user to team
    company.team.push(userId);
    await company.save();

    // Update user's companyId
    user.companyId = companyId;
    await user.save();

    const updatedCompany = await Company.findById(companyId)
      .populate('team', 'name email role');

    res.json({
      message: 'User added to team successfully',
      company: updatedCompany
    });
  } catch (error) {
    console.error('Add user to team error:', error);
    res.status(500).json({ error: 'Failed to add user to team' });
  }
};

// Remove user from company team (admin only)
const removeUserFromTeam = async (req, res) => {
  try {
    const { companyId, userId } = req.body;

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user is in the team
    if (!company.team.includes(userId)) {
      return res.status(400).json({ error: 'User is not in the team' });
    }

    // Remove user from team
    company.team = company.team.filter(id => id.toString() !== userId);
    await company.save();

    // Update user's companyId
    await User.findByIdAndUpdate(userId, { companyId: null });

    const updatedCompany = await Company.findById(companyId)
      .populate('team', 'name email role');

    res.json({
      message: 'User removed from team successfully',
      company: updatedCompany
    });
  } catch (error) {
    console.error('Remove user from team error:', error);
    res.status(500).json({ error: 'Failed to remove user from team' });
  }
};

module.exports = {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyProfile,
  updateCompanyProfile,
  addUserToTeam,
  removeUserFromTeam
}; 