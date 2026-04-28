const mongoose = require('mongoose');
const { getGfs } = require('../gridfs');
const Application = require('../models/Application');
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const { v4: uuidv4 } = require('uuid');

// Get all orders, optionally filtered by vendorId or applicationId
const getOrders = async (req, res) => {
  try {
    const { vendorId, applicationId } = req.query;
    const query = {};

    if (vendorId) {
      query.vendorId = vendorId;
    }
    if (applicationId) {
      // Validate applicationId
      const application = await Application.findOne({ applicationId });
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
      query.applicationId = applicationId;
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
};

// Get orders for a specific vendor, grouped by orderId
const getOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({ message: 'Vendor ID is required' });
    }

    const orders = await Order.find({ vendorId }).sort({ createdAt: -1 }).lean();

    // Group orders by orderId
    const grouped = {};
    orders.forEach((order) => {
      const key = order.orderId;

      if (!grouped[key]) {
        grouped[key] = {
          orderId: key,
          applicationId: order.applicationId,
          patientDetails: order.patientDetails,
          createdAt: order.createdAt,
          tests: [],
        };
      }

      grouped[key].tests.push({
        testId: order.testId,
        testName: order.testName,
        status: order.status,
        resultFileId: order.resultFileId,
        uploadedAt: order.uploadedAt,
      });
    });

    const groupedOrders = Object.values(grouped);
    res.json(groupedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor orders', error: error.message });
  }
};

// Create a new order
const createOrder = async (req, res) => {
  try {
    const { applicationId, testId, testName, vendorId, vendorName, patientDetails } = req.body;

    // Validate required fields
    if (!applicationId || !testId || !testName) {
      return res.status(400).json({ message: 'applicationId, testId, and testName are required' });
    }

    // Verify application exists
    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Generate unique orderId
    const orderId = uuidv4();

    const orderData = {
      orderId,
      applicationId,
      testId,
      testName,
      vendorId: vendorId || null,
      vendorName: vendorName || null,
      patientDetails: patientDetails || null,
      status: 'Waiting for Assign',
    };

    const order = new Order(orderData);
    await order.save();

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['Ordered', 'Completed', 'Cancelled', 'Waiting for Assign'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
};

// Upload test result
const uploadTestResult = async (req, res) => {
  try {
    const { testId } = req.params;
    const file = req.file;

    if (!testId || !file) {
      return res.status(400).json({ message: 'testId and file are required' });
    }

    const gfs = getGfs();
    if (!gfs) {
      return res.status(500).json({ message: 'File storage not configured' });
    }

    const uploadStream = gfs.openUploadStream(file.originalname, {
      contentType: file.mimetype,
    });
    uploadStream.end(file.buffer);

    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    const updatedOrder = await Order.findOneAndUpdate(
      { testId: new mongoose.Types.ObjectId(testId) },
      {
        $set: {
          resultFileId: fileId,
          uploadedAt: new Date(),
          status: 'Completed',
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({
      message: 'Result uploaded successfully',
      fileId,
      orderId: updatedOrder.orderId,
      testId,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload test result', error: error.message });
  }
};

// Retrieve test result file
const getResultFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const download = req.query.download === 'true';

    const gfs = getGfs();
    if (!gfs) {
      return res.status(500).json({ message: 'File storage not configured' });
    }

    const file = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.set('Content-Type', file[0].contentType || 'application/octet-stream');
    res.set('Content-Disposition', download
      ? `attachment; filename="${file[0].filename}"`
      : `inline; filename="${file[0].filename}"`
    );

    const downloadStream = gfs.openDownloadStream(file[0]._id);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      res.status(500).json({ message: 'Error streaming file' });
    });
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }
    res.status(500).json({ message: 'Failed to retrieve file', error: error.message });
  }
};

// Assign vendor to a single order
const assignVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, vendorName } = req.body;

    // Validate required fields
    if (!vendorId || !vendorName) {
      return res.status(400).json({ message: 'vendorId and vendorName are required' });
    }

    // Validate order exists
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order is in "Waiting for Assign" status
    if (order.status !== 'Waiting for Assign') {
      return res.status(400).json({ message: 'Order must be in Waiting for Assign status' });
    }

    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Check if vendor supports the test
    const canHandleTest = vendor.services.some((service) =>
      service.selectedTests.some((test) => test.testId.toString() === order.testId.toString())
    );
    if (!canHandleTest) {
      return res.status(400).json({ message: 'Vendor does not support this test' });
    }

    // Update order with vendor details and status
    order.vendorId = vendorId;
    order.vendorName = vendorName;
    order.status = 'Ordered';
    await order.save();

    res.json(order);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }
    res.status(500).json({ message: 'Failed to assign vendor', error: error.message });
  }
};

// Bulk assign vendor to multiple orders
const bulkAssignVendor = async (req, res) => {
  try {
    const { vendorId, vendorName, orderIds } = req.body;

    // Validate required fields
    if (!vendorId || !vendorName || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'vendorId, vendorName, and orderIds (non-empty array) are required' });
    }

    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Fetch all orders to validate
    const orders = await Order.find({ _id: { $in: orderIds } });
    if (orders.length !== orderIds.length) {
      return res.status(404).json({ message: 'One or more orders not found' });
    }

    // Validate all orders are in "Waiting for Assign" status and vendor supports tests
    for (const order of orders) {
      if (order.status !== 'Waiting for Assign') {
        return res.status(400).json({ message: `Order ${order._id} is not in Waiting for Assign status` });
      }
      const canHandleTest = vendor.services.some((service) =>
        service.selectedTests.some((test) => test.testId.toString() === order.testId.toString())
      );
      if (!canHandleTest) {
        return res.status(400).json({ message: `Vendor does not support test for order ${order._id}` });
      }
    }

    // Update all orders
    const updatedOrders = await Promise.all(
      orders.map(async (order) => {
        order.vendorId = vendorId;
        order.vendorName = vendorName;
        order.status = 'Ordered';
        await order.save();
        return order;
      })
    );

    res.json(updatedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign vendor to orders', error: error.message });
  }
};

// Bulk create orders from tests
const bulkCreateOrders = async (req, res) => {
  try {
    const { applicationId, tests } = req.body;

    if (!applicationId) {
      return res.status(400).json({ message: "Application ID is required" });
    }
    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ message: "No tests provided" });
    }

    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Create orders (fast path with insertMany)
    const docsToInsert = tests.map((test) => ({
      orderId: null,
      applicationId: application.applicationId,
      testId: test.testId,
      testName: test.testName,
      vendorId: null,
      vendorName: test.vendorName || "Unassigned",
      status: "Waiting for Assign",
    }));

    const created = await Order.insertMany(docsToInsert);

    return res.json({
      message: "Tests added successfully.",
      orderCount: created.length,
      orders: created.map(o => ({
        _id: o._id,
        testId: o.testId,
        testName: o.testName,
        status: o.status,
        vendorName: o.vendorName,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error while saving tests" });
  }
};

// Get orders by applicationId
const getOrdersByApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const orders = await Order.find({ applicationId });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

module.exports = {
  getOrders,
  getOrdersByVendor,
  createOrder,
  updateOrderStatus,
  uploadTestResult,
  getResultFile,
  assignVendor,
  bulkAssignVendor,
  bulkCreateOrders,
  getOrdersByApplication,
};
