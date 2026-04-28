const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    age: { type: Number, required: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    phoneNumber: { type: String, required: true, trim: true },
    specialty: {
      type: String,
      required: true,
      trim: true,
    },
    placeOfWork: { type: String, required: true, trim: true },
    regalia: { type: String, trim: true },
    services: [{ type: String, required: true, enum: ["Online", "Offline"] }],
    branches: [{ type: String, trim: true }],
    profileFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "profileImages",
    },
    imageUrl: { type: String, trim: true },
    feesAmount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "EUR", "GBP", "INR", "RUB", "AUD"],
    },
    notificationLanguage: {
      type: String,
      enum: ['en', 'ru'],
      default: 'en',
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);
