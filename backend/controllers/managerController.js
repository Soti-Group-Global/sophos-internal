const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { setManagerAuthCookies, clearManagerAuthCookies } = require("../utils/cookieUtils");
const { transporter, sendManagerAccountEmail, sendForgotPasswordEmail } = require('../utils/emailService');
const User = require("../models/User");
const Manager = require("../models/Manager");
const ContentManager = require("../models/ContentManager");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const { getGfs } = require("../gridfs");
const { getIO } = require("../socket");
const { generateHashedPassword } = require("../utils/passwordUtils");

// Delegate to shared email utility (utils/emailService.js)
const sendManagerAccountCreationEmail = (email, password, fullName, lang = 'en') =>
  sendManagerAccountEmail(email, password, fullName, lang);
const createAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      profileCompleted: user.profileCompleted,
      type: "access",
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "1h" }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      type: "refresh",
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
  );

// Manager Sign-In
const managerSignIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if user has an allowed role
    if (!["manager", "head_manager", "super_admin", "content_manager"].includes(user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Managers, Super Admins, Head Manager or Content Managers only." });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    // Fetch profile data to include canManage and other profile fields
    let profileData = {
      email: user.email,
      profileCompleted: user.profileCompleted,
      role: user.role,
    };

    try {
      if (user.role === "content_manager") {
        const contentManager = await ContentManager.findOne({ email: user.email });
        if (contentManager) {
          profileData.canManage = contentManager.canManage || contentManager.contentSpecialties || [];
          profileData.branches = contentManager.branches || [];
        }
      } else if (["manager", "head_manager"].includes(user.role)) {
        const manager = await Manager.findOne({ email: user.email });
        if (manager) {
          profileData.branches = manager.branches || [];
        }
      }
    } catch (profileError) {
    }

    // Clear the old shared cookie name so stale cookies don't persist
    res.clearCookie("refresh_token", { path: "/api/auth" });
    setManagerAuthCookies(res, token, refreshToken);
    res.json({
      token,
      refreshToken,
      user: profileData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email, language = 'en' } = req.body;

  try {
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(500).json({ message: "Email service is not configured" });
    }


    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: language === 'ru'
          ? 'Электронная почта не найдена. Пожалуйста, свяжитесь с администратором.'
          : 'Email not found. Please contact the administrator.'
      });
    }

    if (!["manager", "head_manager", "super_admin", "content_manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: language === 'ru'
          ? 'У вас нет доступа к этой функции. Пожалуйста, свяжитесь с администратором.'
          : 'You do not have access to this feature. Please contact the administrator.'
      });
    }


    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Set token expiry (1 hour from now)
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    // Save reset token to user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send forgot-password email via shared utility
    try {
      await sendForgotPasswordEmail(email, resetUrl, language);

      res.json({
        success: true,
        message: language === 'ru'
          ? 'Ссылка для сброса пароля отправлена на вашу электронную почту.'
          : 'Password reset link has been sent to your email.'
      });
    } catch (emailError) {
      res.status(500).json({
        success: false,
        message: language === 'ru'
          ? 'Не удалось отправить письмо для сброса пароля. Пожалуйста, попробуйте позже.'
          : 'Failed to send password reset email. Please try again later.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: language === 'ru'
        ? 'Не удалось обработать запрос на сброс пароля.'
        : 'Failed to process password reset request.',    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { token, password, language = 'en' } = req.body;
  try {
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: language === 'ru' ? 'Пароль должен содержать не менее 6 символов.' : 'Password must be at least 6 characters.' });
    }
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: language === 'ru' ? 'Ссылка для сброса пароля недействительна или срок её действия истёк.' : 'Password reset link is invalid or has expired.' });
    }
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    res.json({ success: true, message: language === 'ru' ? 'Пароль успешно изменён.' : 'Password has been reset successfully.' });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

// Refresh Token
const refreshToken = async (req, res) => {
  try {
    // Also accept the old cookie name during migration (role check below still blocks non-manager tokens)
    const refreshTokenValue =
      req.cookies?.manager_refresh_token || req.cookies?.refresh_token ||
      req.body?.refreshToken || req.header("x-refresh-token") || "";

    if (!refreshTokenValue) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshTokenValue, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Refresh token is not valid" });
    }

    const decodedUserId = decoded?.id || decoded?.userId || decoded?._id;

    if (decoded?.type !== "refresh" || !decodedUserId) {
      return res.status(401).json({ message: "Refresh token is not valid" });
    }

    const user = await User.findById(decodedUserId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (
      !["manager", "head_manager", "super_admin", "content_manager"].includes(
        user.role
      )
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const token = createAccessToken(user);
    const newRefresh = createRefreshToken(user);
    setManagerAuthCookies(res, token, newRefresh);

    return res.json({
      token,
      refreshToken: newRefresh,
      user: {
        email: user.email,
        profileCompleted: user.profileCompleted,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// Validate Token
const validateToken = (req, res) => {
  res.status(200).json({
    message: "Token is valid",
    profileCompleted: req.user.profileCompleted,
  });
};

// Get Managers (filtered by branch name if provided)
const getManagers = async (req, res) => {
  try {
    const { branch } = req.query;

    // If branch = "All" or not provided -> return all managers
    const filter =
      !branch || branch.toLowerCase() === "all"
        ? {}
        : { branches: { $regex: new RegExp(`^${branch}$`, "i") } };

    const managers = await Manager.find(filter).sort({ createdAt: -1 }).lean();

    const gfs = getGfs();
    const managersWithPictures = await Promise.all(
      managers.map(async (manager) => {
        let profilePicture = null;

        if (
          manager.profilePicture &&
          mongoose.Types.ObjectId.isValid(manager.profilePicture)
        ) {
          try {
            const fileId = new mongoose.Types.ObjectId(manager.profilePicture);
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

        return { ...manager, profilePicture };
      })
    );

    res.json({ managers: managersWithPictures });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Managers Data (enriched with user roles)
const getManagersData = async (req, res) => {
  try {
    // Fetch all managers from Manager collection
    const managers = await Manager.find().lean();

    if (!managers.length) {
      return res.json({ managers: [] });
    }

    //  Extract all emails
    const emails = managers.map((m) => m.email);

    // Find matching user roles from User model
    const users = await User.find({ email: { $in: emails } })
      .select("email role firstName lastName profilePicture")
      .lean();

    // Build a map of email -> role
    const userRoleMap = new Map(users.map((u) => [u.email, u.role]));

    // Merge role + user info into manager data
    const enrichedManagers = managers.map((m) => {
      const user = users.find((u) => u.email === m.email);

      return {
        _id: m._id,
        email: m.email,
        firstName: user?.firstName || m.firstName || "",
        lastName: user?.lastName || m.lastName || "",
        profilePicture: user?.profilePicture || m.profilePicture || null,
        role: userRoleMap.get(m.email) || "manager", // default role fallback
      };
    });

    res.status(200).json({ managers: enrichedManagers });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create Manager
const createManager = async (req, res) => {
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
      branches,
      notificationLanguage = 'en',
    } = req.body;

    // Ensure notificationLanguage is valid
    const validLanguages = ['en', 'ru'];
    const sanitizedLanguage = validLanguages.includes(notificationLanguage) ? notificationLanguage : 'en';

    // Parse branches if it's a string
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

    // Check for duplicate email
    const existingManager = await Manager.findOne({ email });
    if (existingManager) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Manager already exists" });
    }

    // Check if User already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email already registered" });
    }

    let profilePictureId = null;

    // If image is uploaded -- store it in GridFS
    if (req.file) {
      const gfs = getGfs();
      const readablePhotoStream = new Readable();
      readablePhotoStream.push(req.file.buffer);
      readablePhotoStream.push(null);

      const uploadStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });

      readablePhotoStream.pipe(uploadStream);

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => {
          profilePictureId = uploadStream.id;
          resolve();
        });
        uploadStream.on("error", reject);
      });
    }

    // Create Manager document
    const manager = new Manager({
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      age,
      email,
      phoneNumber,
      profilePicture: profilePictureId, // saved GridFS file ID
      cityOfResidence,
      comments,
      branches: branchList,
      notificationLanguage: sanitizedLanguage,
    });

    // Generate password and create User account
    const { plainPassword, hashedPassword } = await generateHashedPassword(email);

    const user = new User({
      email,
      password: hashedPassword,
      role: "manager",
      profileCompleted: true,
      notificationLanguage: sanitizedLanguage,
    });

    // Save both Manager and User in transaction
    await manager.save({ session });
    await user.save({ session });

    // Format full name as lastName firstName middleName
    const fullName = [lastName, firstName, middleName]
      .filter(Boolean)
      .join(' ') || 'Manager';

    // Send account creation email
    try {
      await sendManagerAccountCreationEmail(email, plainPassword, fullName, sanitizedLanguage);
    } catch (emailError) {
      // Don't fail the transaction if email fails, but log the error
    }

    await session.commitTransaction();
    session.endSession();

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('manager-created', {
        employeeType: 'manager',
        employeeData: manager,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.status(201).json({ message: "Manager created successfully", manager });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

// Update Manager
const updateManager = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const manager = await Manager.findById(req.params.id);
    if (!manager) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Manager not found" });
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

    const updatedManager = await Manager.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('manager-updated', {
        employeeId: req.params.id,
        employeeType: 'manager',
        updatedData: updatedManager,
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res
      .status(200)
      .json({ message: "Manager updated successfully", updatedManager });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Manager
const deleteManager = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const manager = await Manager.findById(req.params.id);
    if (!manager) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Manager not found" });
    }

    // Optionally remove profile picture from GridFS
    if (manager.profilePicture) {
      try {
        const gfs = getGfs();
        await gfs.delete(new mongoose.Types.ObjectId(manager.profilePicture));
      } catch (err) {

      }
    }

    await Manager.findByIdAndDelete(req.params.id, { session });
    await User.deleteOne({ email: manager.email }, { session });
    await session.commitTransaction();
    session.endSession();

    // Emit socket event for real-time updates
    try {
      const io = getIO();
      io.emit('manager-deleted', {
        employeeId: req.params.id,
        employeeType: 'manager',
        timestamp: new Date()
      });
    } catch (socketError) {
    }

    res.status(200).json({ message: "Manager deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  managerSignIn,
  forgotPassword,
  resetPassword,
  refreshToken,
  validateToken,
  getManagers,
  getManagersData,
  createManager,
  updateManager,
  deleteManager
};
