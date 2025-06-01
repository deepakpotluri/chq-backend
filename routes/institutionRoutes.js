// routes/institutionRoutes.js - Complete Institution Routes
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Course = require('../models/Course');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Apply authentication middleware to all routes
router.use(protect);
router.use(authorize('institution'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = 'uploads/syllabus';
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `syllabus-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only PDFs
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Import controller functions
const { 
  getInstitutionProfile,
  getInstitutionAnalytics,
  getInstitutionReviews,
  getInstitutionEarnings,
  getInstitutionCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  promoteCourse,
  getInstitutionEnrollments
} = require('../controllers/institutionController');

// Profile route
router.get('/profile', getInstitutionProfile);

// Analytics route
router.get('/analytics', getInstitutionAnalytics);

// Reviews route
router.get('/reviews', getInstitutionReviews);

// Earnings route
router.get('/earnings', getInstitutionEarnings);

// Enrollments route
router.get('/enrollments', getInstitutionEnrollments);

// Course Management Routes
router.get('/courses', getInstitutionCourses);
router.post('/courses', createCourse);
router.get('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if this institution owns the course
    if (course.institution.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this course' });
    }
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Error getting course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.post('/courses/:id/promote', promoteCourse);

module.exports = router;