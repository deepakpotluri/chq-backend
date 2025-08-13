// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const databaseMiddleware = require('./middleware/database');

// Load environment variables
require('dotenv').config();

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

// Import the getPublicInstitutionProfile function from institutionController
const { getPublicInstitutionProfile } = require('./controllers/institutionController');

// Import models for public courses route
const Course = require('./models/Course');

// Apply database middleware to all routes
app.use(databaseMiddleware);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/aspirant', aspirantRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

// Public Institution Profile Route (now using the controller method)
app.get('/api/institutions/:id/profile', getPublicInstitutionProfile);

// Get institution courses (public)
// FIND THIS CODE IN YOUR index.js:
// Get institution courses - OPTIMIZED VERSION
app.get('/api/institutions/:id/courses', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 12, category, type, sort = '-createdAt' } = req.query;
    
    // Build query
    const query = { 
      institution: id, 
      isPublished: true,
      isActive: true
    };
    
    if (category) query.courseCategory = category;
    if (type) query.courseType = type;
    
    // OPTIMIZED: Execute both queries in parallel and use lean()
    const [courses, total] = await Promise.all([
      Course.find(query)
        .populate('institution', 'institutionProfile.institutionName isVerified')
        .select('title description courseCategory courseType price duration createdAt features imageUrl') // Only select needed fields
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(), // Much faster - returns plain JS objects instead of Mongoose documents
      Course.countDocuments(query)
    ]);
    
    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get institution courses error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? {} : error.message 
    });
  }
});

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