const Service = require("../models/Service");
const DoctorsProfile = require("../models/DoctorsProfile");
const { getGfsServices } = require("../gridfs-services");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

// Create Service
exports.createService = async (req, res) => {
  try {
    const service = await Service.create(req.body);
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get All Services (with search + filter support)
exports.getAllServices = async (req, res) => {
  try {
    const { search, sectionCode, branch } = req.query;

    const filter = {};

    // Search by English or Russian name or description
    if (search) {
      filter.$or = [
        { "name.en": { $regex: search, $options: "i" } },
        { "name.ru": { $regex: search, $options: "i" } },
        { "description.en": { $regex: search, $options: "i" } },
        { "description.ru": { $regex: search, $options: "i" } },
        { "aboutService.en": { $regex: search, $options: "i" } },
        { "aboutService.ru": { $regex: search, $options: "i" } },
        { sectionCode: { $regex: search, $options: "i" } },
      ];
    }

    // Optional section code filtering
    if (sectionCode) {
      filter.sectionCode = sectionCode;
    }

    // Branch filtering - use branches field from Service schema
    if (branch && branch !== "All") {
      filter.branches = branch;
    }

    const services = await Service.find(filter).sort({ createdAt: -1 });

    // Fetch all unique doctor emails from these services
    const allDoctorEmails = [
      ...new Set(services.flatMap((s) => s.doctorEmails || [])),
    ];

    // Fetch details for these doctors from DoctorsProfile
    const doctorsData = await DoctorsProfile.find({
      email: { $in: allDoctorEmails },
    }).select("firstName middleName lastName email");

    // Create a map for quick lookup
    const doctorMap = doctorsData.reduce((map, doctor) => {
      map[doctor.email.toLowerCase()] = doctor;
      return map;
    }, {});

    // Attach doctor details to each service
    const servicesWithDoctors = services.map((service) => {
      const populatedDoctors = (service.doctorEmails || []).map(
        (email) => doctorMap[email.toLowerCase()] || { email }
      );
      return {
        ...service.toObject(),
        doctors: populatedDoctors,
      };
    });

    res.json(servicesWithDoctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Service by ID with populated doctors data
exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // If there are doctor emails, fetch the complete doctor profiles
    if (service.doctorEmails && service.doctorEmails.length > 0) {
      const doctors = await DoctorsProfile.find({
        email: { $in: service.doctorEmails },
      })
        .populate('specialtyIds', 'name_en name_ru')
        .populate('subSpecialityIds', 'name_en name_ru')
        .select("firstName middleName lastName email specialtyIds subSpecialityIds profileFileId languages");

      // Add doctors data to the service response
      const serviceWithDoctors = {
        ...service.toObject(),
        doctors: doctors || [],
      };

      return res.json(serviceWithDoctors);
    }

    // If no doctors, return service with empty doctors array
    res.json({
      ...service.toObject(),
      doctors: [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Service
exports.updateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete Service
exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Service Names Only (for dropdowns, with branch and doctor filter)
exports.getServiceNames = async (req, res) => {
  try {
    const { branch, doctorEmail } = req.query;
    const filter = {};

    if (branch && branch !== "All") {
      filter.branches = branch;
    }

    if (doctorEmail) {
      filter.doctorEmails = doctorEmail.toLowerCase();
    }

    const services = await Service.find(filter).select("name").sort({ "name.en": 1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Upload File to GridFS
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const gfs = getGfsServices();
    const filename = `${Date.now()}_${req.file.originalname}`;

    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
      },
    });

    const fileId = uploadStream.id;
    uploadStream.end(req.file.buffer);

    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);
    });

    res.status(200).json({
      success: true,
      fileId,
      fileName: req.file.originalname,
    });
  } catch (error) {
    res.status(500).json({ message: "File upload failed" });
  }
};

// Get File from GridFS
exports.getFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: "Invalid file ID format" });
    }

    const gfs = getGfsServices();
    const files = await gfs.find({ _id: new ObjectId(fileId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.set("Content-Type", files[0].contentType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.set("Content-Disposition", `inline; filename="${files[0].filename}"`);

    const readStream = gfs.openDownloadStream(new ObjectId(fileId));
    readStream.on("error", (err) => {
      if (!res.headersSent) res.status(404).end();
    });
    readStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
