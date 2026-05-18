const express = require("express");
const multer = require("multer");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  submitReview,
  getReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getReviewFile,
  getPublicReview,
  getReviewsByDoctor
} = require("../controllers/reviewController");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed!"), false);
    }
  },
});

// Handle multiple fields: profilePicture (max 1) and files (max 2)
const uploadMultiple = upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'files', maxCount: 2 }
]);

const handleFileUpload = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        message: err.message,
        success: false,
      });
    } else if (err) {
      return res.status(400).json({
        message: err.message,
        success: false,
      });
    }
    next();
  });
};

router.get("/", auth, getReviews);
router.get("/public", getPublicReview);
router.get("/:id", auth, getReviewById);
router.post("/", auth, handleFileUpload, submitReview);
router.put("/:id", auth, handleFileUpload, updateReview);
router.delete("/:id", auth, deleteReview);
router.get('/doctor/:doctorId', getReviewsByDoctor);
router.get("/file/:fileId", auth, getReviewFile);

module.exports = router;