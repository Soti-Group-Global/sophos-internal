const express = require("express");
const router  = express.Router();

const {
  getAvailableDays,
  getAvailableSlots,
  getWeeklySchedule,
  saveWeeklySchedule,
  getDateOverride,
  saveDateOverride,
  deleteDateOverride,
  getDayClosure,
  closeDaySchedule,
  reopenDaySchedule,
} = require("../controllers/doctorAvailabilityController");

/**
 * GET /api/doctor-availability
 *   Returns available calendar dates within a month.
 *
 *   Query params:
 *     month       {number}  1–12  (required)
 *     year        {number}        (required)
 *     doctorEmail {string}        (use this OR specialtyId)
 *     specialtyId {string}        (ObjectId or name substring; use this OR doctorEmail)
 *
 *   Examples:
 *     /api/doctor-availability?month=6&year=2026&doctorEmail=dr@clinic.com
 *     /api/doctor-availability?month=6&year=2026&specialtyId=<ObjectId>
 */
router.get("/", getAvailableDays);

/**
 * GET /api/doctor-availability/slots
 *   Returns available time slots for a specific date.
 *
 *   Query params:
 *     date          {string}  "YYYY-MM-DD"  (required)
 *     doctorEmail   {string}                (use this OR specialtyId)
 *     specialtyId   {string}                (ObjectId or name substring)
 *     slotDuration  {number}  minutes       (optional, default 30)
 *
 *   Examples:
 *     /api/doctor-availability/slots?date=2026-06-03&doctorEmail=dr@clinic.com
 *     /api/doctor-availability/slots?date=2026-06-03&specialtyId=<ObjectId>&slotDuration=15
 */
router.get("/slots", getAvailableSlots);

router.get("/weekly-schedule/:email", getWeeklySchedule);
router.post("/weekly-schedule", saveWeeklySchedule);
router.get("/date-override/:email/:date", getDateOverride);
router.post("/date-override", saveDateOverride);
router.delete("/date-override/:email/:date", deleteDateOverride);
router.get("/day-closure/:email", getDayClosure);
router.post("/day-closure", closeDaySchedule);
router.delete("/day-closure/:email", reopenDaySchedule);

module.exports = router;
