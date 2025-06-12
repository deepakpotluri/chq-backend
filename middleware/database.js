// middleware/database.js
const mongoose = require('mongoose');

const databaseMiddleware = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
      }
      
      console.log('Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI, {
        bufferCommands: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log('MongoDB connected');
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