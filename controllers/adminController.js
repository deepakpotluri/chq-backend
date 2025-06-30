// controllers/adminController.js - Complete Updated Admin Controller
const User = require('../models/User');
const Course = require('../models/Course');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private
exports.getAdminStats = async (req, res) => {
  try {
    const aspirantCount = await User.countDocuments({ role: 'aspirant' });
    const institutionCount = await User.countDocuments({ role: 'institution' });
    const verifiedInstitutions = await User.countDocuments({ 
      role: 'institution', 
      isVerified: true 
    });
    const pendingInstitutions = await User.countDocuments({ 
      role: 'institution', 
      isVerified: false 
    });
    const courseCount = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ isPublished: true });
    
    // Count pending reviews across all courses - FIXED
    const coursesWithReviews = await Course.find({ 
      'reviews': { $exists: true, $ne: [] } 
    });
    
    let pendingReviews = 0;
    let approvedReviews = 0;
    let rejectedReviews = 0;
    
    coursesWithReviews.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          // Only count reviews that are actually pending
          if (review.verificationStatus === 'pending' && !review.isVerified) {
            pendingReviews++;
          } else if (review.verificationStatus === 'approved' || review.isVerified) {
            approvedReviews++;
          } else if (review.verificationStatus === 'rejected') {
            rejectedReviews++;
          }
        });
      }
    });
    
    res.status(200).json({
      success: true,
      aspirantCount,
      institutionCount,
      verifiedInstitutions,
      pendingInstitutions,
      courseCount,
      publishedCourses,
      pendingReviews,
      approvedReviews,
      rejectedReviews,
      totalReviews: pendingReviews + approvedReviews + rejectedReviews
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all users with filters
// @route   GET /api/admin/users
// @access  Private
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') }
      ];
    }
    
    const users = await User
      .find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all institutions with filters
// @route   GET /api/admin/institutions
// @access  Private
exports.getInstitutions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = { role: 'institution' };
    if (req.query.isVerified !== undefined) {
      filter.isVerified = req.query.isVerified === 'true';
    }
    if (req.query.search) {
      filter.$or = [
        { institutionName: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') }
      ];
    }
    
    const institutions = await User
      .find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: institutions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting institutions:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Verify institution
// @route   PUT /api/admin/institutions/:id/verify
// @access  Private
exports.verifyInstitution = async (req, res) => {
  try {
    const institution = await User.findById(req.params.id);
    
    if (!institution || institution.role !== 'institution') {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    institution.isVerified = true;
    institution.verifiedAt = new Date();
    institution.verifiedBy = req.user.id;
    
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: 'Institution verified successfully',
      data: institution
    });
  } catch (error) {
    console.error('Error verifying institution:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update institution status
// @route   PUT /api/admin/institutions/:id/status
// @access  Private
exports.updateInstitutionStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const institution = await User.findById(req.params.id);
    
    if (!institution || institution.role !== 'institution') {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    if (status === 'active') {
      institution.isActive = true;
      institution.deactivatedAt = null;
    } else if (status === 'inactive') {
      institution.isActive = false;
      institution.deactivatedAt = new Date();
      institution.deactivationReason = reason;
    }
    
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: `Institution ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: institution
    });
  } catch (error) {
    console.error('Error updating institution status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all courses with filters
// @route   GET /api/admin/courses
// @access  Private
exports.getAllCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    if (req.query.isPublished !== undefined) {
      filter.isPublished = req.query.isPublished === 'true';
    }
    if (req.query.search) {
      filter.$or = [
        { title: new RegExp(req.query.search, 'i') },
        { category: new RegExp(req.query.search, 'i') }
      ];
    }
    
    const courses = await Course
      .find(filter)
      .populate('institution', 'institutionName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Course.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Toggle course publication status
// @route   PUT /api/admin/courses/:id/publish
// @access  Private
exports.toggleCoursePublication = async (req, res) => {
  try {
    const { action, reason } = req.body;
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    const isPublished = action === 'publish';
    course.isPublished = isPublished;
    course.publishStatus = isPublished ? 'published' : 'suspended';
    course.adminAction = {
      action: isPublished ? 'published' : 'unpublished',
      reason: reason || '',
      actionBy: req.user.id,
      actionAt: new Date()
    };
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: `Course ${isPublished ? 'published' : 'unpublished'} successfully`,
      data: course
    });
  } catch (error) {
    console.error('Error toggling course publication:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all pending reviews - UPDATED
// @route   GET /api/admin/reviews/pending
// @access  Private
exports.getPendingReviews = async (req, res) => {
  try {
    // More specific query to find only pending reviews
    const courses = await Course.find({
      'reviews': {
        $elemMatch: {
          verificationStatus: 'pending',
          isVerified: { $ne: true }
        }
      }
    }).populate('reviews.user', 'name email').lean();
    
    const pendingReviews = [];
    
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          // Double-check that review is actually pending
          if (review.verificationStatus === 'pending' && !review.isVerified) {
            pendingReviews.push({
              reviewId: review._id,
              courseId: course._id,
              courseTitle: course.title,
              user: review.user || { name: 'Anonymous', email: 'N/A' },
              courseRating: review.courseRating,
              instituteRating: review.instituteRating,
              facultyRating: review.facultyRating,
              reviewText: review.reviewText,
              createdAt: review.createdAt,
              verificationStatus: review.verificationStatus,
              isVerified: review.isVerified
            });
          }
        });
      }
    });
    
    // Sort by creation date (newest first)
    pendingReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.status(200).json({
      success: true,
      count: pendingReviews.length,
      data: pendingReviews
    });
  } catch (error) {
    console.error('Error getting pending reviews:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Verify review - UPDATED
// @route   PUT /api/admin/reviews/:courseId/:reviewId/verify
// @access  Private
exports.verifyReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const { action, rejectionReason } = req.body;
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    const review = course.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    
    // Update review based on action
    if (action === 'approve') {
      review.verificationStatus = 'approved';
      review.isVisible = true;
      review.isVerified = true;
    } else if (action === 'reject') {
      review.verificationStatus = 'rejected';
      review.isVisible = false;
      review.isVerified = false;
      review.rejectionReason = rejectionReason;
    } else if (action === 'archive') {
      review.verificationStatus = 'archived';
      review.isVisible = false;
      review.isVerified = false;
    }
    
    review.verifiedBy = req.user.id;
    review.verifiedAt = new Date();
    
    await course.save();
    
    // Recalculate course average ratings if review was approved
    if (action === 'approve') {
      const visibleReviews = course.reviews.filter(r => r.isVisible && r.isVerified);
      if (visibleReviews.length > 0) {
        course.averageRating = visibleReviews.reduce((sum, r) => sum + r.courseRating, 0) / visibleReviews.length;
        course.totalReviews = visibleReviews.length;
        await course.save();
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Review ${action}d successfully`,
      data: review
    });
  } catch (error) {
    console.error('Error verifying review:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get login activity
// @route   GET /api/admin/activity/logins
// @access  Private
exports.getLoginActivity = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const loginActivity = await User
      .find({})
      .select('email role lastLogin loginCount')
      .sort({ lastLogin: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments();
    
    res.status(200).json({
      success: true,
      data: loginActivity,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting login activity:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get system overview
// @route   GET /api/admin/system/overview
// @access  Private
exports.getSystemOverview = async (req, res) => {
  try {
    const overview = {
      database: {
        status: 'connected',
        collections: {
          users: await User.countDocuments(),
          courses: await Course.countDocuments()
        }
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    };
    
    res.status(200).json({
      success: true,
      overview
    });
  } catch (error) {
    console.error('Error getting system overview:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isActive = isActive;
    if (!isActive) {
      user.deactivatedAt = new Date();
    } else {
      user.deactivatedAt = null;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};