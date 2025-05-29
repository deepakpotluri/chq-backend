// routes/institutionRoutes.js - Cleaned version for Vercel
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
  updateCourse,
  deleteCourse,
  promoteCourse
} = require('../controllers/institutionController');

// Profile route
router.get('/profile', getInstitutionProfile);

// Analytics route
router.get('/analytics', getInstitutionAnalytics);

// Reviews route
router.get('/reviews', getInstitutionReviews);

// Earnings route
router.get('/earnings', getInstitutionEarnings);

// @desc    Get institution enrollments with student details
// @route   GET /api/institution/enrollments
// @access  Private
router.get('/enrollments', async (req, res) => {
  try {
    // Get all courses for this institution
    const courses = await Course.find({ institution: req.user.id }).lean();
    
    // Extract all enrollments with course information
    const allEnrollments = [];
    
    for (const course of courses) {
      if (course.enrollments && course.enrollments.length > 0) {
        for (const enrollment of course.enrollments) {
          if (enrollment.paymentStatus === 'completed' && enrollment.user) {
            try {
              // Fetch user details separately to avoid populate issues
              const userDetails = await User.findById(enrollment.user).select('name email');
              
              if (userDetails) {
                allEnrollments.push({
                  _id: enrollment._id,
                  student: {
                    name: userDetails.name || 'Unknown',
                    email: userDetails.email || 'N/A'
                  },
                  course: {
                    _id: course._id,
                    title: course.title,
                    price: course.price
                  },
                  courseTitle: course.title,
                  enrolledAt: enrollment.enrolledAt,
                  paymentStatus: enrollment.paymentStatus,
                  amount: enrollment.amount || course.price
                });
              }
            } catch (err) {
              // Silently continue if user fetch fails
            }
          }
        }
      }
    }
    
    // Sort by enrollment date (newest first)
    allEnrollments.sort((a, b) => new Date(b.enrolledAt) - new Date(a.enrolledAt));
    
    res.status(200).json({
      success: true,
      enrollments: allEnrollments,
      pagination: {
        total: allEnrollments.length,
        page: 1,
        pages: 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Create new course
// @route   POST /api/institution/courses
// @access  Private
router.post('/courses', async (req, res) => {
  // Handle multipart form data
  upload.single('syllabusFile')(req, res, async function(err) {
    if (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload error' 
      });
    }
    
    try {
      // Destructure ALL possible fields from req.body
      const requestData = req.body;
      
      // Get the fields directly
      const title = requestData.title;
      const description = requestData.description;
      const price = requestData.price;
      const originalPrice = requestData.originalPrice;
      const discount = requestData.discount;
      const duration = requestData.duration;
      const courseCategory = requestData.courseCategory;
      const courseType = requestData.courseType;
      const subjects = requestData.subjects;
      const courseLanguages = requestData.courseLanguages;
      const faculty = requestData.faculty;
      const city = requestData.city;
      const state = requestData.state;
      const address = requestData.address;
      const startDate = requestData.startDate;
      const endDate = requestData.endDate;
      const maxStudents = requestData.maxStudents;
      const deliveryType = requestData.deliveryType;
      const isPublished = requestData.isPublished;
      const tags = requestData.tags;
      
      // Validate required fields
      if (!title || !description || !price || !courseCategory || !startDate || !endDate) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ 
          success: false, 
          message: 'Title, description, price, category, start date, and end date are required' 
        });
      }
      
      // Parse JSON fields safely
      let parsedCourseType = ['online'];
      if (courseType) {
        try {
          parsedCourseType = typeof courseType === 'string' ? JSON.parse(courseType) : courseType;
        } catch (e) {
          // Use default
        }
      }
      
      let parsedLanguages = ['english'];
      if (courseLanguages) {
        try {
          parsedLanguages = typeof courseLanguages === 'string' ? JSON.parse(courseLanguages) : courseLanguages;
        } catch (e) {
          // Use default
        }
      }
      
      let parsedSubjects = [];
      if (subjects) {
        try {
          parsedSubjects = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
        } catch (e) {
          // If JSON parse fails, try splitting by comma
          parsedSubjects = typeof subjects === 'string' ? subjects.split(',').map(s => s.trim()) : [];
        }
      }
      
      let parsedFaculty = [];
      if (faculty) {
        try {
          parsedFaculty = typeof faculty === 'string' ? JSON.parse(faculty) : faculty;
        } catch (e) {
          // Use empty array
        }
      }
      
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (e) {
          // If JSON parse fails, try splitting by comma
          parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
        }
      }
      
      // Create course object
      const courseData = {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        originalPrice: parseFloat(originalPrice || price),
        discount: parseFloat(discount || 0),
        duration: duration || '1 month',
        courseCategory,
        courseType: parsedCourseType,
        subjects: parsedSubjects,
        courseLanguages: parsedLanguages,
        faculty: parsedFaculty,
        city: city || '',
        state: state || '',
        address: address || '',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxStudents: parseInt(maxStudents || 0),
        deliveryType: deliveryType || 'live',
        institution: req.user.id,
        tags: parsedTags,
        isPublished: isPublished === 'true' || isPublished === true,
        status: (isPublished === 'true' || isPublished === true) ? 'published' : 'draft',
        syllabusFile: req.file ? req.file.path : null,
        
        // Initialize default values
        promotionLevel: 'none',
        isFeatured: false,
        views: 0,
        shortlisted: 0,
        currentEnrollments: 0,
        enrollments: [],
        reviews: [],
        averageRating: {
          overall: 0,
          course: 0,
          institute: 0,
          faculty: 0
        },
        totalReviews: 0,
        modules: []
      };
      
      const course = await Course.create(courseData);
      
      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: course
      });
      
    } catch (error) {
      // Remove uploaded file if course creation fails
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          // Ignore unlink errors
        }
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Server error during course creation', 
        error: error.message 
      });
    }
  });
});

// Get all institution courses
router.get('/courses', getInstitutionCourses);

// Update course
router.put('/courses/:id', updateCourse);

// Delete course
router.delete('/courses/:id', deleteCourse);

// Promote course
router.post('/courses/:id/promote', promoteCourse);

module.exports = router;