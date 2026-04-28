const mongoose = require("mongoose");

// Sub-schema for each doctor assignment
const AssignedDoctorSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    doctorEmail: { type: String, required: true, trim: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Access Granted", "Access Revoked", "Pending", "Request Sent"],
      default: "Pending",
    },
  },
  { _id: false }
);

// Main Assistant schema
const AssistantSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    phoneNumber: { type: String, required: true, trim: true },

    gender: { type: String, enum: ["Male", "Female", "Other"] },
    dateOfBirth: { type: Date },
    age: { type: Number },

    specialty: { type: String, trim: true },

    profileFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "profilePictures.files",
    },
    imageUrl: { type: String, trim: true },

    profileCompleted: { type: Boolean, default: false },

    branches: [{ type: String, trim: true }],

    notificationLanguage: {
      type: String,
      enum: ['en', 'ru'],
      default: 'en',
    },

    // Assigned doctors
    doctors: [AssignedDoctorSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assistant", AssistantSchema);
