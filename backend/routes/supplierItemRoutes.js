const express = require("express");
const router = express.Router();
const {
  getSupplierItems,
  createSupplierItem,
  updateSupplierItem,
  deleteSupplierItem,
} = require("../controllers/supplierItemController");

router.get("/", getSupplierItems);

router.post("/", createSupplierItem);

router.put("/:id", updateSupplierItem);

router.delete("/:id", deleteSupplierItem);

module.exports = router;
