const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
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

/** Mailer **/
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendAccountCreationEmail = async (email, password, fullName, notificationLanguage = 'en') => {
  try {
    const loginLink = 'https://doctor.health-direct.ru/';

    const templates = {
      en: {
        subject: 'Your Head Doctor Account Has Been Created',
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
                <p>Your <strong>Head Doctor (Главный врач)</strong> account has been successfully created. Below are your login credentials:</p>

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
        subject: 'Ваш аккаунт главного врача создан',
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
                <p>Ваш аккаунт <strong>Главного врача</strong> был успешно создан. Ниже указаны ваши учетные данные для входа:</p>

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
