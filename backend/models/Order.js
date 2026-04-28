const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    
  orderId: {
    type: String,
    required: false, // Changed to false as it will be null initially
    default: null
  },
  applicationId: {
    type: String,
    required: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialty.tests',
    required: true
  },
  testName: {
    type: String,
    required: true
  },
  vendorId: {
    type: String,
    ref: 'Vendor',
    required: false
  },
  vendorName: {
    type: String,
    required: false
  },
  resultFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'results',
    default: null
  },
  status: {
    type: String,
    enum: ['Ordered', 'Completed', 'Cancelled', 'Waiting for Assign'],
    default: 'Waiting for Assign'
  },
  uploadedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for better query performance
orderSchema.index({ orderId: 1, appointmentId: 1 });

module.exports = mongoose.model('Order', orderSchema);