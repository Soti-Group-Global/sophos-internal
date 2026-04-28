const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const router = express.Router();

const {
  createContentManager,
  getAllContentManagers,
  getContentManagerById,
  updateContentManager,
  deleteContentManager,
  getContentManagerByEmail,
} = require("../controllers/contentManagerController");

/** Multer config **/
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file) return cb(null, false);
    const filetypes = /jpeg|jpg|png/;
    if (filetypes.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG/JPG/PNG images are allowed"));
  },
}).single("profileImage");

// Create Content Manager
router.post("/", [auth, upload], createContentManager);

// Get all Content Managers
router.get("/", auth, getAllContentManagers);

// Get Content Manager by email
router.get("/by-email/:email", auth, getContentManagerByEmail);

// Get by ID
router.get("/:id", auth, getContentManagerById);

// Update Content Manager
router.put("/:id", [auth, upload], updateContentManager);

// Delete Content Manager
router.delete("/:id", auth, deleteContentManager);

module.exports = router;
