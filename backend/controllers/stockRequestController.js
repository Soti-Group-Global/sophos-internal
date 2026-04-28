const Assistant = require("../models/Assistant");
const AssistantTransaction = require("../models/Inventory/AssistantTransaction");
const Stock = require("../models/Inventory/Stock");

// Get all requests
exports.getAllStockRequests = async (req, res) => {
  try {
    const requests = await AssistantTransaction.find({}, {
      fromAssistantEmail: 1,
      status: 1,
      requestedDate: 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

const formatFullName = (user) => {
  if (!user) return "";
  return [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
};

// Get request by ID
exports.getRequestById = async (req, res) => {
  try {
    const request = await AssistantTransaction.findById(req.params.id)
      .populate({
        path: 'items.item',
        select: 'name category sku',
      })
      .lean();

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    const assistant = await Assistant.findOne(
      { email: request.fromAssistantEmail },
      { firstName: 1, middleName: 1, lastName: 1, email: 1, phoneNumber: 1 }
    ).lean();


    const itemIds = request.items.map((i) => i.item?._id).filter(Boolean);

    const stockDocs = await Stock.find({ item: { $in: itemIds } })
      .select("item quantity")
      .lean();

    const stockMap = {};
    stockDocs.forEach((s) => {
      stockMap[s.item.toString()] = s.quantity;
    });

    const updatedItems = request.items.map((item) => {
      if (item.itemStatus !== 'Approved') {
        let minQuantity = Math.min(item.requestedQuantity, (stockMap[item.item?._id?.toString()] || 0));

        return (
          {
            ...item,
            approvedQuantity: minQuantity,
            availableQuantity: stockMap[item.item?._id?.toString()] || 0,
          }
        )
      }

      return ({
        ...item,
        availableQuantity: stockMap[item.item?._id?.toString()] || 0,
      })
    });

    res.json({ ...request, assistant, assistantName: formatFullName(assistant), items: updatedItems });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch request details" });
  }
}

// Get request by ID for Assitant
exports.getAssistantRequestById = async (req, res) => {
  try {
    const request = await AssistantTransaction.findById(req.params.id)
      .populate({
        path: 'items.item',
        select: 'name category sku',
      })
      .lean();

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch request details" });
  }
}

//Get requests by assistant
exports.getRequestsByAssistant = async (req, res) => {
  try {
    const assistantEmail = req.params.assistantEmail;

    if (!assistantEmail) {
      return res.status(400).json({ message: 'Assistant email is required' })
    }

    const transactions = await AssistantTransaction.find({ fromAssistantEmail: assistantEmail }, {
      fromAssistantEmail: 1,
      status: 1,
      requestedDate: 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch the requests' })
  }
}

// Create a new request
exports.createStockRequest = async (req, res) => {
  try {
    const { fromAssistantEmail, items } = req.body;

    if (!fromAssistantEmail || !items?.length) {
      return res.status(400).json({
        message: "assistantEmail, and items are required",
      });
    }

    const assistant = await Assistant.findOne({ email: fromAssistantEmail });

    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }

    const mergedItemsMap = {};

    for (const i of items) {
      const key = i.item.toString();
      if (!mergedItemsMap[key]) {
        mergedItemsMap[key] = { ...i };
      } else {
        mergedItemsMap[key].requestedQuantity += i.requestedQuantity;
      }
    }

    const mergedItems = Object.values(mergedItemsMap);

    const assistantTransaction = new AssistantTransaction({ ...req.body, items: mergedItems });
    await assistantTransaction.save();
    res.status(201).json({ message: 'success' })
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Delete a request
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRequest = await AssistantTransaction.findByIdAndDelete(id);

    if (!deletedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json({
      message: "Request deleted successfully",
      deletedId: id,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete request" });
  }
};

// Update request status
exports.updateItemStatus = async (req, res) => {
  try {
    const { requestId, itemId } = req.params;
    const { status, approvedQuantity } = req.body;

    // Find transaction and item
    const transaction = await AssistantTransaction.findById(requestId);
    if (!transaction) return res.status(404).json({ message: "Stock request not found" });

    const item = transaction.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    // Update item fields
    item.itemStatus = status || item.itemStatus;
    if (approvedQuantity !== undefined) item.approvedQuantity = approvedQuantity;
    item.updatedAt = new Date();

    // If marked as approved → update stock
    if (status === "Approved") {
      await Stock.findOneAndUpdate(
        { item: item.item },
        {
          $inc: { quantity: -(approvedQuantity || item.approvedQuantity) },
          $set: {
            lastUpdated: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    }

    // Save changes
    await transaction.save();

    return res.json({
      message:
        status === "Approved"
          ? "Item marked as approved and stock updated successfully"
          : "Item status updated successfully",
      transaction,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};