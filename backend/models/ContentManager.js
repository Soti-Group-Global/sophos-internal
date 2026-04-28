const mongoose = require("mongoose");

const ContentManagerSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  middleName: { type: String, default: "" },
  lastName: { type: String, required: true },

  dateOfBirth: { type: Date, required: true },
  gender: { type: String, required: true },
  age: { type: Number },

  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },

  profileImage: { type: String },

  cityOfResidence: { type: String, default: "" },

  branches: [{ type: String, trim: true }],

  canManage: [{ type: String, trim: true }],

  notificationLanguage: {
    type: String,
    enum: ['en', 'ru'],
    default: 'en',
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ContentManager", ContentManagerSchema);
