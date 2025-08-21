const Alert = require('../models/Alert');
const Listing = require('../models/listing');
const OpenAIService = require('../services/openaiService');
const { asyncHandler } = require('../middlewares/error.middleware');

// Get all alerts for a user
const getAllAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, channel } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { userId: req.user._id };
    
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (channel) filter.channel = channel;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Alert.countDocuments(filter);

    res.json({
      alerts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get all alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
};

// Get single alert
const getAlert = async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await Alert.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to get alert' });
  }
};

// Create new alert
const createAlert = async (req, res) => {
  try {
    const {
      name,
      description,
      filters,
      channel = 'in-app',
      notificationSettings = {
        email: true,
        telegram: false,
        inApp: true
      }
    } = req.body;

    // Validate filters
    if (!filters || Object.keys(filters).length === 0) {
      return res.status(400).json({ error: 'Alert filters are required' });
    }

    const alert = new Alert({
      userId: req.user._id,
      name,
      description,
      filters,
      channel,
      notificationSettings,
      isActive: true,
      triggerCount: 0
    });

    await alert.save();

    res.status(201).json({
      message: 'Alert created successfully',
      alert
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
};

// Update alert
const updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.userId;
    delete updateData.triggerCount;
    delete updateData.lastTriggered;

    const alert = await Alert.findOneAndUpdate(
      {
        _id: id,
        userId: req.user._id
      },
      updateData,
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({
      message: 'Alert updated successfully',
      alert
    });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
};

// Delete alert
const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
};

// Toggle alert status
const toggleAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    alert.isActive = !alert.isActive;
    await alert.save();

    res.json({
      message: `Alert ${alert.isActive ? 'activated' : 'deactivated'} successfully`,
      alert
    });
  } catch (error) {
    console.error('Toggle alert status error:', error);
    res.status(500).json({ error: 'Failed to toggle alert status' });
  }
};

// Test alert with current listings
const testAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Find matching listings
    const matchingListings = await findMatchingListings(alert.filters);

    // Generate alert content using AI
    const openaiService = new OpenAIService();
    const alertContent = await openaiService.generateAlertContent(alert, matchingListings);

    res.json({
      message: 'Alert test completed',
      alert,
      matchingListings: matchingListings.length,
      alertContent: alertContent.content,
      listings: matchingListings.slice(0, 5) // Return first 5 listings
    });
  } catch (error) {
    console.error('Test alert error:', error);
    res.status(500).json({ error: 'Failed to test alert' });
  }
};

// Helper function to find matching listings
const findMatchingListings = async (filters) => {
  try {
    const query = { processingStatus: 'processed' };
    
    if (filters.brand) {
      query['parsed.brand'] = { $regex: filters.brand, $options: 'i' };
    }
    
    if (filters.model) {
      query['parsed.model'] = { $regex: filters.model, $options: 'i' };
    }
    
    if (filters.maxPrice) {
      query['parsed.price'] = { $lte: filters.maxPrice };
    }
    
    if (filters.minPrice) {
      query['parsed.price'] = { ...query['parsed.price'], $gte: filters.minPrice };
    }
    
    if (filters.country) {
      query['parsed.location'] = { $regex: filters.country, $options: 'i' };
    }
    
    if (filters.condition) {
      query['parsed.condition'] = { $regex: filters.condition, $options: 'i' };
    }
    
    if (filters.year) {
      query['parsed.year'] = filters.year;
    }
    
    if (filters.minYear) {
      query['parsed.year'] = { ...query['parsed.year'], $gte: filters.minYear };
    }
    
    if (filters.maxYear) {
      query['parsed.year'] = { ...query['parsed.year'], $lte: filters.maxYear };
    }

    // Get listings from the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query.createdAt = { $gte: weekAgo };

    const listings = await Listing.find(query)
      .sort({ createdAt: -1 })
      .limit(20);

    return listings;
  } catch (error) {
    console.error('Find matching listings error:', error);
    return [];
  }
};

// Get alert statistics
const getAlertStats = async (req, res) => {
  try {
    const stats = await Alert.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalAlerts: { $sum: 1 },
          activeAlerts: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalTriggers: { $sum: '$triggerCount' },
          byChannel: {
            $push: {
              channel: '$channel',
              count: 1
            }
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        totalAlerts: 0,
        activeAlerts: 0,
        totalTriggers: 0,
        byChannel: {}
      });
    }

    const stat = stats[0];
    
    // Process channel breakdown
    const channelBreakdown = {};
    stat.byChannel.forEach(item => {
      channelBreakdown[item.channel] = (channelBreakdown[item.channel] || 0) + item.count;
    });

    res.json({
      totalAlerts: stat.totalAlerts,
      activeAlerts: stat.activeAlerts,
      totalTriggers: stat.totalTriggers,
      byChannel: channelBreakdown
    });
  } catch (error) {
    console.error('Get alert stats error:', error);
    res.status(500).json({ error: 'Failed to get alert statistics' });
  }
};

module.exports = {
  getAllAlerts,
  getAlert,
  createAlert,
  updateAlert,
  deleteAlert,
  toggleAlertStatus,
  testAlert,
  getAlertStats
}; 