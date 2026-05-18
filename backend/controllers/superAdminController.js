const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SuperAdmin = require("../models/SuperAdmin");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const { getGfs } = require("../gridfs");
const { generateHashedPassword } = require("../utils/passwordUtils");

// Super Admin Sign-In
const superAdminSignIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.role !== "super_admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Super Admins only." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      token,
      user: {
        email: user.email,
        profileCompleted: user.profileCompleted,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Token Validation
const validateToken = (req, res) => {
  res.status(200).json({
    message: "Token is valid",
    profileCompleted: req.user.profileCompleted,
  });
};

// Get All Super Admins
const getAllSuperAdmins = async (req, res) => {
  try {
    const superAdmins = await SuperAdmin.find();
    res.json({ superAdmins });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Super Admins Data with User Info
const getSuperAdminsData = async (req, res) => {
  try {
    const superAdmins = await SuperAdmin.find().lean();

    if (!superAdmins.length) {
      return res.json({ superAdmins: [] });
    }

    const emails = superAdmins.map((s) => s.email);

    const users = await User.find({ email: { $in: emails } })
      .select("email role firstName lastName profilePicture")
      .lean();

    const userRoleMap = new Map(users.map((u) => [u.email, u.role]));

    const enrichedSuperAdmins = superAdmins.map((s) => {
      const user = users.find((u) => u.email === s.email);

      return {
        _id: s._id,
        email: s.email,
        firstName: user?.firstName || s.firstName || "",
        lastName: user?.lastName || s.lastName || "",
        profilePicture: user?.profilePicture || s.profilePicture || null,
        role: userRoleMap.get(s.email) || "super_admin",
      };
    });

    res.status(200).json({ superAdmins: enrichedSuperAdmins });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create Super Admin
const createSuperAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      age,
      email,
      phoneNumber,
      cityOfResidence,
      comments,
    } = req.body;

    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    const existingUser = await User.findOne({ email });

    if (existingSuperAdmin || existingUser) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Super Admin already exists" });
    }

    let profilePictureId = null;

    if (req.file) {
      const gfs = getGfs();
      const readablePhotoStream = new Readable();
      readablePhotoStream.push(req.file.buffer);
      readablePhotoStream.push(null);

      const uploadStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });

      readablePhotoStream.pipe(uploadStream);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => {
          profilePictureId = uploadStream.id;
          resolve();
        });
        uploadStream.on("error", reject);
      });
    }

    const { plainPassword, hashedPassword } = await generateHashedPassword(
      email
    );

    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "super_admin",
      profileCompleted: false,
    });
    await user.save({ session });

    const superAdmin = new SuperAdmin({
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      age,
      email,
      phoneNumber,
      profilePicture: profilePictureId,
      cityOfResidence,
      comments,
    });
    await superAdmin.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Super Admin created successfully",
      superAdmin,
      credentials: {
        email,
        password: plainPassword,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

// Update Super Admin
const updateSuperAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const superAdmin = await SuperAdmin.findById(req.params.id);
    if (!superAdmin) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Super Admin not found" });
    }

    const updateData = { ...req.body };

    if (req.file) {
      const gfs = getGfs();
      const readableStream = new Readable();
      readableStream.push(req.file.buffer);
      readableStream.push(null);

      const uploadStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });

      readableStream.pipe(uploadStream);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => {
          updateData.profilePicture = uploadStream.id;
          resolve();
        });
        uploadStream.on("error", reject);
      });
    }

    const updatedSuperAdmin = await SuperAdmin.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    res
      .status(200)
      .json({ message: "Super Admin updated successfully", updatedSuperAdmin });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Super Admin
const deleteSuperAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const superAdmin = await SuperAdmin.findById(req.params.id);
    if (!superAdmin) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Super Admin not found" });
    }

    if (superAdmin.profilePicture) {
      try {
        const gfs = getGfs();
        await gfs.delete(
          new mongoose.Types.ObjectId(superAdmin.profilePicture)
        );
      } catch (err) {
      }
    }

    await SuperAdmin.findByIdAndDelete(req.params.id, { session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Super Admin deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  superAdminSignIn,
  validateToken,
  getAllSuperAdmins,
  getSuperAdminsData,
  createSuperAdmin,
  updateSuperAdmin,
  deleteSuperAdmin,
};
