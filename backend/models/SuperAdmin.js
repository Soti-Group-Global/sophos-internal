const mongoose = require("mongoose");

const SuperAdminSchema = new mongoose.Schema({
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
  comments: { type: String, default: "" },
  branches: [{ type: String, trim: true }],


  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SuperAdmin", SuperAdminSchema);
