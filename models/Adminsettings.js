const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  homepagePromotedCourses: [{
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      max: 4
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);