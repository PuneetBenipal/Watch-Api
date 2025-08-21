const mongoose = require('mongoose');
const User = require('../models/User.model');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/watch-dealer-hub', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const sampleUsers = [
  {
    name: 'John Doe',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    passwordHash: 'password123',
    role: 'admin',
    defaultCurrency: 'USD',
    region: 'UAE',
    status: 'online',
    subscriptionStatus: 'active',
    usageCount: 150,
    settings: {
      theme: 'light',
      notifications: 'all',
      language: 'en',
      timezone: 'UTC'
    }
  },
  {
    name: 'Jane Smith',
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    passwordHash: 'password123',
    role: 'user',
    defaultCurrency: 'EUR',
    region: 'UAE',
    status: 'offline',
    subscriptionStatus: 'active',
    usageCount: 89,
    settings: {
      theme: 'dark',
      notifications: 'important',
      language: 'en',
      timezone: 'EST'
    }
  },
  {
    name: 'Mike Wilson',
    fullName: 'Mike Wilson',
    email: 'mike.wilson@example.com',
    passwordHash: 'password123',
    role: 'dealer',
    defaultCurrency: 'GBP',
    region: 'UAE',
    status: 'disabled',
    subscriptionStatus: 'inactive',
    usageCount: 45,
    settings: {
      theme: 'auto',
      notifications: 'none',
      language: 'en',
      timezone: 'PST'
    }
  },
  {
    name: 'Sarah Johnson',
    fullName: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    passwordHash: 'password123',
    role: 'user',
    defaultCurrency: 'USD',
    region: 'UAE',
    status: 'online',
    subscriptionStatus: 'active',
    usageCount: 120,
    settings: {
      theme: 'light',
      notifications: 'all',
      language: 'es',
      timezone: 'UTC'
    }
  }
];

async function createSampleUsers() {
  try {
    // Clear existing users
    await User.deleteMany({});
    
    // Create new users
    const users = await User.create(sampleUsers);
    console.log('Sample users created successfully:', users);
  } catch (error) {
    console.error('Error creating sample users:', error);
  } finally {
    mongoose.disconnect();
  }
}

createSampleUsers();
