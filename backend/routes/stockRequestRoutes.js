const express = require("express");
const router = express.Router();
const {
  getAllStockRequests,
  createStockRequest,
  getRequestById,
  deleteRequest,
  updateItemStatus,
  getRequestsByAssistant,
  getAssistantRequestById
} = require("../controllers/stockRequestController");

router.get("/", getAllStockRequests);
router.get("/:id", getRequestById);
router.get("/assistant/request/:id", getAssistantRequestById);
router.get("/assistant/:assistantEmail", getRequestsByAssistant);
router.post("/", createStockRequest);
router.delete("/:id",  deleteRequest);
router.patch("/:requestId/items/:itemId/status", updateItemStatus);

module.exports = router;