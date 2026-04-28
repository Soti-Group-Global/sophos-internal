const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createDoctorLeave,
  getDoctorLeaves,
  getDoctorLeaveById,
  updateDoctorLeaveStatus,
  deleteDoctorLeave,
} = require("../controllers/doctorLeaveController");

// POST /api/doctor-leaves — create a leave (admin-issued or self-requested)
router.post("/", auth, createDoctorLeave);

// GET /api/doctor-leaves?doctorEmail=&status=&from=&to=
router.get("/", auth, getDoctorLeaves);

// GET /api/doctor-leaves/:id
router.get("/:id", auth, getDoctorLeaveById);

// PATCH /api/doctor-leaves/:id/status — approve / reject / cancel
router.patch("/:id/status", auth, updateDoctorLeaveStatus);

// DELETE /api/doctor-leaves/:id
router.delete("/:id", auth, deleteDoctorLeave);

module.exports = router;
