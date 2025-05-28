// routes/aspirantRoutes.js - Enhanced version with shortlist and enrollment features
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Course = require('../models/Course');
const Shortlist = require('../models/Shortlist');

// Apply auth middleware to all routes
router.use(protect);
router.use(authorize('aspirant'));

// @desc    Get aspirant profile
// @route   GET /api/aspirant/profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error getting aspirant profile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Update aspirant profile
// @route   PUT /api/aspirant/profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    
    // Check if email is already used by another user
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error updating aspirant profile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get user's shortlisted courses
// @route   GET /api/aspirant/shortlist
// @access  Private
router.get('/shortlist', async (req, res) => {
  try {
    let shortlist = await Shortlist.findOne({ user: req.user.id })
      .populate({
        path: 'courses.course',
        populate: {
          path: 'institution',
          select: 'institutionName'
        }
      });

    if (!shortlist) {
      // Create empty shortlist if doesn't exist
      shortlist = await Shortlist.create({
        user: req.user.id,
        courses: []
      });
    }

    res.status(200).json({
      success: true,
      courses: shortlist.courses
    });
  } catch (error) {
    console.error('Error getting shortlist:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Add course to shortlist
// @route   POST /api/aspirant/shortlist/:courseId
// @access  Private
router.post('/shortlist/:courseId', async (req, res) => {
  try {
    const { notes } = req.body;
    
    // Check if course exists
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Get or create shortlist
    let shortlist = await Shortlist.findOne({ user: req.user.id });
    
    if (!shortlist) {
      shortlist = new Shortlist({
        user: req.user.id,
        courses: []
      });
    }
    
    // Add course to shortlist
    await shortlist.addCourse(req.params.courseId, notes || '');
    
    // Increment course shortlist count
    await course.addToShortlist();
    
    res.status(200).json({
      success: true,
      message: 'Course added to shortlist successfully'
    });
  } catch (error) {
    console.error('Error adding to shortlist:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Remove course from shortlist
// @route   DELETE /api/aspirant/shortlist/:courseId
// @access  Private
router.delete('/shortlist/:courseId', async (req, res) => {
  try {
    const shortlist = await Shortlist.findOne({ user: req.user.id });
    
    if (!shortlist) {
      return res.status(404).json({ success: false, message: 'Shortlist not found' });
    }
    
    // Check if course is in shortlist
    const courseInShortlist = shortlist.isCourseShortlisted(req.params.courseId);
    
    if (!courseInShortlist) {
      return res.status(400).json({ success: false, message: 'Course not in shortlist' });
    }
    
    // Remove course from shortlist
    await shortlist.removeCourse(req.params.courseId);
    
    // Decrement course shortlist count
    const course = await Course.findById(req.params.courseId);
    if (course) {
      await course.removeFromShortlist();
    }
    
    res.status(200).json({
      success: true,
      message: 'Course removed from shortlist successfully'
    });
  } catch (error) {
    console.error('Error removing from shortlist:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Update shortlist notes for a course
// @route   PUT /api/aspirant/shortlist/:courseId/notes
// @access  Private
router.put('/shortlist/:courseId/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    
    const shortlist = await Shortlist.findOne({ user: req.user.id });
    
    if (!shortlist) {
      return res.status(404).json({ success: false, message: 'Shortlist not found' });
    }
    
    // Find and update the course notes
    const courseItem = shortlist.courses.find(
      item => item.course.toString() === req.params.courseId
    );
    
    if (!courseItem) {
      return res.status(404).json({ success: false, message: 'Course not found in shortlist' });
    }
    
    courseItem.notes = notes || '';
    await shortlist.save();
    
    res.status(200).json({
      success: true,
      message: 'Notes updated successfully'
    });
  } catch (error) {
    console.error('Error updating shortlist notes:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Enroll in a course
// @route   POST /api/aspirant/enroll/:courseId
// @access  Private
router.post('/enroll/:courseId', async (req, res) => {
  try {
    const { amount } = req.body;
    
    const course = await Course.findById(req.params.courseId);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Check if course can be enrolled
    if (!course.canEnroll()) {
      return res.status(400).json({
        success: false,
        message: 'Course is not available for enrollment'
      });
    }
    
    // Check if user is already enrolled
    const alreadyEnrolled = course.enrollments.some(
      enrollment => enrollment.user.toString() === req.user.id
    );
    
    if (alreadyEnrolled) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course'
      });
    }
    
    // Add enrollment to course
    course.enrollments.push({
      user: req.user.id,
      enrolledAt: new Date(),
      paymentStatus: 'completed', // In real app, this would be 'pending' until payment is confirmed
      amount: amount || course.price
    });
    
    await course.save();
    
    res.status(200).json({
      success: true,
      message: 'Successfully enrolled in course'
    });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get enrolled courses
// @route   GET /api/aspirant/enrolled
// @access  Private
router.get('/enrolled', async (req, res) => {
  try {
    const courses = await Course.find({
      'enrollments.user': req.user.id,
      'enrollments.paymentStatus': 'completed'
    })
    .populate('institution', 'institutionName')
    .lean();
    
    // Add enrollment-specific data to each course
    const enrolledCourses = courses.map(course => {
      const enrollment = course.enrollments.find(
        e => e.user.toString() === req.user.id
      );
      
      return {
        _id: `enrollment_${course._id}`,
        course: course,
        enrolledAt: enrollment.enrolledAt,
        paymentStatus: enrollment.paymentStatus,
        amount: enrollment.amount,
        progress: Math.floor(Math.random() * 100), // Mock progress - would be calculated based on actual completion
        batchmates: course.currentEnrollments
      };
    });
    
    res.status(200).json({
      success: true,
      courses: enrolledCourses
    });
  } catch (error) {
    console.error('Error getting enrolled courses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get past enrollments (completed courses)
// @route   GET /api/aspirant/past-enrollments
// @access  Private
router.get('/past-enrollments', async (req, res) => {
  try {
    // For demo purposes, returning empty array
    // In real implementation, this would check for courses with end dates in the past
    const pastCourses = await Course.find({
      'enrollments.user': req.user.id,
      'enrollments.paymentStatus': 'completed',
      endDate: { $lt: new Date() }
    })
    .populate('institution', 'institutionName')
    .lean();
    
    const completedCourses = pastCourses.map(course => {
      const enrollment = course.enrollments.find(
        e => e.user.toString() === req.user.id
      );
      
      return {
        _id: `completed_${course._id}`,
        course: course,
        enrolledAt: enrollment.enrolledAt,
        completedAt: course.endDate,
        paymentStatus: enrollment.paymentStatus,
        amount: enrollment.amount,
        certificateEarned: true
      };
    });
    
    res.status(200).json({
      success: true,
      courses: completedCourses
    });
  } catch (error) {
    console.error('Error getting past enrollments:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get user's reviews
// @route   GET /api/aspirant/reviews
// @access  Private
router.get('/reviews', async (req, res) => {
  try {
    const courses = await Course.find({
      'reviews.user': req.user.id
    })
    .populate('institution', 'institutionName')
    .lean();
    
    const userReviews = [];
    
    courses.forEach(course => {
      const userReview = course.reviews.find(
        review => review.user.toString() === req.user.id
      );
      
      if (userReview) {
        userReviews.push({
          _id: userReview._id,
          course: {
            _id: course._id,
            title: course.title,
            institution: course.institution
          },
          courseRating: userReview.courseRating,
          instituteRating: userReview.instituteRating,
          facultyRating: userReview.facultyRating,
          reviewText: userReview.reviewText,
          isVerified: userReview.isVerified,
          helpfulVotes: userReview.helpfulVotes,
          createdAt: userReview.createdAt
        });
      }
    });
    
    res.status(200).json({
      success: true,
      reviews: userReviews
    });
  } catch (error) {
    console.error('Error getting user reviews:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Change aspirant password
// @route   PUT /api/aspirant/change-password
// @access  Private
router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide current and new password' 
      });
    }
    
    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @desc    Get course recommendations based on user activity
// @route   GET /api/aspirant/recommendations
// @access  Private
router.get('/recommendations', async (req, res) => {
  try {
    // Get user's shortlisted and enrolled courses to understand preferences
    const shortlist = await Shortlist.findOne({ user: req.user.id })
      .populate('courses.course', 'courseCategory tags city language');
    
    const enrolledCourses = await Course.find({
      'enrollments.user': req.user.id,
      'enrollments.paymentStatus': 'completed'
    }).select('courseCategory tags city language');
    
    let recommendations = [];
    
    // Extract preferences
    const allCourses = [
      ...(shortlist?.courses.map(c => c.course) || []),
      ...enrolledCourses
    ];
    
    if (allCourses.length > 0) {
      const categories = [...new Set(allCourses.map(c => c.courseCategory))];
      const tags = [...new Set(allCourses.flatMap(c => c.tags))];
      const cities = [...new Set(allCourses.map(c => c.city))];
      const languages = [...new Set(allCourses.flatMap(c => c.language))];
      
      // Find similar courses not already in shortlist or enrolled
      const excludeCourseIds = allCourses.map(c => c._id);
      
      recommendations = await Course.find({
        _id: { $nin: excludeCourseIds },
        isPublished: true,
        status: 'published',
        $or: [
          { courseCategory: { $in: categories } },
          { tags: { $in: tags } },
          { city: { $in: cities } },
          { language: { $in: languages } }
        ]
      })
      .limit(10)
      .sort({ 'averageRating.overall': -1, views: -1 })
      .populate('institution', 'institutionName');
    } else {
      // Return popular courses for new users
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
    console.error('Error getting recommendations:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;