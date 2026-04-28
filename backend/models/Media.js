const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String }, // For cloud links
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }, // Reference to GridFS file
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Media', mediaSchema);