const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = multer({ storage: multer.memoryStorage() });
const validateUpload = require("../middleware/validateUpload");
const {
  createLaboratoryTest,
  getLaboratoryTests,
  getLaboratoryTestById,
  updateLaboratoryTest,
  deleteLaboratoryTest,
  uploadLaboratoryTestFile,
  getLaboratoryTestFile,
  removeLaboratoryTestFile,
  addLaboratoryTestNote,
  updateLaboratoryTestNote,
  deleteLaboratoryTestNote,
} = require("../controllers/ApplicationLaboratoryTestController");

// Create a new laboratory test for an application
router.post("/", auth, createLaboratoryTest);
// Get all laboratory tests for an application
router.get("/", auth, getLaboratoryTests);
// Get a specific laboratory test by ID
router.get("/:id", auth, getLaboratoryTestById);
// Update a laboratory test by ID
router.put("/:id", auth, updateLaboratoryTest);
// Upload a file for a laboratory test
router.post("/:id/upload-file", auth, upload.single("file"), validateUpload(["image", "pdf", "doc"]), uploadLaboratoryTestFile);
// Get an uploaded file for a laboratory test
router.get("/:id/file", auth, getLaboratoryTestFile);
router.get("/:id/file/:fileId", auth, getLaboratoryTestFile);
// Remove an uploaded file for a laboratory test
router.delete("/:id/file", auth, removeLaboratoryTestFile);
router.delete("/:id/file/:fileId", auth, removeLaboratoryTestFile);
// Add a new text note for a laboratory test
router.patch("/:id/note", auth, addLaboratoryTestNote);
// Update an existing note for a laboratory test
router.patch("/:id/note/:noteId", auth, updateLaboratoryTestNote);
// Delete a laboratory test note
router.delete("/:id/note/:noteId", auth, deleteLaboratoryTestNote);
// Legacy delete note route for compatibility
router.delete("/:id/note", auth, deleteLaboratoryTestNote);
// Delete a laboratory test by ID
router.delete("/:id", auth, deleteLaboratoryTest);
module.exports = router;