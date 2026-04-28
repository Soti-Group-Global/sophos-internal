const mongoose = require('mongoose');

const VacancyApplicationSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vacancy',
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    trim: true,
    default: ''
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  resume: {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  agreedToTerms: {
    type: Boolean,
    required: true,
    default: false,
    validate: {
      validator: function(v) {
        return v === true;
      },
      message: 'You must agree to the terms and conditions'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'],
    default: 'pending'
  },
  internalNotes: {
    type: String,
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

VacancyApplicationSchema.index({ jobPost: 1, email: 1 });
VacancyApplicationSchema.index({ status: 1 });
VacancyApplicationSchema.index({ submittedAt: -1 });
VacancyApplicationSchema.index({ email: 1 });
VacancyApplicationSchema.index({ firstName: 'text', lastName: 'text' });
VacancyApplicationSchema.index({ 'resume.fileId': 1 });

VacancyApplicationSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.middleName ? this.middleName + ' ' : ''}${this.lastName}`.trim();
});

VacancyApplicationSchema.statics.getByStatus = function(status) {
  return this.find({ status }).populate('jobPost', 'title department');
};

VacancyApplicationSchema.statics.getByJobPost = function(jobPostId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const filter = { jobPost: jobPostId };
  if (status) filter.status = status;

  return this.find(filter)
    .sort({ submittedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('jobPost', 'title department');
};

VacancyApplicationSchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  if (notes) {
    this.internalNotes = notes;
  }
  return this.save();
};

VacancyApplicationSchema.pre('save', function(next) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (this.email && !emailRegex.test(this.email)) {
    return next(new Error('Invalid email format'));
  }
  next();
});

module.exports = mongoose.model('VacancyApplication', VacancyApplicationSchema);