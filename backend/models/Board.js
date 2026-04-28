const mongoose = require("mongoose");

const boardNoteSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    content: { type: String, required: true }, // HTML from rich text editor
    visibleTo: {
      type: [String], // array of roles: "super_admin", "manager", "head_manager", etc.
      default: [],
    },
    isPersonal: { type: Boolean, default: false }, // if true, only creator sees it
    createdBy: { type: String, required: true }, // user email
    createdByName: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

boardNoteSchema.index({ createdBy: 1 });
boardNoteSchema.index({ visibleTo: 1 });

module.exports = mongoose.model("BoardNote", boardNoteSchema);
