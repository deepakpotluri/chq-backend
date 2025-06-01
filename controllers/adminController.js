// controllers/adminController.js - Fixed Admin Controller
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
    
    // Count pending reviews across all courses
    const coursesWithReviews = await Course.find({ 'reviews.0': { $exists: true } });
    let pendingReviews = 0;
    coursesWithReviews.forEach(course => {
      pendingReviews += course.reviews.filter(r => r.verificationStatus === 'pending').length;
    });
    
    res.status(200).json({
      success: true,
      aspirantCount,
      institutionCount,
      verifiedInstitutions,
      pendingInstitutions,
      courseCount,
      publishedCourses,
      pendingReviews
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
    const { role, isVerified } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    
    const users = await User
      .find(query)
      .skip(skip)
      .limit(limit)
      .select('-password')
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    // Add login activity data
    const usersWithActivity = users.map(user => ({
      ...user.toObject(),
      lastLogin: user.lastLogin || null,
      loginCount: user.loginCount || 0
    }));
    
    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: usersWithActivity
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all institutions with detailed info
// @route   GET /api/admin/institutions
// @access  Private
exports.getInstitutions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { isVerified } = req.query;
    
    const query = { role: 'institution' };
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    
    const institutions = await User
      .find(query)
      .skip(skip)
      .limit(limit)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get course count for each institution
    const institutionsWithStats = await Promise.all(
      institutions.map(async (inst) => {
        const courseCount = await Course.countDocuments({ institution: inst._id });
        const publishedCourseCount = await Course.countDocuments({ 
          institution: inst._id, 
          isPublished: true 
        });
        
        return {
          ...inst,
          courseCount,
          publishedCourseCount,
          lastLogin: inst.lastLogin || null,
          loginCount: inst.loginCount || 0
        };
      })
    );
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: institutions.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: institutionsWithStats
    });
  } catch (error) {
    console.error('Error getting institutions:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Verify/Unverify institution
// @route   PUT /api/admin/institutions/:id/verify
// @access  Private
exports.verifyInstitution = async (req, res) => {
  try {
    const { isVerified } = req.body;
    const institution = await User.findById(req.params.id);
    
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    if (institution.role !== 'institution') {
      return res.status(400).json({ success: false, message: 'User is not an institution' });
    }
    
    institution.isVerified = isVerified;
    institution.verifiedAt = isVerified ? new Date() : null;
    institution.verifiedBy = isVerified ? req.user.id : null;
    
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: `Institution ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: institution
    });
  } catch (error) {
    console.error('Error verifying institution:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delist/Relist institution
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
    if (!isActive && reason) {
      institution.delistReason = reason;
    } else if (isActive) {
      institution.delistReason = undefined;
    }
    institution.statusUpdatedAt = new Date();
    institution.statusUpdatedBy = req.user.id;
    
    await institution.save();
    
    // If delisting, unpublish all their courses
    if (!isActive) {
      await Course.updateMany(
        { institution: institution._id },
        { 
          isPublished: false, 
          status: 'suspended',
          adminAction: {
            action: 'unpublished',
            reason: `Institution delisted: ${reason}`,
            actionBy: req.user.id,
            actionAt: new Date()
          }
        }
      );
    }
    
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

// @desc    Get all courses with admin controls
// @route   GET /api/admin/courses
// @access  Private
exports.getAllCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { isPublished, status, institutionId } = req.query;
    
    const query = {};
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';
    if (status) query.status = status;
    if (institutionId) query.institution = institutionId;
    
    const courses = await Course
      .find(query)
      .populate('institution', 'institutionName email isVerified')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
    
    const total = await Course.countDocuments(query);
    
    // Ensure all fields are properly formatted
    const formattedCourses = courses.map(course => ({
      ...course,
      price: course.price || 0,
      currentEnrollments: course.currentEnrollments || 0,
      views: course.views || 0,
      averageRating: course.averageRating || { overall: 0 },
      totalReviews: course.totalReviews || 0
    }));
    
    res.status(200).json({
      success: true,
      count: courses.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: formattedCourses
    });
  } catch (error) {
    console.error('Error getting courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Unpublish/Publish course
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

// @desc    Get all pending reviews
// @route   GET /api/admin/reviews/pending
// @access  Private
exports.getPendingReviews = async (req, res) => {
  try {
    const courses = await Course.find({
      'reviews.verificationStatus': 'pending'
    }).populate('reviews.user', 'name email').lean();
    
    const pendingReviews = [];
    
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          if (review.verificationStatus === 'pending') {
            pendingReviews.push({
              reviewId: review._id,
              courseId: course._id,
              courseTitle: course.title,
              user: review.user || { name: 'Anonymous', email: 'N/A' },
              courseRating: review.courseRating,
              instituteRating: review.instituteRating,
              facultyRating: review.facultyRating,
              reviewText: review.reviewText,
              createdAt: review.createdAt
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

// @desc    Verify review
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
    
    if (action === 'approve') {
      review.verificationStatus = 'approved';
      review.isVisible = true;
      review.isVerified = true;
    } else if (action === 'reject') {
      review.verificationStatus = 'rejected';
      review.isVisible = false;
      review.rejectionReason = rejectionReason;
    }
    
    review.verifiedBy = req.user.id;
    review.verifiedAt = new Date();
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: `Review ${action}ed successfully`,
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
      .limit(limit)
      .lean();
    
    const formattedActivity = loginActivity.map(activity => ({
      _id: activity._id,
      email: activity.email,
      role: activity.role,
      lastLogin: activity.lastLogin || null,
      loginCount: activity.loginCount || 0
    }));
    
    res.status(200).json({
      success: true,
      data: formattedActivity
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
    // Revenue calculations
    const allCourses = await Course.find({}).lean();
    let totalRevenue = 0;
    let totalEnrollments = 0;
    
    allCourses.forEach(course => {
      const price = course.price || 0;
      const enrollments = course.currentEnrollments || 0;
      const revenue = price * enrollments;
      totalRevenue += revenue;
      totalEnrollments += enrollments;
    });
    
    // Get recent activities
    const recentInstitutions = await User
      .find({ role: 'institution' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('institutionName email createdAt isVerified')
      .lean();
    
    const recentCourses = await Course
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('institution', 'institutionName')
      .select('title institution createdAt isPublished')
      .lean();
    
    res.status(200).json({
      success: true,
      overview: {
        totalRevenue,
        totalEnrollments,
        averageRevenuePerCourse: allCourses.length > 0 ? (totalRevenue / allCourses.length).toFixed(2) : 0,
        recentInstitutions: recentInstitutions || [],
        recentCourses: recentCourses || []
      }
    });
  } catch (error) {
    console.error('Error getting system overview:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update user status (activate/deactivate)
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