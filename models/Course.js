// models/Course.js - Fixed version with renamed language field
const mongoose = require('mongoose');

// Review Schema
const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  instituteRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  facultyRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    required: true,
    maxlength: 1000
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  notHelpfulVotes: {
    type: Number,
    default: 0
  },
  votedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    vote: {
      type: String,
      enum: ['helpful', 'not_helpful']
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Enhanced Course Schema
const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    default: function() { return this.price; }
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  duration: {
    type: String,
    required: [true, 'Duration is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Institution is required']
  },
  
  // Enhanced Course Details
  courseCategory: {
    type: String,
    enum: ['prelims', 'mains', 'prelims-cum-mains', 'optionals', 'test-series', 'foundation', 'interview'],
    required: [true, 'Course category is required']
  },
  subjects: [{
    type: String,
    required: true
  }],
  // RENAMED: language -> courseLanguages to avoid MongoDB conflict
  courseLanguages: {
    type: [String],
    enum: ['english', 'hindi', 'tamil', 'telugu', 'bengali', 'marathi', 'gujarati', 'kannada', 'malayalam', 'punjabi', 'urdu'],
    default: ['english']
  },
  faculty: [{
    name: {
      type: String,
      required: true
    },
    qualification: String,
    experience: String,
    subject: String
  }],
  
  // Location Details
  city: {
    type: String,
    required: function() {
      return this.courseType.includes('offline') || this.courseType.includes('hybrid');
    }
  },
  state: {
    type: String,
    required: function() {
      return this.courseType.includes('offline') || this.courseType.includes('hybrid');
    }
  },
  address: {
    type: String,
    required: function() {
      return this.courseType.includes('offline') || this.courseType.includes('hybrid');
    }
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  
  // Course Type and Mode
  courseType: {
    type: [String],
    enum: {
      values: ['online', 'offline', 'hybrid', 'weekend', 'evening'],
      message: 'Course type must be one of: online, offline, hybrid, weekend, evening'
    },
    default: ['online'],
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'At least one course type must be selected'
    }
  },
  deliveryType: {
    type: String,
    enum: ['live', 'recorded', 'hybrid'],
    default: 'live'
  },
  
  // Syllabus and Content
  syllabusFile: {
    type: String
  },
  syllabusDetails: [{
    topic: String,
    subtopics: [String],
    duration: String
  }],
  
  // Enhanced Timetable
  timetable: {
    type: String,
    default: '[]'
  },
  weeklySchedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    sessions: [{
      startTime: String,
      endTime: String,
      subject: String,
      faculty: String,
      type: {
        type: String,
        enum: ['lecture', 'test', 'doubt-clearing', 'discussion']
      }
    }]
  }],
  
  // Course modules
  modules: {
    type: [{
      title: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      contentItems: [{
        type: {
          type: String,
          enum: ['video', 'document', 'quiz', 'assignment'],
          required: true
        },
        title: {
          type: String,
          required: true
        },
        content: {
          type: String // URL or text content
        },
        duration: String,
        isPreview: {
          type: Boolean,
          default: false
        }
      }]
    }],
    default: []
  },
  
  // Media and Promotion
  coverImage: {
    type: String,
    default: 'default-course.jpg'
  },
  galleryImages: [String],
  promotionLevel: {
    type: String,
    enum: ['none', 'basic', 'premium', 'featured'],
    default: 'none'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Tags and Search
  tags: {
    type: [String],
    default: []
  },
  searchKeywords: [String],
  
  // Publication and Status
  isPublished: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'cancelled'],
    default: 'draft'
  },
  
  // Enrollment and Capacity
  maxStudents: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  currentEnrollments: {
    type: Number,
    default: 0
  },
  enrollments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    amount: Number
  }],
  
  // Reviews and Ratings
  reviews: [reviewSchema],
  averageRating: {
    course: {
      type: Number,
      default: 0
    },
    institute: {
      type: Number,
      default: 0
    },
    faculty: {
      type: Number,
      default: 0
    },
    overall: {
      type: Number,
      default: 0
    }
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  shortlisted: {
    type: Number,
    default: 0
  },
  leads: {
    type: Number,
    default: 0
  },
  
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

// Indexes for better performance
courseSchema.index({ institution: 1, createdAt: -1 });
courseSchema.index({ isPublished: 1, createdAt: -1 });
courseSchema.index({ courseType: 1, isPublished: 1 });
courseSchema.index({ courseCategory: 1, isPublished: 1 });
courseSchema.index({ city: 1, state: 1 });
courseSchema.index({ startDate: 1 });
courseSchema.index({ 'averageRating.overall': -1 });
courseSchema.index({ views: -1 });
courseSchema.index({ price: 1 });

// Text index for search (without language field conflict)
courseSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text',
  searchKeywords: 'text',
  subjects: 'text',
  city: 'text',
  state: 'text'
});

// Geospatial index for location-based queries
courseSchema.index({ coordinates: '2dsphere' });

// Pre-save middleware
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate overall average rating
  if (this.reviews.length > 0) {
    const totalCourse = this.reviews.reduce((sum, review) => sum + review.courseRating, 0);
    const totalInstitute = this.reviews.reduce((sum, review) => sum + review.instituteRating, 0);
    const totalFaculty = this.reviews.reduce((sum, review) => sum + review.facultyRating, 0);
    
    this.averageRating.course = totalCourse / this.reviews.length;
    this.averageRating.institute = totalInstitute / this.reviews.length;
    this.averageRating.faculty = totalFaculty / this.reviews.length;
    this.averageRating.overall = (this.averageRating.course + this.averageRating.institute + this.averageRating.faculty) / 3;
    this.totalReviews = this.reviews.length;
  }
  
  // Update current enrollments
  this.currentEnrollments = this.enrollments.filter(e => e.paymentStatus === 'completed').length;
  
  next();
});

// Virtual for formatted price
courseSchema.virtual('formattedPrice').get(function() {
  return `₹${this.price.toLocaleString('en-IN')}`;
});

// Virtual for discount price
courseSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return Math.round(this.price * (1 - this.discount / 100));
  }
  return this.price;
});

// Virtual for availability
courseSchema.virtual('isAvailable').get(function() {
  if (this.maxStudents === 0) return true;
  return this.currentEnrollments < this.maxStudents;
});

// Methods
courseSchema.methods.addView = function() {
  this.views += 1;
  return this.save();
};

courseSchema.methods.addToShortlist = function() {
  this.shortlisted += 1;
  return this.save();
};

courseSchema.methods.removeFromShortlist = function() {
  this.shortlisted = Math.max(0, this.shortlisted - 1);
  return this.save();
};

courseSchema.methods.canEnroll = function() {
  return this.isPublished && 
         this.isAvailable && 
         new Date() <= this.startDate &&
         this.status === 'published';
};

// Static methods
courseSchema.statics.findWithFilters = function(filters = {}) {
  const query = { isPublished: true, status: 'published' };
  
  if (filters.category) query.courseCategory = filters.category;
  if (filters.type) query.courseType = { $in: [filters.type] };
  if (filters.city) query.city = new RegExp(filters.city, 'i');
  if (filters.state) query.state = filters.state;
  if (filters.courseLanguages) query.courseLanguages = { $in: [filters.courseLanguages] };
  if (filters.minPrice) query.price = { $gte: filters.minPrice };
  if (filters.maxPrice) query.price = { ...query.price, $lte: filters.maxPrice };
  if (filters.startDate) query.startDate = { $gte: new Date(filters.startDate) };
  
  return this.find(query);
};

courseSchema.statics.findNearby = function(lat, lng, maxDistance = 50000) {
  return this.find({
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    },
    isPublished: true,
    status: 'published'
  });
};

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;