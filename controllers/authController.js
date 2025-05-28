// controllers/authController.js
const User = require('../models/User');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    console.log('Signup request received:', req.body);
    const { name, email, password, role, institutionName, institutionType, adminCode } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('Signup failed: Email already registered:', email);
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    // Verify admin code if registering as admin
    if (role === 'admin') {
      const adminSecretCode = process.env.ADMIN_SECRET_CODE || 'admin123';
      if (adminCode !== adminSecretCode) {
        console.log('Admin signup failed: Invalid admin code');
        return res.status(401).json({ success: false, message: 'Invalid admin code' });
      }
    }
    
    // Validate institution data if registering as institution
    if (role === 'institution' && (!institutionName || !institutionType)) {
      console.log('Institution signup failed: Missing institution details');
      return res.status(400).json({ success: false, message: 'Institution name and type are required' });
    }
    
    // Create user
    const userData = { name, email, password, role };
    
    // Add institution data if applicable
    if (role === 'institution') {
      userData.institutionName = institutionName;
      userData.institutionType = institutionType;
    }
    
    console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });
    
    try {
      const user = await User.create(userData);
      console.log('User created successfully with ID:', user._id);
      
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
      console.error('Error creating user in database:', error);
      return res.status(500).json({ success: false, message: 'Database error during user creation', error: error.message });
    }
  } catch (error) {
    console.error('Signup error:', error);
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
    console.log('Login request received for email:', req.body.email);
    const { email, password, role } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('Login failed: User not found:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Verify role if specified
    if (role && user.role !== role) {
      console.log('Login failed: Role mismatch for user:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials for this role' });
    }
    
    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('Login failed: Password mismatch for user:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    console.log('Login successful for user:', email);
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
    console.error('Login error:', error);
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
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};