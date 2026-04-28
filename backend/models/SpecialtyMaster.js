const mongoose = require('mongoose');

const SpecialtyMasterSchema = new mongoose.Schema({
  name_en: {
    type: String,
    required: true,
    trim: true
  },
  name_ru: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure unique combinations
SpecialtyMasterSchema.index({ name_en: 1 }, { unique: true });
SpecialtyMasterSchema.index({ name_ru: 1 }, { unique: true });

module.exports = mongoose.model('SpecialtyMaster', SpecialtyMasterSchema);
