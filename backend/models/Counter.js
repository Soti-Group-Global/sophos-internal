const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  monthlyCount: { type: Number, default: 0, required: true },
  overallCount: { type: Number, default: 0, required: true },
  monthYear: { type: String, required: true },
});

module.exports = mongoose.model('Counter', counterSchema);