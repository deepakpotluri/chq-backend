// routes/adminRoutes.js - Updated Admin Routes with getAllReviews
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAdminStats,
  getAllUsers,
  getInstitutions,
  verifyInstitution,
  updateInstitutionStatus,
  getAllCourses,
  toggleCoursePublication,
  getPendingReviews,
  getAllReviews,
  verifyReview,
  getLoginActivity,
  getSystemOverview,
  updateUserStatus,
  getHomepagePromotedCourses,
  updateHomepagePromotedCourses
} = require('../controllers/adminController');

// Apply auth middleware to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard & Overview
router.get('/stats', getAdminStats);
router.get('/system/overview', getSystemOverview);

// User Management
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.get('/activity/logins', getLoginActivity);

// Institution Management
router.get('/institutions', getInstitutions);
router.put('/institutions/:id/verify', verifyInstitution);
router.put('/institutions/:id/status', updateInstitutionStatus);

// Course Management
router.get('/courses', getAllCourses);
router.put('/courses/:id/publish', toggleCoursePublication);

// Promoted Courses Management
router.get('/promoted-courses/homepage', getHomepagePromotedCourses);
router.put('/promoted-courses/homepage', updateHomepagePromotedCourses);

// Review Management
router.get('/reviews/pending', getPendingReviews);
router.get('/reviews/all', getAllReviews); // NEW ROUTE
router.put('/reviews/:courseId/:reviewId/verify', verifyReview);

module.exports = router;