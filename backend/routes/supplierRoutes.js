const express = require("express");
const router = express.Router();
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deactivateSupplier
} = require("../controllers/supplierController");

router.get("/", getSuppliers);
router.get("/:id", getSupplierById);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deactivateSupplier);

module.exports = router;
