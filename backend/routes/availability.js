const express = require("express");
const auth = require("../middleware/auth");
const {
  createAvailability,
  getAvailability,
  deleteAvailability,
  getCalendarApplications,
} = require("../controllers/availabilityController");
const router = express.Router();

router.post("/availability", auth, createAvailability);
router.get("/availability", auth, getAvailability);
router.delete("/availability/:id", auth, deleteAvailability);
router.get("/calender", auth, getCalendarApplications);

module.exports = router;
