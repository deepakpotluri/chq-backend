// config/db.js - Optimized for Vercel serverless
const mongoose = require('mongoose');

// Prevent multiple connections in serverless environment
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    const opts = {
      bufferCommands: true, // Enable buffering
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGODB_URI, opts);
    
    isConnected = true;
    console.log('MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

  } catch (error) {
    console.error('MongoDB connection failed:', error);
    isConnected = false;
    throw error;
  }
};

module.exports = connectDB;