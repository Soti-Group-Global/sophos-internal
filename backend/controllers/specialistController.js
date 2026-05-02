const mongoose = require("mongoose");
const { sendSpecialistAccountEmail } = require('../utils/emailService');
const { Readable } = require("stream");

const Specialist = require("../models/Specialist");
const User = require("../models/User");
const { getGfs } = require("../gridfs");
const { getIO } = require("../socket");
const { generateHashedPassword } = require("../utils/passwordUtils");

/** Utility functions **/
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
  sendSpecialistAccountEmail(email, password, fullName, lang);

// Create Specialist
const createSpecialist = async (req, res) => {
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

    // Check for duplicate user
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
    const { plainPassword, hashedPassword } = await generateHashedPassword(
      email
    );

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
        .join(' ') || 'Specialist';
      await sendAccountCreationEmail(
        email,
        plainPassword,
        fullName,
        sanitizedLanguage
      );
    });
    session.endSession();

    // Emit socket event
    try {
      const io = getIO();
      io.emit("specialistCreated", specialist);
    } catch (err) {
    }

    // Optional: Base64 profile picture for response
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

// Get all Specialists (optionally filtered by branch name)
const getAllSpecialists = async (req, res) => {
  try {
    const { branch } = req.query;

    // If branch = "All" or not provided → return all
    const filter =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branches: { $regex: new RegExp(`^${branch}$`, "i") } };

    const specialists = await Specialist.find(filter);
    const gfs = getGfs();

    const specialistsWithImages = await Promise.all(
      specialists.map(async (specialist) => {
        let profilePicture = null;

        // Handle GridFS profile image
        if (specialist.profileFileId) {
          try {
            const file = await gfs
              .find({
                _id: new mongoose.Types.ObjectId(specialist.profileFileId),
              })
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
          } catch (err) {
          }
        }

        return { ...specialist.toObject(), profilePicture };
      })
    );

    res.json({ specialists: specialistsWithImages });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Specialist by ID
const getSpecialistById = async (req, res) => {
  try {
    const specialist = await Specialist.findById(req.params.id);
    if (!specialist)
      return res.status(404).json({ message: "Specialist not found" });

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
    res.json({ specialist: { ...specialist.toObject(), profilePicture } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Specialist by Email
const getSpecialistByEmail = async (req, res) => {
  try {
    const specialist = await Specialist.findOne({ email: req.params.email });
    if (!specialist)
      return res.status(404).json({ message: "Specialist not found" });
    res.json({ specialist });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Specialist Fees
const getSpecialistFees = async (req, res) => {
  try {
    const specialist = await Specialist.findById(req.params.id).select(
      "feesAmount currency"
    );
    if (!specialist)
      return res.status(404).json({ message: "Specialist not found" });
    res.json({
      feesAmount: specialist.feesAmount,
      currency: specialist.currency,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Specialist
const updateSpecialist = async (req, res) => {
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

    // Find specialist
    const specialist = await Specialist.findById(req.params.id);
    if (!specialist) {
      return res.status(404).json({ message: "Specialist not found" });
    }

    // Update main fields
    specialist.firstName = firstName;
    specialist.middleName = middleName || "";
    specialist.lastName = lastName;
    specialist.dateOfBirth = new Date(dateOfBirth);
    specialist.age = calculateAge(dateOfBirth);
    if (specialist.age < 21) {
      return res
        .status(400)
        .json({ message: "Specialist must be at least 21 years old" });
    }
    specialist.gender = gender;
    specialist.email = email;
    specialist.phoneNumber = phoneNumber;
    specialist.specialty = specialty;
    specialist.placeOfWork = placeOfWork;
    specialist.regalia = regalia || "";
    specialist.services =
      typeof services === "string" ? JSON.parse(services) : services;
    specialist.feesAmount = parseFloat(feesAmount);
    specialist.currency = currency;

    // Parse and update branches (array or comma-separated string)
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
    specialist.branches = branchList;

    // Handle profile image (replace old GridFS file if new image uploaded)
    if (req.file) {
      const gfs = getGfs();

      // Delete old image if exists
      if (specialist.profileFileId) {
        try {
          await gfs.delete(
            new mongoose.Types.ObjectId(specialist.profileFileId)
          );
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
      specialist.profileFileId = fileId;
    }

    // Save updated specialist
    await specialist.save();

    // Emit socket event
    getIO().emit("specialistUpdated", specialist);

    // Fetch updated profile image (as Base64)
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
    res.json({
      message: "Specialist updated successfully",
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

// Delete Specialist
const deleteSpecialist = async (req, res) => {
  try {
    const specialist = await Specialist.findById(req.params.id);
    if (!specialist)
      return res.status(404).json({ message: "Specialist not found" });

    if (specialist.profileFileId) {
      const gfs = getGfs();
      try {
        await gfs.delete(new mongoose.Types.ObjectId(specialist.profileFileId));
      } catch (err) {
      }
    }

    await specialist.deleteOne();
    await User.deleteOne({ email: specialist.email });
    res.json({ message: "Specialist deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createSpecialist,
  getAllSpecialists,
  getSpecialistById,
  getSpecialistByEmail,
  getSpecialistFees,
  updateSpecialist,
  deleteSpecialist,
};
