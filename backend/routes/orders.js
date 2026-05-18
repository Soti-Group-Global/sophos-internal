const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const validateUpload = require('../middleware/validateUpload');
const {
  getOrders,
  getOrdersByVendor,
  createOrder,
  updateOrderStatus,
  uploadTestResult,
  getResultFile,
  assignVendor,
  bulkAssignVendor,
  bulkCreateOrders,
  getOrdersByApplication,
} = require('../controllers/orderController');

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(new Error('File is required'), false);
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG, or PNG files are allowed'), false);
    }
    cb(null, true);
  },
}).single('file');

// GET /api/orders — get all orders, optionally filtered by vendorId or applicationId
router.get('/', auth, getOrders);

// GET /api/orders/vendor/:vendorId — get orders for a vendor, grouped by orderId
router.get('/vendor/:vendorId', auth, getOrdersByVendor);

// GET /api/orders/results/:fileId — retrieve test result file
router.get('/results/:fileId', auth, getResultFile);

// POST /api/orders — create a new order
router.post('/', auth, createOrder);

// POST /api/orders/assign-vendor — bulk assign vendor to multiple orders
router.post('/assign-vendor', auth, bulkAssignVendor);

// POST /api/orders/bulk — bulk create orders from tests
router.post('/bulk', auth, bulkCreateOrders);

// POST /api/orders/:testId/upload-result — upload test result
router.post('/:testId/upload-result', auth, upload, validateUpload(["image", "pdf"]), uploadTestResult);

// PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', auth, updateOrderStatus);

// PATCH /api/orders/:id/assign-vendor — assign vendor to a single order
router.patch('/:id/assign-vendor', auth, assignVendor);

// GET /api/orders/:applicationId — get orders by applicationId
router.get('/:applicationId', getOrdersByApplication);

module.exports = router;