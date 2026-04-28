const mongoose = require('mongoose');

const HeadAssistantAvailabilitySchema = new mongoose.Schema({
  headAssistantEmail: {
    type: String,
    required: true,
  },
  start: Date,
  end: Date,
  status: String,
  notes: String,
});

module.exports = mongoose.model('HeadAssistantAvailability', HeadAssistantAvailabilitySchema);