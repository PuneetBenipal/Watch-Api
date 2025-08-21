const mongoose = require('mongoose');
const DiscountCode = require('../models/DiscountCode');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/watchdealerhub');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const disableExpiredCodes = async () => {
  try {
    await connectDB();
    
    console.log('🔍 Checking for expired discount codes...');
    
    // Find all active codes that have expired
    const expiredCodes = await DiscountCode.find({
      active: true,
      expiresAt: { $lt: new Date() }
    });
    
    if (expiredCodes.length === 0) {
      console.log('✅ No expired discount codes found');
      return;
    }
    
    console.log(`📅 Found ${expiredCodes.length} expired discount codes:`);
    
    // Disable each expired code
    for (const code of expiredCodes) {
      console.log(`  - ${code.code} (expired: ${code.expiresAt.toDateString()})`);
      code.active = false;
      await code.save();
    }
    
    // Use the static method to disable all expired codes at once
    const result = await DiscountCode.disableExpiredCodes();
    
    console.log(`✅ Successfully disabled ${result.modifiedCount} expired discount codes`);
    
    // Show summary of all codes
    const allCodes = await DiscountCode.find().sort({ createdAt: -1 });
    const activeCodes = allCodes.filter(code => code.isActive());
    const inactiveCodes = allCodes.filter(code => !code.isActive());
    
    console.log('\n📊 Discount Codes Summary:');
    console.log(`  - Total codes: ${allCodes.length}`);
    console.log(`  - Active codes: ${activeCodes.length}`);
    console.log(`  - Inactive codes: ${inactiveCodes.length}`);
    
    if (inactiveCodes.length > 0) {
      console.log('\n🚫 Inactive/Expired Codes:');
      inactiveCodes.forEach(code => {
        const status = code.isExpired() ? 'EXPIRED' : 'MANUALLY DISABLED';
        console.log(`  - ${code.code}: ${status} (expired: ${code.expiresAt ? code.expiresAt.toDateString() : 'No expiry'})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error disabling expired codes:', error);
    process.exit(1);
  }
};

// Run the script
disableExpiredCodes();










