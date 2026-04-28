const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Vendor = require('../models/Vendor');
const Specialty = require('../models/Specialty');
const { getGfs } = require('../gridfs');

// Generate dummy vendorId and orderSeries
const generateDummyVendorId = () => {
  const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `VENDOR-${randomString}`;
};

const generateDummyOrderSeries = () => {
  const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `ORDER-${randomString}`;
};

// Helper: read profile picture from GridFS as base64
const readProfilePicture = async (profileFileId) => {
  if (!profileFileId) return null;
  const gfs = getGfs();
  const file = await gfs.find({ _id: new mongoose.Types.ObjectId(profileFileId) }).toArray();
  if (file.length === 0) return null;
  const readStream = gfs.openDownloadStream(file[0]._id);
  const chunks = [];
  await new Promise((resolve, reject) => {
    readStream.on('data', (chunk) => chunks.push(chunk));
    readStream.on('end', () => resolve());
    readStream.on('error', reject);
  });
  return Buffer.concat(chunks).toString('base64');
};

// Create vendor
const createVendor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendorName, email, phone, address, services } = req.body;

    // Check for existing vendor by name or email
    const existingVendor = await Vendor.findOne({ $or: [{ vendorName }, { email }] });
    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor name or email already exists' });
    }

    // Generate dummy vendorId and orderSeries
    let vendorId = generateDummyVendorId();
    let orderSeries = generateDummyOrderSeries();

    // Ensure vendorId and orderSeries are unique
    let vendorIdExists = await Vendor.findOne({ vendorId });
    let attempts = 0;
    while (vendorIdExists && attempts < 5) {
      vendorId = generateDummyVendorId();
      vendorIdExists = await Vendor.findOne({ vendorId });
      attempts++;
    }
    if (vendorIdExists) {
      return res.status(400).json({ message: 'Unable to generate unique vendor ID' });
    }

    let orderSeriesExists = await Vendor.findOne({ orderSeries });
    attempts = 0;
    while (orderSeriesExists && attempts < 5) {
      orderSeries = generateDummyOrderSeries();
      orderSeriesExists = await Vendor.findOne({ orderSeries });
      attempts++;
    }
    if (orderSeriesExists) {
      return res.status(400).json({ message: 'Unable to generate unique order series' });
    }

    const vendor = new Vendor({
      vendorName,
      vendorId,
      orderSeries,
      email,
      phone,
      address,
      services: services || [],
    });

    // Handle profile image
    if (req.file) {
      const gfs = getGfs();
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(writeStream.id));
        writeStream.on('error', reject);
      });
      vendor.profileFileId = fileId;
    }

    await vendor.save();

    const populatedVendor = await Vendor.findById(vendor._id).populate('services.specialtyId', 'name');
    const profilePicture = await readProfilePicture(vendor.profileFileId);

    res.status(201).json({
      vendor: {
        ...populatedVendor.toObject(),
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all vendors
const getAllVendors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const vendors = await Vendor.find()
      .populate('services.specialtyId', 'name')
      .skip(skip)
      .limit(limit);

    const total = await Vendor.countDocuments();

    const vendorsWithImages = await Promise.all(
      vendors.map(async (vendor) => {
        const profilePicture = await readProfilePicture(vendor.profileFileId);
        return {
          ...vendor.toObject(),
          profilePicture,
        };
      })
    );

    res.json({
      vendors: vendorsWithImages,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get vendor by ID
const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate('services.specialtyId', 'name');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const profilePicture = await readProfilePicture(vendor.profileFileId);

    res.json({
      vendor: {
        ...vendor.toObject(),
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update vendor
const updateVendor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendorName, email, phone, address, services } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Check for unique name and email if changed
    if (vendorName !== vendor.vendorName || email !== vendor.email) {
      const existingVendor = await Vendor.findOne({
        $or: [{ vendorName }, { email }],
        _id: { $ne: req.params.id },
      });
      if (existingVendor) {
        return res.status(400).json({ message: 'Vendor name or email already exists' });
      }
    }

    // Update fields
    vendor.vendorName = vendorName;
    vendor.email = email;
    vendor.phone = phone || '';
    vendor.address = address || '';
    if (services) {
      vendor.services = services;
    }

    // Handle profile image
    if (req.file) {
      const gfs = getGfs();
      if (vendor.profileFileId) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(vendor.profileFileId));
        } catch (err) {
        }
      }
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(writeStream.id));
        writeStream.on('error', reject);
      });
      vendor.profileFileId = fileId;
    }

    await vendor.save();

    const populatedVendor = await Vendor.findById(vendor._id).populate('services.specialtyId', 'name');
    const profilePicture = await readProfilePicture(populatedVendor.profileFileId);

    res.json({
      vendor: {
        ...populatedVendor.toObject(),
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add service to vendor
const addVendorService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { specialtyId, selectedTests } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const specialty = await Specialty.findById(specialtyId);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    // Validate selectedTests against specialty tests
    for (const selectedTest of selectedTests) {
      const testExists = specialty.tests.some(
        (test) => test._id.toString() === selectedTest.testId && test.name === selectedTest.name
      );
      if (!testExists) {
        return res.status(400).json({ message: `Invalid test: ${selectedTest.name}` });
      }
    }

    // Check if service for this specialty already exists
    if (vendor.services.some((service) => service.specialtyId.toString() === specialtyId)) {
      return res.status(400).json({ message: 'Service for this specialty already exists' });
    }

    vendor.services.push({ specialtyId, selectedTests });

    await vendor.save();

    const populatedVendor = await Vendor.findById(vendor._id).populate('services.specialtyId', 'name');
    const profilePicture = await readProfilePicture(populatedVendor.profileFileId);

    res.json({
      vendor: {
        ...populatedVendor.toObject(),
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update service in vendor
const updateVendorService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { selectedTests } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const service = vendor.services.find((s) => s.specialtyId.toString() === req.params.specialtyId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const specialty = await Specialty.findById(req.params.specialtyId);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    // Validate selectedTests against specialty tests
    for (const selectedTest of selectedTests) {
      const testExists = specialty.tests.some(
        (test) => test._id.toString() === selectedTest.testId && test.name === selectedTest.name
      );
      if (!testExists) {
        return res.status(400).json({ message: `Invalid test: ${selectedTest.name}` });
      }
    }

    service.selectedTests = selectedTests;

    await vendor.save();

    const populatedVendor = await Vendor.findById(vendor._id).populate('services.specialtyId', 'name');
    const profilePicture = await readProfilePicture(populatedVendor.profileFileId);

    res.json({
      vendor: {
        ...populatedVendor.toObject(),
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete service from vendor
const deleteVendorService = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const serviceIndex = vendor.services.findIndex(
      (service) => service.specialtyId.toString() === req.params.specialtyId
    );
    if (serviceIndex === -1) {
      return res.status(404).json({ message: 'Service not found' });
    }

    vendor.services.splice(serviceIndex, 1);

    await vendor.save();

    const populatedVendor = await Vendor.findById(vendor._id).populate('services.specialtyId', 'name');
    const profilePicture = await readProfilePicture(populatedVendor.profileFileId);

    res.json({
      vendor: {
        ...populatedVendor.toObject(),
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete vendor
const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (vendor.profileFileId) {
      const gfs = getGfs();
      try {
        const file = await gfs.find({ _id: new mongoose.Types.ObjectId(vendor.profileFileId) }).toArray();
        if (file.length > 0) {
          await gfs.delete(new mongoose.Types.ObjectId(vendor.profileFileId));
        } else {
        }
      } catch (err) {
      }
    }

    await vendor.deleteOne();

    res.json({ message: 'Vendor deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get profile image by file ID
const getProfileImage = async (req, res) => {
  try {
    const gfs = getGfs();
    const file = await gfs.find({ _id: new mongoose.Types.ObjectId(req.params.fileId) }).toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }
    res.set('Content-Type', file[0].contentType);
    const readStream = gfs.openDownloadStream(file[0]._id);
    readStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  addVendorService,
  updateVendorService,
  deleteVendorService,
  deleteVendor,
  getProfileImage,
};
