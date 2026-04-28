const mongoose = require('mongoose');

const SubSpecialityMasterSchema = new mongoose.Schema({
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
  specialtyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpecialtyMaster',
    required: true
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

// Index for efficient queries
SubSpecialityMasterSchema.index({ specialtyId: 1 });
SubSpecialityMasterSchema.index({ name_en: 1, specialtyId: 1 }, { unique: true });
SubSpecialityMasterSchema.index({ name_ru: 1, specialtyId: 1 }, { unique: true });

module.exports = mongoose.model('SubSpecialityMaster', SubSpecialityMasterSchema);
