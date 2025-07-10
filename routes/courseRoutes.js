// routes/courseRoutes.js - Complete with Review Restrictions
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Shortlist = require('../models/Shortlist');
const { protect, authorize } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// @desc    Get all published courses with advanced filters
// @route   GET /api/courses/published
// @access  Public
router.get('/published', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Build query object
    const query = { isPublished: true, status: 'published' };
    
    // Search functionality
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(req.query.search, 'i')] } }
      ];
    }
    
    // Category filter
    if (req.query.category) {
      query.courseCategory = req.query.category;
    }
    
    // Course type filter
    if (req.query.type) {
      query.courseType = { $in: [req.query.type] };
    }
    
    // Location filters
    if (req.query.city) {
      query.city = { $regex: req.query.city, $options: 'i' };
    }
    if (req.query.state) {
      query.state = req.query.state;
    }
    
    // Language filter
    if (req.query.language) {
      query.courseLanguages = { $in: [req.query.language] };
    }
    
    if (req.query.homepage === 'true') {
  query.homepagePromotionEnabled = true;
  
  const courses = await Course.find(query)
    .sort('homepagePromotionOrder')
    .limit(4)
    .populate('institution', 'institutionName email verified')
    .lean();
  
  return res.status(200).json({
    success: true,
    data: courses
  });
}
    // Price range filters
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = parseInt(req.query.maxPrice);
    }
    
    // Price range preset filter
    if (req.query.priceRange) {
      const [min, max] = req.query.priceRange.split('-');
      if (max === undefined) {
        // Handle "50000+" format
        query.price = { $gte: parseInt(min.replace('+', '')) };
      } else {
        query.price = { $gte: parseInt(min), $lte: parseInt(max) };
      }
    }
    
    // Start date filter
    if (req.query.startDate) {
      query.startDate = { $gte: new Date(req.query.startDate) };
    }
    
    // Rating filter
    if (req.query.rating) {
      query['averageRating.overall'] = { $gte: parseFloat(req.query.rating) };
    }
    
    // Promotion filters
    if (req.query.featured === 'true' || req.query.isFeatured === 'true') {
      query.isFeatured = true;
    }
    if (req.query.promoted === 'true') {
      query.promotionLevel = { $ne: 'none' };
    }
    
    // Build sort object
    let sort = {};
    switch (req.query.sort) {
      case 'price-low':
        sort.price = 1;
        break;
      case 'price-high':
        sort.price = -1;
        break;
      case 'rating':
        sort['averageRating.overall'] = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'start-date':
        sort.startDate = 1;
        break;
      case 'popularity':
        sort.views = -1;
        break;
      default:
        // Default relevance sorting - prioritize featured and promoted courses
        sort = { 
          isFeatured: -1, 
          promotionLevel: -1, 
          'averageRating.overall': -1, 
          createdAt: -1 
        };
    }
    
    // Execute query with population
    const courses = await Course.find(query)
      .skip(skip)
      .limit(limit)
      .sort(sort)
      .populate('institution', 'institutionName email')
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
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get single course by ID - Only show approved reviews
// @route   GET /api/courses/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('institution', 'institutionName email')
      .populate({
        path: 'reviews.user',
        select: 'name'
      });
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // For unpublished courses, only show to the institution that owns it
    if (!course.isPublished || course.status !== 'published') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
        if (decoded.id !== course.institution._id.toString()) {
          return res.status(404).json({ success: false, message: 'Course not found' });
        }
      } catch (err) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
    }
    
    // Filter reviews to only show approved ones to public
    const courseData = course.toObject();
    courseData.reviews = courseData.reviews.filter(review => review.verificationStatus === 'approved');
    
    res.status(200).json({
      success: true,
      data: courseData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Increment course view count
// @route   POST /api/courses/:id/view
// @access  Public
router.post('/:id/view', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    await course.addView();
    
    res.status(200).json({
      success: true,
      message: 'View count updated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Add review to course (Only aspirants can review)
// @route   POST /api/courses/:id/reviews
// @access  Private (Aspirants only)
router.post('/:id/reviews', protect, authorize('aspirant'), async (req, res) => {
  try {
    const { courseRating, instituteRating, facultyRating, reviewText } = req.body;
    
    if (!courseRating || !instituteRating || !facultyRating || !reviewText) {
      return res.status(400).json({
        success: false,
        message: 'All rating fields and review text are required'
      });
    }
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if user has already reviewed this course
    const existingReview = course.reviews.find(
      review => review.user.toString() === req.user.id
    );
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this course'
      });
    }
    
    // Check if user is enrolled in the course (for verification badge)
    const isEnrolled = course.enrollments.some(
      enrollment => enrollment.user.toString() === req.user.id && 
                   enrollment.paymentStatus === 'completed'
    );
    
    const newReview = {
      user: req.user.id,
      courseRating: parseInt(courseRating),
      instituteRating: parseInt(instituteRating),
      facultyRating: parseInt(facultyRating),
      reviewText: reviewText.trim(),
      isVerified: isEnrolled, // This is enrollment verification, not admin verification
      verificationStatus: 'pending', // All reviews start as pending
      isVisible: false, // Not visible until approved
      helpfulVotes: 0,
      notHelpfulVotes: 0,
      votedBy: []
    };
    
    course.reviews.push(newReview);
    await course.save();
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully. It will be visible after admin verification.',
      data: {
        ...newReview,
        verificationMessage: 'Your review has been sent for verification and will appear once approved.'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Vote on a review
// @route   POST /api/courses/:id/reviews/:reviewId/vote
// @access  Private
router.post('/:id/reviews/:reviewId/vote', protect, async (req, res) => {
  try {
    const { vote } = req.body; // 'helpful' or 'not_helpful'
    
    if (!['helpful', 'not_helpful'].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: 'Vote must be either "helpful" or "not_helpful"'
      });
    }
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    const review = course.reviews.id(req.params.reviewId);
    
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    
    // Only allow voting on approved reviews
    if (review.verificationStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot vote on unverified reviews' });
    }
    
    // Check if user has already voted on this review
    const existingVote = review.votedBy.find(
      v => v.user.toString() === req.user.id
    );
    
    if (existingVote) {
      // Update existing vote
      if (existingVote.vote === 'helpful') {
        review.helpfulVotes--;
      } else {
        review.notHelpfulVotes--;
      }
      
      existingVote.vote = vote;
      
      if (vote === 'helpful') {
        review.helpfulVotes++;
      } else {
        review.notHelpfulVotes++;
      }
    } else {
      // Add new vote
      review.votedBy.push({
        user: req.user.id,
        vote: vote
      });
      
      if (vote === 'helpful') {
        review.helpfulVotes++;
      } else {
        review.notHelpfulVotes++;
      }
    }
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: 'Vote recorded successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get course syllabus file
// @route   GET /api/courses/:id/syllabus
// @access  Public
router.get('/:id/syllabus', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course || !course.syllabusFile) {
      return res.status(404).json({ success: false, message: 'Syllabus not found' });
    }
    
    res.download(course.syllabusFile, `${course.title}-syllabus.pdf`);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Search courses with location-based results
// @route   GET /api/courses/search/nearby
// @access  Public
router.get('/search/nearby', async (req, res) => {
  try {
    const { lat, lng, maxDistance = 50000, ...otherFilters } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    const courses = await Course.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(maxDistance)
    );
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get course recommendations based on user preferences
// @route   GET /api/courses/recommendations
// @access  Private
router.get('/recommendations', protect, async (req, res) => {
  try {
    // Get user's shortlisted courses to understand preferences
    const shortlist = await Shortlist.findOne({ user: req.user.id })
      .populate('courses.course', 'courseCategory tags city courseLanguages');
    
    let recommendations = [];
    
    if (shortlist && shortlist.courses.length > 0) {
      // Extract preferences from shortlisted courses
      const categories = [...new Set(shortlist.courses.map(c => c.course.courseCategory))];
      const tags = [...new Set(shortlist.courses.flatMap(c => c.course.tags))];
      const cities = [...new Set(shortlist.courses.map(c => c.course.city))];
      const languages = [...new Set(shortlist.courses.flatMap(c => c.course.courseLanguages))];
      
      // Find similar courses
      recommendations = await Course.find({
        isPublished: true,
        status: 'published',
        $or: [
          { courseCategory: { $in: categories } },
          { tags: { $in: tags } },
          { city: { $in: cities } },
          { courseLanguages: { $in: languages } }
        ]
      })
      .limit(10)
      .sort({ 'averageRating.overall': -1, views: -1 })
      .populate('institution', 'institutionName');
    } else {
      // If no preferences available, return top-rated courses
      recommendations = await Course.find({
        isPublished: true,
        status: 'published'
      })
      .limit(10)
      .sort({ 'averageRating.overall': -1, totalReviews: -1 })
      .populate('institution', 'institutionName');
    }
    
    res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get trending courses
// @route   GET /api/courses/trending
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const trendingCourses = await Course.find({
      isPublished: true,
      status: 'published',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    })
    .sort({ views: -1, shortlisted: -1, currentEnrollments: -1 })
    .limit(10)
    .populate('institution', 'institutionName');
    
    res.status(200).json({
      success: true,
      count: trendingCourses.length,
      data: trendingCourses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get course statistics for admin
// @route   GET /api/courses/admin/stats
// @access  Private (Admin only)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ isPublished: true });
    const totalEnrollments = await Course.aggregate([
      { $group: { _id: null, total: { $sum: '$currentEnrollments' } } }
    ]);
    const totalRevenue = await Course.aggregate([
      { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$currentEnrollments'] } } } }
    ]);
    
    res.status(200).json({
      success: true,
      stats: {
        totalCourses,
        publishedCourses,
        totalEnrollments: totalEnrollments[0]?.total || 0,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get single course with proper review filtering
// @route   GET /api/courses/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('institution', 'institutionName email')
      .populate({
        path: 'reviews.user',
        select: 'name email'
      })
      .populate({
        path: 'reviews.verifiedBy',
        select: 'name'
      });
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check user authorization
    let userRole = 'public';
    let userId = null;
    
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
        userRole = decoded.role;
        userId = decoded.id;
      } catch (err) {
        // Invalid token, treat as public user
      }
    }
    
    // For unpublished courses, only show to the institution that owns it or admins
    if (!course.isPublished || course.status !== 'published') {
      if (userRole === 'admin') {
        // Admins can see everything
      } else if (userRole === 'institution' && userId === course.institution._id.toString()) {
        // Institution can see their own courses
      } else {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
    }
    
    // Filter reviews based on user role
    const courseData = course.toObject();
    
    if (userRole === 'admin') {
      // Admins see all reviews with full details
      courseData.reviews = courseData.reviews.map(review => ({
        ...review,
        canModerate: true
      }));
    } else if (userRole === 'institution' && userId === course.institution._id.toString()) {
      // Institutions see all reviews for their courses
      courseData.reviews = courseData.reviews;
    } else {
      // Public users and aspirants only see approved reviews
      courseData.reviews = courseData.reviews.filter(
        review => review.verificationStatus === 'approved' && review.isVisible
      );
    }
    
    res.status(200).json({
      success: true,
      data: courseData,
      userPermissions: {
        canModerateReviews: userRole === 'admin',
        canEditCourse: userRole === 'institution' && userId === course.institution._id.toString(),
        isOwner: userRole === 'institution' && userId === course.institution._id.toString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/:id/complete', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('institution', 'institutionName email')
      .populate({
        path: 'reviews.user',
        select: 'name'
      });
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Return all reviews without filtering for logged-in users
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// institutionController.js - Update the createCourse and updateCourse methods to handle schedule

// @desc    Create new course
// @route   POST /api/institution/courses
// @access  Private
exports.createCourse = async (req, res) => {
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
      schedule, // Add schedule field
      syllabusDetails
    } = req.body;
    
    // Create course object with all fields
    const courseData = {
      title,
      description,
      price,
      originalPrice: originalPrice || price,
      discount: discount || 0,
      duration,
      institution: req.user.id,
      courseCategory,
      courseType: Array.isArray(courseType) ? courseType : [courseType],
      courseLanguages: Array.isArray(courseLanguages) ? courseLanguages : ['english'],
      subjects: subjects || [],
      city,
      state,
      address,
      startDate,
      endDate,
      highlights: highlights || [],
      whatYouWillLearn: whatYouWillLearn || [],
      maxStudents: maxStudents || 0,
      schedule: schedule || [], // Include schedule
      syllabusDetails: syllabusDetails || [],
      isPublished: req.user.isVerified // Auto-publish if institution is verified
    };
    
    const course = await Course.create(courseData);
    
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
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
    
    // Update fields including schedule
    const updateFields = {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      originalPrice: req.body.originalPrice || req.body.price,
      discount: req.body.discount || 0,
      duration: req.body.duration,
      courseCategory: req.body.courseCategory,
      courseType: Array.isArray(req.body.courseType) ? req.body.courseType : [req.body.courseType],
      courseLanguages: Array.isArray(req.body.courseLanguages) ? req.body.courseLanguages : ['english'],
      subjects: req.body.subjects || [],
      city: req.body.city,
      state: req.body.state,
      address: req.body.address,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      highlights: req.body.highlights || [],
      whatYouWillLearn: req.body.whatYouWillLearn || [],
      maxStudents: req.body.maxStudents || 0,
      schedule: req.body.schedule || [], // Include schedule in update
      syllabusDetails: req.body.syllabusDetails || [],
      updatedAt: Date.now()
    };
    
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
    console.error('Error updating course:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during course update', 
      error: error.message 
    });
  }
};

module.exports = router;