const PurchaseOrder = require("../models/Inventory/PurchaseOrder");
const Stock = require("../models/Inventory/Stock");
const Supplier = require("../models/Inventory/Supplier");
const HeadAssistant = require("../models/HeadAssistant");
const { transporter: _emailTransporter } = require('../utils/emailService');
// Get all purchase orders
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { branch } = req.query;
    // Build query dynamically
    const query =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branch: { $regex: new RegExp(`^${branch}$`, "i") } };
    
    const headAssistant = await HeadAssistant.findOne({ email: req.user.email });
    if(!headAssistant) {
      return res.status(400).json({ message: 'Head assistant not found!' });
    }

    // Find orders (filtered if branch provided)
    const orders = await PurchaseOrder.find(query)
      .populate("supplier", "name branch")
      .populate("items.item", "name category")
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Get single purchase order
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id).populate(
      "supplier items.item"
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new purchase order (multi-supplier compatible)
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Order must include at least one item." });
    }

    // Group items by supplier
    const groupedBySupplier = {};
    for (const i of items) {
      if (!i.supplier || !i.item || !i.quantity) continue;
      if (!groupedBySupplier[i.supplier]) groupedBySupplier[i.supplier] = [];
      groupedBySupplier[i.supplier].push({
        item: i.item,
        quantity: Number(i.quantity),
        costPrice: Number(i.price) || 0,
        batchNumber: i.batchNumber || null,
        expiryDate: i.expiryDate || null,
      });
    }

    if (Object.keys(groupedBySupplier).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid supplier groups found." });
    }

    const createdOrders = [];

    // Loop through each supplier group
    for (const [supplierId, supplierItems] of Object.entries(groupedBySupplier)) {
      // Fetch supplier to get branch
      const supplier = await Supplier.findById(supplierId).select("branch name");
      if (!supplier) {
        continue; // skip invalid supplier IDs
      }

      const totalAmount = supplierItems.reduce(
        (sum, i) => sum + i.quantity * i.costPrice,
        0
      );

      // Create order with supplier branch
      const newOrder = new PurchaseOrder({
        supplier: supplierId,
        branch: supplier.branch || "All",
        items: supplierItems,
        totalAmount,
        status: "Pending",
        createdBy: req.user ? req.user._id : null,
      });

      await newOrder.save();
      createdOrders.push(newOrder);
    }

    res.status(201).json({
      message: "Purchase orders created successfully",
      count: createdOrders.length,
      orders: createdOrders,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};



// Receive purchase order and update stock
exports.receivePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate("supplier");
    if (!po) return res.status(404).json({ message: "Order not found" });

    // Mark purchase order as received
    po.status = "Received";
    po.receivedDate = new Date();
    await po.save();

    // Determine branch (prefer order.branch, fallback to supplier.branch)
    const branchName = po.branch || po.supplier?.branch || "All";

    // Add/update stock for each item
    for (const item of po.items) {
      await Stock.findOneAndUpdate(
        {
          item: item.item,
          batchNumber: item.batchNumber || null,
          branch: branchName,
        },
        {
          $inc: { quantity: item.quantity },
          $set: {
            expiryDate: item.expiryDate,
            costPrice: item.costPrice,
            lastUpdated: new Date(),
            branch: branchName,
          },
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: `Order received and stock updated for branch: ${branchName}`,
      branch: branchName,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




exports.createPurchaseOrderWithPDF = async (req, res) => {
  try {
    const headAssistant = await HeadAssistant.findOne({ email: req.user.email });
    if(!headAssistant) {
      return res.status(400).json({ message: 'Head assistant not found!' });
    }
    const {
      supplier,
      items,
      totalAmount,
      supplierEmail,
      supplierName,
      pdfData,
    } = req.body;

    // Validate required fields
    if (!supplier || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Supplier and at least one valid item are required.",
      });
    }

    // Fetch supplier to get branch info
    const supplierDoc = await Supplier.findById(supplier).select("branch name");
    if (!supplierDoc) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    // Prepare and validate order items
    const orderItems = items.map((item) => ({
      item: item.item,
      quantity: Number(item.quantity) || 0,
      costPrice: Number(item.price) || 0,
      batchNumber: item.batchNumber || null,
      expiryDate: item.expiryDate || null,
      receivedQuantity: 0,
      itemStatus: "Pending",
      remarks: "",
      updatedAt: new Date(),
    }));

    if (orderItems.some((i) => !i.item || i.quantity <= 0)) {
      return res.status(400).json({
        message: "Each item must include a valid product ID and quantity.",
      });
    }

    // Compute total if not explicitly provided
    const calculatedTotal =
      totalAmount ||
      orderItems.reduce((sum, i) => sum + i.quantity * i.costPrice, 0);

    // Create Purchase Order (auto attach supplier branch)
    const newOrder = new PurchaseOrder({
      supplier,
      branch: supplierDoc.branch || "All",
      items: orderItems,
      totalAmount: calculatedTotal,
      status: "Pending",
      createdBy: req.user ? req.user._id : null,
      orderDate: new Date(),
    });

    await newOrder.save();

    // Optional: Send email with attached PDF
    let emailSent = false;
    if (supplierEmail && pdfData) {
      try {
        await sendEmailWithPDF({
          to: supplierEmail,
          supplierName: supplierName || supplierDoc.name || "Supplier",
          order: newOrder,
          pdfData,
        });
        emailSent = true;

        newOrder.emailSent = true;
        newOrder.emailSentAt = new Date();
        await newOrder.save();
      } catch (emailErr) {
      }
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Purchase order created successfully.",
      order: newOrder,
      emailSent,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating purchase order.",
      error: err.message,
    });
  }
};



// Email service function for Gmail
const sendEmailWithPDF = async ({ to, supplierName, order, pdfData }) => {
  try {
    // Use shared transporter from emailService
    const transporter = _emailTransporter;


    const mailOptions = {
      from: `"SOPHOS" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: `Purchase Order #HD-${order._id.toString().slice(-6)} - SOPHOS`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f8fafc; }
            .footer { background: #1e293b; color: white; padding: 20px; text-align: center; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .order-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
            .info-item { padding: 10px; background: #f1f5f9; border-radius: 5px; }
            .contact-info { background: #dbeafe; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 2em;">🏥 SOPHOS</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Medical Supplies & Equipment</p>
          </div>
          
          <div class="content">
            <h2 style="color: #1e40af; margin-top: 0;">New Purchase Order</h2>
            <p>Dear <strong>${supplierName}</strong>,</p>
            
            <div class="order-details">
              <h3 style="color: #1e40af; margin-top: 0;">Order Summary</h3>
              <div class="order-info">
                <div class="info-item">
                  <strong>Order Number:</strong><br>
                  HD-${order._id.toString().slice(-6)}
                </div>
                <div class="info-item">
                  <strong>Order Date:</strong><br>
                  ${new Date(order.createdAt).toLocaleDateString('en-IN')}
                </div>
                <div class="info-item">
                  <strong>Total Amount:</strong><br>
                  ₹${order.totalAmount.toFixed(2)}
                </div>
                <div class="info-item">
                  <strong>Items Ordered:</strong><br>
                  ${order.items.length} products
                </div>
              </div>
            </div>
            
            <p>Please find the detailed purchase order attached as a PDF document. This PDF contains:</p>
            <ul>
              <li>Complete item list with quantities and prices</li>
              <li>Delivery instructions and address</li>
              <li>Quality standards and requirements</li>
              <li>Payment terms and conditions</li>
            </ul>
            
            <div class="contact-info">
              <h4 style="margin-top: 0; color: #1e40af;">Delivery & Contact Information</h4>
              <p><strong>Delivery Address:</strong><br>
              Health-Direct Medical Center<br>
              123 Medical Center Drive, Healthcare City</p>
              
              <p><strong>Contact Procurement Team:</strong><br>
              📞 +91 98765 43210<br>
              ✉️ procurement@health-direct.com</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the attached purchase order</li>
              <li>Confirm order acceptance via email</li>
              <li>Provide expected delivery timeline</li>
              <li>Notify us of any issues or substitutions</li>
            </ol>
            
            <p>We appreciate your prompt attention to this order.</p>
          </div>
          
          <div class="footer">
            <p style="margin: 0; opacity: 0.8;">Thank you for your partnership with Health-Direct</p>
            <p style="margin: 10px 0 0 0; opacity: 0.6;">
              📞 +91 98765 43210 | ✉️ info@health-direct.com | 🌐 www.health-direct.com
            </p>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: pdfData.fileName,
          content: pdfData.base64.split('base64,')[1], // Remove data URI prefix
          encoding: 'base64',
          contentType: 'application/pdf'
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw error;
  }
};

// PATCH /inventory/purchase-orders/:orderId/items/:itemId/status
exports.updateItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status, receivedQuantity } = req.body;


    const order = await PurchaseOrder.findById(orderId).populate("supplier");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.itemStatus = status || item.itemStatus;
    if (receivedQuantity !== undefined) item.receivedQuantity = receivedQuantity;
    item.updatedAt = new Date();

    const branchName = order.branch || order.supplier?.branch || "All";

    if (status === "Received") {
      const qtyToAdd = receivedQuantity || item.quantity;


      const updatedStock = await Stock.findOneAndUpdate(
        {
          item: item.item,
          batchNumber: item.batchNumber || null,
          branch: branchName,
        },
        {
          $inc: { quantity: qtyToAdd },
          $set: {
            expiryDate: item.expiryDate || null,
            lastUpdated: new Date(),
            branch: branchName,
          },
        },
        { upsert: true, new: true }
      );


    }

    await order.save();


    return res.json({
      success: true,
      message:
        status === "Received"
          ? `Item marked as received and stock updated for branch: ${branchName}`
          : "Item status updated successfully",
      branch: branchName,
      order,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

