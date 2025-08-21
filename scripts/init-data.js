const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Setting = require('../models/Setting');
const DiscountCode = require('../models/DiscountCode');
const User = require('../models/User.model');
const Invoice = require('../models/Invoice.model.js');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mydatabase', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize default settings
const initSettings = async () => {
  try {
    console.log('📝 Initializing default settings...');

    const defaultSettings = [
      { name: 'site_name', value: 'WhatsApp Trade Deals' },
      { name: 'site_description', value: 'Platform for trading luxury items' },
      { name: 'contact_email', value: 'admin@example.com' },
      { name: 'max_listings_per_user', value: '10' },
      { name: 'auto_approve_listings', value: 'false' }
    ];

    for (const setting of defaultSettings) {
      await Setting.findOneAndUpdate(
        { name: setting.name },
        setting,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Settings initialized');
  } catch (error) {
    console.error('❌ Error initializing settings:', error);
  }
};

// Initialize sample discount codes
const initDiscountCodes = async () => {
  try {
    console.log('🎫 Initializing sample discount codes...');

    const sampleDiscounts = [
      {
        code: 'WELCOME10',
        description: 'Welcome discount for new users',
        discountPercent: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        usageLimit: 100,
        usedCount: 0
      },
      {
        code: 'LUXURY20',
        description: 'Luxury items discount',
        discountPercent: 20,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        usageLimit: 50,
        usedCount: 0
      }
    ];

    for (const discount of sampleDiscounts) {
      await DiscountCode.findOneAndUpdate(
        { code: discount.code },
        discount,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Discount codes initialized');
  } catch (error) {
    console.error('❌ Error initializing discount codes:', error);
  }
};

// Initialize sample invoices
const initInvoices = async () => {
  try {
    console.log('📄 Initializing sample invoices...');

    // Get a user to associate invoices with
    const user = await User.findOne();
    if (!user) {
      console.log('⚠️ No users found, skipping invoice initialization');
      return;
    }

    const sampleInvoices = [
      {
        userId: user._id,
        buyer: 'John Doe',
        seller: 'Jane Smith',
        amount: 1500,
        currency: 'USD',
        status: 'completed',
        pdfUrl: '/invoices/sample1.pdf'
      },
      {
        userId: user._id,
        buyer: 'Mike Johnson',
        seller: 'Sarah Wilson',
        amount: 2500,
        currency: 'USD',
        status: 'pending',
        pdfUrl: '/invoices/sample2.pdf'
      }
    ];

    for (const invoice of sampleInvoices) {
      await Invoice.findOneAndUpdate(
        {
          userId: invoice.userId,
          buyer: invoice.buyer,
          seller: invoice.seller,
          amount: invoice.amount
        },
        invoice,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Sample invoices initialized');
  } catch (error) {
    console.error('❌ Error initializing invoices:', error);
  }
};

// Main initialization function
const initializeData = async () => {
  try {
    console.log('🚀 Starting data initialization...');

    await connectDB();

    await initSettings();
    await initDiscountCodes();
    await initInvoices();

    console.log('✅ Data initialization completed!');

    // Show summary
    const userCount = await User.countDocuments();
    const settingCount = await Setting.countDocuments();
    const discountCount = await DiscountCode.countDocuments();
    const invoiceCount = await Invoice.countDocuments();

    console.log('\n📊 Data Summary:');
    console.log(`👥 Users: ${userCount}`);
    console.log(`⚙️ Settings: ${settingCount}`);
    console.log(`🎫 Discount Codes: ${discountCount}`);
    console.log(`📄 Invoices: ${invoiceCount}`);

    await mongoose.connection.close();
    console.log('🔚 Database connection closed');

  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
};

// Run initialization
initializeData(); 