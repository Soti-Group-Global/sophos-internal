const mongoose = require("mongoose");
const { sendAssistantAccountEmail } = require('../utils/emailService');
const { Readable } = require("stream");
const { ObjectId } = require("mongodb");
const { validationResult } = require("express-validator");
const Assistant = require("../models/Assistant");
const HeadAssistant = require("../models/HeadAssistant");
const HeadAssistantAvailability = require("../models/HeadAssistantAvailability");
const User = require("../models/User");
const DoctorsProfile = require("../models/DoctorsProfile");
const { getGfs } = require("../gridfs");
const { getIO } = require("../socket");
const { generateHashedPassword } = require("../utils/passwordUtils");

// Calculate age from dateOfBirth
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

// Delegate to shared email utility (utils/emailService.js)
const sendAccountCreationEmail = (email, password, fullName, lang = 'en') =>
  sendAssistantAccountEmail(email, password, fullName, lang);
// Helper to check overlap between assignments
const hasOverlap = (assignments, accessId, start, end) => {
  return assignments.some((assignment) => {
    if (assignment._id.toString() === accessId) return false;
    const existingStart = new Date(assignment.startDateTime);
    const existingEnd = new Date(assignment.endDateTime);
    return (
      (start >= existingStart && start < existingEnd) ||
      (end > existingStart && end <= existingEnd) ||
      (start <= existingStart && end >= existingEnd)
    );
  });
};

// Helper to read a profile picture from GridFS as base64
const readProfilePicture = async (profileFileId) => {
  if (!profileFileId) return null;
  const gfs = getGfs();
  const file = await gfs
    .find({ _id: new mongoose.Types.ObjectId(profileFileId) })
    .toArray();
  if (file.length === 0) return null;
  const readStream = gfs.openDownloadStream(file[0]._id);
  const chunks = [];
  return new Promise((resolve, reject) => {
    readStream.on("data", (chunk) => chunks.push(chunk));
    readStream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("base64"));
    });
    readStream.on("error", reject);
  });
};

//Get me
const getMe = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select(
      "-password",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "assistant" && user.role !== "head_assistant") {
      return res
        .status(403)
        .json({ message: "Access denied: Not an assistant" });
    }
    const profileModel = user.role === "assistant" ? Assistant : HeadAssistant;
    const assistant = await profileModel.findOne({ email: user.email });
    if (!assistant) {
      return res.status(404).json({
        message:
          user.role === "assistant"
            ? "Assistant profile not found"
            : "Head Assistant profile not found",
      });
    }
    res.status(200).json({ assistant });
  } catch (err) {
    console.error("GET /assistants/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

//Update me
const updateMe = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "assistant" && user.role !== "head_assistant") {
      return res
        .status(403)
        .json({ message: "Access denied: Not an assistant" });
    }
    const updateData = { ...req.body, profileCompleted: true };
    const profileModel = user.role === "assistant" ? Assistant : HeadAssistant;
    const updatedAssistant = await profileModel.findOneAndUpdate(
      { email: user.email },
      updateData,
      { new: true, runValidators: true },
    );
    if (!updatedAssistant) {
      return res.status(404).json({
        message:
          user.role === "assistant"
            ? "Assistant profile not found"
            : "Head Assistant profile not found",
      });
    }
    if (!user.profileCompleted) {
      user.profileCompleted = true;
      await user.save();
    }
    res.status(200).json({ assistant: updatedAssistant });
  } catch (err) {
    console.error("PUT /assistants/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

//Upload profile image
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }
    const profileBucket = req.app.locals.profileBucket;
    const uploadStream = profileBucket.openUploadStream(
      `${Date.now()}_${req.file.originalname}`,
      { contentType: req.file.mimetype },
    );
    const fileId = uploadStream.id;
    uploadStream.end(req.file.buffer);
    uploadStream.on("finish", async () => {
      const imageUrl = `/api/assistants/image-by-id/${fileId}`;
      const profileModel =
        req.user.role === "assistant" ? Assistant : HeadAssistant;
      const updatedAssistant = await profileModel.findOneAndUpdate(
        { email: req.user.email },
        { profileFileId: fileId, imageUrl },
        { new: true, select: "profileFileId imageUrl" },
      );
      if (!updatedAssistant) {
        return res
          .status(404)
          .json({ success: false, message: "Assistant not found" });
      }
      res.status(200).json({
        success: true,
        data: { fileId, imageUrl: updatedAssistant.imageUrl },
      });
    });
    uploadStream.on("error", (err) => {
      console.error("Upload stream error:", err);
      if (!res.headersSent) {
        res
          .status(500)
          .json({
            success: false,
            message: "Upload failed",
            error: err.message,
          });
      }
    });
  } catch (err) {
    console.error("Upload error:", err);
    res
      .status(500)
      .json({ success: false, message: "Upload failed", error: err.message });
  }
}

//get image by id
const getImageById = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Assistant email is required" });
    }
    const profileModel =
      req.user.role === "assistant" ? Assistant : HeadAssistant;
    const assistant = await profileModel
      .findOne({ email }, { doctors: 1, _id: 0 })
      .lean();
    if (!assistant) {
      return res.status(404).json({
        message: `${req.user.role === "head_assistant" ? "head " : ""}assistant not found`,
      });
    }
    const accessEntries = assistant.doctors || [];
    const doctorEmails = accessEntries.map((d) => d.doctorEmail);
    const doctorDetailsMap = await DoctorsProfile.find(
      { email: { $in: doctorEmails } },
      { email: 1, firstName: 1, middleName: 1, lastName: 1 },
    )
      .lean()
      .then((doctors) =>
        doctors.reduce((acc, doc) => {
          acc[doc.email] = doc;
          return acc;
        }, {}),
      );
    const merged = accessEntries
      .map((entry) => ({
        ...entry,
        name: doctorDetailsMap[entry.doctorEmail]
          ? {
              en:
                [
                  doctorDetailsMap[entry.doctorEmail].lastName?.en,
                  doctorDetailsMap[entry.doctorEmail].firstName?.en,
                  doctorDetailsMap[entry.doctorEmail].middleName?.en,
                ]
                  .filter(Boolean)
                  .join(" ") || entry.doctorEmail,
              ru:
                [
                  doctorDetailsMap[entry.doctorEmail].lastName?.ru,
                  doctorDetailsMap[entry.doctorEmail].firstName?.ru,
                  doctorDetailsMap[entry.doctorEmail].middleName?.ru,
                ]
                  .filter(Boolean)
                  .join(" ") || entry.doctorEmail,
            }
          : { en: entry.doctorEmail, ru: entry.doctorEmail },
      }))
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
    return res.json(merged);
  } catch (err) {
    console.error("Error fetching assistant doctors:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/assistants/doctors
const getAssistantDoctors = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Assistant email is required" });
    }
    const profileModel =
      req.user.role === "assistant" ? Assistant : HeadAssistant;
    const assistant = await profileModel
      .findOne({ email }, { doctors: 1, _id: 0 })
      .lean();
    if (!assistant) {
      return res.status(404).json({
        message: `${req.user.role === "head_assistant" ? "head " : ""}assistant not found`,
      });
    }
    const accessEntries = assistant.doctors || [];
    const doctorEmails = accessEntries.map((d) => d.doctorEmail);
    const doctorDetailsMap = await DoctorsProfile.find(
      { email: { $in: doctorEmails } },
      { email: 1, firstName: 1, middleName: 1, lastName: 1 },
    )
      .lean()
      .then((doctors) =>
        doctors.reduce((acc, doc) => {
          acc[doc.email] = doc;
          return acc;
        }, {}),
      );
    const merged = accessEntries
      .map((entry) => ({
        ...entry,
        name: doctorDetailsMap[entry.doctorEmail]
          ? {
              en:
                [
                  doctorDetailsMap[entry.doctorEmail].lastName?.en,
                  doctorDetailsMap[entry.doctorEmail].firstName?.en,
                  doctorDetailsMap[entry.doctorEmail].middleName?.en,
                ]
                  .filter(Boolean)
                  .join(" ") || entry.doctorEmail,
              ru:
                [
                  doctorDetailsMap[entry.doctorEmail].lastName?.ru,
                  doctorDetailsMap[entry.doctorEmail].firstName?.ru,
                  doctorDetailsMap[entry.doctorEmail].middleName?.ru,
                ]
                  .filter(Boolean)
                  .join(" ") || entry.doctorEmail,
            }
          : { en: entry.doctorEmail, ru: entry.doctorEmail },
      }))
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
    return res.json(merged);
  } catch (err) {
    console.error("Error fetching assistant doctors:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// Create AccessRequest
const createAccessRequest = async (req, res) => {
  try {
    const { assistantEmail, doctorEmail, startDateTime, endDateTime } =
      req.body;
    if (!assistantEmail || !doctorEmail || !startDateTime || !endDateTime) {
      return res.status(400).json({
        message:
          "assistantEmail, doctorEmail, startDateTime, and endDateTime are required",
      });
    }
    const profileModel =
      req.user.role === "assistant" ? Assistant : HeadAssistant;
    const assistant = await profileModel.findOne({ email: assistantEmail });
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    const newStart = new Date(startDateTime);
    const newEnd = new Date(endDateTime);
    const alreadyAssigned = assistant.doctors.some((d) => {
      if (d.doctorEmail !== doctorEmail) return false;
      const existingStart = new Date(d.startDateTime);
      const existingEnd = new Date(d.endDateTime);
      return newStart <= existingEnd && newEnd >= existingStart;
    });
    if (alreadyAssigned) {
      return res.json({
        ok: false,
        message: "You already have access to this doctor during this period.",
      });
    }
    await profileModel.updateOne(
      { email: assistantEmail },
      {
        $push: {
          doctors: {
            doctorEmail,
            startDateTime: newStart,
            endDateTime: newEnd,
            status: "Request Sent",
          },
        },
      },
      { runValidators: true },
    );
    const updated = await profileModel
      .findOne({ email: assistantEmail }, { doctors: 1, _id: 0 })
      .lean();
    return res.json({ ok: true, doctors: updated?.doctors || [] });
  } catch (err) {
    console.error("Create access request error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// grantAssistantAccess
const grantAssistantAccess = async (req, res) => {
  try {
    const { assistantEmail, doctorEmail, startDateTime, endDateTime } =
      req.body;
    if (!assistantEmail || !doctorEmail || !startDateTime || !endDateTime) {
      return res.status(400).json({
        message:
          "assistantEmail, doctorEmail, startDateTime, and endDateTime are required",
      });
    }
    const assistant = await Assistant.findOne({ email: assistantEmail });
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    const newStart = new Date(startDateTime);
    const newEnd = new Date(endDateTime);
    const alreadyAssigned = assistant.doctors.some((d) => {
      if (d.doctorEmail !== doctorEmail) return false;
      const existingStart = new Date(d.startDateTime);
      const existingEnd = new Date(d.endDateTime);
      return newStart <= existingEnd && newEnd >= existingStart;
    });
    if (alreadyAssigned) {
      return res.json({
        ok: false,
        message:
          "Assistant already have access to this doctor during this period.",
      });
    }
    await Assistant.updateOne(
      { email: assistantEmail },
      {
        $push: {
          doctors: {
            doctorEmail,
            startDateTime: newStart,
            endDateTime: newEnd,
            status: "Access Granted",
          },
        },
      },
      { runValidators: true },
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("Grant assistant access error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// create availability
const createAvailability = async (req, res) => {
  try {
    const { start, end, status, notes } = req.body;
    if (!start || !end || !status) {
      return res
        .status(400)
        .json({ message: "Start, end, and status required." });
    }
    const headAssistantEmail = req.user.email;
    if (!headAssistantEmail) {
      return res
        .status(400)
        .json({ message: "Head Assistant email not available in token." });
    }
    const newSlot = new HeadAssistantAvailability({
      headAssistantEmail,
      start,
      end,
      status,
      notes,
    });
    await newSlot.save();
    res.status(201).json({ message: "Availability saved.", slot: newSlot });
  } catch (err) {
    console.error("Save availability error:", err);
    res.status(500).json({ message: "Server error saving availability." });
  }
}

// get availability
const getAvailability = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res
        .status(400)
        .json({ message: "Start and end query params required." });
    }
    const headAssistantEmail = req.user.email;
    if (!headAssistantEmail) {
      return res
        .status(400)
        .json({ message: "Head Assistant email missing in token." });
    }
    const slots = await HeadAssistantAvailability.find({
      headAssistantEmail,
      start: { $lt: new Date(end) },
      end: { $gt: new Date(start) },
    });
    res.json(slots);
  } catch (err) {
    console.error("Get availability error:", err);
    res.status(500).json({ message: "Server error retrieving availability." });
  }
}

// Delete availability
const deleteAvailability = async (req, res) => {
  try {
    const headAssistantEmail = req.query.email || req.user.email;
    if (!headAssistantEmail) {
      return res.status(400).json({ message: "Head Assistant email missing." });
    }
    const slot = await HeadAssistantAvailability.findOneAndDelete({
      _id: req.params.id,
      headAssistantEmail,
    });
    if (!slot) {
      return res
        .status(404)
        .json({ message: "Slot not found or not owned by this email." });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete error", err);
    res.status(500).json({ message: "Server error deleting slot." });
  }
}

// Create assistant
const createAssistant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      specialty,
      branches,
      notificationLanguage = 'en',
    } = req.body;

    // Ensure notificationLanguage is valid
    const validLanguages = ['en', 'ru'];
    const sanitizedLanguage = validLanguages.includes(notificationLanguage) ? notificationLanguage : 'en';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    let age = null;
    if (dateOfBirth) {
      age = calculateAge(dateOfBirth);
      if (age < 18) {
        return res
          .status(400)
          .json({ message: "Assistant must be at least 18 years old" });
      }
    }

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

    const assistant = new Assistant({
      firstName,
      middleName: middleName || "",
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender,
      age,
      email,
      phoneNumber,
      specialty: specialty || "",
      branches: branchList,
      notificationLanguage: sanitizedLanguage,
      profileCompleted: true,
    });

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
      assistant.profileFileId = fileId;
    }

    const { plainPassword, hashedPassword } = await generateHashedPassword(
      email
    );

    const user = new User({
      email,
      password: hashedPassword,
      role: "assistant",
      profileCompleted: true,
      notificationLanguage: sanitizedLanguage,
    });

    // Format full name as lastName firstName middleName
    const fullName = [lastName, firstName, middleName]
      .filter(Boolean)
      .join(' ') || 'Assistant';

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await assistant.save({ session });
        await user.save({ session });
        await sendAccountCreationEmail(email, plainPassword, fullName, sanitizedLanguage);
      });
    } catch (error) {
      throw error;
    } finally {
      session.endSession();
    }

    const profilePicture = await readProfilePicture(assistant.profileFileId);

    const assistantResponse = {
      _id: assistant._id,
      firstName: assistant.firstName,
      middleName: assistant.middleName,
      lastName: assistant.lastName,
      dateOfBirth: assistant.dateOfBirth,
      gender: assistant.gender,
      age: assistant.age,
      email: assistant.email,
      phoneNumber: assistant.phoneNumber,
      specialty: assistant.specialty,
      branches: assistant.branches,
      profilePicture,
      doctors: assistant.doctors,
    };

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-created', {
        employeeType: 'assistant',
        employeeData: assistantResponse,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.status(201).json({
      message: "Assistant created successfully",
      assistant: assistantResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get assistants
const getAssistants = async (req, res) => {
  try {
    const assistantModel =
      req.user.role === "assistant" ? Assistant : HeadAssistant;
    const assistant = await assistantModel.findOne({ email: req.user.email });
    if (!assistant) {
      return res.status(400).json({ message: "Assistant not found" });
    }
    const [assistants, headAssistants] = await Promise.all([
      Assistant.find({ branches: { $in: assistant.branches } }).select(
        "firstName middleName branches lastName email role",
      ),
      HeadAssistant.find({ branches: { $in: assistant.branches } }).select(
        "firstName middleName branches lastName email role",
      ),
    ]);
    const allAssistants = [
      ...assistants.map((a) => ({ ...a._doc, role: a.role || "assistant" })),
      ...headAssistants.map((h) => ({
        ...h._doc,
        role: h.role || "head_assistant",
        
      })),
    ];
    res.status(200).json({ assistants: allAssistants });
  } catch (error) {
    console.error("Error fetching assistants:", error);
    res.status(500).json({ message: "Server error" });
  }
}

// Get all assistants (both regular and head assistants)
const getAssistantsList = async (req, res) => {
  try {
    const [assistants, headAssistants] = await Promise.all([
      Assistant.find().select("firstName middleName lastName email role"),
      HeadAssistant.find().select("firstName middleName lastName email role"),
    ]);

    const allAssistants = [
      ...assistants.map((a) => ({
        ...a._doc,
        role: a.role || "assistant",
      })),
      ...headAssistants.map((h) => ({
        ...h._doc,
        role: h.role || "head_assistant",
      })),
    ];

    res.status(200).json({ assistants: allAssistants });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all assistants (optionally filtered by branch name)
const getAllAssistants = async (req, res) => {
  try {
    const { branch } = req.query;

    // If ?branch=All or no branch given -> return all assistants
    const filter =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branches: { $regex: new RegExp(`^${branch}$`, "i") } };

    const assistants = await Assistant.find(filter);
    const gfs = getGfs();

    const assistantsWithImages = await Promise.all(
      assistants.map(async (assistant) => {
        let profilePicture = null;

        // Load GridFS profile picture
        if (assistant.profileFileId) {
          try {
            const file = await gfs
              .find({
                _id: new mongoose.Types.ObjectId(assistant.profileFileId),
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

        // Normalize branches array
        let branches = [];
        if (assistant.branches) {
          if (Array.isArray(assistant.branches)) {
            branches = assistant.branches.map((b) =>
              typeof b === "string"
                ? b.replace(/[\[\]"]+/g, "").trim()
                : String(b).trim()
            );
          } else if (typeof assistant.branches === "string") {
            try {
              const parsed = JSON.parse(assistant.branches);
              branches = Array.isArray(parsed)
                ? parsed.map((b) => b.trim())
                : [assistant.branches.trim()];
            } catch {
              branches = assistant.branches
                .split(",")
                .map((b) => b.trim())
                .filter(Boolean);
            }
          }
        }

        // Construct normalized assistant object
        return {
          _id: assistant._id,
          firstName: assistant.firstName,
          middleName: assistant.middleName,
          lastName: assistant.lastName,
          email: assistant.email,
          phoneNumber: assistant.phoneNumber,
          specialty: assistant.specialty,
          dateOfBirth: assistant.dateOfBirth,
          gender: assistant.gender,
          age: assistant.age,
          doctors: assistant.doctors,
          branches,
          profilePicture,
        };
      })
    );

    res.json({ assistants: assistantsWithImages });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get assistant by ID
const getAssistantById = async (req, res) => {
  try {
    const assistant = await Assistant.findById(req.params.id);
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    const profilePicture = await readProfilePicture(assistant.profileFileId);
    res.json({
      assistant: {
        _id: assistant._id,
        firstName: assistant.firstName,
        middleName: assistant.middleName,
        lastName: assistant.lastName,
        email: assistant.email,
        phoneNumber: assistant.phoneNumber,
        specialty: assistant.specialty,
        dateOfBirth: assistant.dateOfBirth,
        gender: assistant.gender,
        age: assistant.age,
        profilePicture,
        doctors: assistant.doctors,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update assistant
const updateAssistant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      specialty,
      branches,
    } = req.body;

    const assistant = await Assistant.findById(req.params.id);
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }

    // Update main fields
    assistant.firstName = firstName;
    assistant.middleName = middleName || "";
    assistant.lastName = lastName;
    assistant.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    assistant.age = dateOfBirth ? calculateAge(dateOfBirth) : null;

    if (assistant.age && assistant.age < 18) {
      return res
        .status(400)
        .json({ message: "Assistant must be at least 18 years old" });
    }

    assistant.gender = gender || assistant.gender;
    assistant.email = email;
    assistant.phoneNumber = phoneNumber;
    assistant.specialty = specialty || "";
    assistant.profileCompleted = true;

    // Parse branches (array or comma-separated string)
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
    assistant.branches = branchList;

    // Handle profile image replacement
    if (req.file) {

      const gfs = getGfs();

      // Delete old image if exists
      if (assistant.profileFileId) {
        try {
          await gfs.delete(
            new mongoose.Types.ObjectId(assistant.profileFileId)
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
      assistant.profileFileId = fileId;
    }

    await assistant.save();

    // Emit socket event for real-time UI
    getIO().emit("assistantUpdated", assistant);

    // Retrieve profile picture as Base64 for frontend display
    const profilePicture = await readProfilePicture(assistant.profileFileId);

    const assistantResponse = {
      _id: assistant._id,
      firstName: assistant.firstName,
      middleName: assistant.middleName,
      lastName: assistant.lastName,
      email: assistant.email,
      phoneNumber: assistant.phoneNumber,
      specialty: assistant.specialty,
      dateOfBirth: assistant.dateOfBirth,
      gender: assistant.gender,
      age: assistant.age,
      branches: assistant.branches,
      profilePicture,
      doctors: assistant.doctors,
    };

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-updated', {
        employeeId: assistant._id,
        employeeType: 'assistant',
        updatedData: assistantResponse,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.json({
      message: "Assistant updated successfully",
      assistant: assistantResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete assistant
const deleteAssistant = async (req, res) => {
  try {
    const assistant = await Assistant.findById(req.params.id);
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    if (assistant.profileFileId) {
      const gfs = getGfs();
      try {
        const file = await gfs
          .find({ _id: new mongoose.Types.ObjectId(assistant.profileFileId) })
          .toArray();
        if (file.length > 0) {
          await gfs.delete(
            new mongoose.Types.ObjectId(assistant.profileFileId)
          );
        }
      } catch (err) {
      }
    }
    await User.deleteOne({ email: assistant.email });
    await assistant.deleteOne();

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-deleted', {
        employeeId: req.params.id,
        employeeType: 'assistant',
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.json({ message: "Assistant deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Assign doctor to assistant
const assignDoctor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assistantEmail, doctorEmail, startDateTime, endDateTime } =
      req.body;

    const assistant = await Assistant.findOne({ email: assistantEmail });
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }

    const doctor = await DoctorsProfile.findOne({ email: doctorEmail });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (start >= end) {
      return res
        .status(400)
        .json({ message: "End date-time must be after start date-time" });
    }

    const overlappingAssignment = assistant.doctors.find((assignment) => {
      // Skip revoked assignments -- they no longer block new assignments
      if (assignment.status === "Access Revoked") return false;
      const existingStart = new Date(assignment.startDateTime);
      const existingEnd = new Date(assignment.endDateTime);
      return (
        (start >= existingStart && start < existingEnd) ||
        (end > existingStart && end <= existingEnd) ||
        (start <= existingStart && end >= existingEnd)
      );
    });

    if (overlappingAssignment) {
      return res
        .status(400)
        .json({ message: "Assignment overlaps with an existing assignment" });
    }

    assistant.doctors.push({
      doctorEmail,
      startDateTime: start,
      endDateTime: end,
      status: "Access Granted",
    });

    await assistant.save();

    res.json({
      success: true,
      message: "Doctor assigned successfully",
      assistant: {
        _id: assistant._id,
        firstName: assistant.firstName,
        middleName: assistant.middleName,
        lastName: assistant.lastName,
        email: assistant.email,
        doctors: assistant.doctors,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove doctor assignment from assistant
const removeDoctorAssignment = async (req, res) => {
  try {
    const assistant = await Assistant.findById(req.params.id);
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    const initialLength = assistant.doctors.length;
    assistant.doctors = assistant.doctors.filter(
      (assignment) => assignment.doctorEmail !== req.params.doctorEmail
    );
    if (assistant.doctors.length === initialLength) {
      return res
        .status(404)
        .json({ message: "No assignment found for this doctor" });
    }
    await assistant.save();
    res.json({
      message: "Doctor assignment removed",
      assistant: {
        _id: assistant._id,
        firstName: assistant.firstName,
        middleName: assistant.middleName,
        lastName: assistant.lastName,
        doctors: assistant.doctors,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get assistants assigned to a doctor
const getAssistantsByDoctor = async (req, res) => {
  try {
    const { startDateTime, endDateTime } = req.query;
    const query = {
      "doctors.doctorEmail": req.params.doctorEmail,
    };
    if (startDateTime && endDateTime) {
      query["doctors.startDateTime"] = { $lte: new Date(endDateTime) };
      query["doctors.endDateTime"] = { $gte: new Date(startDateTime) };
    }
    const assistants = await Assistant.find(query).select(
      "firstName lastName email specialty profileFileId doctors"
    );
    const assistantsWithImages = await Promise.all(
      assistants.map(async (assistant) => {
        let profilePicture = null;
        if (assistant.profileFileId) {
          const gfs = getGfs();
          const file = await gfs
            .find({ _id: new mongoose.Types.ObjectId(assistant.profileFileId) })
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
        return {
          _id: assistant._id,
          firstName: assistant.firstName,
          middleName: assistant.middleName,
          lastName: assistant.lastName,
          email: assistant.email,
          specialty: assistant.specialty,
          profilePicture,
          doctors: assistant.doctors
            .filter((d) => d.doctorEmail === req.params.doctorEmail)
            .map((d) => ({
              _id: d._id,
              doctorEmail: d.doctorEmail,
              startDateTime: d.startDateTime,
              endDateTime: d.endDateTime,
              status: d.status,
            })),
        };
      })
    );
    res.json({ assistants: assistantsWithImages });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get assistant by email
const getAssistantByEmail = async (req, res) => {
  try {
    const assistant = await Assistant.findOne({ email: req.params.email });
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    const profilePicture = await readProfilePicture(assistant.profileFileId);
    res.json({
      assistant: {
        _id: assistant._id,
        firstName: assistant.firstName,
        middleName: assistant.middleName,
        lastName: assistant.lastName,
        email: assistant.email,
        phoneNumber: assistant.phoneNumber,
        specialty: assistant.specialty,
        dateOfBirth: assistant.dateOfBirth,
        gender: assistant.gender,
        age: assistant.age,
        profilePicture,
        doctors: assistant.doctors,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get profile image by file ID
const getProfileImage = async (req, res) => {
  try {
    const gfs = getGfs();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(req.params.fileId) })
      .toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }
    res.set("Content-Type", file[0].contentType);
    const readStream = gfs.openDownloadStream(file[0]._id);
    readStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Grant access to doctor
const grantAccess = async (req, res) => {
  try {
    const {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    } = req.body;

    if (
      !assistantEmail ||
      !accessId ||
      !doctorEmail ||
      !startDateTime ||
      !endDateTime
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const assistant = await Assistant.findOne({ email: assistantEmail });
    if (!assistant)
      return res.status(404).json({ message: "Assistant not found" });

    const doctorAccess = assistant.doctors.find(
      (entry) =>
        entry._id.toString() === accessId && entry.doctorEmail === doctorEmail
    );
    if (!doctorAccess)
      return res.status(404).json({ message: "Access entry not found" });

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ message: "Invalid date format" });
    if (start >= end)
      return res
        .status(400)
        .json({ message: "End time must be after start time" });

    if (hasOverlap(assistant.doctors, accessId, start, end))
      return res
        .status(400)
        .json({ message: "Assignment overlaps with another" });

    doctorAccess.status = "Access Granted";
    doctorAccess.startDateTime = start;
    doctorAccess.endDateTime = end;

    await assistant.save();

    return res.json({
      success: true,
      message: "Access granted successfully",
      assistant,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Revoke access to doctor
const revokeAccess = async (req, res) => {
  try {
    const {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    } = req.body;

    if (
      !assistantEmail ||
      !accessId ||
      !doctorEmail ||
      !startDateTime ||
      !endDateTime
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const assistant = await Assistant.findOne({ email: assistantEmail });
    if (!assistant)
      return res.status(404).json({ message: "Assistant not found" });

    const doctorAccess = assistant.doctors.find(
      (entry) =>
        entry._id.toString() === accessId && entry.doctorEmail === doctorEmail
    );
    if (!doctorAccess)
      return res.status(404).json({ message: "Access entry not found" });

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ message: "Invalid date format" });
    if (start >= end)
      return res
        .status(400)
        .json({ message: "End time must be after start time" });

    doctorAccess.status = "Access Revoked";
    doctorAccess.startDateTime = start;
    doctorAccess.endDateTime = end;

    await assistant.save();

    return res.json({
      success: true,
      message: "Access revoked successfully",
      assistant,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update access time for doctor
const updateAccessTime = async (req, res) => {
  try {
    const {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    } = req.body;

    if (
      !assistantEmail ||
      !accessId ||
      !doctorEmail ||
      !startDateTime ||
      !endDateTime
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const assistant = await Assistant.findOne({ email: assistantEmail });
    if (!assistant)
      return res.status(404).json({ message: "Assistant not found" });

    const doctorAccess = assistant.doctors.find(
      (entry) =>
        entry._id.toString() === accessId && entry.doctorEmail === doctorEmail
    );
    if (!doctorAccess)
      return res.status(404).json({ message: "Access entry not found" });

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ message: "Invalid date format" });
    if (start >= end)
      return res
        .status(400)
        .json({ message: "End time must be after start time" });

    if (hasOverlap(assistant.doctors, accessId, start, end))
      return res
        .status(400)
        .json({ message: "Assignment overlaps with another" });

    doctorAccess.startDateTime = start;
    doctorAccess.endDateTime = end;

    await assistant.save();

    return res.json({
      success: true,
      message: "Access time updated successfully",
      assistant,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createAssistant,
  getAssistantsList,
  getAllAssistants,
  getAssistantById,
  updateAssistant,
  deleteAssistant,
  assignDoctor,
  removeDoctorAssignment,
  getAssistantsByDoctor,
  getAssistantByEmail,
  getProfileImage,
  grantAccess,
  revokeAccess,
  updateAccessTime,
  getMe,
  updateMe,
  uploadProfileImage,
  getImageById,
  getAssistantDoctors,
  createAccessRequest,
  grantAssistantAccess,
  createAvailability,
  getAvailability,
  deleteAvailability,
  getAssistants,
};
