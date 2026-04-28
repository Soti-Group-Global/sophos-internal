const Supplier = require("../models/Inventory/Supplier");

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const { branch } = req.query;

    // If branch is missing or equals "all", return all
    if (!branch || branch.toLowerCase() === "all") {
      const suppliers = await Supplier.find();
      return res.json(suppliers);
    }

    // Otherwise, case-insensitive match on branch name
    const suppliers = await Supplier.find({
      branch: { $regex: new RegExp(`^${branch}$`, "i") },
    });

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get supplier by ID
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier)
      return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create supplier
exports.createSupplier = async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!supplier)
      return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Deactivate supplier
exports.deactivateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!supplier)
      return res.status(404).json({ message: "Supplier not found" });
    res.json({ message: "Supplier deactivated", supplier });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
