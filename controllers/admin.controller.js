const User = require('../models/User.model');
const Company = require('../models/Company.model');
const Inventory = require('../models/inventory');
const Invoice = require('../models/Invoice.model.js');
const Alert = require('../models/Alert');
const Listing = require('../models/listing');
const Subscription = require('../models/Subscription');
const WhatsAppParser = require('../services/whatsappParser');
const OpenAIService = require('../services/openaiService');
const logger = require('../utils/logger');
const cronJobs = require('../scripts/cronJobs');
const { asyncHandler } = require('../middlewares/error.middleware');

// Get system statistics
const getSystemStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalCompanies,
      totalInventory,
      totalInvoices,
      totalAlerts,
      totalListings,
      totalSubscriptions,
      activeSubscriptions
    ] = await Promise.all([
      User.countDocuments(),
      Company.countDocuments(),
      Inventory.countDocuments(),
      Invoice.countDocuments(),
      Alert.countDocuments(),
      Listing.countDocuments(),
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: 'active' })
    ]);

    // Get recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      newUsers,
      newInventory,
      newInvoices,
      newListings
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Inventory.countDocuments({ createdAt: { $gte: weekAgo } }),
      Invoice.countDocuments({ createdAt: { $gte: weekAgo } }),
      Listing.countDocuments({ createdAt: { $gte: weekAgo } })
    ]);

    res.json({
      overview: {
        totalUsers,
        totalCompanies,
        totalInventory,
        totalInvoices,
        totalAlerts,
        totalListings,
        totalSubscriptions,
        activeSubscriptions
      },
      recentActivity: {
        newUsers,
        newInventory,
        newInvoices,
        newListings
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Failed to get system statistics' });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, companyId } = req.query;
    const skip = (page - 1) * limit;

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

// Get all companies (admin only)
const getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 20, plan } = req.query;
    const skip = (page - 1) * limit;

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

// Get system logs
const getSystemLogs = async (req, res) => {
  try {
    const { level, startDate, endDate, limit = 100 } = req.query;

    const filter = {};
    if (level) filter.level = level;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await logger.getLogStats(filter, parseInt(limit));

    res.json({ logs });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: 'Failed to get system logs' });
  }
};

// Cleanup old data
const cleanupOldData = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    // Clean up old listings
    const deletedListings = await Listing.deleteMany({
      createdAt: { $lt: cutoffDate },
      processingStatus: { $in: ['failed', 'duplicate'] }
    });

    // Clean up old logs
    logger.cleanupOldLogs(parseInt(days));

    // Clean up old alerts (inactive for 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const deletedAlerts = await Alert.deleteMany({
      isActive: false,
      lastTriggered: { $lt: sixMonthsAgo }
    });

    res.json({
      message: 'Data cleanup completed successfully',
      deletedListings: deletedListings.deletedCount,
      deletedAlerts: deletedAlerts.deletedCount
    });
  } catch (error) {
    console.error('Cleanup old data error:', error);
    res.status(500).json({ error: 'Failed to cleanup old data' });
  }
};

// Start cron jobs (super admin only)
const startCronJobs = async (req, res) => {
  try {
    await cronJobs.initialize();
    cronJobs.start();

    res.json({ message: 'Cron jobs started successfully' });
  } catch (error) {
    console.error('Start cron jobs error:', error);
    res.status(500).json({ error: 'Failed to start cron jobs' });
  }
};

// Stop cron jobs (super admin only)
const stopCronJobs = async (req, res) => {
  try {
    cronJobs.stop();

    res.json({ message: 'Cron jobs stopped successfully' });
  } catch (error) {
    console.error('Stop cron jobs error:', error);
    res.status(500).json({ error: 'Failed to stop cron jobs' });
  }
};

// Manual WhatsApp parsing
const manualWhatsAppParsing = async (req, res) => {
  try {
    const { groupId, limit = 50 } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const whatsappParser = new WhatsAppParser();
    await whatsappParser.initialize();

    const listings = await whatsappParser.processGroupListings(groupId, limit);

    res.json({
      message: 'WhatsApp parsing completed successfully',
      processedListings: listings.length,
      listings
    });
  } catch (error) {
    console.error('Manual WhatsApp parsing error:', error);
    res.status(500).json({ error: 'Failed to parse WhatsApp messages' });
  }
};

// Generate market report
const generateMarketReport = async (req, res) => {
  try {
    const { companyId, period = '30d' } = req.body;

    const openaiService = new OpenAIService();
    const report = await openaiService.generateMarketReport(companyId, period);

    res.json({
      message: 'Market report generated successfully',
      report
    });
  } catch (error) {
    console.error('Generate market report error:', error);
    res.status(500).json({ error: 'Failed to generate market report' });
  }
};

// System health check
const systemHealthCheck = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check database connection
    try {
      await require('../config/db').connectDB();
      health.services.database = 'connected';
    } catch (error) {
      health.services.database = 'disconnected';
      health.status = 'unhealthy';
    }

    // Check Stripe connection
    try {
      const stripeService = new (require('../services/stripeService'))();
      await stripeService.getPlanPricing();
      health.services.stripe = 'connected';
    } catch (error) {
      health.services.stripe = 'disconnected';
      health.status = 'unhealthy';
    }

    // Check OpenAI connection
    try {
      const openaiService = new OpenAIService();
      await openaiService.validateWatchAuthenticity('test');
      health.services.openai = 'connected';
    } catch (error) {
      health.services.openai = 'disconnected';
      health.status = 'unhealthy';
    }

    // Check cron jobs
    health.services.cronJobs = cronJobs.isInitialized ? 'running' : 'stopped';

    res.json(health);
  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
};

// Update system settings (super admin only)
const updateSystemSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    // Update environment variables or settings in database
    // This is a placeholder - implement based on your settings management
    console.log('System settings update:', settings);

    res.json({
      message: 'System settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
};

// Get subscription analytics
const getSubscriptionAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const analytics = await Subscription.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'active'] },
                { $switch: {
                  branches: [
                    { case: { $eq: ['$plan', 'Basic'] }, then: 29 },
                    { case: { $eq: ['$plan', 'Pro'] }, then: 99 },
                    { case: { $eq: ['$plan', 'Premium'] }, then: 299 }
                  ],
                  default: 0
                }},
                0
              ]
            }
          }
        }
      }
    ]);

    // Calculate conversion rates
    const totalSubscriptions = analytics.reduce((sum, item) => sum + item.count, 0);
    const totalActive = analytics.reduce((sum, item) => sum + item.activeCount, 0);
    const totalRevenue = analytics.reduce((sum, item) => sum + item.totalRevenue, 0);

    res.json({
      analytics,
      summary: {
        totalSubscriptions,
        totalActive,
        conversionRate: totalSubscriptions > 0 ? (totalActive / totalSubscriptions * 100).toFixed(2) : 0,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Get subscription analytics error:', error);
    res.status(500).json({ error: 'Failed to get subscription analytics' });
  }
};

module.exports = {
  getSystemStats,
  getAllUsers,
  getAllCompanies,
  getSystemLogs,
  cleanupOldData,
  startCronJobs,
  stopCronJobs,
  manualWhatsAppParsing,
  generateMarketReport,
  systemHealthCheck,
  updateSystemSettings,
  getSubscriptionAnalytics
}; 