const express = require("express");
const auth = require("../middleware/auth");
const multer = require("multer");
const validateUpload = require("../middleware/validateUpload");
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
router.post("/", auth, upload.single("profileImage"), validateUpload(["image"]), createSuperAdmin);
router.put("/:id", auth, upload.single("profileImage"), validateUpload(["image"]), updateSuperAdmin);
router.delete("/:id", auth,
  (req, res, next) => {
    if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Access denied' });
    next();
  },
  deleteSuperAdmin);

module.exports = router;
