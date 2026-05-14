const mongoose = require("mongoose");
const DoctorsProfile = require("../models/DoctorsProfile");
const Service = require("../models/Service");
const { validationResult } = require("express-validator");
const multer = require("multer");
const { getGfs } = require("../gridfs");

/** Multer config for doctor profile images */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) return cb(null, false);
    const filetypes = /jpeg|jpg|png/;
    if (filetypes.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG/JPG/PNG images are allowed"));
  },
}).single("profileImage");

// -------------------------------------------
// GET ALL DOCTORS
// -------------------------------------------
const getAllDoctors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      specialty,
      location,
      service,
      search,
      branch,
      expert,
      specialist,
      status,
    } = req.query;

    const query = {};

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Filter: specialty by ID
    if (specialty) {
      query.specialtyIds = specialty;
    }

    // Filter: location → location.en
    if (location) {
      query["location.en"] = new RegExp(location, "i");
    }

    // Filter: service type
    if (service) {
      if (service === "online") {
        query["services.online"] = true;
      } else if (service === "offline") {
        query["services.offline"] = true;
      }
    }

    // Filter: expert
    if (expert === "true") {
      query.expert = true;
    }

    // Filter: specialist
    if (specialist === "true") {
      query.specialist = true;
    }

    // Filter: branch
    if (branch && branch !== "All") {
      // Search for branch in branches array (both en and ru fields)
      query.$or = [
        { "branches.en": new RegExp(branch, "i") },
        { "branches.ru": new RegExp(branch, "i") },
      ];
    }
    // If branch is 'All' or empty, no branch filter is applied

    // Search across multilingual fields
    if (search) {
      const regex = new RegExp(search, "i");

      // If branch filter is already applied, we need to combine with $and
      if (query.$or) {
        // Branch filter exists, so we need to use $and to combine with search
        query.$and = [
          { $or: query.$or }, // Existing branch filter
          {
            $or: [
              { "firstName.en": regex },
              { "lastName.en": regex },
              { "location.en": regex },
            ],
          },
        ];
        // Remove the original $or as it's now part of $and
        delete query.$or;
      } else {
        // No branch filter, use normal search
        query.$or = [
          { "firstName.en": regex },
          { "lastName.en": regex },
          { "location.en": regex },
        ];
      }
    }

    const doctors = await DoctorsProfile.find(query)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ displayOrder: 1, "reviewStats.averageRating": -1, createdAt: -1 });

    const total = await DoctorsProfile.countDocuments(query);

    res.status(200).json({
      success: true,
      count: doctors.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
      data: doctors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get all doctors profile data
const getDoctorsProfileData = async (req, res) => {
  try {
    const {
      specialty,
      location,
      service,
      search,
      branch,
      status = "active",
      expert,
      specialist,
      earlyDetection,
    } = req.query;

    const query = {};

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Filter: expert
    if (expert === "true") {
      query.expert = true;
    }

    // Filter: specialist
    if (specialist === "true") {
      query.specialist = true;
    }

    // Filter: early detection
    if (earlyDetection === "true") {
      query.earlyDetection = true;
    }

    // Filter: branch
    if (branch && branch !== "All") {
      const branchArray = Array.isArray(branch) ? branch : [branch];
      const conditions = [];
      branchArray.forEach(b => {
        conditions.push({ "branches.en": new RegExp(b, "i") });
        conditions.push({ "branches.ru": new RegExp(b, "i") });
      });
      query.$or = conditions;
    }

    // Filter: specialty by ID
    if (specialty) {
      query.specialtyIds = specialty;
    }

    // Filter: location → location.en
    if (location) {
      query["location.en"] = new RegExp(location, "i");
    }

    // Filter: service type (using the new boolean structure)
    if (service) {
      if (service === "online") {
        query["services.online"] = true;
      } else if (service === "offline") {
        query["services.offline"] = true;
      }
    }

    // Search across multilingual fields
    if (search) {
      const regex = new RegExp(search, "i");

      query.$or = [
        { "firstName.en": regex },
        { "firstName.ru": regex },
        { "lastName.en": regex },
        { "lastName.ru": regex },
        { "location.en": regex },
        { "location.ru": regex },
        { email: regex }, // Also search in email field
      ];
    }

    const doctors = await DoctorsProfile.find(query)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru')
      .sort({ "reviewStats.averageRating": -1, createdAt: -1 })
      .select("firstName middleName lastName email specialtyIds subSpecialityIds earlyDetection")
      .lean(); // Return plain JavaScript objects for better performance

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const getEarlyDetectionDoctors = async (req, res) => {
  try {
    const { branch, status } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (branch && branch !== "All") {
      const branchArray = Array.isArray(branch) ? branch : [branch];
      const conditions = [];

      branchArray.forEach((item) => {
        conditions.push({ "branches.en": new RegExp(item, "i") });
        conditions.push({ "branches.ru": new RegExp(item, "i") });
      });

      query.$or = conditions;
    }

    const doctors = await DoctorsProfile.find(query)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru')
      .sort({ "reviewStats.averageRating": -1, createdAt: -1 })
      .select("firstName middleName lastName email specialtyIds subSpecialityIds earlyDetection status position")
      .lean();

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// -------------------------------------------
// GET DOCTOR BY ID
// -------------------------------------------
const getDoctorById = async (req, res) => {
  try {
    const doctor = await DoctorsProfile.findById(req.params.id)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru')
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    // Ensure image fields are explicitly null if not present
    // Generate full public image URL
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const publicImageUrl = doctor.publicImagePath 
      ? `${baseUrl}${doctor.publicImagePath}`
      : null;
    
    const sanitizedDoctor = {
      ...doctor,
      publicImageUrl: publicImageUrl, // Full public URL for SEO
      publicImagePath: doctor.publicImagePath || null,
      profileFileId: doctor.profileFileId || null,
      photo: doctor.photo || null,
      imageUrl: doctor.imageUrl || null,
      profilePicture: null, // Always null in this endpoint
      // Explicitly set to null if no image exists to prevent frontend caching
      _clearImage: !doctor.publicImagePath && !doctor.profileFileId && !doctor.photo && !doctor.imageUrl
    };

    res.status(200).json({ success: true, data: sanitizedDoctor });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID",
      });
    }
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// -------------------------------------------
// GET DOCTOR BY EMAIL
// -------------------------------------------
const getDoctorByEmail = async (req, res) => {
  try {
    const doctor = await DoctorsProfile.findOne({ email: req.params.email })
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found with this email",
      });
    }

    res.status(200).json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET DOCTOR SERVICES BY ID
const getDoctorServices = async (req, res) => {
  try {
    const doctor = await DoctorsProfile.findById(req.params.id)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru');
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    if (!doctor.email) {
      return res.status(400).json({
        success: false,
        message: "Doctor email not found in profile",
      });
    }

    const services = await Service.find({
      doctorEmails: doctor.email.toLowerCase(),
    });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// CREATE DOCTOR

const createDoctor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Prepare doctor data
    const doctorData = { ...req.body };

    // Handle feesAmount: if empty string or null, remove it to allow optional field
    if (doctorData.feesAmount === "" || doctorData.feesAmount === null) {
      delete doctorData.feesAmount;
    }

    // Handle profile image upload if file exists
    if (req.file) {
      const path = require('path');
      const fs = require('fs').promises;
      
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `doctor-${timestamp}-${sanitizedName}`;
      const filepath = path.join(__dirname, '../public/uploads/doctors', filename);
      
      // Save file to public folder
      await fs.writeFile(filepath, req.file.buffer);
      
      // Store the public path (relative URL)
      doctorData.publicImagePath = `/uploads/doctors/${filename}`;
      
      // Also upload to GridFS for backwards compatibility (optional)
      const gfs = getGfs();
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);

      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });

      doctorData.profileFileId = fileId.toString();
    }

    // Parse JSON strings for complex fields
    const fieldsToParse = [
      "firstName",
      "middleName",
      "lastName",
      "position",
      "regalia",
      "location",
      "languages",
      "services",
      "branches",
      "about",
      "workExperience",
      "education",
      "scientificActivities",
      "internationalMemberships",
      "russianMemberships",
      "awards",
      "advancedTraining",
      "professionalDevelopments"
    ];

    fieldsToParse.forEach((field) => {
      if (doctorData[field] && typeof doctorData[field] === "string") {
        try {
          doctorData[field] = JSON.parse(doctorData[field]);
        } catch (error) {
          // If parsing fails, keep the original value
        }
      }
    });

    // Handle arrays that might be sent as strings
    const arrayFields = ["languages", "branches", "specialtyIds", "subSpecialityIds"];
    arrayFields.forEach((field) => {
      if (doctorData[field] && typeof doctorData[field] === "string") {
        try {
          const parsed = JSON.parse(doctorData[field]);
          if (Array.isArray(parsed)) {
            doctorData[field] = parsed;
          }
        } catch (error) {
          // If it's a comma-separated string, convert to array
          if (doctorData[field].includes(",")) {
            doctorData[field] = doctorData[field]
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item);
          }
        }
      }
    });

    // Handle reviews array if provided
    if (doctorData.reviews && typeof doctorData.reviews === "string") {
      try {
        doctorData.reviews = JSON.parse(doctorData.reviews);
      } catch (error) {
      }
    }

    // Calculate age if dateOfBirth is provided
    if (doctorData.dateOfBirth) {
      const calculateAge = (dateString) => {
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        return age.toString();
      };

      doctorData.age = calculateAge(doctorData.dateOfBirth);
    }

    // Create the doctor
    const doctor = await DoctorsProfile.create(doctorData);

    // Fetch profile picture as base64 for response if profileFileId exists
    let profilePicture = null;
    if (
      doctor.profileFileId &&
      mongoose.Types.ObjectId.isValid(doctor.profileFileId)
    ) {
      try {
        const gfs = getGfs();
        const file = await gfs
          .find({ _id: new mongoose.Types.ObjectId(doctor.profileFileId) })
          .toArray();
        if (file.length > 0) {
          const readStream = gfs.openDownloadStream(file[0]._id);
          const chunks = [];
          await new Promise((resolve, reject) => {
            readStream.on("data", (chunk) => chunks.push(chunk));
            readStream.on("end", () => {
              profilePicture = Buffer.concat(chunks).toString("base64");
              resolve();
            });
            readStream.on("error", reject);
          });
        }
      } catch (error) {
        
      }
    }

    // Prepare response data
    const responseData = {
      _id: doctor._id,
      firstName: doctor.firstName,
      middleName: doctor.middleName,
      lastName: doctor.lastName,
      dateOfBirth: doctor.dateOfBirth,
      gender: doctor.gender,
      age: doctor.age,
      email: doctor.email,
      phoneNumber: doctor.phoneNumber,
      specialty: doctor.specialty,
      subSpecialties: doctor.subSpecialties,
      position: doctor.position,
      regalia: doctor.regalia,
      location: doctor.location,
      languages: doctor.languages,
      services: doctor.services,
      branches: doctor.branches,
      yearOfExperience: doctor.yearOfExperience,
      about: doctor.about,
      workExperience: doctor.workExperience,
      education: doctor.education,
      advancedTraining: doctor.advancedTraining,
      scientificActivities: doctor.scientificActivities,
      internationalMemberships: doctor.internationalMemberships,
      professionalDevelopments: doctor.professionalDevelopments,
      russianMemberships: doctor.russianMemberships,
      awards: doctor.awards,
      reviews: doctor.reviews,
      feesAmount: doctor.feesAmount,
      currency: doctor.currency,
      status: doctor.status,
      publicImagePath: doctor.publicImagePath || null,
      profileFileId: doctor.profileFileId || null,
      photo: doctor.photo || null,
      imageUrl: doctor.imageUrl || null,
      profilePicture: profilePicture || null,
      reviewStats: doctor.reviewStats,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };

    res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      data: responseData,
    });
  } catch (error) {

    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Handle Multer errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }

    if (error.message === "Only JPEG/JPG/PNG images are allowed") {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, JPG, and PNG images are allowed.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// UPDATE DOCTOR

const updateDoctor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let doctor = await DoctorsProfile.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    // List of fields allowed to update
    const allowedUpdates = [
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "gender",
      "age",
      "email",
      "phoneNumber",
      "specialtyIds",
      "subSpecialityIds",
      "position",
      "regalia",
      "location",
      "expert",
      "specialist",
      "earlyDetection",
      "languages",
      "services",
      "branches",
      "yearOfExperience",
      "about",
      "workExperience",
      "education",
      "advancedTraining",
      "scientificActivities",
      "internationalMemberships",
      "russianMemberships",
      "professionalDevelopments",
      "awards",
      "reviews",
      "profileFileId",
      "photo",
      "imageUrl",
      "videoUrl",
      "feesAmount",
      "currency",
      "status",
    ];

    const updates = {};
    const unsetFields = {};

    // Process regular fields from req.body
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        // Handle feesAmount: if empty string, use $unset to remove from database
        if (key === "feesAmount" && (req.body[key] === "" || req.body[key] === null)) {
          unsetFields[key] = "";
          return;
        }
        
        // Handle multilingual fields and JSON strings
        if (
          typeof req.body[key] === "string" &&
          (req.body[key].startsWith("{") || req.body[key].startsWith("["))
        ) {
          try {
            const parsed = JSON.parse(req.body[key]);
            // For array fields like specialtyIds, subSpecialityIds, ensure they're proper arrays
            if (Array.isArray(parsed)) {
              updates[key] = parsed;
            } else {
              updates[key] = parsed;
            }
          } catch (error) {
            updates[key] = req.body[key];
          }
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    // Handle profile image removal if requested
    if (req.body.removeProfilePhoto === "true") {
      const path = require('path');
      const fs = require('fs').promises;
      const gfs = getGfs();

      // Delete old public image file if exists
      if (doctor.publicImagePath) {
        try {
          const filepath = path.join(__dirname, '../public', doctor.publicImagePath);
          await fs.unlink(filepath);
        } catch (err) {
        }
      }

      // Delete old GridFS image if exists
      if (
        doctor.profileFileId &&
        mongoose.Types.ObjectId.isValid(doctor.profileFileId)
      ) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(doctor.profileFileId));
        } catch (err) {
          
        }
      }

      // Clear the image fields
      updates.profileFileId = null;
      updates.publicImagePath = null;
      updates.photo = null;
    }

    // Handle profile image upload if file exists
    if (req.file) {
      const path = require('path');
      const fs = require('fs').promises;
      const gfs = getGfs();

      // Delete old public image file if exists
      if (doctor.publicImagePath) {
        try {
          const filepath = path.join(__dirname, '../public', doctor.publicImagePath);
          await fs.unlink(filepath);
        } catch (err) {
        }
      }

      // Delete old GridFS image if exists
      if (
        doctor.profileFileId &&
        mongoose.Types.ObjectId.isValid(doctor.profileFileId)
      ) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(doctor.profileFileId));
        } catch (err) {
          
        }
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `doctor-${timestamp}-${sanitizedName}`;
      const filepath = path.join(__dirname, '../public/uploads/doctors', filename);
      
      // Save file to public folder
      await fs.writeFile(filepath, req.file.buffer);
      
      // Store the public path (relative URL)
      updates.publicImagePath = `/uploads/doctors/${filename}`;

      // Upload new image to GridFS for backwards compatibility
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);

      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });

      updates.profileFileId = fileId.toString();
    }

    // Update the doctor profile with all changes
    // Apply updates to the doctor object
    Object.keys(updates).forEach(key => {
      doctor[key] = updates[key];
    });
    
    // Unset fields if any
    Object.keys(unsetFields).forEach(key => {
      doctor[key] = undefined;
    });
    
    // Save the document to trigger pre-save hooks (including slug generation)
    doctor = await doctor.save();

    // Fetch profile picture as base64 for response if profileFileId exists
    let profilePicture = null;
    if (
      doctor.profileFileId &&
      mongoose.Types.ObjectId.isValid(doctor.profileFileId)
    ) {
      try {
        const gfs = getGfs();
        const file = await gfs
          .find({ _id: new mongoose.Types.ObjectId(doctor.profileFileId) })
          .toArray();
        if (file.length > 0) {
          const readStream = gfs.openDownloadStream(file[0]._id);
          const chunks = [];
          await new Promise((resolve, reject) => {
            readStream.on("data", (chunk) => chunks.push(chunk));
            readStream.on("end", () => {
              profilePicture = Buffer.concat(chunks).toString("base64");
              resolve();
            });
            readStream.on("error", reject);
          });
        }
      } catch (error) {
      }
    }

    // Prepare response data
    const responseData = {
      _id: doctor._id,
      firstName: doctor.firstName,
      middleName: doctor.middleName,
      lastName: doctor.lastName,
      dateOfBirth: doctor.dateOfBirth,
      gender: doctor.gender,
      age: doctor.age,
      email: doctor.email,
      phoneNumber: doctor.phoneNumber,
      specialty: doctor.specialty,
      subSpecialties: doctor.subSpecialties,
      position: doctor.position,
      regalia: doctor.regalia,
      location: doctor.location,
      expert: doctor.expert,
      specialist: doctor.specialist,
      earlyDetection: doctor.earlyDetection,
      languages: doctor.languages,
      services: doctor.services,
      branches: doctor.branches,
      yearOfExperience: doctor.yearOfExperience,
      about: doctor.about,
      workExperience: doctor.workExperience,
      education: doctor.education,
      advancedTraining: doctor.advancedTraining,
      scientificActivities: doctor.scientificActivities,
      internationalMemberships: doctor.internationalMemberships,
      russianMemberships: doctor.russianMemberships,
      professionalDevelopments: doctor.professionalDevelopments,
      awards: doctor.awards,
      reviews: doctor.reviews,
      feesAmount: doctor.feesAmount,
      currency: doctor.currency,
      status: doctor.status,
      slug: doctor.slug || null,
      publicImagePath: doctor.publicImagePath || null,
      profileFileId: doctor.profileFileId || null,
      photo: doctor.photo || null,
      imageUrl: doctor.imageUrl || null,
      profilePicture: profilePicture || null,
      reviewStats: doctor.reviewStats,
    };

    res.status(200).json({
      success: true,
      message: "Doctor updated successfully",
      data: responseData,
    });
  } catch (error) {

    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid doctor ID" });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Handle Multer errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }

    if (error.message === "Only JPEG/JPG/PNG images are allowed") {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, JPG, and PNG images are allowed.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// -------------------------------------------
// DELETE DOCTOR
// -------------------------------------------
const deleteDoctor = async (req, res) => {
  try {
    const doctor = await DoctorsProfile.findById(req.params.id);

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor profile not found" });
    }

    // Delete profile image from GridFS if exists
    if (
      doctor.profileFileId &&
      mongoose.Types.ObjectId.isValid(doctor.profileFileId)
    ) {
      try {
        const gfs = getGfs();
        await gfs.delete(new mongoose.Types.ObjectId(doctor.profileFileId));
      } catch (err) {
      }
    }

    await DoctorsProfile.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Doctor profile deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid doctor ID" });
    }

    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// -------------------------------------------
// ADD REVIEW
// -------------------------------------------
const addReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { patientName, rating, description } = req.body;

    const doctor = await DoctorsProfile.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const review = {
      patientName,
      rating: parseInt(rating),
      description,
      date: new Date(),
      verified: false,
    };

    doctor.reviews.unshift(review);
    await doctor.save();

    // Update review stats
    await doctor.updateReviewStats();

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: doctor.reviews[0],
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid doctor ID" });
    }

    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// -------------------------------------------
// GET DOCTORS BY SPECIALTY
// -------------------------------------------
const getDoctorsBySpecialty = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { specialty } = req.params;

    const doctors = await DoctorsProfile.find({
      "specialty.en": new RegExp(specialty, "i"),
      status: "active",
    })
      .select(
        "-reviews -workExperience -education -scientificActivities -advancedTraining -internationalMemberships -russianMemberships"
      )
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ "reviewStats.averageRating": -1 });

    const total = await DoctorsProfile.countDocuments({
      "specialty.en": new RegExp(specialty, "i"),
      status: "active",
    });

    res.status(200).json({
      success: true,
      count: doctors.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: doctors,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// -------------------------------------------
// FEATURED DOCTORS (HIGHLY RATED)
// -------------------------------------------
const getFeaturedDoctors = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const doctors = await DoctorsProfile.find({
      status: "active",
      "reviewStats.averageRating": { $gte: 4.5 },
    })
      .select(
        "-reviews -workExperience -education -scientificActivities -advancedTraining -internationalMemberships -russianMemberships"
      )
      .limit(parseInt(limit))
      .sort({
        "reviewStats.averageRating": -1,
        "reviewStats.totalReviews": -1,
      });

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Get doctor profile image by fileId (returns JSON with base64)
const getDoctorProfileImage = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file ID",
      });
    }

    const gfs = getGfs();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    if (file.length === 0) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const readStream = gfs.openDownloadStream(file[0]._id);
    const chunks = [];

    await new Promise((resolve, reject) => {
      readStream.on("data", (chunk) => chunks.push(chunk));
      readStream.on("end", () => {
        const base64Image = Buffer.concat(chunks).toString("base64");
        const imageUrl = `data:${file[0].contentType};base64,${base64Image}`;

        res.json({
          success: true,
          imageUrl,
          profilePicture: base64Image,
          contentType: file[0].contentType,
          filename: file[0].filename,
        });
        resolve();
      });
      readStream.on("error", (error) => {
        reject(error);
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching image",
      error: error.message,
    });
  }
};

// Serve doctor profile image directly as file (for SEO, meta tags, direct access)
const serveDoctorProfileImage = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).send("Invalid file ID");
    }

    const gfs = getGfs();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    if (file.length === 0) {
      return res.status(404).send("Image not found");
    }

    // Set proper headers for image serving
    res.set("Content-Type", file[0].contentType);
    res.set("Content-Disposition", `inline; filename="${file[0].filename}"`);
    res.set("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

    // Stream the image directly to response
    const readStream = gfs.openDownloadStream(file[0]._id);
    readStream.pipe(res);
    
    readStream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).send("Error serving image");
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching image",
      error: error.message,
    });
  }
};

// -------------------------------------------
// GET ALL DOCTORS MINIMAL DETAILS
// -------------------------------------------
const getDoctorsMinimal = async (req, res) => {
  try {
    const doctors = await DoctorsProfile.find({ status: "active" })
      .select("firstName middleName lastName email")
      .sort({ "firstName.en": 1 });

    // Format the response
    const formattedDoctors = doctors.map((doctor) => ({
      _id: doctor._id,
      firstName: doctor.firstName,
      middleName: doctor.middleName,
      lastName: doctor.lastName,
      email: doctor.email,
      // Optional: create a combined display name
      displayName: {
        en: `${doctor.lastName?.en || ""} ${doctor.firstName?.en || ""} ${doctor.middleName?.en || ""
          } `.trim(),
        ru: `${doctor.lastName?.ru || ""} ${doctor.firstName?.ru || ""} ${doctor.middleName?.ru || ""
          }`.trim(),
      },
    }));


    res.status(200).json({
      success: true,
      count: doctors.length,
      formattedDoctors: formattedDoctors,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Send doctor credentials - create User account and email credentials
const sendDoctorCredentials = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const User = require("../models/User");
    const { transporter } = require('../utils/emailService');
    const { generateHashedPassword } = require("../utils/passwordUtils");
    const mongoose = require("mongoose");

    // Validate doctorId format
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID format",
      });
    }

    // Find the doctor
    const doctor = await DoctorsProfile.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Check if user already exists with doctor role
    const existingUser = await User.findOne({ email: doctor.email, role: "doctor" });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User account already exists for this doctor",
      });
    }

    // Generate password and create User account
    const { plainPassword, hashedPassword } = await generateHashedPassword(doctor.email);
    
    const user = new User({
      email: doctor.email,
      password: hashedPassword,
      role: "doctor",
      profileCompleted: true,
      notificationLanguage: doctor.notificationLanguage || "en",
    });

    await user.save();

    // Send email with credentials
    // Helper function to extract multilingual field value
    const getFieldValue = (field, lang = 'en') => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (typeof field === 'object') return field[lang] || field['en'] || '';
      return '';
    };

    const lang = doctor.notificationLanguage || 'en';
    const fullName = [
      getFieldValue(doctor.lastName, lang),
      getFieldValue(doctor.firstName, lang),
      getFieldValue(doctor.middleName, lang)
    ]
      .filter(Boolean)
      .join(' ') || 'Doctor';

    const loginLink = 'https://manager.health-direct.ru/doctor-signin';
    
    const templates = {
      en: {
        subject: 'Your Doctor Account Credentials',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
              .credential-item { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #1f2937; font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
              .button { display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SOPHOS</h1>
              </div>
              <div class="content">
                <p>Dear <strong>${fullName}</strong>,</p>
                <p>Your <strong>Doctor (Врач)</strong> account has been created successfully. Below are your login credentials:</p>
                
                <div class="credentials-box">
                  <div class="credential-item">
                    <span class="label">Email:</span>
                    <span class="value">${doctor.email}</span>
                  </div>
                  <div class="credential-item">
                    <span class="label">Password:</span>
                    <span class="value">${plainPassword}</span>
                  </div>
                </div>

                <p><strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.</p>

                <div style="text-align: center;">
                  <a href="${loginLink}" class="button" style="display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Login to Your Account</a>
                </div>

                <div class="footer">
                  <p>С уважением,<br><strong>Команда СОФОС</strong></p>
                  <p style="font-size: 12px; color: #9ca3af;">If you did not request this account, please contact our support team immediately.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      ru: {
        subject: 'Учетные данные вашей учетной записи врача',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
              .credential-item { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #1f2937; font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
              .button { display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Добро пожаловать в СОФОС</h1>
              </div>
              <div class="content">
                <p>Уважаемый <strong>${fullName}</strong>,</p>
                <p>Ваша учетная запись врача успешно создана. Ниже приведены ваши данные для входа:</p>
                
                <div class="credentials-box">
                  <div class="credential-item">
                    <span class="label">Электронная почта:</span>
                    <span class="value">${doctor.email}</span>
                  </div>
                  <div class="credential-item">
                    <span class="label">Пароль:</span>
                    <span class="value">${plainPassword}</span>
                  </div>
                </div>

                <p><strong>⚠️ Важно:</strong> Пожалуйста, измените свой пароль после первого входа в систему в целях безопасности.</p>

                <div style="text-align: center;">
                  <a href="${loginLink}" class="button" style="display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Войти в свою учетную запись</a>
                </div>

                <div class="footer">
                  <p>С уважением,<br><strong>Команда СОФОС</strong></p>
                  <p style="font-size: 12px; color: #9ca3af;">Если вы не запрашивали эту учетную запись, немедленно свяжитесь с нашей службой поддержки.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
    };

    const template = templates[lang] || templates.ru;

    await transporter.sendMail({
      from: `"Медицинский центр СОФОС" <${process.env.EMAIL_USER}>`,
      to: doctor.email,
      subject: template.subject,
      html: template.html,
    });

    res.status(200).json({
      success: true,
      message: "Credentials sent successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send credentials",
      error: error.message,
    });
  }
};

// Check if doctor has a user account
const checkDoctorHasAccount = async (req, res) => {
  try {
    const email = req.params.email;
    const User = require("../models/User");

    const user = await User.findOne({ email, role: "doctor" });
    
    res.status(200).json({
      success: true,
      hasAccount: !!user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check account status",
      error: error.message,
    });
  }
};

// Test email endpoint - sends email without creating account
const testDoctorCredentialsEmail = async (req, res) => {
  try {
    const { email, firstName, lastName, middleName, language } = req.body;
    const { transporter } = require('../utils/emailService');

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Generate a test password
    const testPassword = "TestPassword123!";
    
    const fullName = [lastName, firstName, middleName]
      .filter(Boolean)
      .join(' ') || 'Test Doctor';

    const loginLink = 'https://manager.health-direct.ru/doctor-signin';
    
    const templates = {
      en: {
        subject: 'Your Doctor Account Credentials (TEST EMAIL)',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
              .credential-item { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #1f2937; font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
              .button { display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
              .test-badge { background: #fbbf24; color: #78350f; padding: 8px 16px; border-radius: 4px; font-weight: bold; margin-bottom: 20px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SOPHOS</h1>
              </div>
              <div class="content">
                <div class="test-badge">⚠️ THIS IS A TEST EMAIL - NO ACCOUNT WAS CREATED</div>
                <p>Dear <strong>${fullName}</strong>,</p>
                <p>Your <strong>Doctor (Врач)</strong> account has been created successfully. Below are your login credentials:</p>
                
                <div class="credentials-box">
                  <div class="credential-item">
                    <span class="label">Email:</span>
                    <span class="value">${email}</span>
                  </div>
                  <div class="credential-item">
                    <span class="label">Password:</span>
                    <span class="value">${testPassword}</span>
                  </div>
                </div>

                <p><strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.</p>

                <div style="text-align: center;">
                  <a href="${loginLink}" class="button" style="display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Login to Your Account</a>
                </div>

                <div class="footer">
                  <p>С уважением,<br><strong>Команда СОФОС</strong></p>
                  <p style="font-size: 12px; color: #9ca3af;">If you did not request this account, please contact our support team immediately.</p>
                  <p style="font-size: 12px; color: #dc2626; font-weight: bold;">TEST EMAIL - No actual account was created</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      ru: {
        subject: 'Учетные данные вашей учетной записи врача (ТЕСТОВОЕ ПИСЬМО)',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
              .credential-item { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #1f2937; font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
              .button { display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
              .test-badge { background: #fbbf24; color: #78350f; padding: 8px 16px; border-radius: 4px; font-weight: bold; margin-bottom: 20px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Добро пожаловать в СОФОС</h1>
              </div>
              <div class="content">
                <div class="test-badge">⚠️ ЭТО ТЕСТОВОЕ ПИСЬМО - УЧЕТНАЯ ЗАПИСЬ НЕ СОЗДАНА</div>
                <p>Уважаемый <strong>${fullName}</strong>,</p>
                <p>Ваша учетная запись врача успешно создана. Ниже приведены ваши данные для входа:</p>
                
                <div class="credentials-box">
                  <div class="credential-item">
                    <span class="label">Электронная почта:</span>
                    <span class="value">${email}</span>
                  </div>
                  <div class="credential-item">
                    <span class="label">Пароль:</span>
                    <span class="value">${testPassword}</span>
                  </div>
                </div>

                <p><strong>⚠️ Важно:</strong> Пожалуйста, измените свой пароль после первого входа в систему в целях безопасности.</p>

                <div style="text-align: center;">
                  <a href="${loginLink}" class="button" style="display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Войти в свою учетную запись</a>
                </div>

                <div class="footer">
                  <p>С уважением,<br><strong>Команда СОФОС</strong></p>
                  <p style="font-size: 12px; color: #9ca3af;">Если вы не запрашивали эту учетную запись, немедленно свяжитесь с нашей службой поддержки.</p>
                  <p style="font-size: 12px; color: #dc2626; font-weight: bold;">ТЕСТОВОЕ ПИСЬМО - Реальная учетная запись не создана</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
    };

    const lang = language || 'ru';
    const template = templates[lang] || templates.ru;

    await transporter.sendMail({
      from: `"Медицинский центр СОФОС" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
    });

    res.status(200).json({
      success: true,
      message: "Test email sent successfully",
      testData: {
        email,
        fullName,
        testPassword,
        language: lang
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message,
    });
  }
};

// -------------------------------------------
// UPDATE DOCTORS DISPLAY ORDER
// -------------------------------------------
const updateDoctorsOrder = async (req, res) => {
  try {
    const { doctorIds } = req.body;

    if (!Array.isArray(doctorIds) || doctorIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "doctorIds must be a non-empty array"
      });
    }

    // Update each doctor's displayOrder based on their position in the array
    const updatePromises = doctorIds.map((doctorId, index) => {
      return DoctorsProfile.findByIdAndUpdate(
        doctorId,
        { displayOrder: index },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Doctors order updated successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update doctors order",
      error: error.message
    });
  }
};

// -------------------------------------------
module.exports = {
  getAllDoctors,
  getDoctorsProfileData,
  getEarlyDetectionDoctors,
  getDoctorById,
  getDoctorByEmail,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  addReview,
  getDoctorsBySpecialty,
  getFeaturedDoctors,
  getDoctorProfileImage,
  serveDoctorProfileImage,
  getDoctorsMinimal,
  getDoctorServices,
  sendDoctorCredentials,
  checkDoctorHasAccount,
  testDoctorCredentialsEmail,
  updateDoctorsOrder,
};
