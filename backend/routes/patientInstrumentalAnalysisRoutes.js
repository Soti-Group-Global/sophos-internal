const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = multer({ storage: multer.memoryStorage() });
const {
  getAllInstrumentalAnalysis,
  getInstrumentalAnalysisById,
  createInstrumentalAnalysis,
  updateInstrumentalAnalysis,
  deleteInstrumentalAnalysis,
  uploadInstrumentalAnalysisFile,
  getInstrumentalAnalysisFile,
  removeInstrumentalAnalysisFile,
  addInstrumentalAnalysisNote,
  updateInstrumentalAnalysisNote,
  removeInstrumentalAnalysisNote,
} = require("../controllers/PatientTestController");

router.get("/",    auth, getAllInstrumentalAnalysis);
router.post("/",   auth, createInstrumentalAnalysis);
router.get("/:id", auth, getInstrumentalAnalysisById);
router.put("/:id", auth, updateInstrumentalAnalysis);
router.delete("/:id", auth, deleteInstrumentalAnalysis);

// files — patientId in body (upload) or query (get/delete)
router.post("/:id/upload-file",    auth, upload.single("file"), uploadInstrumentalAnalysisFile);
router.get("/:id/file/:fileId",    auth, getInstrumentalAnalysisFile);
router.delete("/:id/file/:fileId", auth, removeInstrumentalAnalysisFile);
router.delete("/:id/file",         auth, removeInstrumentalAnalysisFile);

// notes — patientId in body (add/update) or query (delete)
router.patch("/:id/note",          auth, addInstrumentalAnalysisNote);
router.patch("/:id/note/:noteId",  auth, updateInstrumentalAnalysisNote);
router.delete("/:id/note/:noteId", auth, removeInstrumentalAnalysisNote);
router.delete("/:id/note",         auth, removeInstrumentalAnalysisNote);

module.exports = router;
