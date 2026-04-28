const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },

    sender: {
      email: { type: String, required: true },
      role: {
        type: String,
        enum: [
          'patient', 'doctor', 'manager', 'assistant',
          'head_manager', 'head_assistant', 'head_doctor',
          'specialist', 'super_admin', 'content_manager', 'user',
        ],
        required: true,
      },
    },

    receiver: {
      email: { type: String, required: true },
      role: {
        type: String,
        enum: [
          'patient', 'doctor', 'manager', 'assistant',
          'head_manager', 'head_assistant', 'head_doctor',
          'specialist', 'super_admin', 'content_manager', 'user',
        ],
        required: true,
      },
    },

    file: {
      id: { type: mongoose.Schema.Types.ObjectId },
      url: { type: String },
      type: {
        type: String,
        enum: ["image", "pdf", "video", "audio", "document", "other"],
      },
    },

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
