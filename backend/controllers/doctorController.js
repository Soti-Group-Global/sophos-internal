const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { Readable } = require('stream');

const Doctor = require('../models/Doctor');
const User = require('../models/User');
const DoctorBreak = require('../models/DoctorBreak');
const { getGfs } = require('../gridfs');
const { getIO } = require('../socket');
const { generateHashedPassword } = require('../utils/passwordUtils');

// Calculate age from dateOfBirth
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

// Generate password incorporating email
const generatePassword = (email) => {
  const emailFragment = email.split('@')[0].slice(0, 8);
  const randomString = Math.random().toString(36).slice(-6);
  return `${emailFragment}${randomString}!`;
};

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Function to send account creation email
const sendAccountCreationEmail = async (email, password, fullName, language = 'en') => {
  try {
    const loginLink = 'https://doctor.health-direct.ru/';

    const templates = {
      en: {
        subject: 'Your Doctor Account Has Been Created',
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
                <p>Your <strong>Doctor (Врач)</strong> account has been successfully created. Below are your login credentials:</p>

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
        subject: 'Ваш аккаунт врача создан',
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
                <p>Ваш аккаунт <strong>Врача</strong> был успешно создан. Ниже указаны ваши учетные данные для входа:</p>

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

// Create doctor
const createDoctor = async (req, res) => {
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
      branches, // new
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

    // Check for duplicate user with doctor role
    const existingUser = await User.findOne({ email, role: "doctor" });
    if (existingUser) {
      return res.status(400).json({ message: "A Doctor with this email already exists" });
    }

    // Also check if doctor already exists in Doctor collection
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ message: "A Doctor with this email already exists" });
    }

    // Validate age
    const age = calculateAge(dateOfBirth);
    if (age < 18) {
      return res.status(400).json({ message: "Doctor must be at least 18 years old" });
    }

    // Parse services
    const parsedServices = typeof services === "string" ? JSON.parse(services) : services;

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

    // Create Doctor document
    const doctor = new Doctor({
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
      branches: branchList, // added
      notificationLanguage: sanitizedLanguage,
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

      doctor.profileFileId = fileId;
    }

    // Generate and hash password
    const { plainPassword, hashedPassword } = await generateHashedPassword(email);

    // Create User record
    const user = new User({
      email,
      password: hashedPassword,
      role: "doctor",
      profileCompleted: true,
    });

    // Transaction: save both doctor and user
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await doctor.save({ session });
        await user.save({ session });
      });

      // Real-time socket event
      getIO().emit("doctorCreated", doctor);
    } finally {
      session.endSession();
    }

    // Send account creation email
    try {
      const fullName = [lastName, firstName, middleName]
        .filter(Boolean)
        .join(' ') || 'Doctor';
      await sendAccountCreationEmail(email, plainPassword, fullName, sanitizedLanguage);
    } catch (emailError) {
    }

    // Retrieve base64 profile picture if available
    let profilePicture = null;
    if (doctor.profileFileId) {
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
    }

    // Final response
    const doctorResponse = {
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
      placeOfWork: doctor.placeOfWork,
      regalia: doctor.regalia,
      services: doctor.services,
      feesAmount: doctor.feesAmount,
      currency: doctor.currency,
      branches: doctor.branches,
      profilePicture,
    };

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-created', {
        employeeType: 'doctor',
        employeeData: doctorResponse,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.status(201).json({
      message: "Doctor created successfully",
      doctor: doctorResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all doctors (with optional branch filter)
const getDoctors = async (req, res) => {
  try {
    const { branch } = req.query;

    // If ?branch=All or branch not provided -> return all doctors
    const filter =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branches: { $regex: new RegExp(`^${branch}$`, "i") } };

    const doctors = await Doctor.find(filter);
    const gfs = getGfs();

    const doctorsWithImages = await Promise.all(
      doctors.map(async (doctor) => {
        let profilePicture = null;

        if (doctor.profileFileId) {
          try {
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
          } catch (err) {
          }
        }

        return { ...doctor.toObject(), profilePicture };
      })
    );

    res.json({ doctors: doctorsWithImages });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all doctors (no images)
const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get doctor by ID
const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    let profilePicture = null;
    if (doctor.profileFileId) {
      const gfs = getGfs();
      const file = await gfs.find({ _id: new mongoose.Types.ObjectId(doctor.profileFileId) }).toArray();
      if (file.length > 0) {
        const readStream = gfs.openDownloadStream(file[0]._id);
        const chunks = [];
        await new Promise((resolve, reject) => {
          readStream.on('data', (chunk) => chunks.push(chunk));
          readStream.on('end', () => {
            profilePicture = Buffer.concat(chunks).toString('base64');
            resolve();
          });
          readStream.on('error', reject);
        });
      }
    }
    res.json({
      doctor: { ...doctor.toObject(), profilePicture }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get doctor fees by ID
const getDoctorFees = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('feesAmount currency');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json({
      feesAmount: doctor.feesAmount,
      currency: doctor.currency
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Doctor
const updateDoctor = async (req, res) => {
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
      branches, // added support
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

    // Find doctor
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Update main fields
    doctor.firstName = firstName;
    doctor.middleName = middleName || "";
    doctor.lastName = lastName;
    doctor.dateOfBirth = new Date(dateOfBirth);
    doctor.age = calculateAge(dateOfBirth);
    if (doctor.age < 21) {
      return res
        .status(400)
        .json({ message: "Doctor must be at least 21 years old" });
    }

    doctor.gender = gender;
    doctor.email = email;
    doctor.phoneNumber = phoneNumber;
    doctor.specialty = specialty;
    doctor.placeOfWork = placeOfWork;
    doctor.regalia = regalia || "";
    doctor.services =
      typeof services === "string" ? JSON.parse(services) : services;
    doctor.feesAmount = parseFloat(feesAmount);
    doctor.currency = currency;

    // Parse branches
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
    doctor.branches = branchList;

    // Handle profile image update
    if (req.file) {
      const gfs = getGfs();

      // Delete existing file if present
      if (doctor.profileFileId) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(doctor.profileFileId));
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
      doctor.profileFileId = fileId;
    }

    await doctor.save();

    // Emit socket event
    getIO().emit("doctorUpdated", doctor);

    // Fetch profile image as Base64
    let profilePicture = null;
    if (doctor.profileFileId) {
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
    }

    // Success response
    const doctorResponse = {
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
      placeOfWork: doctor.placeOfWork,
      regalia: doctor.regalia,
      services: doctor.services,
      feesAmount: doctor.feesAmount,
      currency: doctor.currency,
      branches: doctor.branches,
      profilePicture,
    };

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-updated', {
        employeeId: doctor._id,
        employeeType: 'doctor',
        updatedData: doctorResponse,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.json({
      message: "Doctor updated successfully",
      doctor: doctorResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete doctor
const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    if (doctor.profileFileId) {
      const gfs = getGfs();
      try {
        const file = await gfs.find({ _id: new mongoose.Types.ObjectId(doctor.profileFileId) }).toArray();
        if (file.length > 0) {
          await gfs.delete(new mongoose.Types.ObjectId(doctor.profileFileId));
        }
      } catch (err) {
      }
    }
    await doctor.deleteOne();

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('employee-deleted', {
        employeeId: doctor._id,
        employeeType: 'doctor',
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.json({ message: 'Doctor deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get doctor by email
const getDoctorByEmail = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ email: req.params.email });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    let profilePicture = null;
    if (doctor.profileFileId) {
      const gfs = getGfs();
      const file = await gfs.find({ _id: new mongoose.Types.ObjectId(doctor.profileFileId) }).toArray();
      if (file.length > 0) {
        const readStream = gfs.openDownloadStream(file[0]._id);
        const chunks = [];
        await new Promise((resolve, reject) => {
          readStream.on('data', (chunk) => chunks.push(chunk));
          readStream.on('end', () => {
            profilePicture = Buffer.concat(chunks).toString('base64');
            resolve();
          });
          readStream.on('error', reject);
        });
      }
    }
    res.json({
      doctor: { ...doctor.toObject(), profilePicture }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get breaks for a doctor on a specific date
const getDoctorBreaks = async (req, res) => {
  try {
    const { doctorEmail, date } = req.params;

    const breaks = await DoctorBreak.findOne({
      doctorEmail: doctorEmail.toLowerCase(),
      date: date,
    });

    if (!breaks) {
      return res.json({
        doctorEmail,
        date,
        breaks: [],
        comment: '',
      });
    }

    res.json(breaks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update or create breaks for a doctor on a specific date
const createOrUpdateBreaks = async (req, res) => {
  try {
    const { doctorEmail, date, breaks, comment } = req.body;

    // Validate required fields
    if (!doctorEmail || !date) {
      return res.status(400).json({
        message: 'Doctor email and date are required',
      });
    }

    // Validate breaks format
    if (breaks && !Array.isArray(breaks)) {
      return res.status(400).json({
        message: 'Breaks must be an array',
      });
    }

    // Validate each break slot
    if (breaks) {
      for (const breakSlot of breaks) {
        if (!breakSlot.startTime || !breakSlot.endTime) {
          return res.status(400).json({
            message: 'Each break must have startTime and endTime',
          });
        }
      }
    }

    // Find existing break record or create new one
    let doctorBreak = await DoctorBreak.findOne({
      doctorEmail: doctorEmail.toLowerCase(),
      date: date,
    });

    if (doctorBreak) {
      // Update existing record
      doctorBreak.breaks = breaks || [];
      doctorBreak.comment = comment || '';
      doctorBreak.updatedAt = new Date();
      await doctorBreak.save();
    } else {
      // Create new record
      doctorBreak = new DoctorBreak({
        doctorEmail: doctorEmail.toLowerCase(),
        date: date,
        breaks: breaks || [],
        comment: comment || '',
      });
      await doctorBreak.save();
    }

    res.status(200).json({
      message: 'Breaks updated successfully',
      data: doctorBreak,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete breaks for a doctor on a specific date
const deleteBreaks = async (req, res) => {
  try {
    const { doctorEmail, date } = req.params;

    const result = await DoctorBreak.findOneAndDelete({
      doctorEmail: doctorEmail.toLowerCase(),
      date: date,
    });

    if (!result) {
      return res.status(404).json({
        message: 'No breaks found for this doctor on this date',
      });
    }

    res.json({
      message: 'Breaks deleted successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createDoctor,
  getDoctors,
  getAllDoctors,
  getDoctorById,
  getDoctorFees,
  updateDoctor,
  deleteDoctor,
  getDoctorByEmail,
  getDoctorBreaks,
  createOrUpdateBreaks,
  deleteBreaks,
};
