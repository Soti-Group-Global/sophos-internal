const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  patientName: {
    en: {
      firstName: { type: String },
      middleName: { type: String },
      lastName: { type: String }
    },
    ru: {
      firstName: { type: String },
      middleName: { type: String },
      lastName: { type: String }
    },
  },
  description: {
    en: {
      type: String,
    },
    ru: {
      type: String,
    },
  },
  contactInfo: {
    phone: { type: String },
    email: { type: String },
    whatsapp: { type: Boolean, default: false },
    telegram: { type: Boolean, default: false },
    max: { type: Boolean, default: false }
  },
  rating: { type: Number },
  reviewFileIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
    },
  ],
  postedAt: { type: Date, default: Date.now },
  status: { type: String, required: true, enum: ["Posted", "Approved"] },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DoctorsProfile",
  },
  doctorEmail: {
    type: String,
  },
  userProfileId: {
    type: mongoose.Schema.Types.ObjectId,
  },
     branch: [{
      type: String,
  }],
});

module.exports = mongoose.model("Review", reviewSchema);