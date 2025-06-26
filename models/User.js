// models/User.js - Fixed User model with flexible Google Maps validation
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  // Basic fields
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['aspirant', 'institution', 'admin'],
    default: 'aspirant'
  },
  
  // Institution-specific embedded profile
  institutionProfile: {
    institutionName: {
      type: String,
      required: function() { return this.role === 'institution'; }
    },
    institutionType: {
      type: String,
      enum: ['university', 'college', 'training_center', 'coaching_institute', 'online_academy', 'other'],
      required: function() { return this.role === 'institution'; }
    },
    
    // Owner details
    owner: {
      name: {
        type: String,
        required: function() { return this.role === 'institution'; }
      },
      email: {
        type: String,
        required: function() { return this.role === 'institution'; },
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          'Please add a valid owner email'
        ]
      }
    },
    
    // Contact person details
    contactPerson: {
      name: {
        type: String,
        required: function() { return this.role === 'institution'; }
      },
      designation: {
        type: String,
        required: function() { return this.role === 'institution'; }
      },
      phone: {
        type: String,
        required: function() { return this.role === 'institution'; },
        validate: {
          validator: function(v) {
            // More flexible phone validation - allow various formats
            return !v || /^[+]?[0-9\s\-().]+$/.test(v);
          },
          message: 'Please add a valid phone number'
        }
      },
      email: {
        type: String,
        required: function() { return this.role === 'institution'; },
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          'Please add a valid contact email'
        ]
      }
    },
    
    // Address details
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
      fullAddress: {
        type: String,
        required: function() { return this.role === 'institution'; }
      }
    },
    
    // Google Maps link - More flexible validation
    googleMapsLink: {
      type: String,
      required: function() { return this.role === 'institution'; },
      validate: {
        validator: function(v) {
          // Allow empty string for non-institutions
          if (this.role !== 'institution') return true;
          
          // More flexible validation - accept various Google Maps URL formats
          return v && (
            v.includes('google.com/maps') || 
            v.includes('maps.google.com') || 
            v.includes('goo.gl/maps') ||
            v.includes('maps.app.goo.gl') ||
            v.includes('google.com/maps/place')
          );
        },
        message: 'Please provide a valid Google Maps link'
      }
    },
    
    // Additional optional fields
    description: String,
    establishedYear: Number,
    website: String,
    socialLinks: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String
    },
    logo: String,
    coverImage: String
  },
  
  // Verification and status
  isVerified: {
    type: Boolean,
    default: function() {
      return this.role !== 'institution'; // Only institutions need verification
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: function() {
      return this.role === 'institution' ? 'pending' : 'verified';
    }
  },
  verificationNote: String,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  
  // Login tracking
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Encrypt password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Generate JWT token
userSchema.methods.getSignedToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Match password
userSchema.methods.matchPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Update login info
userSchema.methods.updateLoginInfo = async function(ipAddress, userAgent) {
  this.lastLogin = Date.now();
  this.loginCount = (this.loginCount || 0) + 1;
  
  // Add to login history
  this.loginHistory.push({
    timestamp: Date.now(),
    ipAddress,
    userAgent
  });
  
  // Keep only last 10 login records
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(-10);
  }
  
  await this.save();
};

module.exports = mongoose.model('User', userSchema);