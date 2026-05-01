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
  // Doctor-related controllers
  uploadDocumentForDoctors,
  getDocumentByIdForDoctors,
  getAllApplicationsForDoctors,
  getApplicationByIdForDoctors,
  getMedicalHistoryByEmailForDoctors,
  updateCommentForDoctors,
  addCommentForDoctors,
  deleteCommentForDoctors,
  addDescriptionForDoctors,
  addConclusionForDoctors,
  updateVerificationStatusForDoctors,
  getAppointmentsByAssistantEmail,
  getAppointmentsByDoctorEmail,
  getCalendarApplications,
  getByApplicationId,
  getByPatientEmail,
  getAssistantAppointments,
  getCalendar,
  patchApplication,
  updateCommentAssistant,
  addCommentAssistant,
  deleteCommentAssistant,
  updatePrescriptionAssistant,
  updateConclusionAssistant,
  getResultFile,
  updateFollowUp,
  uploadTestResult,
  getTestResult,
  addFollowUpAppointment,
  getCalendarDataForDoctors,
  updateHistoryFormForDoctor,
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
// --- Applications accessible by assistant (appointments for doctors assistant has access to) ---
router.get("/assistant/:email", auth, getAppointmentsByAssistantEmail);

// --- Application counts per day for a month (mini-calendar badges) ---
router.get("/countsByMonth", auth, getApplicationCountsByMonth);

// --- Application by appointment ID ---
router.get(
  "/by-appointment-id/:appointmentId",
  auth,
  getApplicationByAppointmentId,
);

// --- Calendar (doctors interface) - MUST be before /:id route ---
router.get("/calender", auth, getCalendarDataForDoctors);

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

//----Doctor related routes---------//
router.post("/appointments/:id/upload-document", auth, upload.single("file"), uploadDocumentForDoctors);
router.get('/appointments/document-by-id/:id',auth,getDocumentByIdForDoctors);
router.get("/",auth,getAllApplicationsForDoctors);
router.get('/by-application-id/:id',auth,getApplicationByIdForDoctors);
router.get('/medical-history/by-email/:email',auth,getMedicalHistoryByEmailForDoctors);
router.put('/:appointmentId/comments/:commentId', auth, updateCommentForDoctors);
router.put('/:id/comments',auth,addCommentForDoctors);
router.delete('/:appointmentId/comments/:commentId',auth,deleteCommentForDoctors);
router.put('/:id/prescription', auth, addDescriptionForDoctors);
router.put('/:id/conclusion', auth, addConclusionForDoctors);
router.put('/:id/update-verification',auth,updateVerificationStatusForDoctors);
router.get('/doctor/:email',auth,getAppointmentsByDoctorEmail);
router.post('/tests/upload-result',auth,uploadTestResult);
router.get('/results/:id',auth,getTestResult);
router.put('/:applicationId/follow-up',auth,addFollowUpAppointment);
router.put('/:applicationId/history-form',auth,updateHistoryFormForDoctor);

// --- Assistant related routes --- //
router.get('/', auth, getCalendarApplications);
router.get('/by-application-id/:id', auth, getByApplicationId);
router.get('/by-patient-email/:email', auth, getByPatientEmail);
router.get('/assistant/:email', auth, getAssistantAppointments);
router.get('/calendar', auth, getCalendar);
router.patch('/by-application-id/:applicationId', auth, patchApplication);


// Comments
router.put('/:appointmentId/comments/:commentId',auth,updateCommentAssistant);
router.put('/:id/comments', auth, addCommentAssistant);
router.delete('/:appointmentId/comments/:commentId', auth, deleteCommentAssistant);

// Clinical fields
router.put('/:id/prescription', auth, updatePrescriptionAssistant);
router.put('/:id/conclusion', auth, updateConclusionAssistant);

router.get('/results/:id',auth,getResultFile);
// Follow-up
router.put('/:applicationId/follow-up', auth, updateFollowUp);


module.exports = router;
