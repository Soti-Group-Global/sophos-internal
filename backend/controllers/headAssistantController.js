const mongoose = require('mongoose');
const { Readable } = require('stream');
const nodemailer = require('nodemailer');
const { validationResult } = require('express-validator');
const HeadAssistant = require('../models/HeadAssistant');
const User = require('../models/User');
const DoctorsProfile = require('../models/DoctorsProfile');
const { getGfs } = require('../gridfs');
const { getIO } = require('../socket');
const HeadAssistantAvailability = require("../models/HeadAssistantAvailability");
const { generateHashedPassword } = require("../utils/passwordUtils");

/** Utility functions **/
const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const generatePassword = (email) => {
  const emailFragment = email.split('@')[0].slice(0, 8);
  const randomString = Math.random().toString(36).slice(-6);
  return `${emailFragment}${randomString}!`;
};

/** Mail Transporter **/
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: { rejectUnauthorized: false }
});

const sendAccountCreationEmail = async (email, password, fullName, notificationLanguage = 'en') => {
  try {
    const loginLink = 'https://assistant.health-direct.ru/';

    const templates = {
      en: {
        subject: 'Your Head Assistant Account Has Been Created',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af; }
              .credential-label { font-weight: normal; color: #64748b; margin-bottom: 5px; }
              .credential-value { font-weight: bold; font-size: 16px; color: #1e293b; margin-bottom: 15px; }
              .login-button { display: inline-block; background: #1e40af; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .login-button:hover { background: #1e3a8a; }
              .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SOPHOS</h1>
              </div>
              <div class="content">
                <p>Dear ${fullName},</p>
                <p>Your <strong>Head Assistant (Старший ассистент)</strong> account has been successfully created. Below are your login credentials:</p>

                <div class="credentials">
                  <div class="credential-label">Email:</div>
                  <div class="credential-value">${email}</div>
                  <div class="credential-label">Password:</div>
                  <div class="credential-value">${password}</div>
                </div>

                <p>Click the button below to log in to your account:</p>
                <div style="text-align: center;">
                  <a href="${loginLink}" class="login-button">Log In Now</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">Or copy and paste this link: ${loginLink}</p>

                <p style="color: #ef4444; font-weight: bold;">Important: Please change your password after your first login for security purposes.</p>

                <div class="footer">
                  <p>С уважением,<br><strong>Команда СОФОС</strong></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      ru: {
        subject: 'Ваш аккаунт старшего ассистента создан',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af; }
              .credential-label { font-weight: normal; color: #64748b; margin-bottom: 5px; }
              .credential-value { font-weight: bold; font-size: 16px; color: #1e293b; margin-bottom: 15px; }
              .login-button { display: inline-block; background: #1e40af; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .login-button:hover { background: #1e3a8a; }
              .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Добро пожаловать в СОФОС</h1>
              </div>
              <div class="content">
                <p>Уважаемый(-ая) ${fullName},</p>
                <p>Ваш аккаунт <strong>Старшего ассистента</strong> был успешно создан. Ниже указаны ваши учетные данные для входа:</p>

                <div class="credentials">
                  <div class="credential-label">Электронная почта:</div>
                  <div class="credential-value">${email}</div>
                  <div class="credential-label">Пароль:</div>
                  <div class="credential-value">${password}</div>
                </div>

                <p>Нажмите на кнопку ниже, чтобы войти в свой аккаунт:</p>
                <div style="text-align: center;">
                  <a href="${loginLink}" class="login-button">Войти</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">Или скопируйте и вставьте эту ссылку: ${loginLink}</p>

                <p style="color: #ef4444; font-weight: bold;">Важно: Пожалуйста, смените пароль после первого входа в систему из соображений безопасности.</p>

                <div class="footer">
                  <p>С уважением,<br><strong>Команда СОФОС</strong></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      }
    };

    const template = templates[language] || templates['ru'];

    const mailOptions = {
      from: `"Медицинский центр СОФОС" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
};

// Create HeadAssistant
const createHeadAssistant = async (req, res) => {
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

    // Prevent duplicate user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Age validation
    let age = dateOfBirth ? calculateAge(dateOfBirth) : null;
    if (age && age < 18) {
      return res.status(400).json({ message: "Head Assistant must be at least 18 years old" });
    }

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

    // Create HeadAssistant document
    const headAssistant = new HeadAssistant({
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

    // Upload profile image to GridFS if provided
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
      headAssistant.profileFileId = fileId;
    }

    // Generate and hash password
    const { plainPassword, hashedPassword } = await generateHashedPassword(email);

    // Create corresponding User record
    const user = new User({
      email,
      password: hashedPassword,
      role: "head_assistant",
      profileCompleted: true,
      notificationLanguage: sanitizedLanguage,
    });

    // Transaction — ensure atomic save
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await headAssistant.save({ session });
      await user.save({ session });

      const fullName = [lastName, firstName, middleName]
        .filter(Boolean)
        .join(' ') || 'Head Assistant';
      await sendAccountCreationEmail(email, plainPassword, fullName, sanitizedLanguage);
    });
    session.endSession();

    // Optional: load profile image as Base64 for response
    let profilePicture = null;
    if (headAssistant.profileFileId) {
      const gfs = getGfs();
      const file = await gfs
        .find({ _id: new mongoose.Types.ObjectId(headAssistant.profileFileId) })
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

    res.status(201).json({
      message: "Head Assistant created successfully",
      headAssistant: {
        _id: headAssistant._id,
        firstName: headAssistant.firstName,
        middleName: headAssistant.middleName,
        lastName: headAssistant.lastName,
        dateOfBirth: headAssistant.dateOfBirth,
        gender: headAssistant.gender,
        age: headAssistant.age,
        email: headAssistant.email,
        phoneNumber: headAssistant.phoneNumber,
        specialty: headAssistant.specialty,
        branches: headAssistant.branches,
        profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all Head Assistants (optionally filtered by branch name)
const getAllHeadAssistants = async (req, res) => {
  try {
    const { branch } = req.query;

    // If branch = "All" or not provided -> return all
    const filter =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branches: { $regex: new RegExp(`^${branch}$`, "i") } };

    const headAssistants = await HeadAssistant.find(filter);

    res.json({ headAssistants });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get by ID
const getHeadAssistantById = async (req, res) => {
  try {
    const headAssistant = await HeadAssistant.findById(req.params.id);
    if (!headAssistant) return res.status(404).json({ message: 'Not found' });
    res.json({ headAssistant });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update HeadAssistant
const updateHeadAssistant = async (req, res) => {
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

    const headAssistant = await HeadAssistant.findById(req.params.id);
    if (!headAssistant) {
      return res.status(404).json({ message: "Head Assistant not found" });
    }

    // Update main fields
    headAssistant.firstName = firstName;
    headAssistant.middleName = middleName || "";
    headAssistant.lastName = lastName;
    headAssistant.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    headAssistant.age = dateOfBirth ? calculateAge(dateOfBirth) : null;

    if (headAssistant.age && headAssistant.age < 25) {
      return res
        .status(400)
        .json({ message: "Head Assistant must be at least 25 years old" });
    }

    headAssistant.gender = gender || headAssistant.gender;
    headAssistant.email = email;
    headAssistant.phoneNumber = phoneNumber;
    headAssistant.specialty = specialty || "";
    headAssistant.profileCompleted = true;

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
    headAssistant.branches = branchList;

    // Handle profile image
    if (req.file) {

      const gfs = getGfs();

      // Delete existing file if present
      if (headAssistant.profileFileId) {
        try {
          await gfs.delete(
            new mongoose.Types.ObjectId(headAssistant.profileFileId)
          );
        } catch (err) {

        }
      }

      // Upload new profile image
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });
      headAssistant.profileFileId = fileId;
    }

    await headAssistant.save();
    getIO().emit("headAssistantUpdated", headAssistant);

    // Retrieve profile picture as Base64
    let profilePicture = null;
    if (headAssistant.profileFileId) {
      const gfs = getGfs();
      const file = await gfs
        .find({ _id: new mongoose.Types.ObjectId(headAssistant.profileFileId) })
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
      message: "Head Assistant updated successfully",
      headAssistant: {
        _id: headAssistant._id,
        firstName: headAssistant.firstName,
        middleName: headAssistant.middleName,
        lastName: headAssistant.lastName,
        email: headAssistant.email,
        phoneNumber: headAssistant.phoneNumber,
        specialty: headAssistant.specialty,
        dateOfBirth: headAssistant.dateOfBirth,
        gender: headAssistant.gender,
        age: headAssistant.age,
        branches: headAssistant.branches,
        profilePicture,
        assistants: headAssistant.assistants || [],
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete HeadAssistant
const deleteHeadAssistant = async (req, res) => {
  try {
    const headAssistant = await HeadAssistant.findById(req.params.id);
    if (!headAssistant) return res.status(404).json({ message: 'Not found' });

    if (headAssistant.profileFileId) {
      const gfs = getGfs();
      try {
        await gfs.delete(new mongoose.Types.ObjectId(headAssistant.profileFileId));
      } catch (e) {
      }
    }

    await User.deleteOne({ email: headAssistant.email });
    await headAssistant.deleteOne();
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign doctor to HeadAssistant
const assignDoctor = async (req, res) => {
  try {
    const { doctorEmail, startDateTime, endDateTime, status } = req.body;
    const headAssistant = await HeadAssistant.findById(req.params.id);
    if (!headAssistant) return res.status(404).json({ message: 'Not found' });

    const doctor = await DoctorsProfile.findOne({ email: doctorEmail });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (start >= end) return res.status(400).json({ message: 'End must be after start' });

    const overlapping = headAssistant.doctors.find((d) => {
      const es = new Date(d.startDateTime);
      const ee = new Date(d.endDateTime);
      return (start < ee && end > es);
    });
    if (overlapping) return res.status(400).json({ message: 'Overlapping assignment' });

    headAssistant.doctors.push({
      doctorEmail,
      startDateTime: start,
      endDateTime: end,
      status: status || 'Pending',
    });

    await headAssistant.save();
    res.json({ headAssistant });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get head assistant by email
const getHeadAssistantByEmail = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const headAssistant = await HeadAssistant.findOne({ email });

    if (!headAssistant) {
      return res.status(404).json({
        success: false,
        message: "Head Assistant not found",
      });
    }

    res.status(200).json({
      success: true,
      headAssistant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching head assistant",
    });
  }
};

// Get head assistant availability
const getAvailability = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const headAssistant = await HeadAssistant.findOne({ email });
    if (!headAssistant) {
      return res.status(404).json({
        success: false,
        message: "Head Assistant not found",
      });
    }

    const availability = await HeadAssistantAvailability.find({
      headAssistantEmail: email,
      start: { $gte: new Date(startDate) },
      end: { $lte: new Date(endDate) },
    }).sort({ start: 1 });

    res.status(200).json(availability);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching availability",
    });
  }
};

// Create head assistant availability
const createAvailability = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const { start, end, status = "Available" } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Start and end times are required",
      });
    }

    const headAssistant = await HeadAssistant.findOne({ email });
    if (!headAssistant) {
      return res.status(404).json({
        success: false,
        message: "Head Assistant not found",
      });
    }

    // Check for overlapping availability
    const overlappingAvailability = await HeadAssistantAvailability.findOne({
      headAssistantEmail: email,
      $or: [
        {
          start: { $lt: new Date(end) },
          end: { $gt: new Date(start) },
        },
      ],
    });

    if (overlappingAvailability) {
      return res.status(400).json({
        success: false,
        message: "Time slot overlaps with existing availability",
      });
    }

    const newAvailability = new HeadAssistantAvailability({
      headAssistantEmail: email,
      start: new Date(start),
      end: new Date(end),
      status,
    });

    await newAvailability.save();

    res.status(201).json({
      success: true,
      availability: newAvailability,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while creating availability",
    });
  }
};

// Delete head assistant availability
const deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const headAssistant = await HeadAssistant.findOne({ email: email.toLowerCase() });
    if (!headAssistant) {
      return res.status(404).json({
        success: false,
        message: "Head Assistant not found",
      });
    }

    const availability = await HeadAssistantAvailability.findOne({
      _id: id,
      headAssistantEmail: email.toLowerCase(),
    });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: "Availability slot not found",
      });
    }

    await HeadAssistantAvailability.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Availability slot deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while deleting availability",
    });
  }
};

// Bulk update head assistant availability
const bulkUpdateAvailability = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const { slots } = req.body;

    if (!Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        message: "Slots array is required",
      });
    }

    const headAssistant = await HeadAssistant.findOne({ email });
    if (!headAssistant) {
      return res.status(404).json({
        success: false,
        message: "Head Assistant not found",
      });
    }

    // Delete existing availability for the date range
    if (slots.length > 0) {
      const startDate = new Date(Math.min(...slots.map(slot => new Date(slot.start))));
      const endDate = new Date(Math.max(...slots.map(slot => new Date(slot.end))));

      await HeadAssistantAvailability.deleteMany({
        headAssistantEmail: email,
        start: { $gte: startDate },
        end: { $lte: endDate },
      });
    }

    // Create new availability slots
    const availabilitySlots = slots.map(slot => ({
      headAssistantEmail: email,
      start: new Date(slot.start),
      end: new Date(slot.end),
      status: slot.status || "Available",
    }));

    const savedSlots = await HeadAssistantAvailability.insertMany(availabilitySlots);

    res.status(201).json({
      success: true,
      slots: savedSlots,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while bulk updating availability",
    });
  }
};

module.exports = {
  createHeadAssistant,
  getAllHeadAssistants,
  getHeadAssistantById,
  updateHeadAssistant,
  deleteHeadAssistant,
  assignDoctor,
  getHeadAssistantByEmail,
  getAvailability,
  createAvailability,
  deleteAvailability,
  bulkUpdateAvailability,
};
