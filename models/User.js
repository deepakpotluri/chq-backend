// models/User.js - Complete Enhanced User Model
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Create a dedicated User schema
const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'], 
    select: false 
  },
  role: { 
    type: String, 
    enum: ['aspirant', 'institution', 'admin'],
    default: 'aspirant' 
  },
  
  // For institutions
  institutionName: { 
    type: String,
    trim: true
  },
  institutionType: { 
    type: String,
    enum: ['coaching', 'university', 'college', 'other']
  },
  
  // Verification fields
  isVerified: { 
    type: Boolean, 
    default: function() {
      // Aspirants are auto-verified, institutions need admin verification
      return this.role === 'aspirant';
    }
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Activity tracking
  isActive: {
    type: Boolean,
    default: true
  },
  delistReason: String,
  statusUpdatedAt: Date,
  statusUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Login tracking
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    userAgent: String
  }],
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT
userSchema.methods.getSignedToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'mysecretkey',
    { expiresIn: '30d' }
  );
};

// Check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    return false;
  }
};

// Update login info
userSchema.methods.updateLoginInfo = async function(ipAddress = null, userAgent = null) {
  this.lastLogin = new Date();
  this.loginCount += 1;
  
  // Keep only last 10 login records
  if (this.loginHistory.length >= 10) {
    this.loginHistory.shift();
  }
  
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress: ipAddress || 'Unknown',
    userAgent: userAgent || 'Unknown'
  });
  
  await this.save();
};

// This will create a "users" collection in MongoDB
const User = mongoose.model('User', userSchema);

module.exports = User;