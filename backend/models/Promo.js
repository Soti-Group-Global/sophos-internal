const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId }, // GridFS file ID
  fileType: { type: String, enum: ["image", "video", "gif"] },
  filename: { type: String },
  order: { type: Number, required: true }, // For slide ordering
  createdAt: { type: Date, default: Date.now },

  // Multilingual fields
  description: {
    en: {
      type: String,
      trim: true,
    },
    ru: {
      type: String,
      trim: true,
    },
    // Add more languages as needed
  },

  // Date fields
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  // Gradient colors for website live preview
  startColor: {
    type: String,
    default: "#47a4d7",
    trim: true,
  },
  endColor: {
    type: String,
    default: "#1cabe9",
    trim: true,
  },

  // Website banner overlay text (shown on the banner slide)
  promoBannerTitle: {
    en: { type: String, trim: true },
    ru: { type: String, trim: true },
  },
  promoBannerDescription: {
    en: { type: String, trim: true },
    ru: { type: String, trim: true },
  },
});

// Virtual for getting description in current language
promoSchema.virtual("currentDescription").get(function () {
  // This can be customized based on your language detection logic
  return this.description.en; // Default to English
});

// Virtual to check if promo is currently active based on dates
promoSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    this.startDate <= now &&
    (!this.endDate || this.endDate >= now)
  );
});

// Virtual to check if promo is scheduled for future
promoSchema.virtual("isScheduled").get(function () {
  const now = new Date();
  return this.isActive && this.startDate > now;
});

// Virtual to check if promo has expired
promoSchema.virtual("isExpired").get(function () {
  const now = new Date();
  return this.endDate && this.endDate < now;
});

// Method to get description in specific language
promoSchema.methods.getDescription = function (language = "en") {
  return this.description[language] || this.description.en || "";
};

// Method to get banner title
promoSchema.methods.getBannerTitle = function (language = "en") {
  if (this.promoBannerTitle) {
    return this.promoBannerTitle[language] || this.promoBannerTitle.en || "";
  }
  return "";
};

// Method to get banner description (falls back to description if not set)
promoSchema.methods.getBannerDescription = function (language = "en") {
  if (this.promoBannerDescription) {
    return this.promoBannerDescription[language] || this.promoBannerDescription.en || this.getDescription(language);
  }
  return this.getDescription(language);
};

// Static method to get active promos for a specific language
promoSchema.statics.getActivePromos = function (language = "en") {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
  }).sort({ order: 1 });
};

// Index for better query performance
promoSchema.index({ order: 1 });
promoSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

// Pre-save middleware to validate dates
promoSchema.pre("save", function (next) {
  if (this.endDate && this.startDate > this.endDate) {
    return next(new Error("Start date cannot be after end date"));
  }
  next();
});

module.exports = mongoose.model("Promo", promoSchema);
