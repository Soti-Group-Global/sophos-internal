// models/Project.js
const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    createdBy: {
      type: String,
      required: false,
    },
    members: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", ProjectSchema);
