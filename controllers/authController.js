// controllers/authController.js - Complete version with institution profile support
const User = require('../models/User');
const crypto = require('crypto');
const { sendOTPEmail } = require('../services/emailServices');


const otpStore = new Map();

// @desc    Register user (including institutions with full profile)
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      adminCode,
      institutionProfile,
      isEmailVerified 
    } = req.body;

    const otpData = otpStore.get(email);
    if (!isEmailVerified || !otpData || !otpData.verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please verify your email before signing up' 
      });
    }

     otpStore.delete(email);
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
  // If user exists but email not verified, delete the temp user
   if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }
}
    // Verify admin code if registering as admin
    if (role === 'admin') {
      const adminSecretCode = process.env.ADMIN_SECRET_CODE || 'admin123';
      if (adminCode !== adminSecretCode) {
        return res.status(401).json({ success: false, message: 'Invalid admin code' });
      }
    }
    
    // Create user data object
    const userData = { 
      name: role === 'institution' ? institutionProfile?.institutionName || name : name, 
      email, 
      password, 
      role,
      isEmailVerified: true
    };
    
    // Add institution-specific data if role is institution
    if (role === 'institution') {
      // Validate required institution fields
      if (!institutionProfile || 
          !institutionProfile.institutionName || 
          !institutionProfile.institutionType ||
          !institutionProfile.owner?.name ||
          !institutionProfile.owner?.email ||
          !institutionProfile.contactPerson?.name ||
          !institutionProfile.contactPerson?.designation ||
          !institutionProfile.contactPerson?.phone ||
          !institutionProfile.contactPerson?.email ||
          !institutionProfile.address?.fullAddress ||
          !institutionProfile.googleMapsLink) {
        return res.status(400).json({ 
          success: false, 
          message: 'All required institution fields must be provided',
          requiredFields: {
            institutionName: 'Institution name is required',
            institutionType: 'Institution type is required',
            'owner.name': 'Owner name is required',
            'owner.email': 'Owner email is required',
            'contactPerson.name': 'Contact person name is required',
            'contactPerson.designation': 'Contact person designation is required',
            'contactPerson.phone': 'Contact person phone is required',
            'contactPerson.email': 'Contact person email is required',
            'address.fullAddress': 'Full address is required',
            googleMapsLink: 'Google Maps link is required'
          }
        });
      }
      
      userData.institutionProfile = institutionProfile;
      userData.isVerified = false;
      userData.verificationStatus = 'pending';
    }
    
    try {
      const user = await User.create(userData);
      
      // For institutions, inform them about verification requirement
      if (role === 'institution') {
        return res.status(201).json({ 
          success: true, 
          message: 'Institution registered successfully. Please wait for admin verification before accessing the dashboard.',
          requiresVerification: true,
          role: user.role,
          userId: user._id
        });
      }
      
      // For aspirants and admins, generate token
      const token = user.getSignedToken();
      
      res.status(201).json({ 
        success: true, 
        token, 
        role: user.role,
        userId: user._id,
        message: 'User registered successfully'
      });
    } catch (error) {
      console.error('User creation error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error during user creation', 
        error: error.message 
      });
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


// @desc    Send OTP for email verification
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOTP = async (req, res) => {
  try {
    const { email, name, role } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Check if email already exists and is verified
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered and verified' 
      });
    }
    
    // If user exists but not verified, delete the old record
    if (existingUser && !existingUser.isEmailVerified) {
      await User.deleteOne({ email });
    }
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP data in memory (use Redis in production)
    const otpData = {
      otp: crypto.createHash('sha256').update(otp).digest('hex'),
      email,
      name: name || 'User',
      role: role || 'aspirant',
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    
    otpStore.set(email, otpData);
    
    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, name || 'User');
    
    if (!emailSent) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification email' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      email // Return email for reference
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { otp, email } = req.body;
    
    if (!otp || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP and email are required' 
      });
    }
    
    // Get stored OTP data
    const otpData = otpStore.get(email);
    
    if (!otpData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired or invalid' 
      });
    }
    
    // Check if OTP is expired
    if (otpData.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }
    
    // Hash the provided OTP
    const hashedProvidedOTP = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');
    
    // Compare with stored hash
    if (hashedProvidedOTP !== otpData.otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    // OTP is valid, mark as verified
    otpData.verified = true;
    otpStore.set(email, otpData);
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      email: otpData.email
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
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
    
    // Get IP and user agent for tracking
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    
    // Find user - DO NOT create a new user here
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
    
    // Check if institution is verified
    if (user.role === 'institution' && !user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your institution account is pending verification. Please wait for admin approval.',
        requiresVerification: true
      });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact support.',
        isDeactivated: true
      });
    }
    
    // Update login info
    await user.updateLoginInfo(ipAddress, userAgent);
    
    // Generate token
    const token = user.getSignedToken();
    
    res.status(200).json({ 
      success: true, 
      token, 
      role: user.role,
      userId: user._id,
      isVerified: user.isVerified,
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
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Prepare response data
    let responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
    
    // Add institution-specific data if user is an institution
    if (user.role === 'institution' && user.institutionProfile) {
      responseData = {
        ...responseData,
        institutionProfile: {
          institutionName: user.institutionProfile.institutionName,
          institutionType: user.institutionProfile.institutionType,
          description: user.institutionProfile.description,
          establishedYear: user.institutionProfile.establishedYear,
          contactPerson: user.institutionProfile.contactPerson,
          address: user.institutionProfile.address,
          googleMapsLink: user.institutionProfile.googleMapsLink,
          website: user.institutionProfile.website,
          socialLinks: user.institutionProfile.socialLinks
          // Note: Owner details are excluded for security
        }
      };
    }
    
    res.status(200).json({ 
      success: true, 
      data: responseData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Get institution profile (for institution users)
// @route   GET /api/institution/profile
// @access  Private (Institution only)
exports.getInstitutionProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user || user.role !== 'institution') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Institution only.' 
      });
    }
    
    const profileData = {
      id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      verificationStatus: user.verificationStatus,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      institutionName: user.institutionProfile?.institutionName,
      institutionType: user.institutionProfile?.institutionType,
      description: user.institutionProfile?.description,
      establishedYear: user.institutionProfile?.establishedYear,
      contactPerson: user.institutionProfile?.contactPerson,
      address: user.institutionProfile?.address,
      googleMapsLink: user.institutionProfile?.googleMapsLink,
      website: user.institutionProfile?.website,
      socialLinks: user.institutionProfile?.socialLinks
    };
    
    res.status(200).json({ 
      success: true, 
      data: profileData,
      isVerified: user.isVerified
    });
    
  } catch (error) {
    console.error('Get institution profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Update institution profile
// @route   PUT /api/institution/profile
// @access  Private (Institution only)
exports.updateInstitutionProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || user.role !== 'institution') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Institution only.' 
      });
    }
    
    // Fields that institutions can update
    const allowedUpdates = [
      'description',
      'contactPerson',
      'address',
      'googleMapsLink',
      'website',
      'socialLinks'
    ];
    
    // Initialize institutionProfile if it doesn't exist
    if (!user.institutionProfile) {
      user.institutionProfile = {};
    }
    
    // Update only allowed fields
    const updates = req.body;
    Object.keys(updates).forEach(update => {
      if (allowedUpdates.includes(update)) {
        // Special handling for nested objects
        if (update === 'contactPerson' && typeof updates[update] === 'object') {
          // Update contact person fields individually to preserve other fields
          if (!user.institutionProfile.contactPerson) {
            user.institutionProfile.contactPerson = {};
          }
          Object.keys(updates[update]).forEach(field => {
            user.institutionProfile.contactPerson[field] = updates[update][field];
          });
        } else if (update === 'address' && typeof updates[update] === 'object') {
          // Update address fields individually
          if (!user.institutionProfile.address) {
            user.institutionProfile.address = {};
          }
          Object.keys(updates[update]).forEach(field => {
            user.institutionProfile.address[field] = updates[update][field];
          });
        } else if (update === 'socialLinks' && typeof updates[update] === 'object') {
          // Update social links individually
          if (!user.institutionProfile.socialLinks) {
            user.institutionProfile.socialLinks = {};
          }
          Object.keys(updates[update]).forEach(field => {
            user.institutionProfile.socialLinks[field] = updates[update][field];
          });
        } else {
          // Simple field update
          user.institutionProfile[update] = updates[update];
        }
      }
    });
    
    // Mark nested fields as modified for Mongoose
    user.markModified('institutionProfile');
    
    await user.save();
    
    // Return updated profile data
    const responseData = {
      institutionName: user.institutionProfile.institutionName,
      institutionType: user.institutionProfile.institutionType,
      description: user.institutionProfile.description,
      establishedYear: user.institutionProfile.establishedYear,
      contactPerson: user.institutionProfile.contactPerson,
      address: user.institutionProfile.address,
      googleMapsLink: user.institutionProfile.googleMapsLink,
      website: user.institutionProfile.website,
      socialLinks: user.institutionProfile.socialLinks
    };
    
    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: responseData
    });
    
  } catch (error) {
    console.error('Update institution profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Logout user / clear token
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: {}
  });
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    
    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    user.password = req.body.newPassword;
    await user.save();
    
    // Generate new token
    const token = user.getSignedToken();
    
    res.status(200).json({
      success: true,
      token,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with that email'
      });
    }
    
    // Get reset token
    const resetToken = user.getResetPasswordToken();
    
    await user.save({ validateBeforeSave: false });
    
    // Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;
    
    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;
    
    try {
      // Here you would send email
      // await sendEmail({
      //   email: user.email,
      //   subject: 'Password reset token',
      //   message
      // });
      
      res.status(200).json({ 
        success: true, 
        message: 'Email sent',
        resetToken // In production, remove this and only send via email
      });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      
      await user.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        success: false,
        message: 'Email could not be sent'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    // Generate token
    const token = user.getSignedToken();
    
    res.status(200).json({
      success: true,
      token,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

module.exports = exports;