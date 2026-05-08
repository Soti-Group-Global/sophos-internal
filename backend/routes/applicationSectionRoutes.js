const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = multer({ storage: multer.memoryStorage() });
const {
  getSection,
  uploadFile,
  getFile,
  removeFile,
  updateComment,
} = require("../controllers/ApplicationSectionController");

// GET section data (files + comment)
router.get("/:applicationId/:section", auth, getSection);
// Upload a file to a section
router.post("/:applicationId/:section/upload", auth, upload.single("file"), uploadFile);
// Download a file from a section
router.get("/:applicationId/:section/file/:fileId", auth, getFile);
// Delete a file from a section
router.delete("/:applicationId/:section/file/:fileId", auth, removeFile);
// Update section comment
router.patch("/:applicationId/:section/comment", auth, updateComment);

module.exports = router;
