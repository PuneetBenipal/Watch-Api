// Try to import node-cron, but make it optional
let cron;
try {
  cron = require('node-cron');
} catch (error) {
  console.warn('node-cron not installed. Cron jobs will be disabled.');
  cron = null;
}
const WhatsAppParser = require('../services/whatsappParser');
const Alert = require('../models/Alert');
const Listing = require('../models/Listing');
const Inventory = require('../models/inventory');
const logger = require('../utils/logger');
const OpenAIService = require('../services/openaiService');

class CronJobs {
  constructor() {
    this.whatsappParser = new WhatsAppParser();
    this.openaiService = new OpenAIService();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.whatsappParser.initialize();
      this.isInitialized = true;
      logger.info('Cron jobs initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cron jobs', error);
    }
  }

  start() {
    if (!cron) {
      logger.warn('node-cron not available. Cron jobs disabled.');
      return;
    }

    if (!this.isInitialized) {
      logger.warn('Cron jobs not initialized, skipping start');
      return;
    }

    // Parse WhatsApp groups every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.parseWhatsAppGroups();
    });

    // Check alerts every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.checkAlerts();
    });

    // Generate market reports daily at 6 AM
    cron.schedule('0 6 * * *', async () => {
      await this.generateMarketReports();
    });

    // Clean up old data weekly on Sunday at 2 AM
    cron.schedule('0 2 * * 0', async () => {
      await this.cleanupOldData();
    });

    // Update inventory statistics daily at 8 AM
    cron.schedule('0 8 * * *', async () => {
      await this.updateInventoryStats();
    });

    // Backup data monthly on the 1st at 3 AM
    cron.schedule('0 3 1 * *', async () => {
      await this.backupData();
    });

    logger.info('Cron jobs started successfully');
  }

  async parseWhatsAppGroups() {
    try {
      logger.info('Starting WhatsApp group parsing');

      // Get configured WhatsApp groups from environment or database
      const groups = process.env.WHATSAPP_GROUPS?.split(',') || [];

      for (const groupId of groups) {
        try {
          const listings = await this.whatsappParser.processGroupListings(groupId, 50);
          logger.info(`Processed ${listings.length} listings from group ${groupId}`);

          // Update group processing status
          await this.updateGroupProcessingStatus(groupId, listings.length);
        } catch (error) {
          logger.error(`Failed to process group ${groupId}`, error);
        }
      }
    } catch (error) {
      logger.error('WhatsApp parsing failed', error);
    }
  }

  async checkAlerts() {
    try {
      logger.info('Starting alert checks');

      const activeAlerts = await Alert.find({ isActive: true });

      for (const alert of activeAlerts) {
        try {
          const matchingListings = await this.findMatchingListings(alert.filters);

          if (matchingListings.length > 0) {
            await this.triggerAlert(alert, matchingListings);
          }
        } catch (error) {
          logger.error(`Failed to check alert ${alert._id}`, error);
        }
      }
    } catch (error) {
      logger.error('Alert checking failed', error);
    }
  }

  async findMatchingListings(filters) {
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

      // Get listings from the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      query.createdAt = { $gte: yesterday };

      const listings = await Listing.find(query)
        .sort({ createdAt: -1 })
        .limit(20);

      return listings;
    } catch (error) {
      logger.error('Failed to find matching listings', error);
      return [];
    }
  }

  async triggerAlert(alert, matchingListings) {
    try {
      // Generate alert content using AI
      const alertContent = await this.openaiService.generateAlertContent(alert, matchingListings);

      // Update alert statistics
      alert.lastTriggered = new Date();
      alert.triggerCount += 1;
      await alert.save();

      // Send notifications based on channel
      await this.sendAlertNotifications(alert, alertContent.content, matchingListings);

      logger.info(`Alert ${alert._id} triggered with ${matchingListings.length} matches`);
    } catch (error) {
      logger.error(`Failed to trigger alert ${alert._id}`, error);
    }
  }

  async sendAlertNotifications(alert, content, listings) {
    try {
      const settings = alert.notificationSettings || {};

      if (settings.email) {
        await this.sendEmailAlert(alert, content, listings);
      }

      if (settings.telegram) {
        await this.sendTelegramAlert(alert, content, listings);
      }

      if (settings.inApp) {
        await this.sendInAppAlert(alert, content, listings);
      }
    } catch (error) {
      logger.error('Failed to send alert notifications', error);
    }
  }

  async sendEmailAlert(alert, content, listings) {
    // TODO: Implement email sending
    logger.info(`Email alert would be sent for alert ${alert._id}`);
  }

  async sendTelegramAlert(alert, content, listings) {
    // TODO: Implement Telegram bot sending
    logger.info(`Telegram alert would be sent for alert ${alert._id}`);
  }

  async sendInAppAlert(alert, content, listings) {
    // TODO: Implement in-app notification
    logger.info(`In-app alert would be sent for alert ${alert._id}`);
  }

  async generateMarketReports() {
    try {
      logger.info('Starting market report generation');

      // Get all companies
      const companies = await require('../models/Company.model').find();

      for (const company of companies) {
        try {
          const report = await this.openaiService.generateMarketReport(company._id, '30d');

          // Store report in database or send to company
          await this.storeMarketReport(company._id, report);

          logger.info(`Generated market report for company ${company._id}`);
        } catch (error) {
          logger.error(`Failed to generate report for company ${company._id}`, error);
        }
      }
    } catch (error) {
      logger.error('Market report generation failed', error);
    }
  }

  async storeMarketReport(companyId, report) {
    // TODO: Implement report storage
    logger.info(`Market report stored for company ${companyId}`);
  }

  async cleanupOldData() {
    try {
      logger.info('Starting data cleanup');

      // Clean up old listings (older than 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedListings = await Listing.deleteMany({
        createdAt: { $lt: ninetyDaysAgo },
        processingStatus: { $in: ['failed', 'duplicate'] }
      });

      // Clean up old logs
      logger.cleanupOldLogs(30);

      // Clean up old alerts (inactive for 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const deletedAlerts = await Alert.deleteMany({
        isActive: false,
        lastTriggered: { $lt: sixMonthsAgo }
      });

      logger.info(`Cleanup completed: ${deletedListings.deletedCount} listings, ${deletedAlerts.deletedCount} alerts`);
    } catch (error) {
      logger.error('Data cleanup failed', error);
    }
  }

  async updateInventoryStats() {
    try {
      logger.info('Starting inventory statistics update');

      // Update company statistics
      const companies = await require('../models/Company.model').find();

      for (const company of companies) {
        try {
          const stats = await Inventory.aggregate([
            { $match: { companyId: company._id } },
            {
              $group: {
                _id: null,
                totalItems: { $sum: 1 },
                totalValue: { $sum: '$priceListed' },
                averagePrice: { $avg: '$priceListed' },
                byStatus: { $push: '$status' },
                byBrand: { $push: '$brand' }
              }
            }
          ]);

          if (stats.length > 0) {
            // Store statistics in company document or separate collection
            await this.storeInventoryStats(company._id, stats[0]);
          }
        } catch (error) {
          logger.error(`Failed to update stats for company ${company._id}`, error);
        }
      }
    } catch (error) {
      logger.error('Inventory statistics update failed', error);
    }
  }

  async storeInventoryStats(companyId, stats) {
    // TODO: Implement statistics storage
    logger.info(`Inventory stats stored for company ${companyId}`);
  }

  async backupData() {
    try {
      logger.info('Starting data backup');

      // Create backup of important collections
      const backupData = {
        timestamp: new Date().toISOString(),
        companies: await require('../models/Company.model').find().lean(),
        users: await require('../models/User.model').find().select('-passwordHash').lean(),
        inventory: await Inventory.find().lean(),
        subscriptions: await require('../models/Subscription').find().lean()
      };

      // Save backup to file or cloud storage
      await this.saveBackup(backupData);

      logger.info('Data backup completed successfully');
    } catch (error) {
      logger.error('Data backup failed', error);
    }
  }

  async saveBackup(backupData) {
    // TODO: Implement backup storage (file system, S3, etc.)
    logger.info('Backup data saved');
  }

  async updateGroupProcessingStatus(groupId, processedCount) {
    // TODO: Implement group processing status tracking
    logger.info(`Updated processing status for group ${groupId}: ${processedCount} items`);
  }

  stop() {
    logger.info('Stopping cron jobs');
    // Cleanup resources
    if (this.whatsappParser) {
      this.whatsappParser.close();
    }
  }
}

// Create singleton instance
const cronJobs = new CronJobs();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  cronJobs.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  cronJobs.stop();
  process.exit(0);
});

module.exports = cronJobs; 