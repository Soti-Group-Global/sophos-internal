const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const {
  getProfile,
  updateOrCreateProfile,
  changePassword,
} = require('../controllers/profileController');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error('Only JPEG/JPG/PNG images are allowed'));
  },
}).single('profilePicture');

// GET profile
router.get("/", auth, getProfile);

// UPDATE or CREATE profile
router.put("/", [auth, upload], updateOrCreateProfile);

// Change Password
router.put("/change-password", auth, changePassword);

module.exports = router;
