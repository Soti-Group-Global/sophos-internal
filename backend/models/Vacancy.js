const mongoose = require('mongoose');

const VacancySchema = new mongoose.Schema({
  title: {
    en: {
      type: String,
      required: true,
      trim: true
    },
    ru: {
      type: String,
      trim: true
    }
  },
  department: {
    en: {
      type: String,
      trim: true
    },
    ru: {
      type: String,
      trim: true
    }
  },
  location: {
    en: {
      type: String,
      trim: true
    },
    ru: {
      type: String,
      trim: true
    }
  },
  description: {
    en: {
      type: String
    },
    ru: {
      type: String
    }
  },
  requirements: {
    en: {
      type: String
    },
    ru: {
      type: String
    }
  },
  responsibilities: {
    en: {
      type: String
    },
    ru: {
      type: String
    }
  },
  employmentType: {
    type: String,
  },
  experienceLevel: {
    en: { type: String },
    ru: { type: String }
  },
  salary: {
    en: { type: String },
    ru: { type: String }
  },
  salaryRange: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'RUB'
    }
  },
  applicationDeadline: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'closed', 'archived'],
    default: 'draft'
  },
  // New field: showApplyButton checkbox
  showApplyButton: {
    type: Boolean,
    default: true
  },
  otherEmploymentType: {
    en: { type: String },
    ru: { type: String }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  applicationCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAt: {
    type: Date
  },
  possibilities: {
    en: { type: String },
    ru: { type: String }
  },
  schedule: {
    en: { type: String },
    ru: { type: String }
  },
  selectionStage: {
    en: { type: String },
    ru: { type: String }
  },
   branch: [{
      type: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for multilingual fields
VacancySchema.index({ 'title.en': 'text', 'title.ru': 'text' });
VacancySchema.index({ 'description.en': 'text', 'description.ru': 'text' });
VacancySchema.index({ 'salary.en': 'text', 'salary.ru': 'text' });
VacancySchema.index({ 'possibilities.en': 'text', 'possibilities.ru': 'text' });
VacancySchema.index({ 'schedule.en': 'text', 'schedule.ru': 'text' });
VacancySchema.index({ 'selectionStage.en': 'text', 'selectionStage.ru': 'text' });
VacancySchema.index({ status: 1 });
VacancySchema.index({ 'department.en': 1, 'department.ru': 1 });
VacancySchema.index({ employmentType: 1 });
VacancySchema.index({ applicationDeadline: 1 });
VacancySchema.index({ createdAt: -1 });
VacancySchema.index({ showApplyButton: 1 }); // New index for showApplyButton

// Virtual for checking if vacancy is open for applications
VacancySchema.virtual('isOpen').get(function() {
  const isDeadlineValid = !this.applicationDeadline || new Date() < this.applicationDeadline;
  return this.status === 'published' && isDeadlineValid;
});

// Virtual for checking if apply button should be shown
VacancySchema.virtual('shouldShowApplyButton').get(function() {
  return this.showApplyButton && this.isOpen;
});

// Method to get text in specific language
VacancySchema.methods.getLocalizedText = function(field, lang = 'en') {
  if (this[field] && this[field][lang]) {
    return this[field][lang];
  }
  // Fallback to English if requested language doesn't exist
  return this[field]?.en || '';
};

// Method to set text in specific language
VacancySchema.methods.setLocalizedText = function(field, lang, value) {
  // Normalize legacy string fields to multilingual objects
  if (!this[field] || typeof this[field] === 'string') {
    this[field] = typeof this[field] === 'string'
      ? { en: this[field], ru: '' }
      : {};
  }
  this[field][lang] = value;
};

// Method to get all data for a specific language
VacancySchema.methods.getLocalizedData = function(lang = 'en') {
  const localizedFields = ['title', 'department', 'location', 'description', 'requirements', 'responsibilities', 'possibilities', 'experienceLevel', 'salary', 'schedule', 'selectionStage'];
  const result = { ...this.toObject() };
  
  localizedFields.forEach(field => {
    if (result[field]) {
      result[field] = result[field][lang] || result[field].en || '';
    }
  });
  
  return result;
};

// Method to publish a vacancy
VacancySchema.methods.publish = async function() {
  this.status = 'published';
  this.publishedAt = new Date();
  await this.save();
};

// Method to close a vacancy
VacancySchema.methods.close = async function() {
  this.status = 'closed';
  await this.save();
};

// Method to archive a vacancy
VacancySchema.methods.archive = async function() {
  this.status = 'archived';
  await this.save();
};

// Method to toggle apply button visibility
VacancySchema.methods.toggleApplyButton = async function() {
  this.showApplyButton = !this.showApplyButton;
  await this.save();
  return this.showApplyButton;
};

// Method to set apply button visibility
VacancySchema.methods.setApplyButtonVisibility = async function(visible) {
  this.showApplyButton = visible;
  await this.save();
  return this.showApplyButton;
};

// Method to update application count
VacancySchema.methods.incrementApplicationCount = async function() {
  this.applicationCount += 1;
  await this.save();
};

// Method to update view count
VacancySchema.methods.incrementViewCount = async function() {
  this.viewCount += 1;
  await this.save();
};

// Static method to get active vacancies with language support
VacancySchema.statics.getActiveVacancies = function(lang = 'en') {
  return this.find({ 
    status: 'published',
    $or: [
      { applicationDeadline: { $gte: new Date() } },
      { applicationDeadline: null }
    ]
  }).then(vacancies => {
    return vacancies.map(vacancy => vacancy.getLocalizedData(lang));
  });
};

// Static method to get vacancies with apply button enabled
VacancySchema.statics.getVacanciesWithApplyButton = function(lang = 'en') {
  return this.find({ 
    status: 'published',
    showApplyButton: true,
    $or: [
      { applicationDeadline: { $gte: new Date() } },
      { applicationDeadline: null }
    ]
  }).then(vacancies => {
    return vacancies.map(vacancy => vacancy.getLocalizedData(lang));
  });
};

// Static method to get vacancies by status with language support
VacancySchema.statics.getByStatus = function(status, lang = 'en') {
  return this.find({ status }).sort({ createdAt: -1 })
    .then(vacancies => {
      return vacancies.map(vacancy => vacancy.getLocalizedData(lang));
    });
};

// Static method for text search across both languages
VacancySchema.statics.search = function(query, lang = 'en') {
  return this.find({
    $and: [
      {
        status: 'published',
        $or: [
          { applicationDeadline: { $gte: new Date() } },
          { applicationDeadline: null }
        ]
      },
      {
        $or: [
          { [`title.${lang}`]: { $regex: query, $options: 'i' } },
          { [`description.${lang}`]: { $regex: query, $options: 'i' } },
          { [`requirements.${lang}`]: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  });
};

// Static method to get vacancies with apply button status
VacancySchema.statics.getVacanciesWithApplyStatus = function(lang = 'en', showApplyButton = null) {
  let query = { 
    status: 'published',
    $or: [
      { applicationDeadline: { $gte: new Date() } },
      { applicationDeadline: null }
    ]
  };
  
  if (showApplyButton !== null) {
    query.showApplyButton = showApplyButton;
  }
  
  return this.find(query).then(vacancies => {
    return vacancies.map(vacancy => {
      const data = vacancy.getLocalizedData(lang);
      data.showApplyButton = vacancy.showApplyButton;
      data.shouldShowApplyButton = vacancy.shouldShowApplyButton;
      return data;
    });
  });
};

module.exports = mongoose.model('Vacancy', VacancySchema);
