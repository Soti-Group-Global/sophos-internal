const jwt = require("jsonwebtoken");
const DoctorsProfile = require("../models/DoctorsProfile");
const Assistant = require("../models/Assistant");
const HeadAssistant = require("../models/HeadAssistant");
const User = require("../models/User");
const {
  normalizeEmail,
  createAccessToken,
  createRefreshToken,
  validateUserCredentials,
} = require("../utils/authUtils");
const { setStaffAuthCookies, clearStaffAuthCookies } = require("../utils/cookieUtils");

const doctorSignIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, user, accessToken, refreshToken } =
      await validateUserCredentials({
        email,
        password,
        allowedRoles: ["doctor", "head_doctor", "specialist"],
        invalidRoleMessage: "Invalid credentials or not a doctor role",
        invalidCredentialsStatus: 401,
      });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const normalizedEmail = normalizeEmail(email);
    const doctorProfile = await DoctorsProfile.findOne({ email: normalizedEmail });

    setStaffAuthCookies(res, accessToken, refreshToken);
    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted || false,
        doctorProfileId: doctorProfile?._id || null,
        firstName: doctorProfile?.firstName || null,
        middleName: doctorProfile?.middleName || null,
        lastName: doctorProfile?.lastName || null,
        profileFileId: doctorProfile?.profileFileId || null,
        phoneNumber: doctorProfile?.phoneNumber || null,
        position: doctorProfile?.position || null,
        gender: doctorProfile?.gender || null,
      },
    });
  } catch (error) {
    console.error("doctorSignIn error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

const assistantSignIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, user, accessToken, refreshToken } =
      await validateUserCredentials({
        email,
        password,
        allowedRoles: ["assistant", "head_assistant"],
        invalidRoleMessage: "Invalid credentials or not an assistant role",
        invalidCredentialsStatus: 401,
      });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const normalizedEmail = normalizeEmail(email);
    const isHeadAssistant = user.role === "head_assistant";
    const assistantProfile = isHeadAssistant
      ? await HeadAssistant.findOne({ email: normalizedEmail })
      : await Assistant.findOne({ email: normalizedEmail });

    setStaffAuthCookies(res, accessToken, refreshToken);
    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted || false,
        assistantProfileId: assistantProfile?._id || null,
        firstName: assistantProfile?.firstName || null,
        middleName: assistantProfile?.middleName || null,
        lastName: assistantProfile?.lastName || null,
        profileFileId: assistantProfile?.profileFileId || null,
        phoneNumber: assistantProfile?.phoneNumber || null,
        specialty: assistantProfile?.specialty || null,
        branches: assistantProfile?.branches || [],
        notificationLanguage: assistantProfile?.notificationLanguage || user.notificationLanguage || "en",
      },
    });
  } catch (error) {
    console.error("assistantSignIn error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

const refreshAuthToken = async (req, res) => {
  try {
    // Also accept the old cookie name during migration (role check below still blocks manager tokens)
    const refreshTokenValue =
      req.cookies?.staff_refresh_token || req.cookies?.refresh_token ||
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

    if (!["assistant", "head_assistant", "doctor", "head_doctor", "specialist"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);
    setStaffAuthCookies(res, newAccessToken, newRefreshToken);
    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

const doctorLogout = async (req, res) => {
  clearStaffAuthCookies(res);
  return res.status(200).json({ success: true });
};

const assistantLogout = async (req, res) => {
  clearStaffAuthCookies(res);
  return res.status(200).json({ success: true });
};

module.exports = {
  doctorSignIn,
  assistantSignIn,
  refreshAuthToken,
  doctorLogout,
  assistantLogout,
};
