// routes/authRoutes.js - Updated with institution profile routes
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  signup, 
  login, 
  getMe,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword,
  updatePassword,
  getInstitutionProfile,
  updateInstitutionProfile
} = require('../controllers/authController');

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);


// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);
// Institution specific routes (these can also be in institutionRoutes.js)
router.get('/institution/profile', protect, authorize('institution'), getInstitutionProfile);
router.put('/institution/profile', protect, authorize('institution'), updateInstitutionProfile);

module.exports = router;