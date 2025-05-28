// models/Shortlist.js - User shortlist model
const mongoose = require('mongoose');

const shortlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courses: [{
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: 500
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure one shortlist per user
shortlistSchema.index({ user: 1 }, { unique: true });

// Pre-save middleware
shortlistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Methods
shortlistSchema.methods.addCourse = function(courseId, notes = '') {
  const existingCourse = this.courses.find(c => c.course.toString() === courseId.toString());
  
  if (!existingCourse) {
    this.courses.push({
      course: courseId,
      notes: notes
    });
  }
  
  return this.save();
};

shortlistSchema.methods.removeCourse = function(courseId) {
  this.courses = this.courses.filter(c => c.course.toString() !== courseId.toString());
  return this.save();
};

shortlistSchema.methods.isCourseShortlisted = function(courseId) {
  return this.courses.some(c => c.course.toString() === courseId.toString());
};

const Shortlist = mongoose.model('Shortlist', shortlistSchema);

module.exports = Shortlist;