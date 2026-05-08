const SupplierItem = require("../models/Inventory/supplierItem");
const Supplier = require("../models/Inventory/Supplier");
const HeadAssistant = require("../models/HeadAssistant");


// Get all supplier items
exports.getSupplierItems = async (req, res) => {
  try {
    const { branch } = req.query;

    const headAssistant = await HeadAssistant.findOne({ email: req.user.email });
    if(!headAssistant) {
      return res.status(400).json({ message: 'Head assistant not found!' });
    }

    // Base query
    const query = {};

    if (branch && branch.toLowerCase() !== "all") {
      // Find supplier IDs that belong to this branch
      const suppliers = await Supplier.find({
        branch: { $regex: new RegExp(`^${branch}$`, "i") },
      }).select("_id");

      // Extract their IDs
      const supplierIds = suppliers.map((s) => s._id);

      // Apply filter
      query.supplier = { $in: supplierIds };
    }

    // Fetch data with population
    const data = await SupplierItem.find(query)
      .populate("supplier", "name branch")
      .populate("item", "name category sku");

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new supplier item and auto-assign branch from supplier
exports.createSupplierItem = async (req, res) => {
  try {
    const { supplier, item, price } = req.body;
    // Ensure supplier exists
    const supplierData = await Supplier.findById(supplier);
    if (!supplierData) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const headAssistant = await HeadAssistant.findOne({ email: req.user.email });
    if(!headAssistant) {
      return res.status(400).json({ message: 'Head assistant not found!' });
    }

    // Extract branch from supplier (can be string or object)
    const branch =
      typeof supplierData.branch === "object"
        ? supplierData.branch.name
        : supplierData.branch;

    // Create SupplierItem with branch included
    const newItem = await SupplierItem.create({
      supplier,
      item,
      price,
      branch,
    });
    res.json(newItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


exports.updateSupplierItem = async (req, res) => {
  const updated = await SupplierItem.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
};

exports.deleteSupplierItem = async (req, res) => {
  await SupplierItem.findByIdAndDelete(req.params.id);
  res.json({ message: "Supplier item removed" });
};
