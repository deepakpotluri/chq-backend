// routes/authRoutes.js - Updated with institution profile routes
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  signup, 
  login, 
  getMe,
  getInstitutionProfile,
  updateInstitutionProfile
} = require('../controllers/authController');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);

// Institution specific routes (these can also be in institutionRoutes.js)
router.get('/institution/profile', protect, authorize('institution'), getInstitutionProfile);
router.put('/institution/profile', protect, authorize('institution'), updateInstitutionProfile);

module.exports = router;