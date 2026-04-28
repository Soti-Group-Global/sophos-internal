const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const ContentManager = require("../models/ContentManager");
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

const normalizeStringArray = (value) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch (_) {
      // ignore
    }
    return trimmed
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
};

/** Mailer **/
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendAccountCreationEmail = async (email, password, fullName, role, language = 'en') => {
  try {
    const loginLink = 'https://manager.sophos-med.ru/manager-signin';

    const templates = {
      en: {
        subject: 'Your Content Manager Account Has Been Created',
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
                <p>Your <strong>Content Manager</strong> account has been successfully created. Below are your login credentials:</p>

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
        subject: 'Ваш аккаунт Контент-менеджера был создан',
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
                <p>Ваш аккаунт <strong>Контент-менеджера</strong> был успешно создан. Ниже указаны ваши учетные данные для входа:</p>

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

// Create Content Manager
const createContentManager = async (req, res) => {

  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      cityOfResidence,
      canManage,
      contentSpecialties,
      branches,
      notificationLanguage = 'en',
    } = req.body;

    // Ensure notificationLanguage is valid
    const validLanguages = ['en', 'ru'];
    const sanitizedLanguage = validLanguages.includes(notificationLanguage) ? notificationLanguage : 'en';

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "gender",
      "email",
      "phoneNumber",
      "cityOfResidence",
    ];
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field] === "") {
        return res.status(400).json({ message: `Please fill in ${field}` });
      }
    }

    // Check for duplicate email with same role
    const existingUser = await User.findOne({ email, role: "content_manager" });
    if (existingUser) {
      return res.status(400).json({ message: "A Content Manager with this email already exists" });
    }

    // Also check if content manager already exists
    const existingContentManager = await ContentManager.findOne({ email });
    if (existingContentManager) {
      return res.status(400).json({ message: "A Content Manager with this email already exists" });
    }

    // Validate age
    const age = calculateAge(dateOfBirth);
    if (age < 18) {
      return res
        .status(400)
        .json({ message: "Content Manager must be at least 18 years old" });
    }

    // Parse canManage (accepts array or comma-separated string)
    // Fallback to contentSpecialties for backward compatibility
    const managementField = canManage || contentSpecialties;
    let specialtiesList = [];
    if (managementField) {
      if (Array.isArray(managementField)) {
        specialtiesList = managementField
          .map((s) => s.trim())
          .filter((s) => s);
      } else if (typeof managementField === "string") {
        specialtiesList = managementField
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
      }
    }

    // Create Content Manager document
    const contentManager = new ContentManager({
      firstName,
      middleName: middleName || "",
      lastName,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      age,
      email,
      phoneNumber,
      cityOfResidence,
      branches: normalizeStringArray(branches),
      canManage: specialtiesList,
      notificationLanguage: sanitizedLanguage,
    });

    // Upload profile image to GridFS
    if (req.file) {
      const gfs = getGfs();
      const readablePhotoStream = require("stream").Readable();
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

      contentManager.profileImage = fileId.toString();
    }

    // Generate and hash password
    const { plainPassword, hashedPassword } = await generateHashedPassword(
      email
    );


    // Create associated User record
    const user = new User({
      email,
      password: hashedPassword,
      role: "content_manager",
      profileCompleted: true,
      notificationLanguage: sanitizedLanguage,
    });

    // Save both Content Manager + User atomically
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await contentManager.save({ session });
      await user.save({ session });
      const fullName = [lastName, firstName, middleName]
        .filter(Boolean)
        .join(' ') || 'Content Manager';
      await sendAccountCreationEmail(
        email,
        plainPassword,
        fullName,
        "Content Manager",
        sanitizedLanguage
      );
    });
    session.endSession();

    // Emit socket event if connected
    try {
      const io = getIO();
      io.emit("content_manager_created", { contentManager });
    } catch (err) {
    }

    // Optional: convert profile picture to Base64 for immediate response
    let profilePicture = null;
    if (contentManager.profileImage) {
      const gfs = getGfs();
      const file = await gfs
        .find({ _id: new mongoose.Types.ObjectId(contentManager.profileImage) })
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
    const contentManagerResponse = {
      _id: contentManager._id,
      firstName: contentManager.firstName,
      middleName: contentManager.middleName,
      lastName: contentManager.lastName,
      dateOfBirth: contentManager.dateOfBirth,
      gender: contentManager.gender,
      age: contentManager.age,
      email: contentManager.email,
      phoneNumber: contentManager.phoneNumber,
      cityOfResidence: contentManager.cityOfResidence,
      branches: contentManager.branches || [],
      contentSpecialties: contentManager.contentSpecialties,
      profilePicture,
    };

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-created', {
        employeeType: 'content_manager',
        employeeData: contentManagerResponse,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.status(201).json({
      message: "Content Manager created successfully",
      contentManager: contentManagerResponse,
    });
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
};

// Get all Content Managers
const getAllContentManagers = async (req, res) => {
  try {
    const contentManagers = await ContentManager.find().sort({ createdAt: -1 }).lean();

    const gfs = getGfs();
    const items = await Promise.all(
      contentManagers.map(async (cm) => {
        let profilePicture = null;

        if (cm.profileImage && mongoose.Types.ObjectId.isValid(cm.profileImage)) {
          try {
            const fileId = new mongoose.Types.ObjectId(cm.profileImage);
            const file = await gfs.find({ _id: fileId }).toArray();
            if (file.length > 0) {
              const readStream = gfs.openDownloadStream(file[0]._id);
              const chunks = [];
              profilePicture = await new Promise((resolve, reject) => {
                readStream.on("data", (chunk) => chunks.push(chunk));
                readStream.on("end", () =>
                  resolve(Buffer.concat(chunks).toString("base64"))
                );
                readStream.on("error", reject);
              });
            }
          } catch (err) {
          }
        }

        return { ...cm, profilePicture };
      })
    );

    res.json({ contentManagers: items });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get by ID
const getContentManagerById = async (req, res) => {
  try {
    const contentManager = await ContentManager.findById(req.params.id);
    if (!contentManager)
      return res.status(404).json({ message: "Content Manager not found" });
    res.json({ contentManager });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Content Manager
const updateContentManager = async (req, res) => {

  try {
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      cityOfResidence,
      canManage,
      contentSpecialties,
      branches,
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid content manager ID" });
    }

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "gender",
      "email",
      "phoneNumber",
      "cityOfResidence",
    ];

    const missingFields = requiredFields.filter(field => !req.body[field] || req.body[field] === "");
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Please fill in the following fields: ${missingFields.join(", ")}`
      });
    }

    // Find content manager
    const contentManager = await ContentManager.findById(req.params.id);
    if (!contentManager) {
      return res.status(404).json({ message: "Content Manager not found" });
    }

    // Update base fields
    contentManager.firstName = firstName;
    contentManager.middleName = middleName || "";
    contentManager.lastName = lastName;
    contentManager.dateOfBirth = new Date(dateOfBirth);
    contentManager.age = calculateAge(dateOfBirth);

    // Validate age
    if (contentManager.age < 18) {
      return res
        .status(400)
        .json({ message: "Content Manager must be at least 18 years old" });
    }

    contentManager.gender = gender;
    contentManager.email = email;
    contentManager.phoneNumber = phoneNumber;
    contentManager.cityOfResidence = cityOfResidence;
    if (branches !== undefined) {
      contentManager.branches = normalizeStringArray(branches);
    }

    // Parse and update canManage
    // Fallback to contentSpecialties for backward compatibility
    const managementField = canManage || contentSpecialties;
    let specialtiesList = [];
    if (managementField) {
      if (Array.isArray(managementField)) {
        specialtiesList = managementField
          .map((s) => s.trim())
          .filter((s) => s);
      } else if (typeof managementField === "string") {
        // Handle both JSON string and comma-separated string
        try {
          const parsed = JSON.parse(managementField);
          if (Array.isArray(parsed)) {
            specialtiesList = parsed.map((s) => s.trim()).filter((s) => s);
          }
        } catch {
          // If not JSON, treat as comma-separated
          specialtiesList = managementField
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
      }
    }
    contentManager.canManage = specialtiesList;

    // Handle profile image update
    if (req.file) {
      const gfs = getGfs();

      // Delete old image if exists and is a GridFS file
      if (contentManager.profileImage && mongoose.Types.ObjectId.isValid(contentManager.profileImage)) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(contentManager.profileImage));
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
      contentManager.profileImage = fileId.toString();
    }

    await contentManager.save();

    // Emit socket update event
    getIO().emit("contentManagerUpdated", contentManager);

    // Fetch profile picture as base64 for response (only if it's a GridFS file)
    let profilePicture = null;
    if (contentManager.profileImage && mongoose.Types.ObjectId.isValid(contentManager.profileImage)) {
      try {
        const gfs = getGfs();
        const file = await gfs
          .find({ _id: new mongoose.Types.ObjectId(contentManager.profileImage) })
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
    } else if (contentManager.profileImage) {
      // If it's a URL, use it directly
      profilePicture = contentManager.profileImage;
    }

    // Respond with updated data
    const contentManagerResponse = {
      _id: contentManager._id,
      firstName: contentManager.firstName,
      middleName: contentManager.middleName,
      lastName: contentManager.lastName,
      dateOfBirth: contentManager.dateOfBirth,
      gender: contentManager.gender,
      age: contentManager.age,
      email: contentManager.email,
      phoneNumber: contentManager.phoneNumber,
      cityOfResidence: contentManager.cityOfResidence,
      branches: contentManager.branches || [],
      contentSpecialties: contentManager.contentSpecialties,
      profilePicture: profilePicture || contentManager.profileImage,
    };

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-updated', {
        employeeId: contentManager._id,
        employeeType: 'content_manager',
        updatedData: contentManagerResponse,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.json({
      message: "Content Manager updated successfully",
      contentManager: contentManagerResponse,
    });
  } catch (error) {

    // More specific error messages
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Invalid content manager ID format" });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Content Manager
const deleteContentManager = async (req, res) => {
  try {
    const contentManager = await ContentManager.findById(req.params.id);
    if (!contentManager)
      return res.status(404).json({ message: "Content Manager not found" });

    if (contentManager.profileImage) {
      const gfs = getGfs();
      try {
        await gfs.delete(
          new mongoose.Types.ObjectId(contentManager.profileImage)
        );
      } catch (err) {
      }
    }

    await contentManager.deleteOne();
    await User.deleteOne({ email: contentManager.email });

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-deleted', {
        employeeId: req.params.id,
        employeeType: 'content_manager',
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.json({ message: "Content Manager deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Content Manager by email
const getContentManagerByEmail = async (req, res) => {
  try {
    const contentManager = await ContentManager.findOne({
      email: req.params.email,
    });
    if (!contentManager)
      return res.status(404).json({ message: "Content Manager not found" });
    res.json({ contentManager });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createContentManager,
  getAllContentManagers,
  getContentManagerById,
  updateContentManager,
  deleteContentManager,
  getContentManagerByEmail,
};
