// models/Task.js
const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "medium"],
      default: "normal",
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["todo", "inprocess", "completed"],
      default: "todo",
    },
    assignedTo: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

TaskSchema.index({ projectId: 1, status: 1, order: 1 });

module.exports = mongoose.model("Task", TaskSchema);
