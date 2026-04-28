const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  addVendorService,
  updateVendorService,
  deleteVendorService,
  deleteVendor,
  getProfileImage,
} = require('../controllers/vendorController');

const router = express.Router();

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, false);
    }
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/JPG/PNG images are allowed'));
  },
}).single('profileImage');

// Validation rules
const vendorValidation = [
  body('vendorName').trim().notEmpty().withMessage('Vendor name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('phone').optional().matches(/^\+?\d{10,15}$/).withMessage('Invalid phone number format'),
  body('address').optional().trim(),
];

const addServiceValidation = [
  body('specialtyId').isMongoId().withMessage('Invalid specialty ID'),
  body('selectedTests').isArray().withMessage('Selected tests must be an array'),
];

const updateServiceValidation = [
  body('selectedTests').isArray().withMessage('Selected tests must be an array'),
];

// Create vendor
router.post('/', [auth, upload, ...vendorValidation], createVendor);

// Get all vendors
router.get('/', auth, getAllVendors);

// Get profile image by file ID (must be before /:id to avoid conflict)
router.get('/profile-image/:fileId', auth, getProfileImage);

// Get vendor by ID
router.get('/:id', auth, getVendorById);

// Update vendor
router.put('/:id', [auth, upload, ...vendorValidation], updateVendor);

// Add service to vendor
router.post('/:id/services', [auth, ...addServiceValidation], addVendorService);

// Update service in vendor
router.put('/:id/services/:specialtyId', [auth, ...updateServiceValidation], updateVendorService);

// Delete service from vendor
router.delete('/:id/services/:specialtyId', auth, deleteVendorService);

// Delete vendor
router.delete('/:id', auth, deleteVendor);

module.exports = router;