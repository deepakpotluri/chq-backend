// middleware/database.js
const mongoose = require('mongoose');

// Cache connection for serverless environments
let cachedConnection = null;

const databaseMiddleware = async (req, res, next) => {
  try {
    // Check if we already have a cached connection
    if (cachedConnection && mongoose.connection.readyState === 1) {
      return next();
    }

    // If no connection or connection is not ready
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
      }
      
      console.log('Connecting to MongoDB...');
      
      // Optimized connection options for Vercel
      await mongoose.connect(process.env.MONGODB_URI, {
        bufferCommands: false, // Disable mongoose buffering
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      });
      
      cachedConnection = mongoose.connection;
      console.log('MongoDB connected successfully');
    }
    
    next();
  } catch (error) {
    console.error('Database middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection error', 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
};

module.exports = databaseMiddleware;