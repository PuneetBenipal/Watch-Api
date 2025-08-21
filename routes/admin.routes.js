const express = require("express");
const router = express.Router();
const { isAuth, isAdmin, isSuperAdmin } = require("../middlewares/auth.middleware");
const User = require("../models/User.model");
const Company = require("../models/Company.model");
const { Inventory } = require("../models/inventory");
const Invoice = require("../models/Invoice.model.js");
const Alert = require("../models/Alert");
const Listing = require("../models/Listing.js");
const Subscription = require("../models/Subscription");
const cronJobs = require("../scripts/cronJobs");
const TradeDeal = require("../models/TradeDeal");
const DiscountCode = require("../models/DiscountCode");
const ExchangeRate = require("../models/ExchangeRate");

// All routes require authentication and admin role
// router.use(isAuth);
// router.use(isAdmin);

// Get system statistics
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers,
      totalCompanies,
      totalInventory,
      totalInvoices,
      totalAlerts,
      totalListings,
      totalSubscriptions
    ] = await Promise.all([
      User.countDocuments(),
      Company.countDocuments(),
      Inventory.countDocuments(),
      Invoice.countDocuments(),
      Alert.countDocuments(),
      Listing.countDocuments(),
      Subscription.countDocuments()
    ]);

    res.json({
      stats: {
        totalUsers,
        totalCompanies,
        totalInventory,
        totalInvoices,
        totalAlerts,
        totalListings,
        totalSubscriptions
      }
    });
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({ error: "Failed to get system statistics" });
  }
});

// Get all users (admin only)
router.get("/users", async (req, res) => {
  try {
    console.log("Admin: Fetching users...");
    const { page = 1, limit = 20, role, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    console.log("Admin: Filter:", filter);

    const users = await User.find(filter)
      .select("status subscriptionStatus fullName email role defaultCurrency region createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log(`Admin: Found ${users.length} users`);

    // Format user data for display
    const formattedUsers = users.map(user => ({
      id: user._id,
      status: user.status || "online",
      subscription: user.subscriptionStatus || "active",
      name: user.name || user.fullName,
      email: user.email,
      role: user.role || "user",
      defaultCurrency: user.defaultCurrency || "USD",
      region: user.region || "UAE",
      created: user.createdAt ? user.createdAt.toISOString() : null,
      updated: user.updatedAt ? user.updatedAt.toISOString() : null,
      // Also include original field names for compatibility
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null
    }));

    const total = await User.countDocuments(filter);

    console.log(`Admin: Total users: ${total}`);

    res.json({
      users: formattedUsers,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error("Get admin users error:", error);
    res.status(500).json({ error: "Failed to get users", details: error.message });
  }
});

// Get specific user details
router.get("/users/:userId/details", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-passwordHash")
      .populate("companyId");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get additional user details
    const userDetails = {
      ...user.toObject(),
      subscriptionStatus: user.subscriptionStatus || "active",
      usageCount: user.usageCount || 0,
      lastLogin: user.lastLogin || user.updatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json(userDetails);
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({ error: "Failed to get user details" });
  }
});

// Get user payment history
router.get("/users/:userId/payments", async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get payment history from Invoice model
    const payments = await Invoice.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    // Format payment data
    const paymentHistory = payments.map(payment => ({
      id: payment._id,
      date: payment.createdAt,
      amount: payment.totalAmount || payment.amount || 0,
      status: payment.status || "completed",
      method: payment.paymentMethod || "credit_card",
      description: payment.description || "Subscription payment"
    }));

    res.json(paymentHistory);
  } catch (error) {
    console.error("Get user payment history error:", error);
    res.status(500).json({ error: "Failed to get payment history" });
  }
});

// Get user modules
router.get("/users/:userId/modules", async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Default modules configuration
    const defaultModules = [
      { id: "analytics", name: "Analytics", enabled: user.role === "admin" },
      { id: "chat", name: "Chat Support", enabled: true },
      { id: "reports", name: "Reports", enabled: user.role === "admin" },
      { id: "api", name: "API Access", enabled: user.role === "admin" },
      { id: "export", name: "Data Export", enabled: user.role === "admin" },
      { id: "advanced", name: "Advanced Features", enabled: user.role === "admin" }
    ];

    res.json(defaultModules);
  } catch (error) {
    console.error("Get user modules error:", error);
    res.status(500).json({ error: "Failed to get user modules" });
  }
});

// Update user module
router.put("/users/:userId/modules/:moduleId", async (req, res) => {
  try {
    const { userId, moduleId } = req.params;
    const { enabled } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // In a real implementation, you would store module permissions in the database
    // For now, we"ll just return success
    res.json({
      message: `Module ${moduleId} ${enabled ? "enabled" : "disabled"} successfully`,
      moduleId,
      enabled
    });
  } catch (error) {
    console.error("Update user module error:", error);
    res.status(500).json({ error: "Failed to update user module" });
  }
});

// Get user settings
router.get("/users/:userId/settings", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Default user settings
    const userSettings = {
      theme: user.settings?.theme || "auto",
      notifications: user.settings?.notifications || "all",
      language: user.settings?.language || "en",
      timezone: user.settings?.timezone || "UTC"
    };

    res.json(userSettings);
  } catch (error) {
    console.error("Get user settings error:", error);
    res.status(500).json({ error: "Failed to get user settings" });
  }
});

// Update user settings
router.put("/users/:userId/settings", async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user settings
    user.settings = { ...user.settings, ...settings };
    await user.save();

    res.json({
      message: "User settings updated successfully",
      settings: user.settings
    });
  } catch (error) {
    console.error("Update user settings error:", error);
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

// Update user status
router.put("/users/:userId/status", async (req, res) => {
  try {
    console.log("Admin: Updating user status...", req.params.userId, req.body);
    const { userId } = req.params;
    const { status } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      console.log("Admin: User not found for status update:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    user.status = status;
    await user.save();
    console.log("Admin: User status updated successfully:", userId, status);

    res.json({
      message: "User status updated successfully",
      user: {
        id: user._id,
        name: user.name || user.fullName,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({ error: "Failed to update user status", details: error.message });
  }
});

// Update user
router.put("/users/:userId", async (req, res) => {
  try {
    console.log("Admin: Updating user...", req.params.userId, req.body);
    const { userId } = req.params;
    const { name, email, role, status } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      console.log("Admin: User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (status) user.status = status;

    await user.save();
    console.log("Admin: User updated successfully:", userId);

    res.json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name || user.fullName,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user", details: error.message });
  }
});

// Delete user

// router.get("/users") 
router.delete("/users/:userId", async (req, res) => {
  try {
    console.log("Admin: Deleting user...", req.params.userId);
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      console.log("Admin: User not found for deletion:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    await User.findByIdAndDelete(userId);
    console.log("Admin: User deleted successfully:", userId);

    res.json({
      message: "User deleted successfully",
      userId
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user", details: error.message });
  }
});

// Discount Codes Management

// Temporarily allow unauthenticated access for testing - COMMENT OUT THESE LINES FOR PRODUCTION
router.get("/discount-codes", async (req, res) => {
  try {
    console.log("Admin: Fetching discount codes...");

    // First, disable any expired codes
    await DiscountCode.disableExpiredCodes();

    const discountCodes = await DiscountCode.find().sort({ createdAt: -1 });
    console.log(`Admin: Found ${discountCodes.length} discount codes`);

    // Transform the data to match frontend expectations
    const transformedCodes = discountCodes.map(code => ({
      id: code._id.toString(),
      code: code.code,
      discount: code.discountPercent,
      active: code.isActive(), // Use the method to check if code is actually active
      createdAt: code.createdAt,
      expiresAt: code.expiresAt
    }));

    res.json(transformedCodes);
  } catch (error) {
    console.error("Get discount codes error:", error);
    res.status(500).json({ error: "Failed to get discount codes" });
  }
});

// Generate a random 16-digit code
const generateRandomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

router.post("/discount-codes", async (req, res) => {
  try {
    const { code, discount, expiresAt } = req.body;

    console.log("Admin: Creating discount code...", { code, discount, expiresAt });

    // Validate required fields
    if (!discount || discount < 1 || discount > 100) {
      return res.status(400).json({ error: "Discount percentage must be between 1 and 100" });
    }

    if (!expiresAt) {
      return res.status(400).json({ error: "Expiry date is required" });
    }

    // Validate expiry date - must be in the future
    const selectedDate = new Date(expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

    if (selectedDate <= today) {
      return res.status(400).json({ error: "Expiry date must be in the future" });
    }

    // Generate code if not provided
    const finalCode = code || generateRandomCode();

    // Check if code already exists
    const existingCode = await DiscountCode.findOne({ code: finalCode });
    if (existingCode) {
      return res.status(400).json({ error: "Discount code already exists" });
    }

    // Create new discount code
    const newDiscountCode = new DiscountCode({
      code: finalCode,
      discountPercent: parseInt(discount),
      expiresAt: new Date(expiresAt),
      active: true
    });

    const savedCode = await newDiscountCode.save();
    console.log("Admin: Discount code created with ID:", savedCode._id);

    res.status(201).json({
      id: savedCode._id.toString(),
      code: savedCode.code,
      discount: savedCode.discountPercent,
      active: savedCode.isActive(),
      createdAt: savedCode.createdAt,
      expiresAt: savedCode.expiresAt
    });
  } catch (error) {
    console.error("Create discount code error:", error);
    res.status(500).json({ error: "Failed to create discount code" });
  }
});

router.delete("/discount-codes/:codeId", async (req, res) => {
  try {
    const { codeId } = req.params;

    console.log("Admin: Deleting discount code...", codeId);

    const deletedCode = await DiscountCode.findByIdAndDelete(codeId);
    if (!deletedCode) {
      return res.status(404).json({ error: "Discount code not found" });
    }

    console.log("Admin: Discount code deleted successfully:", codeId);
    res.json({
      message: "Discount code deleted successfully",
      codeId
    });
  } catch (error) {
    console.error("Delete discount code error:", error);
    res.status(500).json({ error: "Failed to delete discount code" });
  }
});

// New route to manually disable a discount code
router.patch("/discount-codes/:codeId/toggle", async (req, res) => {
  try {
    const { codeId } = req.params;
    const { active } = req.body;

    console.log("Admin: Toggling discount code status...", { codeId, active });

    const discountCode = await DiscountCode.findById(codeId);
    if (!discountCode) {
      return res.status(404).json({ error: "Discount code not found" });
    }

    // If trying to activate an expired code, return error
    if (active && discountCode.isExpired()) {
      return res.status(400).json({ error: "Cannot activate an expired discount code" });
    }

    discountCode.active = active;
    await discountCode.save();

    console.log("Admin: Discount code status updated successfully:", codeId);
    res.json({
      id: discountCode._id.toString(),
      code: discountCode.code,
      discount: discountCode.discountPercent,
      active: discountCode.isActive(),
      createdAt: discountCode.createdAt,
      expiresAt: discountCode.expiresAt
    });
  } catch (error) {
    console.error("Toggle discount code error:", error);
    res.status(500).json({ error: "Failed to toggle discount code status" });
  }
});

// Revenue Analytics
router.get("/revenue", async (req, res) => {
  try {
    // Get revenue data from invoices
    const revenueData = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          mrr: { $sum: { $cond: [{ $eq: ["$status", "active"] }, "$totalAmount", 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    const revenue = revenueData[0] || { total: 0, mrr: 0, count: 0 };

    res.json({
      total: revenue.total || 0,
      mrr: revenue.mrr || 0,
      churnRate: 5.2, // Sample data
      trends: {
        monthly: [12000, 13500, 14200, 13800, 15600, 16200],
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
      }
    });
  } catch (error) {
    console.error("Get revenue data error:", error);
    res.status(500).json({ error: "Failed to get revenue data" });
  }
});

// Exchange Rates
router.get("/exchange-rates", async (req, res) => {
  try {
    console.log("Admin: Fetching exchange rates...");

    // Get the latest exchange rates from database
    const exchangeRates = await ExchangeRate.getLatest();

    console.log("Admin: Found exchange rates:", exchangeRates.toFrontendFormat());
    res.json(exchangeRates.toFrontendFormat());
  } catch (error) {
    console.error("Get exchange rates error:", error);
    res.status(500).json({ error: "Failed to get exchange rates" });
  }
});

router.put("/exchange-rates", async (req, res) => {
  try {
    const { usdToEur, usdToGbp, usdToJpy, globalTaxRate, defaultCurrency, autoUpdate } = req.body;

    console.log("Admin: Updating exchange rates...", { usdToEur, usdToGbp, usdToJpy, globalTaxRate, defaultCurrency, autoUpdate });

    // Validate input
    if (usdToEur && (isNaN(usdToEur) || usdToEur < 0)) {
      return res.status(400).json({ error: "USD to EUR rate must be a positive number" });
    }
    if (usdToGbp && (isNaN(usdToGbp) || usdToGbp < 0)) {
      return res.status(400).json({ error: "USD to GBP rate must be a positive number" });
    }
    if (usdToJpy && (isNaN(usdToJpy) || usdToJpy < 0)) {
      return res.status(400).json({ error: "USD to JPY rate must be a positive number" });
    }
    if (globalTaxRate && (isNaN(globalTaxRate) || globalTaxRate < 0 || globalTaxRate > 100)) {
      return res.status(400).json({ error: "Global tax rate must be between 0 and 100" });
    }
    if (defaultCurrency && !["USD", "EUR", "GBP", "JPY"].includes(defaultCurrency)) {
      return res.status(400).json({ error: "Invalid default currency" });
    }

    // Create new exchange rate entry
    const newExchangeRate = new ExchangeRate({
      usdToEur: parseFloat(usdToEur) || 0.85,
      usdToGbp: parseFloat(usdToGbp) || 0.73,
      usdToJpy: parseFloat(usdToJpy) || 110.0,
      globalTaxRate: parseFloat(globalTaxRate) || 0,
      defaultCurrency: defaultCurrency || "USD",
      autoUpdate: autoUpdate !== undefined ? autoUpdate : true,
      source: "manual",
      lastUpdated: new Date()
    });

    await newExchangeRate.save();
    console.log("Admin: Exchange rates updated successfully:", newExchangeRate._id);

    res.json({
      message: "Exchange rates updated successfully",
      rates: newExchangeRate.toFrontendFormat()
    });
  } catch (error) {
    console.error("Update exchange rates error:", error);
    res.status(500).json({ error: "Failed to update exchange rates" });
  }
});

// New route to update exchange rates from external API
router.post("/exchange-rates/update-from-api", async (req, res) => {
  try {
    console.log("Admin: Updating exchange rates from external API...");

    const updatedRates = await ExchangeRate.updateFromAPI();

    res.json({
      message: "Exchange rates updated from API successfully",
      rates: updatedRates.toFrontendFormat()
    });
  } catch (error) {
    console.error("Update exchange rates from API error:", error);
    res.status(500).json({ error: "Failed to update exchange rates from API" });
  }
});

// New route to get exchange rate history
router.get("/exchange-rates/history", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const rates = await ExchangeRate.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ExchangeRate.countDocuments();

    const formattedRates = rates.map(rate => rate.toFrontendFormat());

    res.json({
      rates: formattedRates,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error("Get exchange rate history error:", error);
    res.status(500).json({ error: "Failed to get exchange rate history" });
  }
});

// New route to clear exchange rate history
router.delete("/exchange-rates/history", async (req, res) => {
  try {
    console.log("Admin: Clearing exchange rate history...");

    // Keep only the latest rate entry
    const latestRate = await ExchangeRate.findOne().sort({ createdAt: -1 });

    if (!latestRate) {
      return res.status(404).json({ error: "No exchange rates found" });
    }

    // Delete all rates except the latest one
    const result = await ExchangeRate.deleteMany({
      _id: { $ne: latestRate._id }
    });

    console.log(`Admin: Cleared ${result.deletedCount} exchange rate history entries`);

    res.json({
      message: `Cleared ${result.deletedCount} exchange rate history entries`,
      remainingRates: 1
    });
  } catch (error) {
    console.error("Clear exchange rate history error:", error);
    res.status(500).json({ error: "Failed to clear exchange rate history" });
  }
});

// Get all companies (admin only)
router.get("/companies", async (req, res) => {
  try {
    const { page = 1, limit = 20, plan } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (plan) filter.plan = plan;

    const companies = await Company.find(filter)
      .populate("team", "name email role")
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
    console.error("Get admin companies error:", error);
    res.status(500).json({ error: "Failed to get companies" });
  }
});

// Get system logs
router.get("/logs", async (req, res) => {
  try {
    const logger = require("../utils/logger");
    const logStats = logger.getLogStats();

    res.json({ logStats });
  } catch (error) {
    console.error("Get admin logs error:", error);
    res.status(500).json({ error: "Failed to get system logs" });
  }
});

// Clean up old data (admin only)
router.post("/cleanup", async (req, res) => {
  try {
    const { days = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Clean up old listings
    const deletedListings = await Listing.deleteMany({
      createdAt: { $lt: cutoffDate },
      processingStatus: { $in: ["failed", "duplicate"] }
    });

    // Clean up old alerts
    const deletedAlerts = await Alert.deleteMany({
      isActive: false,
      lastTriggered: { $lt: cutoffDate }
    });

    // Clean up old logs
    const logger = require("../utils/logger");
    logger.cleanupOldLogs(30);

    res.json({
      message: "Cleanup completed successfully",
      deletedListings: deletedListings.deletedCount,
      deletedAlerts: deletedAlerts.deletedCount
    });
  } catch (error) {
    console.error("Admin cleanup error:", error);
    res.status(500).json({ error: "Failed to perform cleanup" });
  }
});

// Start/stop cron jobs (super admin only)
router.post("/cron/start", isSuperAdmin, async (req, res) => {
  try {
    await cronJobs.initialize();
    cronJobs.start();

    res.json({ message: "Cron jobs started successfully" });
  } catch (error) {
    console.error("Start cron jobs error:", error);
    res.status(500).json({ error: "Failed to start cron jobs" });
  }
});

router.post("/cron/stop", isSuperAdmin, async (req, res) => {
  try {
    cronJobs.stop();

    res.json({ message: "Cron jobs stopped successfully" });
  } catch (error) {
    console.error("Stop cron jobs error:", error);
    res.status(500).json({ error: "Failed to stop cron jobs" });
  }
});

// Manual WhatsApp parsing (admin only)
router.post("/parse-whatsapp", async (req, res) => {
  try {
    const { groupId, limit = 50 } = req.body;

    const WhatsAppParser = require("../services/whatsappParser");
    const parser = new WhatsAppParser();
    await parser.initialize();

    const listings = await parser.processGroupListings(groupId, limit);

    res.json({
      message: `Processed ${listings.length} listings from WhatsApp group`,
      listings
    });
  } catch (error) {
    console.error("Manual WhatsApp parsing error:", error);
    res.status(500).json({ error: "Failed to parse WhatsApp group" });
  }
});

// Generate market report (admin only)
router.post("/market-report", async (req, res) => {
  try {
    const { companyId, timeRange = "30d" } = req.body;

    const OpenAIService = require("../services/openaiService");
    const openaiService = new OpenAIService();

    const report = await openaiService.generateMarketReport(companyId, timeRange);

    res.json({
      message: "Market report generated successfully",
      report
    });
  } catch (error) {
    console.error("Generate market report error:", error);
    res.status(500).json({ error: "Failed to generate market report" });
  }
});

// System health check
router.get("/health", async (req, res) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      services: {
        whatsappParser: "available",
        openaiService: "available",
        stripeService: "available",
        pdfGenerator: "available"
      }
    };

    // Check database connection
    try {
      await User.findOne().limit(1);
    } catch (error) {
      health.database = "disconnected";
      health.status = "unhealthy";
    }

    res.json({ health });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      health: {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

// Update system settings (super admin only)
router.put("/settings", isSuperAdmin, async (req, res) => {
  try {
    const {
      whatsappGroups,
      openaiApiKey,
      stripeSecretKey,
      adminRegistrationCode
    } = req.body;

    // Update environment variables or settings
    // This would typically be done through a settings management system
    // For now, we"ll just return success

    res.json({
      message: "System settings updated successfully",
      updated: Object.keys(req.body)
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Failed to update system settings" });
  }
});

// Get subscription analytics (admin only)
router.get("/subscriptions/analytics", async (req, res) => {
  try {
    const analytics = await Subscription.aggregate([
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
          },
          trialingSubscriptions: {
            $sum: { $cond: [{ $eq: ["$status", "trialing"] }, 1, 0] }
          },
          canceledSubscriptions: {
            $sum: { $cond: [{ $eq: ["$status", "canceled"] }, 1, 0] }
          },
          byPlan: {
            $push: {
              plan: "$plan",
              count: 1
            }
          }
        }
      }
    ]);

    if (analytics.length === 0) {
      return res.json({
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        trialingSubscriptions: 0,
        canceledSubscriptions: 0,
        byPlan: {}
      });
    }

    const stat = analytics[0];

    // Process plan breakdown
    const planBreakdown = {};
    stat.byPlan.forEach(item => {
      planBreakdown[item.plan] = (planBreakdown[item.plan] || 0) + 1;
    });

    res.json({
      totalSubscriptions: stat.totalSubscriptions,
      activeSubscriptions: stat.activeSubscriptions,
      trialingSubscriptions: stat.trialingSubscriptions,
      canceledSubscriptions: stat.canceledSubscriptions,
      byPlan: planBreakdown
    });
  } catch (error) {
    console.error("Get subscription analytics error:", error);
    res.status(500).json({ error: "Failed to get subscription analytics" });
  }
});

// TRADE DEALS ROUTES
router.get("/trade-deals", async (req, res) => {
  try {
    console.log("Admin: Fetching trade deals...");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const tradeDeals = await TradeDeal.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await TradeDeal.countDocuments();
    const totalPages = Math.ceil(total / limit);

    console.log(`Admin: Found ${tradeDeals.length} trade deals (page ${page}/${totalPages})`);
    res.json({
      deals: tradeDeals,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error("Admin trade deals error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.post("/trade-deals", async (req, res) => {
  try {
    console.log("Admin: Creating trade deal...");
    console.log("Admin: Trade deal data:", req.body);
    const tradeDeal = new TradeDeal(req.body);
    const savedTradeDeal = await tradeDeal.save();
    console.log("Admin: Trade deal created with ID:", savedTradeDeal._id);
    res.status(201).json(savedTradeDeal);
  } catch (error) {
    console.error("Admin trade deal creation error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.put("/trade-deals/:id", async (req, res) => {
  try {
    console.log("Admin: Updating trade deal...");
    const updatedTradeDeal = await TradeDeal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedTradeDeal) {
      return res.status(404).json({ error: "Trade deal not found" });
    }
    console.log("Admin: Trade deal updated successfully");
    res.json(updatedTradeDeal);
  } catch (error) {
    console.error("Admin trade deal update error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.delete("/trade-deals/:id", async (req, res) => {
  try {
    console.log("Admin: Deleting trade deal...");
    const deletedTradeDeal = await TradeDeal.findByIdAndDelete(req.params.id);
    if (!deletedTradeDeal) {
      return res.status(404).json({ error: "Trade deal not found" });
    }
    console.log("Admin: Trade deal deleted successfully");
    res.sendStatus(204);
  } catch (error) {
    console.error("Admin trade deal deletion error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get trade deals analytics
router.get("/trade-deals/analytics", async (req, res) => {
  try {
    console.log("Admin: Fetching trade deals analytics...");

    const totalDeals = await TradeDeal.countDocuments();
    const completedDeals = await TradeDeal.countDocuments({ status: "Completed" });
    const pendingDeals = await TradeDeal.countDocuments({ status: "Pending" });
    const forwardedDeals = await TradeDeal.countDocuments({ status: "Forwarded" });

    // Calculate total value from all deals
    const valueResult = await TradeDeal.aggregate([
      { $group: { _id: null, total: { $sum: "$deal_value" } } }
    ]);
    const totalValue = valueResult[0]?.total || 0;

    // Calculate total profit
    const profitResult = await TradeDeal.aggregate([
      { $group: { _id: null, total: { $sum: "$profit" } } }
    ]);
    const totalProfit = profitResult[0]?.total || 0;

    // Calculate total commission
    const commissionResult = await TradeDeal.aggregate([
      { $group: { _id: null, total: { $sum: "$commission" } } }
    ]);
    const totalCommission = commissionResult[0]?.total || 0;

    const analytics = {
      total_deals: totalDeals,
      completed_deals: completedDeals,
      pending_deals: pendingDeals,
      forwarded_deals: forwardedDeals,
      total_value: totalValue,
      total_profit: totalProfit,
      total_commission: totalCommission
    };

    console.log("Admin: Trade deals analytics:", analytics);
    res.json(analytics);
  } catch (error) {
    console.error("Admin trade deals analytics error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router; 