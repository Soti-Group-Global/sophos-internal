const mongoose = require("mongoose");
const { sendHeadDoctorAccountEmail } = require('../utils/emailService');
const HeadDoctor = require("../models/HeadDoctor");
const User = require("../models/User");
const { getGfs } = require("../gridfs");
const { getIO } = require("../socket");
const { generateHashedPassword } = require("../utils/passwordUtils");

/** Utility **/
const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

const generatePassword = (email) => {
  const emailFragment = email.split("@")[0].slice(0, 8);
  const randomString = Math.random().toString(36).slice(-6);
  return `${emailFragment}${randomString}!`;
};

// Delegate to shared email utility (utils/emailService.js)
const sendAccountCreationEmail = (email, password, fullName, lang = 'en') =>
  sendHeadDoctorAccountEmail(email, password, fullName, lang);

// Create Specialist
const createHeadDoctor = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      specialty,
      placeOfWork,
      regalia,
      services,
      feesAmount,
      currency,
      branches, // added
    } = req.body;

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "gender",
      "email",
      "phoneNumber",
      "specialty",
      "placeOfWork",
      "services",
      "feesAmount",
      "currency",
    ];
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field] === "") {
        return res.status(400).json({ message: `Please fill in ${field}` });
      }
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Validate age
    const age = calculateAge(dateOfBirth);
    if (age < 18) {
      return res
        .status(400)
        .json({ message: "Specialist must be at least 18 years old" });
    }

    // Parse services JSON if needed
    const parsedServices =
      typeof services === "string" ? JSON.parse(services) : services;

    // Parse branches (accepts array or comma-separated string)
    let branchList = [];
    if (branches) {
      if (Array.isArray(branches)) {
        branchList = branches.map((b) => b.trim()).filter((b) => b);
      } else if (typeof branches === "string") {
        branchList = branches
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b);
      }
    }

    // Create Specialist document
    const specialist = new Specialist({
      firstName,
      middleName: middleName || "",
      lastName,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      age,
      email,
      phoneNumber,
      specialty,
      placeOfWork,
      regalia: regalia || "",
      services: parsedServices,
      feesAmount: parseFloat(feesAmount),
      currency,
      branches: branchList,
    });

    // Upload profile image to GridFS
    if (req.file) {
      const gfs = getGfs();
      const readablePhotoStream = new Readable();
      readablePhotoStream.push(req.file.buffer);
      readablePhotoStream.push(null);

      const uploadStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });

      readablePhotoStream.pipe(uploadStream);
      const fileId = await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => resolve(uploadStream.id));
        uploadStream.on("error", reject);
      });

      specialist.profileFileId = fileId;
    }

    // Generate and hash password
    const { plainPassword, hashedPassword } = await generateHashedPassword(email);

    // Create associated User record
    const user = new User({
      email,
      password: hashedPassword,
      role: "specialist",
      profileCompleted: true,
    });

    // Save both Specialist + User atomically
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await specialist.save({ session });
      await user.save({ session });
      const fullName = [lastName, firstName, middleName]
        .filter(Boolean)
        .join(' ') || 'Head Doctor';
      await sendAccountCreationEmail(email, plainPassword, fullName, sanitizedLanguage);
    });
    session.endSession();

    // Emit socket event if connected
    try {
      const io = getIO();
      io.emit("specialist_created", { specialist });
    } catch (err) {
    }

    // Optional: convert profile picture to Base64 for immediate response
    let profilePicture = null;
    if (specialist.profileFileId) {
      const gfs = getGfs();
      const file = await gfs
        .find({ _id: new mongoose.Types.ObjectId(specialist.profileFileId) })
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
    }

    // Success response
    res.status(201).json({
      message: "Specialist created successfully",
      specialist: {
        _id: specialist._id,
        firstName: specialist.firstName,
        middleName: specialist.middleName,
        lastName: specialist.lastName,
        dateOfBirth: specialist.dateOfBirth,
        gender: specialist.gender,
        age: specialist.age,
        email: specialist.email,
        phoneNumber: specialist.phoneNumber,
        specialty: specialist.specialty,
        placeOfWork: specialist.placeOfWork,
        regalia: specialist.regalia,
        services: specialist.services,
        feesAmount: specialist.feesAmount,
        currency: specialist.currency,
        branches: specialist.branches,
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all HeadDoctors (optionally filtered by branch name)
const getAllHeadDoctors = async (req, res) => {
  try {
    const { branch } = req.query;

    // If branch = "All" or not provided → return all head doctors
    const filter =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branches: { $regex: new RegExp(`^${branch}$`, "i") } };

    const headDoctors = await HeadDoctor.find(filter);

    res.json({ headDoctors });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get by ID
const getHeadDoctorById = async (req, res) => {
  try {
    const headDoctor = await HeadDoctor.findById(req.params.id);
    if (!headDoctor) return res.status(404).json({ message: "Not found" });
    res.json({ headDoctor });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get fees by ID
const getHeadDoctorFees = async (req, res) => {
  try {
    const headDoctor = await HeadDoctor.findById(req.params.id).select(
      "feesAmount currency"
    );
    if (!headDoctor) return res.status(404).json({ message: "Not found" });
    res.json({
      feesAmount: headDoctor.feesAmount,
      currency: headDoctor.currency,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update HeadDoctor
const updateHeadDoctor = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      specialty,
      placeOfWork,
      regalia,
      services,
      feesAmount,
      currency,
      branches,
    } = req.body;

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "gender",
      "email",
      "phoneNumber",
      "specialty",
      "placeOfWork",
      "services",
      "feesAmount",
      "currency",
    ];
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field] === "") {
        return res.status(400).json({ message: `Please fill in ${field}` });
      }
    }

    const headDoctor = await HeadDoctor.findById(req.params.id);
    if (!headDoctor) {
      return res.status(404).json({ message: "Head Doctor not found" });
    }

    // Update base fields
    headDoctor.firstName = firstName;
    headDoctor.middleName = middleName || "";
    headDoctor.lastName = lastName;
    headDoctor.dateOfBirth = new Date(dateOfBirth);
    headDoctor.age = calculateAge(dateOfBirth);
    if (headDoctor.age < 25) {
      return res
        .status(400)
        .json({ message: "Head Doctor must be at least 25 years old" });
    }
    headDoctor.gender = gender;
    headDoctor.email = email;
    headDoctor.phoneNumber = phoneNumber;
    headDoctor.specialty = specialty;
    headDoctor.placeOfWork = placeOfWork;
    headDoctor.regalia = regalia || "";
    headDoctor.services =
      typeof services === "string" ? JSON.parse(services) : services;
    headDoctor.feesAmount = parseFloat(feesAmount);
    headDoctor.currency = currency;

    // Parse and update branches (accepts array or comma-separated string)
    let branchList = [];
    if (branches) {
      if (Array.isArray(branches)) {
        branchList = branches.map((b) => b.trim()).filter((b) => b);
      } else if (typeof branches === "string") {
        branchList = branches
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b);
      }
    }
    headDoctor.branches = branchList;

    // Handle profile image update
    if (req.file) {
      const gfs = getGfs();

      // Delete old image if exists
      if (headDoctor.profileFileId) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(headDoctor.profileFileId));
        } catch (err) {
        }
      }

      // Upload new image
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });
      headDoctor.profileFileId = fileId;
    }

    await headDoctor.save();

    // Emit socket update event
    getIO().emit("headDoctorUpdated", headDoctor);

    // Fetch profile picture as base64 for response
    let profilePicture = null;
    if (headDoctor.profileFileId) {
      const gfs = getGfs();
      const file = await gfs
        .find({ _id: new mongoose.Types.ObjectId(headDoctor.profileFileId) })
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
    }

    // Respond with updated data
    res.json({
      message: "Head Doctor updated successfully",
      headDoctor: {
        _id: headDoctor._id,
        firstName: headDoctor.firstName,
        middleName: headDoctor.middleName,
        lastName: headDoctor.lastName,
        dateOfBirth: headDoctor.dateOfBirth,
        gender: headDoctor.gender,
        age: headDoctor.age,
        email: headDoctor.email,
        phoneNumber: headDoctor.phoneNumber,
        specialty: headDoctor.specialty,
        placeOfWork: headDoctor.placeOfWork,
        regalia: headDoctor.regalia,
        services: headDoctor.services,
        feesAmount: headDoctor.feesAmount,
        currency: headDoctor.currency,
        branches: headDoctor.branches,
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete HeadDoctor
const deleteHeadDoctor = async (req, res) => {
  try {
    const headDoctor = await HeadDoctor.findById(req.params.id);
    if (!headDoctor) return res.status(404).json({ message: "Not found" });

    if (headDoctor.profileFileId) {
      const gfs = getGfs();
      try {
        await gfs.delete(new mongoose.Types.ObjectId(headDoctor.profileFileId));
      } catch (err) {
      }
    }

    await headDoctor.deleteOne();
    await User.deleteOne({ email: headDoctor.email });
    res.json({ message: "HeadDoctor deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get HeadDoctor by email
const getHeadDoctorByEmail = async (req, res) => {
  try {
    const headDoctor = await HeadDoctor.findOne({ email: req.params.email });
    if (!headDoctor) return res.status(404).json({ message: "Not found" });
    res.json({ headDoctor });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createHeadDoctor,
  getAllHeadDoctors,
  getHeadDoctorById,
  getHeadDoctorFees,
  updateHeadDoctor,
  deleteHeadDoctor,
  getHeadDoctorByEmail,
};
