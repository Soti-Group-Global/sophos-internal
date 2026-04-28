const express = require("express");
const auth = require("../middleware/auth");
const multer = require("multer");
const {
  superAdminSignIn,
  validateToken,
  getAllSuperAdmins,
  getSuperAdminsData,
  createSuperAdmin,
  updateSuperAdmin,
  deleteSuperAdmin,
} = require("../controllers/superAdminController");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/superadmin-signin", superAdminSignIn);
router.get("/validate", auth, validateToken);
router.get("/", auth, getAllSuperAdmins);
router.get("/superadmins-data", auth, getSuperAdminsData);
router.post("/", auth, upload.single("profileImage"), createSuperAdmin);
router.put("/:id", auth, upload.single("profileImage"), updateSuperAdmin);
router.delete("/:id", auth, deleteSuperAdmin);

module.exports = router;
