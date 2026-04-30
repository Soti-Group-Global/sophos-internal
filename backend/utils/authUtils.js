const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const normalizeEmail = (email) => (email || "").toLowerCase().trim();

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

const validateUserCredentials = async ({
  email,
  password,
  allowedRoles,
  invalidRoleMessage,
  invalidCredentialsStatus = 401,
}) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return {
      error: {
        status: 400,
        message: "Email and password are required",
      },
    };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return {
      error: {
        status: invalidCredentialsStatus,
        message: "Invalid credentials",
      },
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      error: {
        status: 403,
        message: invalidRoleMessage || "Access denied",
      },
    };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return {
      error: {
        status: invalidCredentialsStatus,
        message: "Invalid credentials",
      },
    };
  }

  return {
    user,
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
  };
};

module.exports = {
  normalizeEmail,
  createAccessToken,
  createRefreshToken,
  validateUserCredentials,
};
