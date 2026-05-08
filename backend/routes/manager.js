const express = require("express");
const auth = require("../middleware/auth");
const multer = require("multer");
const router = express.Router();

const {
  managerSignIn,
  forgotPassword,
  resetPassword,
  refreshToken,
  validateToken,
  getManagers,
  getManagersData,
  createManager,
  updateManager,
  deleteManager,
} = require("../controllers/managerController");
const {
  assistantSignIn,
  assistantLogout,
  refreshAuthToken,
} = require("../controllers/authController");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Auth routes
router.post("/manager-signin", managerSignIn);
router.post("/assistant-signin", assistantSignIn);
router.post("/assistant-logout", assistantLogout);
router.post("/refresh", refreshAuthToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh-token", refreshToken);
router.get("/validate", auth, validateToken);

// Manager CRUD routes
router.get("/", auth, getManagers);
router.get("/managers-data", auth, getManagersData);
router.post("/", auth, upload.single("profileImage"), createManager);
router.put("/:id", auth, upload.single("profileImage"), updateManager);
router.delete("/:id", auth, deleteManager);

module.exports = router;
