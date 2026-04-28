const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const {
  createPromo,
  streamPromoFile,
  getAllPromos,
  getActivePromos,
  getActivePromoById,
  reorderPromos,
  getPromoById,
  updatePromo,
  deletePromo,
} = require("../controllers/promoController");
const router = express.Router();

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, false);
    }
    const filetypes = /jpeg|jpg|png|mp4|gif/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG, PNG, MP4, or GIF files are allowed"));
  },
}).single("promoFile");

// Create promo
router.post("/", [auth, upload], createPromo);

// Stream promo file directly (public - used by frontend and external sites)
router.get("/file/:fileId", streamPromoFile);

// Get all promos (admin - with all details)
router.get("/", auth, getAllPromos);

// Get active promos for public display (no auth required)
router.get("/active", getActivePromos);

// Get single active promo by ID (no auth required)
router.get("/active/:id", getActivePromoById);

// Reorder promos
router.put("/reorder", auth, reorderPromos);

// Get single promo by ID (public - used by external website)
router.get("/:id", getPromoById);

// Update promo
router.put("/:id", [auth, upload], updatePromo);

// Delete promo
router.delete("/:id", auth, deletePromo);

module.exports = router;
