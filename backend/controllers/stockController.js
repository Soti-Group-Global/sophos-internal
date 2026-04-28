const Stock = require("../models/Inventory/Stock");
const InventoryItem = require("../models/Inventory/InventoryItem");

// Get all stock
exports.getAllStocks = async (req, res) => {
  try {
    const { branch } = req.query;


    const query = {};

    // Apply branch filter only if specified and not "All" (case-insensitive)
    if (branch && branch.toLowerCase() !== "all") {
      query.branch = { $regex: new RegExp(`^${branch}$`, "i") };
    }

    const stocks = await Stock.find(query)
      .populate({
        path: "item",
        select: "name category sku unit manufacturer reorderLevel",
      })
      .sort({ lastUpdated: -1 });

    res.json(stocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// Get stock by item
exports.getStockByItem = async (req, res) => {
  try {
    const stock = await Stock.find({ item: req.params.itemId }).populate("item");
    res.json(stock);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update stock quantity manually
exports.updateStockQuantity = async (req, res) => {
  try {
    const { quantity } = req.body;
    const stock = await Stock.findByIdAndUpdate(
      req.params.id,
      { quantity },
      { new: true }
    );
    if (!stock) return res.status(404).json({ message: "Stock not found" });
    res.json(stock);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get low-stock alerts
exports.getLowStockItems = async (req, res) => {
  try {
    const items = await InventoryItem.find();
    const lowStockItems = [];

    for (const item of items) {
      const totalStock = await Stock.aggregate([
        { $match: { item: item._id } },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
      ]);

      const qty = totalStock[0]?.total || 0;
      if (qty <= item.reorderLevel) {
        lowStockItems.push({
          item: item.name,
          availableQty: qty,
          reorderLevel: item.reorderLevel
        });
      }
    }

    res.json(lowStockItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Order Suggestions
exports.getReorderSuggestions = async (req, res) => {
  try {
    const { branch } = req.query;

    // Build branch filter
    const branchFilter =
      branch && branch.toLowerCase() !== "all"
        ? { branch: { $regex: new RegExp(`^${branch}$`, "i") } }
        : {};

    // Get all items with their preferred suppliers
    const items = await InventoryItem.find().populate("preferredSupplier");

    const reorderList = [];

    for (const item of items) {
      // Aggregate total stock quantity filtered by branch (if provided)
      const stockAgg = await Stock.aggregate([
        {
          $match: {
            item: item._id,
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: null,
            totalQty: { $sum: "$quantity" },
          },
        },
      ]);

      const totalAvailable = stockAgg[0]?.totalQty || 0;

      // Compare against reorder level
      if (totalAvailable < item.reorderLevel) {
        reorderList.push({
          item: item._id,
          name: item.name,
          category: item.category,
          branch: branch || "All",
          totalAvailable,
          reorderLevel: item.reorderLevel,
          reorderQuantity: item.reorderQuantity,
          preferredSupplier: item.preferredSupplier || null,
        });
      }
    }

    res.json(reorderList);
  } catch (err) {
    res.status(500).json({ message: "Failed to check low-stock items" });
  }
};
