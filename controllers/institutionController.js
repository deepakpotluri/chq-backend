// controllers/institutionController.js
const User = require('../models/User');
const Course = require('../models/Course');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Add this after the existing upload configuration
const uploadMultiple = multer({ 
  storage, 
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'syllabusFile' && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else if ((file.fieldname === 'coverImage' || file.fieldname === 'galleryImages') && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Update the createCourse method to use:
uploadMultiple.fields([
  { name: 'syllabusFile', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 10 }
]);

// Helper function to parse array fields
const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    // Try to parse as JSON
    if (field.startsWith('[')) {
      try {
        return JSON.parse(field);
      } catch (e) {
        // If JSON parsing fails, split by comma
        return field.replace(/[\[\]"]/g, '').split(',').map(item => item.trim()).filter(item => item);
      }
    }
    // Single value
    return [field];
  }
  return [];
};

// ============= INSTITUTION PROFILE MANAGEMENT =============

// @desc    Get public institution profile with role-based data filtering
// @route   GET /api/institutions/:id/profile
// @access  Public (with optional authentication for additional data)
exports.getPublicInstitutionProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is authenticated (optional)
    let requestingUserId = null;
    let requestingUserRole = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
        requestingUserId = decoded.id;
        
        // Get requesting user's role
        const requestingUser = await User.findById(requestingUserId);
        if (requestingUser) {
          requestingUserRole = requestingUser.role;
        }
      } catch (error) {
        // Invalid token, continue as public request
        console.log('Optional auth: Invalid token, treating as public request');
      }
    }
    
    // Find institution
    const institution = await User.findById(id).select('-password');
    
    if (!institution || institution.role !== 'institution') {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    // Get courses based on user role
    let coursesQuery = { institution: id };
    
    // Public users and aspirants see only published courses
    if (!requestingUserId || requestingUserRole === 'aspirant') {
      coursesQuery.isPublished = true;
      coursesQuery.status = 'published';
    }
    // Institution can see their own courses (all statuses)
    else if (requestingUserRole === 'institution' && requestingUserId === id) {
      // No additional filters - see all their courses
    }
    // Admin can see all courses
    else if (requestingUserRole === 'admin') {
      // No additional filters - see all courses
    }
    // Other institutions see only published courses
    else {
      coursesQuery.isPublished = true;
      coursesQuery.status = 'published';
    }
    
    const courses = await Course.find(coursesQuery)
      .select('title description price originalPrice discount courseCategory courseType startDate endDate enrollments averageRating totalReviews status isPublished coverImage')
      .sort('-createdAt');
    
    // Calculate stats
    const totalCourses = courses.length;
    const totalEnrollments = courses.reduce((sum, course) => sum + course.enrollments.length, 0);
    
    // Prepare base response data - public information
    const profileData = {
      _id: institution._id,
      name: institution.name,
      email: institution.email,
      role: institution.role,
      institutionProfile: {
        institutionName: institution.institutionProfile?.institutionName,
        institutionType: institution.institutionProfile?.institutionType,
        description: institution.institutionProfile?.description,
        establishedYear: institution.institutionProfile?.establishedYear,
        address: institution.institutionProfile?.address,
        googleMapsLink: institution.institutionProfile?.googleMapsLink,
        website: institution.institutionProfile?.website,
        socialLinks: institution.institutionProfile?.socialLinks
      },
      isVerified: institution.isVerified,
      verificationStatus: institution.verificationStatus,
      courses: courses.map(course => ({
        ...course.toObject(),
        currentEnrollments: course.enrollments.filter(e => e.paymentStatus === 'completed').length
      })),
      stats: {
        totalCourses,
        totalEnrollments,
        avgRating: courses.reduce((sum, c) => sum + (c.averageRating?.overall || 0), 0) / (totalCourses || 1)
      }
    };
    
    // Add sensitive data based on user role
    const isOwner = requestingUserRole === 'institution' && requestingUserId === id;
    const isAdmin = requestingUserRole === 'admin';
    
    // 1. No login or aspirant should NOT see owner & contact person details
    if (!requestingUserId || requestingUserRole === 'aspirant') {
      // Remove sensitive data - already excluded above
    }
    // 2. Same institution can see all details including contact person
    else if (isOwner) {
      profileData.institutionProfile.contactPerson = institution.institutionProfile?.contactPerson;
      profileData.lastLogin = institution.lastLogin;
      profileData.createdAt = institution.createdAt;
    }
    // 3. Other institutions can't see owner details but can see basic info
    else if (requestingUserRole === 'institution' && !isOwner) {
      // Don't add contact person or owner details
    }
    // 4. Admin can see all details but can't edit
    else if (isAdmin) {
      profileData.institutionProfile.contactPerson = institution.institutionProfile?.contactPerson;
      profileData.institutionProfile.owner = institution.institutionProfile?.owner;
      profileData.lastLogin = institution.lastLogin;
      profileData.createdAt = institution.createdAt;
    }
    
    res.status(200).json({
      success: true,
      data: profileData,
      userRole: requestingUserRole,
      isOwner: isOwner
    });
  } catch (error) {
    console.error('Error getting institution profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Get institution profile (for logged-in institution)
// @route   GET /api/institution/profile
// @access  Private
exports.getInstitutionProfile = async (req, res) => {
  try {
    const institution = await User.findById(req.user.id).select('-password');
    
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    res.status(200).json({
      success: true,
      data: institution
    });
  } catch (error) {
    console.error('Error getting institution profile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update institution contact person
// @route   PUT /api/institution/profile/contact
// @access  Private
exports.updateInstitutionContactPerson = async (req, res) => {
  try {
    const { name, designation, phone, email } = req.body;
    
    const institution = await User.findById(req.user.id);
    
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    // Update contact person details
    institution.institutionProfile.contactPerson = {
      name,
      designation,
      phone,
      email
    };
    
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: 'Contact person updated successfully',
      data: institution.institutionProfile.contactPerson
    });
  } catch (error) {
    console.error('Error updating contact person:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get institution analytics
// @route   GET /api/institution/analytics
// @access  Private
exports.getInstitutionAnalytics = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id });
    
    // Calculate total views
    const totalViews = courses.reduce((sum, course) => sum + course.views, 0);
    
    // Calculate total enrollments
    const totalEnrollments = courses.reduce((sum, course) => {
      return sum + course.enrollments.filter(e => e.paymentStatus === 'completed').length;
    }, 0);
    
    // Calculate total revenue
    const totalRevenue = courses.reduce((sum, course) => {
      return sum + course.enrollments
        .filter(e => e.paymentStatus === 'completed')
        .reduce((courseSum, enrollment) => courseSum + (enrollment.amount || course.price), 0);
    }, 0);
    
    // Get monthly data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyData = [];
    for (let i = 0; i < 6; i++) {
      const startDate = new Date(sixMonthsAgo);
      startDate.setMonth(startDate.getMonth() + i);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      const monthEnrollments = courses.reduce((sum, course) => {
        return sum + course.enrollments.filter(e => {
          const enrollDate = new Date(e.enrolledAt);
          return e.paymentStatus === 'completed' && 
                 enrollDate >= startDate && 
                 enrollDate < endDate;
        }).length;
      }, 0);
      
      const monthRevenue = courses.reduce((sum, course) => {
        return sum + course.enrollments.filter(e => {
          const enrollDate = new Date(e.enrolledAt);
          return e.paymentStatus === 'completed' && 
                 enrollDate >= startDate && 
                 enrollDate < endDate;
        }).reduce((monthSum, enrollment) => monthSum + (enrollment.amount || course.price), 0);
      }, 0);
      
      monthlyData.push({
        month: startDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        enrollments: monthEnrollments,
        revenue: monthRevenue
      });
    }
    
    // Get top performing courses
    const topCourses = courses
      .map(course => ({
        id: course._id,
        title: course.title,
        enrollments: course.enrollments.filter(e => e.paymentStatus === 'completed').length,
        revenue: course.enrollments
          .filter(e => e.paymentStatus === 'completed')
          .reduce((sum, e) => sum + (e.amount || course.price), 0),
        rating: course.averageRating?.overall || 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCourses: courses.length,
          totalViews,
          totalEnrollments,
          totalRevenue
        },
        monthlyData,
        topCourses
      }
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get institution reviews
// @route   GET /api/institution/reviews
// @access  Private
exports.getInstitutionReviews = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .populate('reviews.user', 'name')
      .select('title reviews');
    
    // Flatten all reviews
    const allReviews = [];
    courses.forEach(course => {
      course.reviews.forEach(review => {
        allReviews.push({
          ...review.toObject(),
          courseName: course.title,
          courseId: course._id
        });
      });
    });
    
    // Sort by date (newest first)
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.status(200).json({
      success: true,
      count: allReviews.length,
      data: allReviews
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
    
    // Calculate earnings by course
    const earningsByCourse = courses.map(course => ({
      courseId: course._id,
      courseName: course.title,
      totalEnrollments: course.enrollments.filter(e => e.paymentStatus === 'completed').length,
      totalEarnings: course.enrollments
        .filter(e => e.paymentStatus === 'completed')
        .reduce((sum, enrollment) => sum + (enrollment.amount || course.price), 0),
      status: course.isPublished ? 'Active' : 'Draft'
    }));
    
    // Calculate total earnings
    const totalEarnings = earningsByCourse.reduce((sum, course) => sum + course.totalEarnings, 0);
    
    // Calculate monthly earnings (mock data - implement actual logic based on enrollment dates)
    const monthlyEarnings = totalEarnings / 12; // Simple average for now
    
    res.status(200).json({
      success: true,
      totalEarnings,
      monthlyEarnings,
      courses: earningsByCourse
    });
  } catch (error) {
    console.error('Error getting earnings:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get institution enrollments
// @route   GET /api/institution/enrollments
// @access  Private
exports.getInstitutionEnrollments = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .populate('enrollments.user', 'name email')
      .select('title enrollments');
    
    // Flatten all enrollments
    const allEnrollments = [];
    courses.forEach(course => {
      course.enrollments.forEach(enrollment => {
        if (enrollment.paymentStatus === 'completed') {
          allEnrollments.push({
            ...enrollment.toObject(),
            courseName: course.title,
            courseId: course._id
          });
        }
      });
    });
    
    // Sort by date (newest first)
    allEnrollments.sort((a, b) => new Date(b.enrolledAt) - new Date(a.enrolledAt));
    
    res.status(200).json({
      success: true,
      count: allEnrollments.length,
      data: allEnrollments
    });
  } catch (error) {
    console.error('Error getting enrollments:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create new course
// @route   POST /api/institution/courses
// @access  Private
exports.createCourse = async (req, res) => {
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
        // Destructure all fields including schedule
        const {
          title,
          description,
          price,
          originalPrice,
          discount,
          duration,
          courseCategory,
          courseType,
          courseLanguages,
          subjects,
          city,
          state,
          address,
          startDate,
          endDate,
          highlights,
          whatYouWillLearn,
          maxStudents,
          schedule,
          syllabusDetails,
          faculty,
          tags,
           prerequisites,
          targetAudience,
          
        } = req.body;
        
        // Parse JSON strings back to arrays/objects
        let parsedSchedule = [];
        let parsedFaculty = [];
        let parsedTags = [];
        let parsedSyllabusDetails = [];
        
        try {
          if (schedule) {
            parsedSchedule = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
          }
        } catch (parseError) {
          console.error('Error parsing schedule:', parseError);
          parsedSchedule = [];
        }
        
        try {
          if (faculty) {
            parsedFaculty = typeof faculty === 'string' ? JSON.parse(faculty) : faculty;
          }
        } catch (parseError) {
          console.error('Error parsing faculty:', parseError);
          parsedFaculty = [];
        }
        
        try {
          if (tags) {
            parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
          }
        } catch (parseError) {
          console.error('Error parsing tags:', parseError);
          parsedTags = [];
        }

         try {
          if (syllabusDetails) {
            parsedSyllabusDetails = typeof syllabusDetails === 'string' ? JSON.parse(syllabusDetails) : syllabusDetails;
          }
        } catch (parseError) {
          console.error('Error parsing syllabusDetails:', parseError);
          parsedSyllabusDetails = [];
        }
        
        // Create course object with all fields - FIXED PARSING
        const courseData = {
          title,
          description,
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : Number(price),
          discount: discount ? Number(discount) : 0,
          duration,
          institution: req.user.id,
          courseCategory,
          courseType: parseArrayField(courseType),
          courseLanguages: parseArrayField(courseLanguages).length > 0 ? parseArrayField(courseLanguages) : ['english'],
          subjects: parseArrayField(subjects),
          city,
          state,
          address,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          highlights: parseArrayField(highlights),
          whatYouWillLearn: parseArrayField(whatYouWillLearn),
          prerequisites: parseArrayField(prerequisites),
          targetAudience, 
          maxStudents: maxStudents ? Number(maxStudents) : 0,
          schedule: parsedSchedule,
          syllabusDetails: parsedSyllabusDetails,
          syllabusFile: req.file ? req.file.path : undefined,
          faculty: parsedFaculty,
          tags: parsedTags,
          isPublished: false,
          status: 'draft'
        };
        
        // Create course
        const course = await Course.create(courseData);
        
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
    res.status(500).json({ 
      success: false, 
      message: 'Server error during course creation', 
      error: error.message 
    });
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
        const course = await Course.findById(req.params.id);
        
        if (!course) {
          return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        // Check if this institution owns the course
        if (course.institution.toString() !== req.user.id) {
          return res.status(403).json({ success: false, message: 'Not authorized to update this course' });
        }
        
        // Build update object
        const updateFields = {};
        const allowedFields = [
          'title', 'description', 'price', 'originalPrice', 'discount',
          'duration', 'courseCategory', 'courseType', 'courseLanguages',
          'subjects', 'city', 'state', 'address', 'startDate', 'endDate',
          'highlights', 'whatYouWillLearn', 'maxStudents', 'schedule',
          'syllabusDetails', 'faculty', 'tags', 'isPublished','prerequisites',
          'targetAudience', 'coordinates',
          'coverImage', 'galleryImages'
        ];
        
        // Process each field
        Object.keys(req.body).forEach(field => {
          if (allowedFields.includes(field)) {
            if (field === 'schedule' || field === 'faculty' || field === 'tags') {
              try {
                updateFields[field] = typeof req.body[field] === 'string' ? JSON.parse(req.body[field]) : req.body[field];
              } catch (e) {
                updateFields[field] = req.body[field];
              }
            } else if (field === 'courseType' || field === 'courseLanguages' || 
                      field === 'subjects' || field === 'highlights' || 
                      field === 'whatYouWillLearn') {
              // Use parseArrayField helper for array fields
              updateFields[field] = parseArrayField(req.body[field]);
            } else {
              updateFields[field] = req.body[field];
            }
          }
        });
        
        // Update status based on isPublished
        if ('isPublished' in req.body) {
          updateFields.status = req.body.isPublished === 'true' || req.body.isPublished === true ? 
            'published' : 'draft';
        }
        
        // If there's a new file and an old one exists, delete the old one
        if (req.file) {
          if (course.syllabusFile) {
            fs.unlink(course.syllabusFile, (err) => {
              if (err) console.error('Error removing old file:', err);
            });
          }
          updateFields.syllabusFile = req.file.path;
        }
        
        // Update course
        const updatedCourse = await Course.findByIdAndUpdate(
          req.params.id,
          updateFields,
          { new: true, runValidators: true }
        );
        
        res.status(200).json({
          success: true,
          message: 'Course updated successfully',
          data: updatedCourse
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
    res.status(500).json({ 
      success: false, 
      message: 'Server error during course update', 
      error: error.message 
    });
  }
};

// @desc    Get all institution courses
// @route   GET /api/institution/courses
// @access  Private
exports.getInstitutionCourses = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    console.error('Error getting courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get single course
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
      return res.status(403).json({ success: false, message: 'Not authorized to view this course' });
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

// @desc    Delete course
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
    
    await course.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Promote course
// @route   POST /api/institution/courses/:id/promote
// @access  Private
exports.promoteCourse = async (req, res) => {
  try {
    const { promotionLevel } = req.body;
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if this institution owns the course
    if (course.institution.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to promote this course' });
    }
    
    course.promotionLevel = promotionLevel;
    course.isFeatured = promotionLevel === 'featured';
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: 'Course promotion updated successfully',
      data: course
    });
  } catch (error) {
    console.error('Error promoting course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Export all functions as a module
module.exports = {
  getPublicInstitutionProfile: exports.getPublicInstitutionProfile,
  getInstitutionProfile: exports.getInstitutionProfile,
  updateInstitutionContactPerson: exports.updateInstitutionContactPerson,
  getInstitutionAnalytics: exports.getInstitutionAnalytics,
  getInstitutionReviews: exports.getInstitutionReviews,
  getInstitutionEarnings: exports.getInstitutionEarnings,
  getInstitutionEnrollments: exports.getInstitutionEnrollments,
  createCourse: exports.createCourse,
  updateCourse: exports.updateCourse,
  getInstitutionCourses: exports.getInstitutionCourses,
  getCourse: exports.getCourse,
  deleteCourse: exports.deleteCourse,
  promoteCourse: exports.promoteCourse
};