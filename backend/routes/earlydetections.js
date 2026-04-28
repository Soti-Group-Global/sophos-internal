const express = require("express");
const multer = require("multer");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const { tbankPaymentWebhook } = require('../controllers/earlyDetectionController');
const {
  getAllEarlyDetections,
  getDoctorSingleDetection,
  updatePrescription,
  updateConclusion,
  uploadDocument,
  uploadDocumentFile,
  uploadDocumentUrl,
  getDocumentById,
  updateVerification,
  updateComment,
  addComment,
  deleteComment,
  addMultipleTests,
} = require("../controllers/earlydetectionsController");

// T-Bank Payment Webhook
router.post('/payment/tbank-webhook', tbankPaymentWebhook);

// CRUD routes
router.get("/", getAllEarlyDetections);
router.get("/doctor/single", getDoctorSingleDetection);
router.put("/:applicationId/prescription", updatePrescription);
router.put("/:applicationId/conclusion", updateConclusion);
router.post("/:id/upload-document", upload.single("file"), uploadDocument);
router.post("/:id/documents/file", upload.single("file"), uploadDocumentFile);
router.post("/:id/documents/url", uploadDocumentUrl);
router.get("/appointments/document-by-id/:id", getDocumentById);
router.put("/:id/update-verification", updateVerification);
router.put("/:applicationId/comments/:commentId", updateComment);
router.put("/:applicationId/comments", addComment);
router.delete("/:applicationId/comments/:commentId", deleteComment);
router.put("/:applicationId/add-multiple-tests", addMultipleTests);

module.exports = router;
