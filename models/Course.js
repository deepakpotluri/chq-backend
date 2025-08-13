// models/Course.js - Complete Course Model with ALL frontend enum values included
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
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  rejectionReason: String,
  isVisible: {
    type: Boolean,
    default: false
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

// Schedule Schema - Updated to match frontend calendar structure
const scheduleSchema = new mongoose.Schema({
  id: {
    type: mongoose.Schema.Types.Mixed, // Can be number or string
    required: true
  },
  date: {
    type: String, // ISO date string format "YYYY-MM-DD"
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['lecture', 'test', 'exam', 'doubt-clearing', 'discussion', 'workshop', 'assignment', 'lab', 'tutorial', 'break'],
    default: 'lecture'
  },
  startTime: {
    type: String, // Format "HH:MM"
    required: true
  },
  endTime: {
    type: String, // Format "HH:MM"
    required: true
  },
  subject: String,
  faculty: String,
  description: String,
  color: {
    type: String,
    default: '#3B82F6'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDays: {
    type: [Number], // Array of day numbers (0-6, where 0 is Sunday)
    default: []
  },
    meetingLink: {
    type: String,
    default: '',
    trim: true
  },
}, { _id: false }); // Disable automatic _id for subdocuments

// Course Schema
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
  
  // Institution reference
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Course categorization - Updated to include ALL frontend values
  courseCategory: {
    type: String,
    enum: ['prelims', 'mains', 'interview', 'foundation', 'optional', 'prelims-cum-mains', 'optionals', 'test-series'],
    required: true
  },
  courseType: {
    type: [String],
    enum: ['online', 'offline', 'hybrid', 'weekend', 'evening'],
    required: true
  },
  
  // Languages - Updated to include ALL frontend languages
  courseLanguages: {
    type: [String],
    enum: [
      'english', 
      'hindi', 
      'regional',
      // All languages from frontend
      'tamil',
      'telugu',
      'marathi',
      'kannada',
      'malayalam',
      'bengali',
      'gujarati',
      'punjabi',
      'odia',
      'urdu',
      'assamese',
      'kashmiri',
      'konkani',
      'manipuri',
      'nepali',
      'sanskrit',
      'sindhi'
    ],
    default: ['english']
  },
  
  // Location (for offline courses)
  city: String,
  state: String,
  address: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  
  // Course content
  subjects: [String],
  highlights: [String],
  whatYouWillLearn: [String],
  prerequisites: [String],
  targetAudience: String,
  
  // Course dates
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  enrollmentDeadline: Date,
  
  // Syllabus
  syllabusFile: {
    type: String
  },
  syllabusDetails: [{
    topic: String,
    subtopics: [String],
    duration: String
  }],
  
  // Schedule - Array of schedule events
  schedule: {
    type: [scheduleSchema],
    default: []
  },
  
  // Weekly Schedule (alternative format)
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
        enum: ['lecture', 'test', 'doubt-clearing', 'discussion','workshop','assignment']
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
        },
        homepagePromotionOrder: {
  type: Number,
  default: null, // null means not displayed on homepage
  min: 1,
  max: 4
},
homepagePromotionEnabled: {
  type: Boolean,
  default: false
},
promotionExpiryDate: {
  type: Date,
  default: null
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
    enum: ['draft', 'published', 'archived', 'cancelled', 'suspended'],
    default: 'draft'
  },
  
  // Delivery Type
  deliveryType: {
    type: String,
    enum: ['live', 'recorded', 'mixed', 'hybrid'],
    default: 'live'
  },
  
  // Admin action tracking
  adminAction: {
    action: String,
    reason: String,
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    actionAt: Date
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
  
  // Tracking
  views: {
    type: Number,
    default: 0
  },
  shortlisted: {
    type: Number,
    default: 0
  },
  
  // Faculty details
  faculty: [{
    name: String,
    subject: String,
    qualification: String,
    experience: String,
    profileImage: String
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

// Indexes
courseSchema.index({ institution: 1, status: 1 });
courseSchema.index({ courseCategory: 1, status: 1 });
courseSchema.index({ city: 1, state: 1 });
courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ 'schedule.date': 1 });

// Pre-save middleware
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate ratings
  const approvedReviews = this.reviews.filter(r => r.verificationStatus === 'approved');
  
  if (approvedReviews.length > 0) {
    let totalCourse = 0, totalInstitute = 0, totalFaculty = 0;
    
    approvedReviews.forEach(review => {
      totalCourse += review.courseRating;
      totalInstitute += review.instituteRating;
      totalFaculty += review.facultyRating;
    });
    
    this.averageRating.course = totalCourse / approvedReviews.length;
    this.averageRating.institute = totalInstitute / approvedReviews.length;
    this.averageRating.faculty = totalFaculty / approvedReviews.length;
    this.averageRating.overall = (this.averageRating.course + this.averageRating.institute + this.averageRating.faculty) / 3;
    
    this.totalReviews = approvedReviews.length;
  } else {
    this.averageRating = { course: 0, institute: 0, faculty: 0, overall: 0 };
    this.totalReviews = 0;
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
  // Check if course is published
  if (!this.isPublished) {
    console.log('Course not published');
    return false;
  }
  
  // Check if course status is published
  if (this.status !== 'published') {
    console.log('Course status not published:', this.status);
    return false;
  }
  
  // Check if enrollment deadline has passed
  if (this.enrollmentDeadline && new Date() > this.enrollmentDeadline) {
    console.log('Enrollment deadline passed');
    return false;
  }
  
  // Check if course is full
  if (this.maxStudents > 0 && this.currentEnrollments >= this.maxStudents) {
    console.log('Course is full');
    return false;
  }
  
  return true;
};

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;