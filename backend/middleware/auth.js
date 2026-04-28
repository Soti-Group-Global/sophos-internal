const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer <token>) or legacy x-auth-token
    const authHeader = req.header('Authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;
    const legacyToken = req.header('x-auth-token');
    const token = bearerToken || legacyToken;

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token validity
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If token type exists, ensure it's an access token (backward compatible)
    if (decoded.type && decoded.type !== "access") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    // Backward compatibility: support multiple token payload shapes
    const decodedUserId = decoded?.id || decoded?.userId || decoded?._id;

    // Ensure user still exists
    let user = null;
    if (decodedUserId) {
      user = await User.findById(decodedUserId);
    }

    // Fallback to email lookup for older tokens without id
    if (!user && decoded?.email) {
      user = await User.findOne({ email: decoded.email });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found, authorization denied' });
    }

    // Attach verified user info to request
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      profileCompleted: user.profileCompleted,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired, please log in again' });
    }
    res.status(401).json({ message: 'Token is not valid' });
  }
};
