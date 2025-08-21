const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('../models/User.model');

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

// Update existing users to have a default status
const updateExistingUsers = async () => {
  try {
    console.log('🔄 Updating existing users with default status...');
    
    // Find users without a status field or with null/undefined status
    const usersWithoutStatus = await User.find({
      $or: [
        { status: { $exists: false } },
        { status: null },
        { status: undefined }
      ]
    });
    
    console.log(`Found ${usersWithoutStatus.length} users without status field`);
    
    if (usersWithoutStatus.length > 0) {
      // Update all users without status to 'online' by default
      const result = await User.updateMany(
        {
          $or: [
            { status: { $exists: false } },
            { status: null },
            { status: undefined }
          ]
        },
        { 
          $set: { status: 'online' } 
        }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} users with default status 'online'`);
    } else {
      console.log('✅ All users already have status field');
    }
    
    // Show summary of user statuses
    const statusCounts = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    console.log('\n📊 User Status Summary:');
    statusCounts.forEach(item => {
      console.log(`  ${item._id}: ${item.count} users`);
    });
    
  } catch (error) {
    console.error('❌ Error updating users:', error);
  }
};

// Run the migration
const runMigration = async () => {
  try {
    await connectDB();
    await updateExistingUsers();
    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
    process.exit(0);
  }
};

// Execute migration if run directly
if (require.main === module) {
  runMigration();
}

module.exports = { updateExistingUsers };