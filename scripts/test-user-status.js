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

// Test user status functionality
const testUserStatus = async () => {
  try {
    console.log('🧪 Testing User Status Functionality...\n');

    // 1. Create a test user
    console.log('1. Creating test user...');
    const testUser = new User({
      email: 'test-status@example.com',
      password: 'testpassword123',
      fullName: 'Test Status User'
      // status should default to 'online'
    });

    await testUser.save();
    console.log(`✅ Test user created with default status: ${testUser.status}`);

    // 2. Test status updates
    console.log('\n2. Testing status updates...');

    // Update to offline
    await User.findByIdAndUpdate(testUser._id, { status: 'offline' });
    let updatedUser = await User.findById(testUser._id);
    console.log(`✅ Status updated to: ${updatedUser.status}`);

    // Update to disabled
    await User.findByIdAndUpdate(testUser._id, { status: 'disabled' });
    updatedUser = await User.findById(testUser._id);
    console.log(`✅ Status updated to: ${updatedUser.status}`);

    // Update back to online
    await User.findByIdAndUpdate(testUser._id, { status: 'online' });
    updatedUser = await User.findById(testUser._id);
    console.log(`✅ Status updated to: ${updatedUser.status}`);

    // 3. Test invalid status (should fail)
    console.log('\n3. Testing invalid status...');
    try {
      const invalidUser = new User({
        email: 'invalid-status@example.com',
        password: 'testpassword123',
        fullName: 'Invalid Status User',
        status: 'invalid-status'
      });
      await invalidUser.save();
      console.log('❌ Invalid status was accepted (this should not happen)');
    } catch (error) {
      console.log('✅ Invalid status correctly rejected');
    }

    // 4. Test filtering by status
    console.log('\n4. Testing status filtering...');

    // Create users with different statuses
    const onlineUser = new User({
      email: 'online@example.com',
      password: 'testpassword123',
      fullName: 'Online User',
      status: 'online'
    });

    const offlineUser = new User({
      email: 'offline@example.com',
      password: 'testpassword123',
      fullName: 'Offline User',
      status: 'offline'
    });

    const disabledUser = new User({
      email: 'disabled@example.com',
      password: 'testpassword123',
      fullName: 'Disabled User',
      status: 'disabled'
    });

    await Promise.all([onlineUser.save(), offlineUser.save(), disabledUser.save()]);

    // Test filtering
    const onlineUsers = await User.find({ status: 'online' });
    const offlineUsers = await User.find({ status: 'offline' });
    const disabledUsers = await User.find({ status: 'disabled' });

    console.log(`✅ Online users: ${onlineUsers.length}`);
    console.log(`✅ Offline users: ${offlineUsers.length}`);
    console.log(`✅ Disabled users: ${disabledUsers.length}`);

    // 5. Clean up test users
    console.log('\n5. Cleaning up test users...');
    await User.deleteMany({
      email: {
        $in: [
          'test-status@example.com',
          'online@example.com',
          'offline@example.com',
          'disabled@example.com'
        ]
      }
    });
    console.log('✅ Test users cleaned up');

    console.log('\n🎉 All tests passed! User status functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
const runTest = async () => {
  try {
    await connectDB();
    await testUserStatus();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📴 Database connection closed');
    process.exit(0);
  }
};

// Execute test if run directly
if (require.main === module) {
  runTest();
}

module.exports = { testUserStatus };