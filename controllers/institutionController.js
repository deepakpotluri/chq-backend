// controllers/institutionController.js - Complete Institution Controller
const User = require('../models/User');
const Course = require('../models/Course');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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
exports.getInstitutionProfile = async (req, res) => {
  try {
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
};

// @desc    Get institution analytics
// @route   GET /api/institution/analytics
// @access  Private
exports.getInstitutionAnalytics = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id });
    
    // Calculate aggregate statistics
    const totalViews = courses.reduce((sum, course) => sum + (course.views || 0), 0);
    const totalLeads = courses.reduce((sum, course) => sum + (course.shortlisted || 0), 0);
    const totalEnrollments = courses.reduce((sum, course) => sum + (course.currentEnrollments || 0), 0);
    const conversionRate = totalViews > 0 ? ((totalEnrollments / totalViews) * 100).toFixed(1) : 0;
    
    // Calculate average rating
    const coursesWithRatings = courses.filter(course => course.averageRating && course.averageRating.overall > 0);
    const averageRating = coursesWithRatings.length > 0 
      ? (coursesWithRatings.reduce((sum, course) => sum + course.averageRating.overall, 0) / coursesWithRatings.length).toFixed(1)
      : 0;
    
    // Find top performing course
    const topPerformingCourse = courses.reduce((best, course) => {
      if (!best || course.currentEnrollments > best.currentEnrollments) {
        return course;
      }
      return best;
    }, null);
    
    // Calculate monthly growth (mock calculation for demo)
    const monthlyGrowth = Math.floor(Math.random() * 30) + 5;
    
    res.status(200).json({
      success: true,
      totalViews,
      totalLeads,
      totalEnrollments,
      conversionRate: parseFloat(conversionRate),
      averageRating: parseFloat(averageRating),
      monthlyGrowth,
      topPerformingCourse: topPerformingCourse?.title || 'No courses available'
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get institution enrollments
// @route   GET /api/institution/enrollments
// @access  Private
exports.getInstitutionEnrollments = async (req, res) => {
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
};

// @desc    Get institution reviews with verification status
// @route   GET /api/institution/reviews
// @access  Private
exports.getInstitutionReviews = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id }).lean();
    
    const allReviews = [];
    
    for (const course of courses) {
      if (course.reviews && course.reviews.length > 0) {
        for (const review of course.reviews) {
          try {
            // Fetch user details separately
            const userDetails = await User.findById(review.user).select('name');
            
            allReviews.push({
              _id: review._id,
              course: {
                _id: course._id,
                title: course.title
              },
              user: userDetails || { name: 'Anonymous' },
              courseRating: review.courseRating,
              instituteRating: review.instituteRating,
              facultyRating: review.facultyRating,
              reviewText: review.reviewText,
              isVerified: review.isVerified,
              verificationStatus: review.verificationStatus,
              rejectionReason: review.rejectionReason,
              helpfulVotes: review.helpfulVotes,
              createdAt: review.createdAt
            });
          } catch (err) {
            console.error('Error fetching user details for review:', err);
          }
        }
      }
    }
    
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
};

// @desc    Get institution earnings
// @route   GET /api/institution/earnings
// @access  Private
exports.getInstitutionEarnings = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id });
    
    // Calculate total earnings
    let totalEarnings = 0;
    courses.forEach(course => {
      totalEarnings += course.price * course.currentEnrollments;
    });
    
    const thisMonthEarnings = Math.floor(totalEarnings * 0.2);
    const pendingPayouts = Math.floor(totalEarnings * 0.1);
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
};

// @desc    Create new course
// @route   POST /api/institution/courses
// @access  Private
exports.createCourse = async (req, res) => {
  try {
    // Check if institution is verified
    const institution = await User.findById(req.user.id);
    if (!institution.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your institution must be verified before creating courses' 
      });
    }

    // Handle file upload
    upload.single('syllabusFile')(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message || 'File upload error' 
        });
      }
      
      try {
        const { 
          title, 
          description, 
          price, 
          duration, 
          courseType, 
          timetable, 
          isPublished 
        } = req.body;
        
        // Parse additional fields
        const requestData = req.body;
        const originalPrice = requestData.originalPrice;
        const discount = requestData.discount;
        const courseCategory = requestData.courseCategory;
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
        
        // Parse JSON fields
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
            parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
          }
        }
        
        // Create course
        const course = await Course.create({
          title,
          description,
          price: Number(price),
          originalPrice: Number(originalPrice || price),
          discount: Number(discount || 0),
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
          timetable: timetable || '[]',
          modules: []
        });
        
        res.status(201).json({
          success: true,
          message: 'Course created successfully',
          data: course
        });
      } catch (error) {
        // Remove uploaded file if course creation fails
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error removing file:', err);
          });
        }
        
        console.error('Error creating course:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Server error during course creation', 
          error: error.message 
        });
      }
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update course
// @route   PUT /api/institution/courses/:id
// @access  Private
exports.updateCourse = async (req, res) => {
  try {
    // Handle file upload
    upload.single('syllabusFile')(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message || 'File upload error' 
        });
      }
      
      try {
        // Find course
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
          if (req.body[key] !== undefined && key !== 'syllabusFile') {
            course[key] = req.body[key];
          }
        });
        
        // Update status based on publication
        if (req.body.isPublished !== undefined) {
          course.status = req.body.isPublished ? 'published' : 'draft';
        }
        
        // If there's a new file and an old one exists, delete the old one
        if (req.file) {
          if (course.syllabusFile) {
            fs.unlink(course.syllabusFile, (err) => {
              if (err) console.error('Error removing old file:', err);
            });
          }
          course.syllabusFile = req.file.path;
        }
        
        await course.save();
        
        res.status(200).json({
          success: true,
          message: 'Course updated successfully',
          data: course
        });
      } catch (error) {
        // Remove uploaded file if course update fails
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error removing file:', err);
          });
        }
        
        console.error('Error updating course:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Server error during course update', 
          error: error.message 
        });
      }
    });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all institution courses
// @route   GET /api/institution/courses
// @access  Private
exports.getInstitutionCourses = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
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
};

// @desc    Get a single course
// @route   GET /api/institution/courses/:id
// @access  Private
exports.getCourse = async (req, res) => {
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
};

// @desc    Delete a course
// @route   DELETE /api/institution/courses/:id
// @access  Private
exports.deleteCourse = async (req, res) => {
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
      fs.unlink(course.syllabusFile, (err) => {
        if (err) console.error('Error removing file:', err);
      });
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
};

// @desc    Promote a course
// @route   POST /api/institution/courses/:id/promote
// @access  Private
exports.promoteCourse = async (req, res) => {
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
    } else {
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
};

// @desc    Get all published courses (for homepage and course browsing)
// @route   GET /api/courses/published
// @access  Public
exports.getPublishedCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const query = { isPublished: true };
    
    // Add search functionality
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(req.query.search, 'i')] } }
      ];
    }
    
    // Add filter by course type
    if (req.query.type) {
      query.courseType = req.query.type;
    }
    
    // Add featured filter
    if (req.query.isFeatured === 'true' || req.query.featured === 'true') {
      query.isFeatured = true;
    }
    
    // Add promoted filter
    if (req.query.promoted === 'true') {
      query.promotionLevel = { $ne: 'none' };
    }
    
    // Populate the institution field to get institution name
    const courses = await Course.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('institution', 'institutionName')
      .lean();
    
    const total = await Course.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: courses.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: courses
    });
  } catch (error) {
    console.error('Error getting published courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = exports;