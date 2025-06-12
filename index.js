// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const databaseMiddleware = require('./middleware/database');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// CORS configuration - Allow all origins
const corsOptions = {
  origin: '*', // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add headers middleware for additional CORS support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
const aspirantRoutes = require('./routes/aspirantRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes');

// Apply database middleware to all routes
app.use(databaseMiddleware);

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
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

// For Vercel deployment
const PORT = process.env.PORT || 5000;

// Start the server for local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export for Vercel
module.exports = app;