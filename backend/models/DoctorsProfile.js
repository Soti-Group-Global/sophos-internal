// models/DoctorsProfile.js
const mongoose = require("mongoose");

// Reusable multilingual field
const MultilingualString = {
  en: { type: String, trim: true },
  ru: { type: String, trim: true }
};

const doctorsProfileSchema = new mongoose.Schema(
  {

    firstName: MultilingualString,
    middleName: MultilingualString,
    lastName: MultilingualString,

    // Auto-generated slug: dr-lastName-firstName-middleName (English only)
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },

    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    age: { type: Number, required: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    phoneNumber: { type: String, required: true, trim: true },

    // Specialty references
    specialtyIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpecialtyMaster'
    }],
    subSpecialityIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubSpecialityMaster'
    }],
    
    position: MultilingualString,
    regalia: MultilingualString,

    location: MultilingualString,
    languages: [MultilingualString],

    services: {
      online: { type: Boolean, default: false },
      offline: { type: Boolean, default: false }
    },
    expert: {type: Boolean, default: false},
    specialist: {type: Boolean, default: false},
    earlyDetection: { type: Boolean, default: false },


    branches: [MultilingualString],
    yearOfExperience: {type: Number},

    internationalMemberships: MultilingualString,
    russianMemberships: MultilingualString,

    awards: MultilingualString,

    workExperience: MultilingualString,
    education: MultilingualString,
    advancedTraining: MultilingualString,
    professionalDevelopments: MultilingualString,

    // Scientific Activities
    scientificActivities: MultilingualString,

    // About Section
    about: MultilingualString,

    reviews: [
      {
        patientName: { type: String, trim: true, required: true },
        rating: { 
          type: Number, 
          required: true, 
          min: 1, 
          max: 5,
          validate: {
            validator: Number.isInteger,
            message: 'Rating must be an integer'
          }
        },
        description: { type: String, trim: true, required: true },
        date: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false }
      }
    ],

    // Media
    profileFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "profileImages"
    },
    imageUrl: { type: String, trim: true },
    publicImagePath: { type: String, trim: true }, // Public file path for direct access
    photo: { type: String, trim: true }, // Base64 or URL for profile photo
    videoUrl: [{ type: String, trim: true }], // array of videos

    // Fees
    feesAmount: { type: Number, min: 0 },
    currency: {
      type: String,
      required: true,
      enum: ["RUB", "INR", "USD", "EUR", "GBP", "AUD"]
    },

    // Review Statistics (Auto-calculated)
    reviewStats: {
      totalReviews: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 }
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active"
    },

    // Display order for custom sorting (lower numbers appear first)
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Helper function to generate slug from English name
function generateSlug(firstName, middleName, lastName) {
  const parts = [];
  
  // Add lastName if exists
  if (lastName && lastName.trim()) {
    parts.push(lastName.trim());
  }
  
  // Add firstName if exists
  if (firstName && firstName.trim()) {
    parts.push(firstName.trim());
  }
  
  // Add middleName if exists
  if (middleName && middleName.trim()) {
    parts.push(middleName.trim());
  }
  
  // Create slug: dr-lastName-firstName-middleName
  const slug = 'dr-' + parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  return slug;
}

// Auto-generate/update slug and calculate review stats before saving
doctorsProfileSchema.pre("save", function (next) {
  // Generate slug from English name fields
  if (this.firstName || this.middleName || this.lastName) {
    const firstName = this.firstName?.en || '';
    const middleName = this.middleName?.en || '';
    const lastName = this.lastName?.en || '';
    
    this.slug = generateSlug(firstName, middleName, lastName);
  }
  
  // Calculate review stats
  if (this.reviews && this.reviews.length > 0) {
    this.reviewStats.totalReviews = this.reviews.length;

    const totalRating = this.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );

    this.reviewStats.averageRating = parseFloat((totalRating / this.reviews.length).toFixed(1));
  } else {
    this.reviewStats.totalReviews = 0;
    this.reviewStats.averageRating = 0;
  }
  next();
});

// Virtual for full name
doctorsProfileSchema.virtual('fullName').get(function() {
  return {
    en: `${this.firstName.en || ''} ${this.middleName.en || ''} ${this.lastName.en || ''}`.trim(),
    ru: `${this.firstName.ru || ''} ${this.middleName.ru || ''} ${this.lastName.ru || ''}`.trim()
  };
});

// Virtual for public image URL (for SEO and meta tags)
doctorsProfileSchema.virtual('imagePublicUrl').get(function() {
  if (this.profileFileId) {
    // In production, use your actual domain
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    return `${baseUrl}/api/doctors/profile-image-file/${this.profileFileId}`;
  }
  return null;
});

// Ensure virtuals are included in JSON output
doctorsProfileSchema.set('toJSON', { virtuals: true });
doctorsProfileSchema.set('toObject', { virtuals: true });

// Method to add a review
doctorsProfileSchema.methods.addReview = function(reviewData) {
  this.reviews.push(reviewData);
  return this.save();
};

// Method to update review stats
doctorsProfileSchema.methods.updateReviewStats = function() {
  if (this.reviews && this.reviews.length > 0) {
    this.reviewStats.totalReviews = this.reviews.length;
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.reviewStats.averageRating = parseFloat((totalRating / this.reviews.length).toFixed(1));
  } else {
    this.reviewStats.totalReviews = 0;
    this.reviewStats.averageRating = 0;
  }
  return this.save();
};

// Static method to find doctors by specialty
doctorsProfileSchema.statics.findBySpecialty = function(specialtyId) {
  return this.find({ specialtyIds: specialtyId }).populate('specialtyIds subSpecialityIds');
};

// Static method to find active doctors with high ratings
doctorsProfileSchema.statics.findTopRated = function(limit = 10) {
  return this.find({ 
    status: 'active',
    'reviewStats.averageRating': { $gte: 4.0 }
  })
  .sort({ 'reviewStats.averageRating': -1 })
  .limit(limit);
};

// Indexes for better querying
doctorsProfileSchema.index({ specialtyIds: 1 });
doctorsProfileSchema.index({ subSpecialityIds: 1 });
doctorsProfileSchema.index({ "location.en": 1 });
doctorsProfileSchema.index({ "location.ru": 1 });
doctorsProfileSchema.index({ status: 1 });
doctorsProfileSchema.index({ "reviewStats.averageRating": -1 });
doctorsProfileSchema.index({ email: 1 });
doctorsProfileSchema.index({ "services.online": 1 });
doctorsProfileSchema.index({ "services.offline": 1 });
doctorsProfileSchema.index({ "reviews.rating": 1 });

// Compound indexes for common queries
doctorsProfileSchema.index({ 
  status: 1, 
  "reviewStats.averageRating": -1 
});

doctorsProfileSchema.index({
  specialtyIds: 1,
  "services.online": 1,
  status: 1
});

module.exports = mongoose.model("DoctorsProfile", doctorsProfileSchema);