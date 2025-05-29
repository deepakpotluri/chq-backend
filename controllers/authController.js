// controllers/authController.js - Cleaned version without console logs
const User = require('../models/User');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role, institutionName, institutionType, adminCode } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    // Verify admin code if registering as admin
    if (role === 'admin') {
      const adminSecretCode = process.env.ADMIN_SECRET_CODE || 'admin123';
      if (adminCode !== adminSecretCode) {
        return res.status(401).json({ success: false, message: 'Invalid admin code' });
      }
    }
    
    // Validate institution data if registering as institution
    if (role === 'institution' && (!institutionName || !institutionType)) {
      return res.status(400).json({ success: false, message: 'Institution name and type are required' });
    }
    
    // Create user
    const userData = { name, email, password, role };
    
    // Add institution data if applicable
    if (role === 'institution') {
      userData.institutionName = institutionName;
      userData.institutionType = institutionType;
    }
    
    try {
      const user = await User.create(userData);
      
      // Generate token
      const token = user.getSignedToken();
      
      res.status(201).json({ 
        success: true, 
        token, 
        role: user.role,
        userId: user._id,
        message: 'User registered successfully'
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Database error during user creation', error: error.message });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration',
      error: error.message 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Verify role if specified
    if (role && user.role !== role) {
      return res.status(401).json({ success: false, message: 'Invalid credentials for this role' });
    }
    
    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = user.getSignedToken();
    
    res.status(200).json({ 
      success: true, 
      token, 
      role: user.role,
      userId: user._id,
      message: 'Login successful'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login',
      error: error.message 
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionName: user.institutionName,
        institutionType: user.institutionType,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};