const mongoose = require('mongoose');
const { sendDoctorAccountEmail } = require('../utils/emailService');
const { Readable } = require('stream');

const Doctor = require('../models/DoctorsProfile');
const User = require('../models/User');
const Assistant = require('../models/Assistant');
const HeadAssistant = require('../models/HeadAssistant');
const DoctorBreak = require('../models/DoctorBreak');
const DoctorMessage = require('../models/DoctorMessage');
const { ObjectId } = mongoose.Types;
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

// Delegate to shared email utility (utils/emailService.js)
const sendAccountCreationEmail = (email, password, fullName, language = 'en') =>
  sendDoctorAccountEmail(email, password, fullName, language);



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

// Get doctor profile image by GridFS file ID
// Get doctor profile image by GridFS file ID or doctor ID
const getDoctorImageById = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const gfs = getGfs();

    const tryReadFile = async (id) => {
      const files = await gfs.find({ _id: new ObjectId(id) }).toArray();
      if (!files || files.length === 0) {
        return null;
      }

      const file = files[0];
      res.set('Content-Type', file.contentType || 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${file.filename}"`);
      res.set('Cache-Control', 'public, max-age=31536000');

      return await new Promise((resolve, reject) => {
        const readStream = gfs.openDownloadStream(file._id);
        readStream.on('error', reject);
        readStream.on('end', resolve);
        readStream.pipe(res);
      });
    };

    const directFile = await tryReadFile(fileId);
    if (directFile !== null) {
      return;
    }

    const doctor = await Doctor.findOne({
      $or: [{ profileFileId: fileId }, { _id: new ObjectId(fileId) }],
    }).select('profileFileId');

    if (doctor?.profileFileId && doctor.profileFileId !== fileId) {
      const doctorFile = await tryReadFile(doctor.profileFileId);
      if (doctorFile !== null) {
        return;
      }
    }

    return res.status(404).json({ message: 'Image not found' });
  } catch (error) {
    return res.status(500).json({
      message: 'Error fetching image',    });
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
    res.status(500).json({ message: 'Server error' });
  }
};

// Update or create breaks for the currently authenticated doctor (doctor interface)
const createOrUpdateMyBreaks = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { date, breaks, comment } = req.body;
    const doctorEmail = (req.user.role === 'doctor' ? req.user.email : (req.body.doctorEmail || req.user.email)).toLowerCase();

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    if (breaks !== undefined && !Array.isArray(breaks)) {
      return res.status(400).json({ message: 'Breaks must be an array' });
    }

    if (Array.isArray(breaks)) {
      for (const breakSlot of breaks) {
        if (!breakSlot?.startTime || !breakSlot?.endTime) {
          return res.status(400).json({
            message: 'Each break must have startTime and endTime',
          });
        }
      }
    }

    let doctorBreak = await DoctorBreak.findOne({ doctorEmail, date });

    if (doctorBreak) {
      doctorBreak.breaks = Array.isArray(breaks) ? breaks : doctorBreak.breaks;
      if (comment !== undefined) doctorBreak.comment = comment || '';
      doctorBreak.updatedAt = new Date();
      await doctorBreak.save();
    } else {
      doctorBreak = new DoctorBreak({
        doctorEmail,
        date,
        breaks: Array.isArray(breaks) ? breaks : [],
        comment: comment || '',
      });
      await doctorBreak.save();
    }

    return res.status(200).json({
      message: 'Breaks updated successfully',
      data: doctorBreak,
    });
  } catch (error) {
    console.error('Error updating my breaks:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Partial update of a break record by id for the currently authenticated doctor
const updateMyBreakById = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { breakId } = req.params;
    const { date, breaks, comment } = req.body || {};

    const doctorBreak = await DoctorBreak.findById(breakId);
    if (!doctorBreak) {
      return res.status(404).json({ message: 'Break record not found' });
    }

    if (req.user.role === 'doctor' && doctorBreak.doctorEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (breaks !== undefined && !Array.isArray(breaks)) {
      return res.status(400).json({ message: 'Breaks must be an array' });
    }

    if (Array.isArray(breaks)) {
      for (const breakSlot of breaks) {
        if (!breakSlot?.startTime || !breakSlot?.endTime) {
          return res.status(400).json({
            message: 'Each break must have startTime and endTime',
          });
        }
      }
      doctorBreak.breaks = breaks;
    }

    if (date !== undefined) doctorBreak.date = date;
    if (comment !== undefined) doctorBreak.comment = comment || '';

    doctorBreak.updatedAt = new Date();
    await doctorBreak.save();

    return res.status(200).json({
      message: 'Breaks updated successfully',
      data: doctorBreak,
    });
  } catch (error) {
    console.error('Error updating break by id:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Delete a break record by id for the currently authenticated doctor
const deleteMyBreakById = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { breakId } = req.params;

    const doctorBreak = await DoctorBreak.findById(breakId);
    if (!doctorBreak) {
      return res.status(404).json({ message: 'Break record not found' });
    }

    if (req.user.role === 'doctor' && doctorBreak.doctorEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await DoctorBreak.deleteOne({ _id: doctorBreak._id });

    return res.json({ message: 'Breaks deleted successfully', data: doctorBreak });
  } catch (error) {
    console.error('Error deleting break by id:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



// Get current authenticated doctor's profile
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Fetch doctor profile — case-insensitive to handle email casing mismatches
    const emailRegex = new RegExp(`^${req.user.email}$`, 'i');
    const doctor = await Doctor.findOne({ email: emailRegex });

    if (!doctor) {
      // Profile not created yet — return minimal stub from User model
      return res.json({
        doctor: {
          email: req.user.email,
          role: req.user.role,
          firstName: "",
          lastName: "",
          profilePicture: null,
          profileCompleted: req.user.profileCompleted,
        },
      });
    }

    // Get profile picture if exists
    let profilePicture = null;
    if (doctor.profileFileId) {
      const gfs = getGfs();
      try {
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
      } catch (fileError) {
        console.error('Error fetching profile picture:', fileError);
        // Continue without profile picture
      }
    }

    const doctorObj = doctor.toObject();
   
    res.json({
      doctor: { ...doctorObj, profilePicture }
    });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current doctor's breaks for a specific date (optional)
const getMyBreaks = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const doctorEmail = req.user.email.toLowerCase();
    const { date } = req.query;

    const query = { doctorEmail };
    if (date) query.date = date;

    const breakDocs = await DoctorBreak.find(query).sort({ date: 1 }).lean();

    // Frontend expects an array of DoctorBreak documents under `breaks`
    return res.json({
      doctorEmail,
      breaks: breakDocs,
    });
  } catch (error) {
    console.error('Error fetching doctor breaks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get list of all branches
const getDoctorBranchesList = async (req, res) => {
  try {
    // For DoctorsProfile model, branches might be embedded differently
    // Let's just return an empty array or a default branch list
    const branches = ['Main Branch', 'Secondary Branch', 'Online'];
    res.json({ branches });
  } catch (error) {
    console.error('Error fetching doctor branches:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/doctors/messages
const getMessage = async (req, res) => {
  try {
    const docMsg = await DoctorMessage.findOne({ email: req.user.email });
    res.json({ messages: docMsg ? docMsg.messages : [] });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
// DELETE /api/doctors/messages/:messageId
const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  try {
    const docMsg = await DoctorMessage.findOne({ email: req.user.email });
    if (!docMsg) return res.status(404).json({ message: 'Message list not found' });
    const before = docMsg.messages.length;
    docMsg.messages = docMsg.messages.filter((m) => m._id.toString() !== messageId);
    const after = docMsg.messages.length;
    if (before === after) {
      return res.status(404).json({ message: 'Message not found' });
    }
    await docMsg.save();
    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
// POST /api/doctors/messages/upload
const uploadMessageFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const bucket = req.app.locals.messageBucket;
    const filename = `${Date.now()}_${req.file.originalname}`;
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: { uploadedBy: req.user.id, originalName: req.file.originalname },
    });
    const fileId = uploadStream.id;
    uploadStream.end(req.file.buffer);
    uploadStream.on('finish', () => {
      res.status(200).json({
        success: true,
        fileId,
        fileUrl: `/api/doctors/file-by-id/${fileId}`,
        fileType: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
        fileName: req.file.originalname,
      });
    });
    uploadStream.on('error', (err) => {
      console.error('Upload stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'File upload failed', error: err.message });
      }
    });
  } catch (err) {
    console.error('Upload processing error:', err);
    res.status(500).json({ success: false, message: 'File processing failed', error: err.message });
  }
}
// GET /api/doctors/lite
const getDoctorsLite = async (req, res) => {
  try {
    const doctors = await Doctor.find({}, { _id: 1, firstName: 1, middleName: 1, lastName: 1, email: 1 })
      .lean();
    
    const formatted = doctors.map((d) => {
      const pickLang = (field, lang) => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (typeof field === 'object') return field[lang] || '';
        return '';
      };
      const buildName = (lang) =>
        [pickLang(d.lastName, lang), pickLang(d.firstName, lang), pickLang(d.middleName, lang)]
          .filter(Boolean).join(' ');
      return {
        _id: d._id,
        name: {
          ru: buildName('ru') || buildName('en') || 'N/A',
          en: buildName('en') || buildName('ru') || 'N/A',
        },
        email: d.email,
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching doctors (lite):', err.message, err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}
// GET /api/doctors/messages/allDoctors
const getAllDoctorsForMessages = async (req, res) => {
   try {
    const assistantModel = req.user.role === 'assistant' ? Assistant : HeadAssistant;
    const assistant = await assistantModel.findOne({ email: req.user.email });
    if (!assistant) {
      return res.status(400).json({ message: 'Assistant not found' });
    }
    const doctors = await Doctor.find({ 'branches.en': { $in: assistant.branches } });
    const doctorsWithImages = await Promise.all(
      doctors.map(async (doctor) => {
        let profilePicture = null;
        if (doctor.profileFileId) {
          const gfs = req.app.locals.profileBucket;
          const file = await gfs
            .find({ _id: new mongoose.Types.ObjectId(doctor.profileFileId) })
            .toArray();
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
        return { ...doctor.toObject(), profilePicture };
      })
    );
    res.json({ doctors: doctorsWithImages });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

//------------- Assistant related functions -------------//
//get doctors for particular assistant
const getDoctorsForAssistant = async (req, res) => {
  try {
    const assistantEmail = req.query.assistantEmail;
    if (!assistantEmail) {
      return res.status(400).json({ message: 'assistantEmail is required' });
    }
    const assistantModel = req.user.role === 'head_assistant' ? HeadAssistant : Assistant;
    const assistant = await assistantModel.findOne({ email: assistantEmail });
    if (!assistant) {
      return res.status(404).json({ message: 'Assistant not found' });
    }
    const now = new Date();
    const activeDoctorEmails = assistant.doctors
      .filter((d) => {
        const start = new Date(d.startDateTime);
        const end = new Date(d.endDateTime);
        return start <= now && end >= now;
      })
      .map((d) => d.doctorEmail);
    if (activeDoctorEmails.length === 0) {
      return res.status(200).json({ doctors: [] });
    }
    const doctors = await Doctor.find({ email: { $in: activeDoctorEmails } });
    res.status(200).json({ doctors });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
} 
const updateMe = async (req, res) => {
  try {
    const { phoneNumber, dateOfBirth } = req.body;
    const doctor = await Doctor.findOne({ email: new RegExp(`^${req.user.email}$`, 'i') });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    if (phoneNumber !== undefined) doctor.phoneNumber = phoneNumber;
    if (dateOfBirth !== undefined) doctor.dateOfBirth = dateOfBirth;

    await doctor.save();
    res.json({ message: 'Profile updated', doctor });
  } catch (err) {
    console.error('updateMe error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createDoctor,
  getDoctors,
  getAllDoctors,
  getDoctorById,
  getDoctorFees,
  updateDoctor,
  updateMe,
  deleteDoctor,
  getDoctorByEmail,
  getDoctorImageById,
  getDoctorBreaks,
  createOrUpdateMyBreaks,
  updateMyBreakById,
  deleteMyBreakById,
  getMe,
  getMyBreaks,
  getDoctorBranchesList,
  getDoctorsForAssistant,
  getMessage,
  deleteMessage,
  uploadMessageFile,
  getDoctorsLite,
  getAllDoctorsForMessages,
};
