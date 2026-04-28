const express = require("express");
const router = express.Router();
const {
  getAllStocks,
  getStockByItem,
  updateStockQuantity,
  getLowStockItems,
  getReorderSuggestions
} = require("../controllers/stockController");

router.get("/", getAllStocks);
router.get("/item/:itemId", getStockByItem);
router.patch("/:id", updateStockQuantity);
router.get("/alerts/low", getLowStockItems);
router.get("/reorder-suggestions", getReorderSuggestions);

module.exports = router;
