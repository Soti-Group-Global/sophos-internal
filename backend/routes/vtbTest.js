const express = require("express");
const router = express.Router();
const {
  testConnection,
  testOrder,
  createOrder,
  getLiveToken,
  handleWebhook,
  getOrderStatus,
} = require("../controllers/vtbTestController");

// GET /bank/test-connection — test SSL chain and VTB sandbox credentials
router.get("/bank/test-connection", testConnection);

// GET /bank/test-order — create a sandbox test order
router.get("/bank/test-order", testOrder);

// GET /bank/create-order — create a live production order
router.get("/bank/create-order", createOrder);

// GET /bank/live-token — obtain a live VTB access token
router.get("/bank/live-token", getLiveToken);

// POST /bank/webhook — VTB payment/refund webhook callback
router.post("/bank/webhook", handleWebhook);

// GET /bank/order-status/:orderId — check VTB order status
router.get("/bank/order-status/:orderId", getOrderStatus);

module.exports = router;
