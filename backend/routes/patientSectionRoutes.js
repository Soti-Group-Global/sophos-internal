const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const validateUpload = require("../middleware/validateUpload");
const upload = multer({ storage: multer.memoryStorage() });
const {
  getSection,
  uploadFile,
  addTextEntry,
  getFile,
  removeFile,
  removeEntry,
  updateComment,
} = require("../controllers/PatientSectionController");

// GET section data
router.get("/:patientId/:section", auth, getSection);
// Upload a file entry (all section types)
router.post("/:patientId/:section/upload", auth, upload.single("file"), validateUpload(["image", "pdf", "doc"]), uploadFile);
// Add a text entry (lab sections only)
router.post("/:patientId/:section/text", auth, addTextEntry);
// Download a file
router.get("/:patientId/:section/file/:fileId", auth, getFile);
// Delete a file entry
router.delete("/:patientId/:section/file/:fileId", auth, removeFile);
// Delete any entry by _id (lab sections)
router.delete("/:patientId/:section/entries/:entryId", auth, removeEntry);
// Update section comment (managed sections)
router.patch("/:patientId/:section/comment", auth, updateComment);

module.exports = router;
