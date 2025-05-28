// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection (ensure single connection)
let dbConnected = false;
(async () => {
  if (!dbConnected) {
    try {
      await connectDB();
      console.log('MongoDB connected successfully');
      dbConnected = true;
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err);
    }
  }
})();

// Routes
const authRoutes = require('./routes/authRoutes');
const aspirantRoutes = require('./routes/aspirantRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes'); // Added new course routes

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/aspirant', aspirantRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Civils HQ API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// Check if running in Vercel or Local
if (process.env.VERCEL) {
  // Vercel: Export the app as a serverless handler
  module.exports = app;
} else {
  // Local: Start the server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
