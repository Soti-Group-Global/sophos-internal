const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  roomName: String,
  doctorEmail: String,
  patientEmail: String,
  startTime: Date,
  endTime: Date,
  tokenDoctor: String,
  tokenPatient: String,
  status: { type: String, default: "scheduled" },
  recordingUrl: String,
});

module.exports = mongoose.model("Meeting", meetingSchema);
