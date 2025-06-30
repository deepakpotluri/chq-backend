// controllers/adminController.js - Updated with getAllReviews functionality
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
      aspirantCount,
      institutionCount,
      verifiedInstitutions,
      pendingInstitutions,
      courseCount,
      publishedCourses,
      pendingReviews,
      approvedReviews,
      rejectedReviews
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.isVerified) query.isVerified = req.query.isVerified === 'true';
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
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
    console.error('Error getting all users:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all institutions
// @route   GET /api/admin/institutions
// @access  Private
exports.getInstitutions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    let query = { role: 'institution' };
    if (req.query.isVerified !== undefined && req.query.isVerified !== '') {
      query.isVerified = req.query.isVerified === 'true';
    }
    
    const institutions = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
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
    const { isApproved, rejectionReason } = req.body;
    
    const institution = await User.findById(req.params.id);
    
    if (!institution || institution.role !== 'institution') {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    institution.isVerified = isApproved;
    institution.verificationStatus = isApproved ? 'approved' : 'rejected';
    institution.verifiedAt = isApproved ? new Date() : undefined;
    institution.rejectionReason = !isApproved ? rejectionReason : undefined;
    institution.verifiedBy = req.user.id;
    
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: `Institution ${isApproved ? 'approved' : 'rejected'} successfully`,
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
    const { isActive, reason } = req.body;
    
    const institution = await User.findById(req.params.id);
    
    if (!institution || institution.role !== 'institution') {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    institution.isActive = isActive;
    institution.deactivationReason = !isActive ? reason : undefined;
    institution.lastStatusUpdate = new Date();
    institution.statusUpdatedBy = req.user.id;
    
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: `Institution ${isActive ? 'activated' : 'delisted'} successfully`,
      data: institution
    });
  } catch (error) {
    console.error('Error updating institution status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all courses
// @route   GET /api/admin/courses
// @access  Private
exports.getAllCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (req.query.isPublished !== undefined && req.query.isPublished !== '') {
      query.isPublished = req.query.isPublished === 'true';
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    const courses = await Course.find(query)
      .populate('institution', 'institutionName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Course.countDocuments(query);
    
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
    console.error('Error getting all courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Toggle course publication status
// @route   PUT /api/admin/courses/:id/publish
// @access  Private
exports.toggleCoursePublication = async (req, res) => {
  try {
    const { isPublished, reason } = req.body;
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    course.isPublished = isPublished;
    course.status = isPublished ? 'published' : 'suspended';
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

// @desc    Get all reviews with filters - NEW ENDPOINT
// @route   GET /api/admin/reviews/all
// @access  Private
exports.getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    
    // Find all courses with reviews
    let query = { 'reviews': { $exists: true, $ne: [] } };
    
    const courses = await Course.find(query)
      .populate('reviews.user', 'name email')
      .populate('institution', 'institutionName')
      .lean();
    
    // Extract and filter reviews
    let allReviews = [];
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          // Filter based on status
          let includeReview = false;
          if (!status || status === '' || status === 'all') {
            includeReview = true;
          } else if (status === 'approved' && (review.verificationStatus === 'approved' || review.isVerified)) {
            includeReview = true;
          } else if (status === 'rejected' && review.verificationStatus === 'rejected') {
            includeReview = true;
          } else if (status === 'archived' && review.verificationStatus === 'archived') {
            includeReview = true;
          } else if (status === 'pending' && review.verificationStatus === 'pending' && !review.isVerified) {
            includeReview = true;
          }
          
          if (includeReview) {
            allReviews.push({
              reviewId: review._id,
              courseId: course._id,
              courseTitle: course.title,
              institutionName: course.institution?.institutionName || 'Unknown',
              user: review.user || { name: 'Anonymous', email: 'N/A' },
              courseRating: review.courseRating,
              instituteRating: review.instituteRating,
              facultyRating: review.facultyRating,
              reviewText: review.reviewText,
              createdAt: review.createdAt,
              verificationStatus: review.verificationStatus || (review.isVerified ? 'approved' : 'pending'),
              isVerified: review.isVerified,
              isVisible: review.isVisible,
              verifiedAt: review.verifiedAt,
              rejectionReason: review.rejectionReason
            });
          }
        });
      }
    });
    
    // Sort by creation date (newest first)
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Paginate
    const total = allReviews.length;
    const paginatedReviews = allReviews.slice(skip, skip + limit);
    
    res.status(200).json({
      success: true,
      data: paginatedReviews,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting all reviews:', error);
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
      review.verifiedAt = new Date();
      review.verifiedBy = req.user.id;
      review.rejectionReason = undefined;
    } else if (action === 'reject') {
      review.verificationStatus = 'rejected';
      review.isVisible = false;
      review.isVerified = false;
      review.rejectionReason = rejectionReason;
      review.verifiedBy = req.user.id;
      review.verifiedAt = new Date();
    } else if (action === 'archive') {
      review.verificationStatus = 'archived';
      review.isVisible = false;
      review.verifiedBy = req.user.id;
      review.verifiedAt = new Date();
    }
    
    await course.save();
    
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
    const limit = parseInt(req.query.limit) || 50;
    
    const recentLogins = await User.find({ lastLogin: { $exists: true } })
      .select('name email role lastLogin ipAddress')
      .sort({ lastLogin: -1 })
      .limit(limit);
    
    res.status(200).json({
      success: true,
      data: recentLogins
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
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await Course.aggregate([
      { $unwind: '$enrollments' },
      { $count: 'total' }
    ]);
    
    const overview = {
      totalUsers,
      activeUsers,
      totalCourses,
      totalEnrollments: totalEnrollments[0]?.total || 0,
      systemHealth: 'Operational',
      lastUpdated: new Date()
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
    user.lastStatusUpdate = new Date();
    user.statusUpdatedBy = req.user.id;
    
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