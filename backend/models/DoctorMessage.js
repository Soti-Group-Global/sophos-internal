const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    text: String,
    user: String,
    timestamp: { type: Date, default: Date.now },
    replyTo: mongoose.Schema.Types.ObjectId,
    fileId: mongoose.Schema.Types.ObjectId,
    fileUrl: String,
    fileType: String,
  },
  { _id: true }
);

const doctorMessageSchema = new mongoose.Schema(
  {
    email: String,
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoctorMessage", doctorMessageSchema);
