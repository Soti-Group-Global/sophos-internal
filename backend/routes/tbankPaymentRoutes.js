const express = require('express');
const router = express.Router();
const tbankPaymentController = require('../controllers/tbankPaymentController');
const installmentController = require('../controllers/installmentController');

/**
 * T-Bank Payment Routes for Early Detection Bookings
 * Base path: /api/early-detection/payment
 */

// @route   POST /api/early-detection/payment/init
// @desc    Initialize T-Bank payment for a booking
// @access  Public
router.post('/init', tbankPaymentController.initTBankPayment);

// @route   POST /api/early-detection/payment/webhook
// @desc    Handle T-Bank payment webhook notifications
// @access  Public (verified by signature)
router.post('/webhook', tbankPaymentController.tbankPaymentWebhook);

// @route   GET /api/early-detection/payment/status/:bookingId
// @desc    Check payment status for a booking
// @access  Public
router.get('/status/:bookingId', tbankPaymentController.checkPaymentStatus);

// @route   POST /api/early-detection/payment/cancel
// @desc    Cancel T-Bank payment
// @access  Public
router.post('/cancel', tbankPaymentController.cancelTBankPayment);

// Installment Payment Routes
// @route   POST /api/early-detection/payment/installment/init
// @desc    Initialize installment payment for a booking
// @access  Public
router.post('/installment/init', installmentController.initInstallmentPayment);

// @route   GET /api/early-detection/payment/installment/:bookingId
// @desc    Get installment payment details
// @access  Public
router.get('/installment/:bookingId', installmentController.getInstallmentDetails);

// @route   POST /api/early-detection/payment/installment/update
// @desc    Update installment payment status
// @access  Private (internal)
router.post('/installment/update', installmentController.updateInstallmentPayment);

// @route   POST /api/early-detection/payment/installment/cancel
// @desc    Cancel installment plan
// @access  Public
router.post('/installment/cancel', installmentController.cancelInstallmentPlan);

module.exports = router;
