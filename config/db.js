const mongoose = require('mongoose');
require('dotenv').config();

const bootstrap = require("../services/bootstrap");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    await bootstrap.initSuperAdmin();
    await bootstrap.initModules();
    await bootstrap.initFrePlan();
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = { connectDB }; 