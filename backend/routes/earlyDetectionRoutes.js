const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const {
  submitBooking,
  paymentWebhook,
  tbankPaymentWebhook,
  checkPaymentStatus,
  getBookings,
  getBookingById,
  getUserBookings,
  cancelUnpaidBooking,
  getInvoiceByNumber,
  getMonthlyInvoices,
  updateBookingStatus,
  updatePaymentStatus,
  markAsPaid,
  cancelBooking,
  updateBooking,
  createManualBooking,
  addInternalNote,
  updateInternalNote,
  deleteInternalNote,
  deleteBooking,
  generatePaymentLink,
  getManagedTests,
  createManagedTest,
  updateManagedTest,
  deleteManagedTest,
  uploadScheduleSectionFile,
  getScheduleFile,
  saveSpecialistHistoryForm,
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
router.get("/bookings", getBookings);
router.get("/invoices/monthly/:month/:year", getMonthlyInvoices);

// Admin booking management routes
router.put("/bookings/:id/status", updateBookingStatus);
router.put("/bookings/:id/payment-status", updatePaymentStatus);
router.put("/bookings/:id/mark-as-paid", markAsPaid);
router.put("/bookings/:id/cancel", cancelBooking);
router.put("/bookings/:id", updateBooking);
router.delete("/bookings/:id", deleteBooking);
router.post("/bookings/manual", createManualBooking);
router.post("/bookings/:id/generate-payment-link", generatePaymentLink);
router.post("/bookings/:id/notes", addInternalNote);
router.put("/bookings/:id/notes/:noteId", updateInternalNote);
router.delete("/bookings/:id/notes/:noteId", deleteInternalNote);
router.get("/bookings/tests/:section", getManagedTests);
router.post("/bookings/tests/:section", createManagedTest);
router.put("/bookings/tests/:section/:testId", updateManagedTest);
router.delete("/bookings/tests/:section/:testId", deleteManagedTest);
router.post(
  "/bookings/:id/schedule/:section/upload",
  upload.single("file"),
  uploadScheduleSectionFile,
);
router.get("/bookings/files/:fileId", getScheduleFile);
router.put("/bookings/:id/specialist/:idx", saveSpecialistHistoryForm);

module.exports = router;
