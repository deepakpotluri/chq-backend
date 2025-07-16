const express = require('express');
const cors = require('cors');
const path = require('path');

// IMPORTANT: Don't use dotenv.config() in production/Vercel
// Vercel automatically loads environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Initialize express app
const app = express();

// Database connection
const connectDB = require('./config/db');

// CORS configuration
const corsOptions = {
  origin: '*',
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - Note: Vercel doesn't support file uploads to /uploads
// You'll need to use a cloud storage service like AWS S3 or Cloudinary
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Additional CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes - Import after middleware
const authRoutes = require('./routes/authRoutes');
const aspirantRoutes = require('./routes/aspirantRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes');
const { getPublicInstitutionProfile } = require('./controllers/institutionController');
const Course = require('./models/Course');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/aspirant', aspirantRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

// Public routes
app.get('/api/institutions/:id/profile', getPublicInstitutionProfile);

// Get institution courses (public)
app.get('/api/institutions/:id/courses', async (req, res) => {
  try {
    // Ensure database is connected
    await connectDB();
    
    const { id } = req.params;
    const { page = 1, limit = 12, category, type, sort = '-createdAt' } = req.query;
    
    const query = { 
      institution: id, 
      isPublished: true,
      isActive: true
    };
    
    if (category) query.courseCategory = category;
    if (type) query.courseType = type;
    
    const courses = await Course.find(query)
      .populate('institution', 'institutionProfile.institutionName isVerified')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Course.countDocuments(query);
    
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
  res.json({ 
    message: 'Civils HQ API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await connectDB();
    
    res.json({ 
      status: 'ok', 
      message: 'API is healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: 'API is unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectDB(); // Connect to database on startup for local dev
  });
}

module.exports = app;