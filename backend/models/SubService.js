const mongoose = require("mongoose");

const SubServiceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
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
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "RUB",
      uppercase: true,
    },
    notes: {
      en: { type: String, default: "" },
      ru: { type: String, default: "" },
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
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Indexes
SubServiceSchema.index({ code: 1 });
SubServiceSchema.index({ "name.en": 1 });
SubServiceSchema.index({ "name.ru": 1 });
SubServiceSchema.index({ price: 1 });

module.exports = mongoose.model("SubService", SubServiceSchema);
