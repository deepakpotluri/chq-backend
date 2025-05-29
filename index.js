// index.js - Updated for Vercel deployment
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Enhanced CORS configuration for Vercel
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://chq-frontend.vercel.app', // Replace with your actual frontend URL
      /\.vercel\.app$/,
      /\.netlify\.app$/
    ];
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
const initDB = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};

// Initialize DB connection
initDB();

// Static files (Note: May not work properly on Vercel, consider using external storage)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Routes
const authRoutes = require('./routes/authRoutes');
const aspirantRoutes = require('./routes/aspirantRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/aspirant', aspirantRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Civils HQ API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      aspirant: '/api/aspirant',
      institution: '/api/institution',
      admin: '/api/admin',
      courses: '/api/courses'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Vercel requires this export
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}