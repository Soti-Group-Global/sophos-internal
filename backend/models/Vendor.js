const mongoose = require('mongoose');

const VendorServiceSchema = new mongoose.Schema({
  specialtyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialty',
    required: true
  },
  selectedTests: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  }]
});

const VendorSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  vendorId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  orderSeries:{
    type: String,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  address: {
    type: String,
    required: false,
    trim: true
  },
  services: [VendorServiceSchema],
  profileFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'profileImages',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Vendor', VendorSchema);