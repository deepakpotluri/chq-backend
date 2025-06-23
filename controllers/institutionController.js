// institutionController.js - Updated with proper schedule handling

const Course = require('../models/Course');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/syllabus';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
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
    
    // Calculate analytics
    const totalCourses = courses.length;
    const totalEnrollments = courses.reduce((sum, course) => sum + course.currentEnrollments, 0);
    const totalRevenue = courses.reduce((sum, course) => sum + (course.price * course.currentEnrollments), 0);
    const totalViews = courses.reduce((sum, course) => sum + course.views, 0);
    const totalLeads = courses.reduce((sum, course) => sum + (course.shortlisted?.length || 0), 0);
    
    // Get published vs draft courses
    const publishedCourses = courses.filter(c => c.isPublished).length;
    const draftCourses = courses.filter(c => !c.isPublished).length;
    
    // Calculate average rating
    let totalRating = 0;
    let ratedCourses = 0;
    courses.forEach(course => {
      if (course.averageRating && course.averageRating.overall > 0) {
        totalRating += course.averageRating.overall;
        ratedCourses++;
      }
    });
    const averageRating = ratedCourses > 0 ? (totalRating / ratedCourses) : 0;
    
    // Calculate conversion rate
    const conversionRate = totalViews > 0 ? ((totalEnrollments / totalViews) * 100) : 0;
    
    // Calculate monthly growth (mock data for now)
    const monthlyGrowth = 15; // You can implement actual calculation based on historical data
    
    // Find top performing course
    const topPerformingCourse = courses.length > 0 ? 
      courses.reduce((best, course) => 
        course.currentEnrollments > (best?.currentEnrollments || 0) ? course : best
      )?.title || 'No courses available' : 'No courses available';
    
    res.status(200).json({
      success: true,
      totalViews,
      totalLeads,
      totalEnrollments,
      conversionRate: Math.round(conversionRate * 10) / 10,
      averageRating: Math.round(averageRating * 10) / 10,
      monthlyGrowth,
      topPerformingCourse,
      totalCourses,
      publishedCourses,
      draftCourses,
      totalRevenue
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
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
          schedule, // This comes as a JSON string
          syllabusDetails,
          faculty, // This also comes as a JSON string
          tags // This also comes as a JSON string
        } = req.body;
        
        // Parse JSON strings back to arrays/objects
        let parsedSchedule = [];
        let parsedFaculty = [];
        let parsedTags = [];
        
        try {
          if (schedule) {
            parsedSchedule = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
            console.log('Parsed schedule:', parsedSchedule);
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
        
        // Parse other array fields
        let parsedCourseType = courseType;
        if (typeof courseType === 'string') {
          try {
            parsedCourseType = JSON.parse(courseType);
          } catch (e) {
            parsedCourseType = [courseType];
          }
        }
        
        let parsedCourseLanguages = courseLanguages;
        if (typeof courseLanguages === 'string') {
          try {
            parsedCourseLanguages = JSON.parse(courseLanguages);
          } catch (e) {
            parsedCourseLanguages = ['english'];
          }
        }
        
        // Create course object with all fields
        const courseData = {
          title,
          description,
          price: Number(price),
          originalPrice: Number(originalPrice) || Number(price),
          discount: Number(discount) || 0,
          duration,
          institution: req.user.id,
          courseCategory,
          courseType: Array.isArray(parsedCourseType) ? parsedCourseType : [parsedCourseType],
          courseLanguages: Array.isArray(parsedCourseLanguages) ? parsedCourseLanguages : ['english'],
          subjects: subjects || [],
          city,
          state,
          address,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          highlights: highlights || [],
          whatYouWillLearn: whatYouWillLearn || [],
          maxStudents: Number(maxStudents) || 0,
          schedule: parsedSchedule, // Use parsed schedule
          faculty: parsedFaculty, // Use parsed faculty
          tags: parsedTags, // Use parsed tags
          syllabusDetails: syllabusDetails || [],
          isPublished: req.user.isVerified, // Auto-publish if institution is verified
          status: req.user.isVerified ? 'published' : 'draft'
        };
        
        // Add syllabus file if uploaded
        if (req.file) {
          courseData.syllabusFile = req.file.path;
        }
        
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
        // Find course
        const course = await Course.findById(req.params.id);
        
        if (!course) {
          return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        // Check if this institution owns the course
        if (course.institution.toString() !== req.user.id) {
          return res.status(403).json({ 
            success: false, 
            message: 'Not authorized to update this course' 
          });
        }
        
        // Parse JSON strings for complex fields
        let parsedSchedule = req.body.schedule || [];
        let parsedFaculty = req.body.faculty || [];
        let parsedTags = req.body.tags || [];
        
        // If these fields come as strings (from FormData), parse them
        if (typeof parsedSchedule === 'string') {
          try {
            parsedSchedule = JSON.parse(parsedSchedule);
            console.log('Parsed schedule for update:', parsedSchedule);
          } catch (e) {
            console.error('Error parsing schedule:', e);
            parsedSchedule = course.schedule || [];
          }
        }
        
        if (typeof parsedFaculty === 'string') {
          try {
            parsedFaculty = JSON.parse(parsedFaculty);
          } catch (e) {
            console.error('Error parsing faculty:', e);
            parsedFaculty = course.faculty || [];
          }
        }
        
        if (typeof parsedTags === 'string') {
          try {
            parsedTags = JSON.parse(parsedTags);
          } catch (e) {
            console.error('Error parsing tags:', e);
            parsedTags = course.tags || [];
          }
        }
        
        // Parse other array fields
        let parsedCourseType = req.body.courseType;
        if (typeof parsedCourseType === 'string') {
          try {
            parsedCourseType = JSON.parse(parsedCourseType);
          } catch (e) {
            parsedCourseType = [parsedCourseType];
          }
        }
        
        let parsedCourseLanguages = req.body.courseLanguages;
        if (typeof parsedCourseLanguages === 'string') {
          try {
            parsedCourseLanguages = JSON.parse(parsedCourseLanguages);
          } catch (e) {
            parsedCourseLanguages = ['english'];
          }
        }
        
        // Update fields including schedule
        const updateFields = {
          title: req.body.title || course.title,
          description: req.body.description || course.description,
          price: Number(req.body.price) || course.price,
          originalPrice: Number(req.body.originalPrice) || Number(req.body.price) || course.originalPrice,
          discount: Number(req.body.discount) || 0,
          duration: req.body.duration || course.duration,
          courseCategory: req.body.courseCategory || course.courseCategory,
          courseType: Array.isArray(parsedCourseType) ? parsedCourseType : [parsedCourseType],
          courseLanguages: Array.isArray(parsedCourseLanguages) ? parsedCourseLanguages : ['english'],
          subjects: req.body.subjects || course.subjects || [],
          city: req.body.city || course.city,
          state: req.body.state || course.state,
          address: req.body.address || course.address,
          startDate: req.body.startDate ? new Date(req.body.startDate) : course.startDate,
          endDate: req.body.endDate ? new Date(req.body.endDate) : course.endDate,
          highlights: req.body.highlights || course.highlights || [],
          whatYouWillLearn: req.body.whatYouWillLearn || course.whatYouWillLearn || [],
          maxStudents: Number(req.body.maxStudents) || course.maxStudents || 0,
          schedule: parsedSchedule, // Use parsed schedule
          faculty: parsedFaculty, // Use parsed faculty
          tags: parsedTags, // Use parsed tags
          syllabusDetails: req.body.syllabusDetails || course.syllabusDetails || [],
          updatedAt: Date.now()
        };
        
        // Update status based on publication
        if (req.body.isPublished !== undefined) {
          updateFields.isPublished = req.body.isPublished;
          updateFields.status = req.body.isPublished ? 'published' : 'draft';
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

// @desc    Get institution reviews
// @route   GET /api/institution/reviews
// @access  Private
exports.getInstitutionReviews = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .populate({
        path: 'reviews.user',
        select: 'name email'
      });
    
    // Extract all reviews
    const allReviews = [];
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          allReviews.push({
            _id: review._id,
            rating: review.courseRating, // Changed from review.rating to review.courseRating
            courseRating: review.courseRating, // Add this for compatibility
            instituteRating: review.instituteRating,
            facultyRating: review.facultyRating,
            comment: review.reviewText, // Changed from review.comment to review.reviewText
            student: review.user, // This will contain the populated user data
            courseTitle: course.title,
            courseName: course.title,
            courseId: course._id,
            createdAt: review.createdAt,
            verificationStatus: review.verificationStatus,
            reviewText: review.reviewText, // Use the actual reviewText field
            helpfulVotes: review.helpfulVotes || 0,
            rejectionReason: review.rejectionReason
          });
        });
      }
    });
    
    // Sort by date (newest first)
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.status(200).json({
      success: true,
      count: allReviews.length,
      reviews: allReviews // Changed from 'data' to 'reviews'
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
    
    let totalEarnings = 0;
    let monthlyBreakdown = [];
    let monthlyData = {};
    
    // Get current date
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    courses.forEach(course => {
      const courseEarnings = course.price * course.currentEnrollments;
      totalEarnings += courseEarnings;
      
      // Process enrollments for monthly breakdown
      if (course.enrollments && course.enrollments.length > 0) {
        course.enrollments.forEach(enrollment => {
          if (enrollment.paymentStatus === 'completed' && enrollment.enrolledAt) {
            const enrollDate = new Date(enrollment.enrolledAt);
            const monthKey = `${enrollDate.getFullYear()}-${String(enrollDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
              monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += enrollment.amount || course.price;
          }
        });
      }
    });
    
    // Convert monthly data to array format
    const sortedMonths = Object.keys(monthlyData).sort();
    monthlyBreakdown = sortedMonths.map(month => ({
      month,
      amount: monthlyData[month]
    }));
    
    // Calculate this month's earnings
    const thisMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const thisMonthEarnings = monthlyData[thisMonthKey] || 0;
    
    // Mock pending and completed payouts (you can implement actual payout tracking)
    const pendingPayouts = totalEarnings * 0.1; // 10% as pending
    const completedPayouts = totalEarnings * 0.9; // 90% as completed
    
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

// @desc    Get institution enrollments
// @route   GET /api/institution/enrollments
// @access  Private
exports.getInstitutionEnrollments = async (req, res) => {
  try {
    const courses = await Course.find({ institution: req.user.id })
      .populate({
        path: 'enrollments.user',
        select: 'name email'
      });
    
    // Extract all enrollments
    const allEnrollments = [];
    courses.forEach(course => {
      if (course.enrollments && course.enrollments.length > 0) {
        course.enrollments.forEach(enrollment => {
          if (enrollment.paymentStatus === 'completed') {
            allEnrollments.push({
              _id: enrollment._id,
              student: enrollment.user, // This will contain the populated user data
              courseTitle: course.title,
              courseName: course.title,
              courseId: course._id,
              enrolledAt: enrollment.enrolledAt,
              amount: enrollment.amount || course.price,
              paymentStatus: enrollment.paymentStatus
            });
          }
        });
      }
    });
    
    // Sort by date (newest first)
    allEnrollments.sort((a, b) => new Date(b.enrolledAt) - new Date(a.enrolledAt));
    
    res.status(200).json({
      success: true,
      count: allEnrollments.length,
      enrollments: allEnrollments // Changed from 'data' to 'enrollments'
    });
  } catch (error) {
    console.error('Error getting enrollments:', error);
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

module.exports = exports;