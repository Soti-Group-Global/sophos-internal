const mongoose = require('mongoose');

const contactRequestSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: false,
    trim: true,
    default: ""
  },
  lastName: {
    type: String,
    required: false,
    trim: true,
    default: ""
  },
  middleName: {
    type: String,
    trim: true,
    default: ""
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'completed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ContactRequest', contactRequestSchema);