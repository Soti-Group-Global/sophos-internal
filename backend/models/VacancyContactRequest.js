const mongoose = require('mongoose');

const VacancyContactRequestSchema = new mongoose.Schema({
  // Vacancy reference
  vacancyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vacancy',
    required: true,
    index: true
  },
  
  // Contact information
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  
  vacancyTitle: {
    type: String,
    required: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'contacted', 'resolved', 'spam'],
    default: 'pending',
    index: true
  },
  
  // Additional information
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
VacancyContactRequestSchema.index({ createdAt: -1 });
VacancyContactRequestSchema.index({ status: 1, createdAt: -1 });
VacancyContactRequestSchema.index({ vacancyId: 1, status: 1 });
VacancyContactRequestSchema.index({ phoneNumber: 1, createdAt: -1 });

// Virtual for formatted phone number
VacancyContactRequestSchema.virtual('formattedPhone').get(function() {
  const phone = this.phoneNumber;
  if (phone.length === 11) {
    return `+${phone.substring(0, 1)} (${phone.substring(1, 4)}) ${phone.substring(4, 7)}-${phone.substring(7)}`;
  }
  return phone;
});

// Method to mark as contacted
VacancyContactRequestSchema.methods.markAsContacted = function(userId) {
  this.status = 'contacted';
  this.updatedBy = userId;
  return this.save();
};

// Method to mark as resolved
VacancyContactRequestSchema.methods.markAsResolved = function(userId) {
  this.status = 'resolved';
  this.updatedBy = userId;
  return this.save();
};

// Static method to get stats
VacancyContactRequestSchema.statics.getStats = async function(vacancyId = null) {
  const match = vacancyId ? { vacancyId } : {};
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        recent: {
          $sum: {
            $cond: [
              { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats;
};

const VacancyContactRequest = mongoose.model('VacancyContactRequest', VacancyContactRequestSchema);

module.exports = VacancyContactRequest;