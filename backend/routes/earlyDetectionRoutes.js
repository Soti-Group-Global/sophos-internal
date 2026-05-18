const express = require("express");
const router = express.Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const validateUpload = require("../middleware/validateUpload");
const upload = multer({ storage: multer.memoryStorage() });
const {
  submitBooking,
  paymentWebhook,
  tbankPaymentWebhook,
  checkPaymentStatus,
  getBookings,
  getUserBookings,
  cancelUnpaidBooking,
  getInvoiceByNumber,
  getMonthlyInvoices,
  updateBookingStatus,
  updatePaymentStatus,
  markAsPaid,
  cancelBooking,
  createManualBooking,
  deleteBooking,
  generatePaymentLink,
  getManagedTests,
  createManagedTest,
  updateManagedTest,
  deleteManagedTest,
  uploadScheduleSectionFile,
  getScheduleFile,
  addInternalNote,
  getInternalNotes,
  updateInternalNote,
  deleteInternalNote,
  getWeeklyBookingsOnCalendar,
  getBookingById,
  updateBooking,
  saveSpecialistHistoryForm,
  addTestEntryNote,
  updateTestEntryNote,
  deleteTestEntryNote,
} = require("../controllers/earlyDetectionController");

// Public routes
router.post("/submit", submitBooking);
router.get("/booking/:id", getBookingById);
router.get("/invoice/:invoiceNumber", getInvoiceByNumber);
router.get("/payment/status/:bookingId", checkPaymentStatus);
router.get("/user-bookings/:email", getUserBookings);
router.put("/cancel-unpaid/:bookingId", cancelUnpaidBooking);

// Payment webhooks
router.post("/payment/webhook", paymentWebhook); // YooKassa
router.post("/payment/tbank-webhook", tbankPaymentWebhook); // T-Bank

// Admin routes
router.get("/bookings", auth, getBookings);
router.get("/invoices/monthly/:month/:year", auth, getMonthlyInvoices);

// Admin booking management routes
router.put("/bookings/:id/status", auth, updateBookingStatus);
router.put("/bookings/:id/payment-status", auth, updatePaymentStatus);
router.put("/bookings/:id/mark-as-paid", auth, markAsPaid);
router.put("/bookings/:id/cancel", auth, cancelBooking);
router.put("/bookings/:id", auth, updateBooking);
router.delete("/bookings/:id", auth, deleteBooking);
router.post("/bookings/manual", auth, createManualBooking);
router.post("/bookings/:id/generate-payment-link", auth, generatePaymentLink);
router.post("/bookings/:id/notes", auth, addInternalNote);
router.put("/bookings/:id/notes/:noteId", auth, updateInternalNote);
router.delete("/bookings/:id/notes/:noteId", auth, deleteInternalNote);
router.get("/bookings/tests/:section", auth, getManagedTests);
router.post("/bookings/tests/:section", auth, createManagedTest);
router.put("/bookings/tests/:section/:testId", auth, updateManagedTest);
router.delete("/bookings/tests/:section/:testId", auth, deleteManagedTest);
router.post(
  "/bookings/:id/schedule/:section/upload",
  auth,
  upload.single("file"),
  validateUpload(["image", "pdf", "doc"]),
  uploadScheduleSectionFile,
);
router.get("/bookings/files/:fileId", auth, getScheduleFile);
router.put("/bookings/:id/specialist/:idx", auth, saveSpecialistHistoryForm);
router.post("/bookings/:id/schedule/:section/items/:itemId/notes", auth, addTestEntryNote);
router.put("/bookings/:id/schedule/:section/entries/:entryId/notes/:noteId", auth, updateTestEntryNote);
router.delete("/bookings/:id/schedule/:section/entries/:entryId/notes/:noteId", auth, deleteTestEntryNote);

// === Early Detection Booking Routes ===
router.get('/doctor', auth, getWeeklyBookingsOnCalendar);
router.get('/bookings/calendar',auth,getWeeklyBookingsOnCalendar);
router.get('/bookings/:bookingId',auth,getBookingById);
router.put('/bookings/:bookingId', auth, updateBooking);
router.put('/bookings/:bookingId/specialist-consultations/:specialistIndex/history-form', auth, saveSpecialistHistoryForm);
router.post('/bookings/:id/internal-notes', auth, addInternalNote);
router.get('/bookings/:id/internal-notes', auth, getInternalNotes);
router.put('/bookings/:id/internal-notes/:noteId', auth, updateInternalNote);
router.delete('/bookings/:id/internal-notes/:noteId', auth, deleteInternalNote);












module.exports = router;
