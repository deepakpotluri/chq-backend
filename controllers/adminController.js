// controllers/adminController.js
const User = require('../models/User');
const Course = require('../models/Course');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private
exports.getAdminStats = async (req, res) => {
  try {
    const aspirantCount = await User.countDocuments({ role: 'aspirant' });
    const institutionCount = await User.countDocuments({ role: 'institution' });
    const pendingInstitutions = await User.countDocuments({ 
      role: 'institution', 
      isVerified: false 
    });
    const courseCount = await Course.countDocuments();
    
    res.status(200).json({
      success: true,
      aspirantCount,
      institutionCount,
      pendingInstitutions,
      courseCount
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
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
};

// @desc    Verify institution
// @route   PUT /api/admin/institutions/:id/verify
// @access  Private
exports.verifyInstitution = async (req, res) => {
  try {
    const institution = await User.findById(req.params.id);
    
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    
    if (institution.role !== 'institution') {
      return res.status(400).json({ success: false, message: 'User is not an institution' });
    }
    
    institution.isVerified = true;
    await institution.save();
    
    res.status(200).json({
      success: true,
      message: 'Institution verified successfully'
    });
  } catch (error) {
    console.error('Error verifying institution:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all aspirants
// @route   GET /api/admin/aspirants
// @access  Private
exports.getAspirants = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const aspirants = await User
      .find({ role: 'aspirant' })
      .skip(skip)
      .limit(limit)
      .select('name email createdAt');
    
    const total = await User.countDocuments({ role: 'aspirant' });
    
    res.status(200).json({
      success: true,
      count: aspirants.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: aspirants
    });
  } catch (error) {
    console.error('Error getting aspirants:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};