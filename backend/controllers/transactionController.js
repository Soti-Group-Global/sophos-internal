const StockTransaction = require("../models/Inventory/StockTransaction");
const Stock = require("../models/Inventory/Stock");

// Get all transactions
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await StockTransaction.find()
      .populate("item patient createdBy")
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create transaction (usage, adjustment, transfer)
exports.createTransaction = async (req, res) => {
  try {
    const { type, item, quantity, fromLocation, toLocation } = req.body;

    // Log the transaction
    const transaction = new StockTransaction(req.body);
    await transaction.save();

    // Update stock quantities depending on type
    if (type === "Usage" || type === "Adjustment") {
      await Stock.findOneAndUpdate(
        { item, location: fromLocation },
        { $inc: { quantity: -Math.abs(quantity) }, lastUpdated: new Date() }
      );
    }

    if (type === "Transfer") {
      // Deduct from source
      await Stock.findOneAndUpdate(
        { item, location: fromLocation },
        { $inc: { quantity: -Math.abs(quantity) } }
      );

      // Add to destination
      await Stock.findOneAndUpdate(
        { item, location: toLocation },
        { $inc: { quantity: Math.abs(quantity) } },
        { upsert: true, new: true }
      );
    }

    if (type === "Return") {
      await Stock.findOneAndUpdate(
        { item, location: toLocation },
        { $inc: { quantity: Math.abs(quantity) } },
        { upsert: true, new: true }
      );
    }

    res.status(201).json({ message: "Transaction recorded successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
