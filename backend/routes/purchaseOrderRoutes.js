// routes/purchaseOrders.js
const express = require("express");
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  receivePurchaseOrder,
  createPurchaseOrderWithPDF,
  updateItemStatus
} = require("../controllers/purchaseOrderController");

router.get("/", getPurchaseOrders);
router.get("/:id", getPurchaseOrderById);
router.post("/", createPurchaseOrder);
router.put("/:id/receive", receivePurchaseOrder);
// Add this route - it will be /api/inventory/purchase-orders/with-pdf
router.post('/with-pdf', createPurchaseOrderWithPDF);
router.patch("/:orderId/items/:itemId/status", updateItemStatus);

module.exports = router;