const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer = require("multer");
const {
  uploadDocumentFile,
  uploadDocumentUrl,
  getUserIdByEmail,
  getMedicalHistoryByEmail,
  getApplicationsByPatientEmail,
  getApplicationsByDate,
  getApplicationCountsByMonth,
  getApplicationById,
  updateApplication,
  getAllApplications,
  createApplication,
  addComment,
  updateComment,
  getPayments,
  createPayment,
  updatePayment,
  markPaymentPaid,
  markPaymentFree,
  cancelPayment,
  getPaymentInvoice,
  getPaymentAkt,
  deleteDocument,
  getMediaFile,
  sendApplicationEmail,
  yookassaWebhook,
  paymentReturnHandler,
  getApplicationByAppointmentId,
  updatePrescription,
  updateConclusion,
  getMediaById,
  saveFollowUp,
  updateHistoryForm,
  verifyHistoryField,
} = require("../controllers/applicationController");

// Multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// --- Document routes ---
router.post("/:id/documents/file", upload.single("file"), uploadDocumentFile);
router.post("/:id/documents/url", uploadDocumentUrl);
router.delete("/:id/documents/:filename", auth, deleteDocument);

// --- User lookup ---
router.get("/user-id/:email", auth, getUserIdByEmail);

// --- Medical history ---
router.get("/medical-history/by-email/:email", auth, getMedicalHistoryByEmail);

// --- Applications by patient email ---
router.get("/by-patient-email/:email", auth, getApplicationsByPatientEmail);

// --- Applications by date (calendar view) - MUST be before /:id route ---
router.get("/applicationsByDate", auth, getApplicationsByDate);

// --- Application counts per day for a month (mini-calendar badges) ---
router.get("/countsByMonth", auth, getApplicationCountsByMonth);

// --- Application by appointment ID ---
router.get(
  "/by-appointment-id/:appointmentId",
  auth,
  getApplicationByAppointmentId,
);

// --- Media routes ---
router.get("/media/:id/media", getMediaFile);
router.get("/media/:id", getMediaById);

// --- Payment webhook & return ---
router.post("/webhook/yookassa", yookassaWebhook);
router.get("/return", paymentReturnHandler);

// --- Single application CRUD ---
router.get("/:id", auth, getApplicationById);
router.put("/:id", auth, updateApplication);

// --- All applications (list) ---
router.get("/", auth, getAllApplications);
router.post("/", auth, createApplication);

// --- Comments ---
router.post("/:id/comments", auth, addComment);
router.put("/comments/:commentId", auth, updateComment);

// --- Payments ---
router.get("/:id/payments", auth, getPayments);
router.post("/:id/payments", auth, createPayment);
router.patch("/:id/payments", auth, updatePayment);
router.put(
  "/:applicationId/payments/:paymentId/mark-paid",
  auth,
  markPaymentPaid,
);
router.put(
  "/:applicationId/payments/:paymentId/mark-free",
  auth,
  markPaymentFree,
);
router.put("/:applicationId/payments/:paymentId/cancel", auth, cancelPayment);
router.get(
  "/:applicationId/payments/:paymentId/invoice",
  auth,
  getPaymentInvoice,
);
router.get("/:applicationId/payments/:paymentId/akt", auth, getPaymentAkt);

// --- Email ---
router.post("/:id/emails/send", auth, sendApplicationEmail);

// --- Prescription & Conclusion ---
router.put("/:id/prescription", auth, updatePrescription);
router.put("/:id/conclusion", auth, updateConclusion);

// --- Follow-up ---
router.patch("/:id/follow-up", auth, saveFollowUp);

// --- History form ---
router.patch("/:id/history", auth, updateHistoryForm);
router.patch("/:id/history/:fieldKey/verify", auth, verifyHistoryField);

module.exports = router;
