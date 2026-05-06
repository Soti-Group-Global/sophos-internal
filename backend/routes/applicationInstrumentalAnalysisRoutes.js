const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = multer({ storage: multer.memoryStorage() });
const {
  createInstrumentalAnalysis,
  getInstrumentalAnalyses,
  getInstrumentalAnalysisById,
  updateInstrumentalAnalysis,
  deleteInstrumentalAnalysis,
  uploadInstrumentalAnalysisFile,
  getInstrumentalAnalysisFile,
  removeInstrumentalAnalysisFile,
  addInstrumentalAnalysisNote,
  updateInstrumentalAnalysisNote,
  deleteInstrumentalAnalysisNote,
} = require("../controllers/ApplicationInstrumentalAnalysisController");

// Create a new instrumental analysis for an application
router.post("/", auth, createInstrumentalAnalysis);
// Get all instrumental analyses for an application
router.get("/", auth, getInstrumentalAnalyses);
// Get a specific instrumental analysis by ID
router.get("/:id", auth, getInstrumentalAnalysisById);
// Update an instrumental analysis by ID
router.put("/:id", auth, updateInstrumentalAnalysis);
// Upload a file for an instrumental analysis
router.post("/:id/upload-file", auth, upload.single("file"), uploadInstrumentalAnalysisFile);
// Get an uploaded file for an instrumental analysis
router.get("/:id/file", auth, getInstrumentalAnalysisFile);
router.get("/:id/file/:fileId", auth, getInstrumentalAnalysisFile);
// Remove an uploaded file for an instrumental analysis
router.delete("/:id/file", auth, removeInstrumentalAnalysisFile);
router.delete("/:id/file/:fileId", auth, removeInstrumentalAnalysisFile);
// Add a new text note for an instrumental analysis
router.patch("/:id/note", auth, addInstrumentalAnalysisNote);
// Update an existing note for an instrumental analysis
router.patch("/:id/note/:noteId", auth, updateInstrumentalAnalysisNote);
// Delete an instrumental analysis note
router.delete("/:id/note/:noteId", auth, deleteInstrumentalAnalysisNote);
// Legacy delete note route for compatibility
router.delete("/:id/note", auth, deleteInstrumentalAnalysisNote);
// Delete an instrumental analysis by ID
router.delete("/:id", auth, deleteInstrumentalAnalysis);
module.exports = router;