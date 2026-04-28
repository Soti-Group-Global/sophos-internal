const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: [
      "patient",
      "doctor",
      "manager",
      "assistant",
      "head_manager",
      "head_assistant",
      "head_doctor",
      "specialist",
      "super_admin",
      "content_manager"
    ],
  },
  profileCompleted: {
    type: Boolean,
    default: true,
  },
  passwordResetToken: {
    type: String,
    default: null,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  notificationLanguage: {
    type: String,
    enum: ['en', 'ru'],
    default: 'en',
  },
});

module.exports = mongoose.model("User", userSchema);
