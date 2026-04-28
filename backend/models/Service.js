const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      en: {
        type: String,
        required: true,
        trim: true,
      },
      ru: {
        type: String,
        required: true,
        trim: true,
      },
    },
    sectionCode: {
      type: String,
      trim: true,
    },
    description: {
      en: {
        type: String,
        default: "",
      },
      ru: {
        type: String,
        default: "",
      },
    },
    doctorEmails: [{
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Please provide a valid email address'
      }
    }],
    branches: [{
      type: String,
      trim: true,
      default: "All"
    }],
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
    },
    startColor: {
      type: String,
      default: "#ffffff",
    },
    endColor: {
      type: String,
      default: "#ffffff",
    },
    aboutService: {
      en: {
        type: String,
        default: "",
      },
      ru: {
        type: String,
        default: "",
      },
    },
    fileId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
ServiceSchema.index({ "name.en": 1 });
ServiceSchema.index({ "name.ru": 1 });
ServiceSchema.index({ status: 1 });
ServiceSchema.index({ createdAt: -1 });
ServiceSchema.index({ doctorEmails: 1 });

module.exports = mongoose.model("Service", ServiceSchema);