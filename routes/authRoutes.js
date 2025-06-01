// routes/authRoutes.js - Complete Auth Routes
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { signup, login, getMe } = require('../controllers/authController');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;