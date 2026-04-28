const express = require("express");
const multer = require("multer");
const router = express.Router();

const {
  submitComplicatedCasesForm,
  getComplicatedCasesForms,
  getComplicatedCasesFormById,
  updateComplicatedCasesForm,
  deleteComplicatedCasesForm,
  uploadFile,
  getFile,
  deleteFile,
} = require("../../controllers/website/complicatedCasesFormController");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});

// Form CRUD routes
router.post("/", upload.array("files", 10), submitComplicatedCasesForm);
router.get("/", getComplicatedCasesForms);
router.get("/:id", getComplicatedCasesFormById);
router.put("/:id", updateComplicatedCasesForm);
router.delete("/:id", deleteComplicatedCasesForm);

// File upload/download routes
router.post("/upload", upload.single("file"), uploadFile);
router.get("/file/:fileId", getFile);
router.delete("/file/:fileId", deleteFile);

module.exports = router;
