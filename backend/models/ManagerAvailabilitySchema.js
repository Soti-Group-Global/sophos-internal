const mongoose = require('mongoose');

const ManagerAvailabilitySchema = new mongoose.Schema({
  managerEmail: {
    type: String,
    required: true,
  },
  start: Date,
  end: Date,
  status: String,
  notes: String,
});

module.exports = mongoose.model('ManagerAvailability', ManagerAvailabilitySchema);