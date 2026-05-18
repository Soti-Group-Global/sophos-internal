const User = require('../models/User');
const Manager = require('../models/Manager');
const SuperAdmin = require('../models/SuperAdmin');
const ContentManager = require('../models/ContentManager');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { getGfs } = require('../gridfs');

// GET profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData = null;
    let profilePicture = null;

    // Handle Manager / Head Manager profile
    if (["manager", "head_manager"].includes(user.role)) {
      const manager = await Manager.findOne({ email: user.email });
      if (!manager) {
        return res.status(404).json({ message: "Manager profile not found" });
      }

      // Handle profile picture (GridFS)
      if (manager.profilePicture) {
        try {
          const gfs = getGfs();
          const files = await gfs
            .find({ _id: new mongoose.Types.ObjectId(manager.profilePicture) })
            .toArray();

          if (files.length > 0) {
            const readStream = gfs.openDownloadStream(files[0]._id);
            const chunks = [];
            profilePicture = await new Promise((resolve, reject) => {
              readStream.on("data", (chunk) => chunks.push(chunk));
              readStream.on("end", () =>
                resolve(
                  `data:${files[0].contentType};base64,${Buffer.concat(chunks).toString("base64")}`
                )
              );
              readStream.on("error", reject);
            });
          }
        } catch (err) {
        }
      }

      profileData = {
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
        notificationLanguage: user.notificationLanguage || "en",
        firstName: manager.firstName,
        middleName: manager.middleName,
        lastName: manager.lastName,
        gender: manager.gender,
        dateOfBirth: manager.dateOfBirth,
        phoneNumber: manager.phoneNumber,
        cityOfResidence: manager.cityOfResidence,
        comments: manager.comments,
        profilePicture,
        branches: manager.branches,
      };
    }

    // Handle Content Manager profile
    else if (user.role === "content_manager") {
      const contentManager = await ContentManager.findOne({ email: user.email });
      if (!contentManager) {
        return res.status(404).json({ message: "Content Manager profile not found" });
      }

      // Handle profile picture (GridFS)
      if (contentManager.profileImage) {
        try {
          const gfs = getGfs();
          const files = await gfs
            .find({ _id: new mongoose.Types.ObjectId(contentManager.profileImage) })
            .toArray();

          if (files.length > 0) {
            const readStream = gfs.openDownloadStream(files[0]._id);
            const chunks = [];
            profilePicture = await new Promise((resolve, reject) => {
              readStream.on("data", (chunk) => chunks.push(chunk));
              readStream.on("end", () =>
                resolve(
                  `data:${files[0].contentType};base64,${Buffer.concat(chunks).toString("base64")}`
                )
              );
              readStream.on("error", reject);
            });
          }
        } catch (err) {
        }
      }

      profileData = {
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
        notificationLanguage: user.notificationLanguage || "en",
        firstName: contentManager.firstName,
        middleName: contentManager.middleName,
        lastName: contentManager.lastName,
        gender: contentManager.gender,
        dateOfBirth: contentManager.dateOfBirth,
        phoneNumber: contentManager.phoneNumber,
        cityOfResidence: contentManager.cityOfResidence,
        profilePicture,
        canManage: contentManager.canManage || contentManager.contentSpecialties || [],
        branches: contentManager.branches || [],
      };
    }

    // Handle Super Admin profile
    else if (user.role === "super_admin") {
      const superAdmin = await SuperAdmin.findOne({ email: user.email });
      if (!superAdmin) {
        return res.status(404).json({ message: "Super Admin profile not found" });
      }

      profileData = {
        email: superAdmin.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
        notificationLanguage: user.notificationLanguage || "en",
        firstName: superAdmin.firstName,
        middleName: superAdmin.middleName,
        lastName: superAdmin.lastName,
        gender: superAdmin.gender,
        dateOfBirth: superAdmin.dateOfBirth,
        phoneNumber: superAdmin.phoneNumber,
        cityOfResidence: superAdmin.cityOfResidence,
        comments: superAdmin.comments,
        profilePicture: superAdmin.profileImage || null,
        branches: superAdmin.branches,
      };
    }

    // Unauthorized role
    else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Return consistent structure
    res.status(200).json({ user: profileData });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* -------------------- UPDATE or CREATE PROFILE -------------------- */
const updateOrCreateProfile = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    gender,
    dateOfBirth,
    cityOfResidence,
    phoneNumber,
    comments,
    canManage,
    contentSpecialties,
    notificationLanguage,
  } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let profileModel;
    let profileDoc;
    let modelName;

    // Select model based on role
    if (["manager", "head_manager"].includes(user.role)) {
      profileModel = Manager;
      modelName = "Manager";
    } else if (user.role === "content_manager") {
      profileModel = ContentManager;
      modelName = "ContentManager";
    } else if (user.role === "super_admin") {
      profileModel = SuperAdmin;
      modelName = "SuperAdmin";
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Find existing profile
    profileDoc = await profileModel.findOne({ email: user.email });

    // Create new if missing
    if (!profileDoc) {
      if (!firstName || !lastName || !gender || !dateOfBirth || !cityOfResidence || !phoneNumber) {
        return res.status(400).json({
          message: `All required fields must be provided for new ${modelName} profile`,
        });
      }

      const profileData = {
        email: user.email,
        firstName,
        middleName: middleName || "",
        lastName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        cityOfResidence,
        phoneNumber,
        notificationLanguage: notificationLanguage || "en",
      };

      // Add role-specific fields
      if (user.role === "content_manager") {
        // Parse canManage for content managers (with fallback to contentSpecialties)
        const managementField = canManage || contentSpecialties;
        let specialtiesList = [];
        if (managementField) {
          if (Array.isArray(managementField)) {
            specialtiesList = managementField.map((s) => s.trim()).filter((s) => s);
          } else if (typeof managementField === "string") {
            try {
              const parsed = JSON.parse(managementField);
              if (Array.isArray(parsed)) {
                specialtiesList = parsed.map((s) => s.trim()).filter((s) => s);
              }
            } catch {
              specialtiesList = managementField
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s);
            }
          }
        }
        profileData.canManage = specialtiesList;
      } else {
        profileData.comments = comments || "";
      }

      profileDoc = new profileModel(profileData);
    } else {
      // Update existing fields
      if (firstName) profileDoc.firstName = firstName;
      if (middleName !== undefined) profileDoc.middleName = middleName || "";
      if (lastName) profileDoc.lastName = lastName;
      if (gender) profileDoc.gender = gender;
      if (dateOfBirth) profileDoc.dateOfBirth = new Date(dateOfBirth);
      if (cityOfResidence) profileDoc.cityOfResidence = cityOfResidence;
      if (phoneNumber) profileDoc.phoneNumber = phoneNumber;
      if (notificationLanguage) profileDoc.notificationLanguage = notificationLanguage;

      // Handle role-specific fields
      if (user.role === "content_manager") {
        // Parse and update canManage for content managers (with fallback to contentSpecialties)
        const managementField = canManage || contentSpecialties;
        if (managementField !== undefined) {
          let specialtiesList = [];
          if (managementField) {
            if (Array.isArray(managementField)) {
              specialtiesList = managementField.map((s) => s.trim()).filter((s) => s);
            } else if (typeof managementField === "string") {
              try {
                const parsed = JSON.parse(managementField);
                if (Array.isArray(parsed)) {
                  specialtiesList = parsed.map((s) => s.trim()).filter((s) => s);
                }
              } catch {
                specialtiesList = managementField
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s);
              }
            }
          }
          profileDoc.canManage = specialtiesList;
        }
      } else {
        if (comments !== undefined) profileDoc.comments = comments || "";
      }
    }

    // --- Handle Profile Picture using GridFS ---
    if (req.file) {
      const gfs = getGfs();

      // Delete old profile picture if exists
      const oldProfileImageField = user.role === "super_admin" ? "profileImage" :
                                 user.role === "content_manager" ? "profileImage" : "profilePicture";

      if (profileDoc[oldProfileImageField]) {
        const oldId = profileDoc[oldProfileImageField];
        try {
          await gfs.delete(new mongoose.Types.ObjectId(oldId));
        } catch (err) {
        }
      }

      // Upload new file
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);

      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });

      // Assign file ID depending on schema
      if (user.role === "super_admin" || user.role === "content_manager") {
        profileDoc.profileImage = fileId;
      } else {
        profileDoc.profilePicture = fileId;
      }
    }

    await profileDoc.save();

    // Mark profile as completed and update notification language
    user.profileCompleted = true;
    if (notificationLanguage) {
      user.notificationLanguage = notificationLanguage;
    }
    await user.save();

    // --- Retrieve picture from GridFS (base64) ---
    let profilePicture = null;
    const fileId = user.role === "super_admin" || user.role === "content_manager"
      ? profileDoc.profileImage
      : profileDoc.profilePicture;

    if (fileId) {
      try {
        const gfs = getGfs();
        const file = await gfs
          .find({ _id: new mongoose.Types.ObjectId(fileId) })
          .toArray();

        if (file.length > 0) {
          const readStream = gfs.openDownloadStream(file[0]._id);
          const chunks = [];
          profilePicture = await new Promise((resolve, reject) => {
            readStream.on("data", (chunk) => chunks.push(chunk));
            readStream.on("end", () =>
              resolve(
                `data:${file[0].contentType};base64,${Buffer.concat(chunks).toString("base64")}`
              )
            );
            readStream.on("error", reject);
          });
        }
      } catch (err) {
      }
    }

    // --- Final unified response ---
    const responseData = {
      email: profileDoc.email,
      role: user.role,
      profileCompleted: user.profileCompleted,
      firstName: profileDoc.firstName,
      middleName: profileDoc.middleName,
      lastName: profileDoc.lastName,
      phoneNumber: profileDoc.phoneNumber,
      gender: profileDoc.gender,
      dateOfBirth: profileDoc.dateOfBirth,
      cityOfResidence: profileDoc.cityOfResidence,
      profilePicture,
    };

    // Add role-specific fields to response
    if (user.role === "content_manager") {
      responseData.contentSpecialties = profileDoc.contentSpecialties || [];
    } else {
      responseData.comments = profileDoc.comments || "";
    }

    res.status(200).json({
      user: responseData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Change Password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    // Save updated password
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("changePassword error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getProfile,
  updateOrCreateProfile,
  changePassword,
};
