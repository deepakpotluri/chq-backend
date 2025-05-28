// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');

// Apply auth middleware to all routes
router.use(protect);
router.use(authorize('admin'));

// Get admin dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const aspirantCount = await User.countDocuments({ role: 'aspirant' });
    const institutionCount = await User.countDocuments({ role: 'institution' });
    const pendingInstitutions = await User.countDocuments({ 
      role: 'institution', 
      isVerified: false 
    });
    
    res.status(200).json({
      success: true,
      aspirantCount,
      institutionCount,
      pendingInstitutions,
      courseCount: 0 // Placeholder for future implementation
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get all institutions
router.get('/institutions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const institutions = await User
      .find({ role: 'institution' })
      .skip(skip)
      .limit(limit)
      .select('email institutionName institutionType isVerified createdAt');
    
    const total = await User.countDocuments({ role: 'institution' });
    
    res.status(200).json({
      success: true,
      count: institutions.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: institutions
    });
  } catch (error) {
    console.error('Error getting institutions:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
