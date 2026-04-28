const mongoose = require("mongoose");
const moment = require("moment-timezone");

const notificationSchema = new mongoose.Schema({
  patientEmail: { type: String, required: false },
  doctorEmail: { type: String, required: false },
  vendorEmail: { type: String, required: false },

  addedBy: { type: String, required: true },

  message: {
    en: { type: String, required: true },
    ru: { type: String, required: true }
  },

  appointmentId: { type: String, required: false },
  orderId: { type: String, required: false },
  vendorId: { type: String, required: false },

  isRead: {
    patient: { type: Boolean, default: false },
    doctor: { type: Boolean, default: false },
    manager: { type: Boolean, default: false },
    head_manager: { type: Boolean, default: false },
    head_doctor: { type: Boolean, default: false },
    head_assistant: { type: Boolean, default: false },
    assistant: { type: Boolean, default: false },
    specialist: { type: Boolean, default: false },
    super_admin: { type: Boolean, default: false },
    content_manager: { type: Boolean, default: false },
    vendor: { type: Boolean, default: false },
    user: { type: Boolean, default: false },
  },

  createdAt: {
    type: Date,
    default: () => moment.tz("Europe/Moscow").toDate()
  }
});


module.exports = mongoose.model("UserNotification", notificationSchema);
