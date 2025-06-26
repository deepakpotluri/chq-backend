// routes/institutionRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Course = require('../models/Course');
const { 
  getInstitutionProfile,
  getInstitutionAnalytics,
  getInstitutionReviews,
  getInstitutionEarnings,
  getInstitutionCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  promoteCourse,
  getInstitutionEnrollments,
  updateInstitutionContactPerson,
  getCourse
} = require('../controllers/institutionController');

// Apply authentication middleware to all routes
router.use(protect);
router.use(authorize('institution'));

// Profile routes
router.get('/profile', getInstitutionProfile);
router.put('/profile/contact', updateInstitutionContactPerson); // NEW ROUTE

// Analytics route
router.get('/analytics', getInstitutionAnalytics);

// Reviews route
router.get('/reviews', getInstitutionReviews);

// Earnings route
router.get('/earnings', getInstitutionEarnings);

// Enrollments route
router.get('/enrollments', getInstitutionEnrollments);

// Course Management Routes
router.get('/courses', getInstitutionCourses);
router.post('/courses', createCourse);
router.get('/courses/:id', getCourse);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.post('/courses/:id/promote', promoteCourse);

module.exports = router;