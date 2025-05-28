// routes/institutionRoutes.js - Updated to properly fetch enrollments
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

// @desc    Get institution profile
// @route   GET /api/institution/profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    console.log('Getting profile for user ID:', req.user.id);
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    res.status(200).json({
      success: true,
      email: user.email,
      name: user.name,
      institutionName: user.institutionName,
      institutionType: user.institutionType,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error getting institution profile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Instead of duplicating the controller logic, use the controller
const { 
  getInstitutionProfile,
  getInstitutionAnalytics,
  getInstitutionEnrollments,
  getInstitutionReviews,
  getInstitutionEarnings,
  createCourse,
  getInstitutionCourses,
  updateCourse,
  deleteCourse,
  promoteCourse
} = require('../controllers/institutionController');

// Profile route
router.get('/profile', getInstitutionProfile);

// Analytics route
router.get('/analytics', getInstitutionAnalytics);

// Enrollments route
router.get('/enrollments', getInstitutionEnrollments);

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
              console.error('Error fetching user details for enrollment:', err);
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
    console.error('Error getting enrollments:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get institution reviews
// @route   GET /api/institution/reviews
// @access  Private
router.get('/reviews', async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .populate('reviews.user', 'name')
      .lean();
    
    const allReviews = [];
    
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          allReviews.push({
            _id: review._id,
            course: {
              _id: course._id,
              title: course.title
            },
            user: review.user,
            courseRating: review.courseRating,
            instituteRating: review.instituteRating,
            facultyRating: review.facultyRating,
            reviewText: review.reviewText,
            isVerified: review.isVerified,
            helpfulVotes: review.helpfulVotes,
            createdAt: review.createdAt
          });
        });
      }
    });
    
    // Sort by date (newest first)
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.status(200).json({
      success: true,
      reviews: allReviews
    });
  } catch (error) {
    console.error('Error getting reviews:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get institution earnings
// @route   GET /api/institution/earnings
// @access  Private
router.get('/earnings', async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id });
    
    // Calculate total earnings
    let totalEarnings = 0;
    courses.forEach(course => {
      totalEarnings += course.price * course.currentEnrollments;
    });
    
    const thisMonthEarnings = Math.floor(totalEarnings * 0.2); // Mock 20% this month
    const pendingPayouts = Math.floor(totalEarnings * 0.1); // 10% pending
    const completedPayouts = totalEarnings - pendingPayouts;
    
    // Mock monthly breakdown
    const monthlyBreakdown = [
      { month: 'Jan', earnings: Math.floor(totalEarnings * 0.25) },
      { month: 'Feb', earnings: Math.floor(totalEarnings * 0.35) },
      { month: 'Mar', earnings: thisMonthEarnings }
    ];
    
    res.status(200).json({
      success: true,
      totalEarnings,
      thisMonthEarnings,
      pendingPayouts,
      completedPayouts,
      monthlyBreakdown
    });
  } catch (error) {
    console.error('Error getting earnings:', error);
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
      console.error('File upload error:', err);
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload error' 
      });
    }
    
    try {
      console.log('Course creation request body:', req.body);
      console.log('Uploaded file:', req.file);
      
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
          console.log('Failed to parse courseType, using default');
        }
      }
      
      let parsedLanguages = ['english'];
      if (courseLanguages) {
        try {
          parsedLanguages = typeof courseLanguages === 'string' ? JSON.parse(courseLanguages) : courseLanguages;
        } catch (e) {
          console.log('Failed to parse courseLanguages, using default');
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
          console.log('Failed to parse faculty, using empty array');
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
      
      console.log('Creating course with data:', courseData);
      
      const course = await Course.create(courseData);
      
      console.log('Course created successfully:', course._id);
      
      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: course
      });
      
    } catch (error) {
      console.error('Error creating course:', error);
      
      // Remove uploaded file if course creation fails
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error removing uploaded file:', unlinkError);
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

// @desc    Get all institution courses
// @route   GET /api/institution/courses
// @access  Private
router.get('/courses', async (req, res) => {
  try {
    console.log('Getting courses for institution:', req.user.id);
    const courses = await Course.find({ institution: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`Found ${courses.length} courses`);
    
    // Add earnings data for each course
    const coursesWithEarnings = courses.map(course => ({
      ...course,
      earnings: course.price * course.currentEnrollments
    }));
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: coursesWithEarnings
    });
  } catch (error) {
    console.error('Error getting institution courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Update course
// @route   PUT /api/institution/courses/:id
// @access  Private
router.put('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if this institution owns the course
    if (course.institution.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this course' });
    }
    
    // Update fields from request body
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        course[key] = req.body[key];
      }
    });
    
    // Update status based on publication
    if (req.body.isPublished !== undefined) {
      course.status = req.body.isPublished ? 'published' : 'draft';
    }
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Delete a course
// @route   DELETE /api/institution/courses/:id
// @access  Private
router.delete('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if this institution owns the course
    if (course.institution.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this course' });
    }
    
    // Delete syllabus file if exists
    if (course.syllabusFile) {
      try {
        fs.unlinkSync(course.syllabusFile);
      } catch (e) {
        console.error('Error removing file:', e);
      }
    }
    
    await Course.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Promote a course
// @route   POST /api/institution/courses/:id/promote
// @access  Private
router.post('/courses/:id/promote', async (req, res) => {
  try {
    const { promotionLevel } = req.body;
    
    if (!['none', 'basic', 'premium', 'featured'].includes(promotionLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promotion level'
      });
    }
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if this institution owns the course
    if (course.institution.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to promote this course' });
    }
    
    // Update promotion level
    course.promotionLevel = promotionLevel;
    
    // Set featured status for featured promotion
    if (promotionLevel === 'featured') {
      course.isFeatured = true;
    } else if (promotionLevel !== 'featured') {
      course.isFeatured = false;
    }
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: `Course promoted to ${promotionLevel} level successfully`,
      data: course
    });
  } catch (error) {
    console.error('Error promoting course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;