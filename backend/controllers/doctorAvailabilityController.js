/**
 * Doctor Availability Controller
 *
 * GET /api/doctor-availability
 *   → Returns available dates for a month
 *   Query: month (1-12), year, doctorEmail? OR specialtyId?
 *
 * GET /api/doctor-availability/slots
 *   → Returns available time slots for a specific date
 *   Query: doctorEmail, date (YYYY-MM-DD), slotDuration? (minutes, default 30)
 */

const mongoose = require("mongoose");
const DoctorsProfile    = require("../models/DoctorsProfile");
const DoctorWeeklySchedule = require("../models/DoctorWeeklySchedule");
const DoctorLeave       = require("../models/DoctorLeave");
const DoctorBreak       = require("../models/DoctorBreak");
const DoctorDateOverride = require("../models/DoctorDateOverride");
const DoctorDayClosure  = require("../models/DoctorDayClosure");
const NewAppointment    = require("../models/Application");
const SpecialtyMaster   = require("../models/SpecialtyMaster");

// ── Utilities ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/** Date → "YYYY-MM-DD" */
const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

/** "HH:MM" → minutes from midnight */
const toMins = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** minutes → "HH:MM" */
const fromMins = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2,"0")}:${String(mins % 60).padStart(2,"0")}`;

/** Doctor display name from profile doc */
const doctorName = (doc) => ({
  en: [doc.firstName?.en, doc.middleName?.en, doc.lastName?.en].filter(Boolean).join(" ").trim(),
  ru: [doc.firstName?.ru, doc.middleName?.ru, doc.lastName?.ru].filter(Boolean).join(" ").trim(),
});

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Build schedule lookup: { email: { DayName: { isDayOff, slots[] } } }
 * Falls back to DEFAULT_SCHEDULE for any doctor who has no saved schedule.
 */
async function buildScheduleMap(emails) {
  const docs = await DoctorWeeklySchedule.find({ doctorEmail: { $in: emails } }).lean();
  const map = {};
  for (const sd of docs) {
    const byDay = {};
    for (const d of (sd.schedule || [])) byDay[d.day] = d;
    map[sd.doctorEmail] = byDay;
  }
  // For doctors with no saved schedule, fall back to the default (Mon–Fri 09:00–18:00)
  const defaultByDay = {};
  for (const d of DoctorWeeklySchedule.DEFAULT_SCHEDULE) defaultByDay[d.day] = d;
  for (const email of emails) {
    if (!map[email]) map[email] = defaultByDay;
  }
  return map;
}

/**
 * Does the doctor have an approved leave on this date?
 */
function isOnLeave(dateStr, leaves) {
  return leaves.some(
    (l) => l.status === "Approved" && dateStr >= l.startDate && dateStr <= l.endDate
  );
}

/**
 * Get available date strings for one doctor within a month.
 * scheduleByDay:   { Monday: { isDayOff, slots[] }, ... }
 * breaksForMonth:  DoctorBreak[] records covering any part of the month
 */
function availableDatesForDoctor(scheduleByDay, leaves, breaksForMonth, year, month, dateOverrides = []) {
  const result = [];
  const daysInMonth = new Date(year, month, 0).getDate(); // last calendar day

  // Build override lookup by date
  const overrideMap = {};
  for (const ov of dateOverrides) overrideMap[ov.date] = ov;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dateStr = toDateStr(d);
    const dayName = DAY_NAMES[d.getDay()];

    // On approved leave → skip
    if (isOnLeave(dateStr, leaves)) continue;

    // Check for a date override first
    const override = overrideMap[dateStr];
    if (override) {
      if (override.isDayOff) continue;
      const hasWork = (override.slots || []).some((s) => s.type === "working");
      if (!hasWork) continue;
      // Use override slots for generating free slots
      const overrideScheduleByDay = { [dayName]: { isDayOff: false, slots: override.slots } };
      const dateBreaks = (breaksForMonth || []).filter((b) => dateStr >= b.startDate && dateStr <= b.endDate);
      const freeSlots = generateSlots(overrideScheduleByDay, dateStr, dateBreaks, [], 30);
      if (freeSlots.length > 0) result.push(dateStr);
      continue;
    }

    const daySched = scheduleByDay?.[dayName];

    // No schedule saved → skip; day is off → skip
    if (!daySched || daySched.isDayOff) continue;

    // Must have at least one working-type slot in weekly schedule
    const hasWork = (daySched.slots || []).some((s) => s.type === "working");
    if (!hasWork) continue;

    // Filter DoctorBreak records that overlap this specific date
    const dateBreaks = (breaksForMonth || []).filter(
      (b) => dateStr >= b.startDate && dateStr <= b.endDate
    );

    // Generate actual slots (accounting for schedule breaks + specific date breaks)
    // If zero slots remain the day is fully blocked — don't mark as available
    const freeSlots = generateSlots(scheduleByDay, dateStr, dateBreaks, [], 30);
    if (freeSlots.length === 0) continue;

    result.push(dateStr);
  }
  return result;
}

// Each appointment occupies this many minutes regardless of display slot size
const APPOINTMENT_DURATION_MINS = 60;

/**
 * Generate available time slots for a doctor on one date.
 * @param {object}   scheduleByDay  - from buildScheduleMap
 * @param {string}   dateStr        - "YYYY-MM-DD"
 * @param {object[]} breaksForDate  - DoctorBreak records for that date
 * @param {string[]} bookedTimes    - startTime strings of existing appointments
 * @param {number}   slotMins       - display slot size in minutes (default 30)
 */
function generateSlots(scheduleByDay, dateStr, breaksForDate, bookedTimes, slotMins = 30, apptDurationMins = APPOINTMENT_DURATION_MINS) {
  const dayName = DAY_NAMES[new Date(dateStr + "T00:00:00").getDay()];
  const daySched = scheduleByDay?.[dayName];

  if (!daySched || daySched.isDayOff) return [];

  // Blocked intervals (break windows)
  const blocked = [];

  // 1) Weekly-schedule break slots
  for (const slot of (daySched.slots || [])) {
    if (slot.type === "break") {
      blocked.push({ start: toMins(slot.startTime), end: toMins(slot.endTime) });
    }
  }

  // 2) DoctorBreak records for this date
  for (const b of breaksForDate) {
    if (b.startTime && b.endTime) {
      blocked.push({ start: toMins(b.startTime), end: toMins(b.endTime) });
    }
  }

  // 3) Already-booked appointments — each occupies APPOINTMENT_DURATION_MINS from its startTime.
  //    Any display slot that overlaps that window is blocked.
  //    e.g. booking at 09:00 (60 min) blocks both 09:00–09:30 AND 09:30–10:00.
  const bookedIntervals = bookedTimes.map((t) => ({
    start: toMins(t),
    end:   toMins(t) + apptDurationMins,
  }));

  const slots = [];

  for (const slot of (daySched.slots || [])) {
    if (slot.type !== "working") continue;
    const workStart = toMins(slot.startTime);
    const workEnd   = toMins(slot.endTime);

    for (let m = workStart; m + slotMins <= workEnd; m += slotMins) {
      const slotEnd = m + slotMins;

      // Overlaps any break window?
      if (blocked.some((b) => m < b.end && slotEnd > b.start)) continue;

      // Overlaps any booked appointment window?
      if (bookedIntervals.some((b) => m < b.end && slotEnd > b.start)) continue;

      slots.push({
        startTime: fromMins(m),
        endTime:   fromMins(slotEnd),
      });
    }
  }

  return slots;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/doctor-availability
 *
 * Returns available calendar dates within a month.
 *
 * Query params:
 *   month        {number}  1–12 (required)
 *   year         {number}  (required)
 *   doctorEmail  {string}  (optional — use this OR specialtyId)
 *   specialtyId  {string}  (optional — ObjectId or name string)
 *
 * Response variants:
 *   • doctorEmail → single doctor's available dates
 *   • specialtyId → all doctors in that specialty, each with their available dates
 */
exports.getAvailableDays = async (req, res) => {
  try {
    const { month, year, doctorEmail, doctorId, specialtyId } = req.query;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: "month and year are required" });
    }

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (isNaN(m) || m < 1 || m > 12 || isNaN(y)) {
      return res.status(400).json({ success: false, message: "Invalid month or year" });
    }

    const monthStartStr = `${y}-${String(m).padStart(2,"0")}-01`;
    const monthEndStr   = toDateStr(new Date(y, m, 0)); // last day of month

    // ── Case A: single doctor ─────────────────────────────────────────────────
    if (doctorEmail || doctorId) {
      const query = doctorId && mongoose.Types.ObjectId.isValid(doctorId)
        ? { _id: doctorId }
        : { email: doctorEmail.toLowerCase().trim() };
      const resolvedEmail = doctorEmail ? doctorEmail.toLowerCase().trim() : null;
      // Resolve email from ID if only doctorId was given
      let email = resolvedEmail;
      if (!email) {
        const idDoc = await DoctorsProfile.findOne(query).select("email").lean();
        if (!idDoc) return res.status(404).json({ success: false, message: "Doctor not found" });
        email = idDoc.email.toLowerCase().trim();
      }

      const [docProfile, schedMap, leaves, monthBreaks, dateOverrides] = await Promise.all([
        DoctorsProfile.findOne({ email }).select("firstName middleName lastName email specialtyIds").lean(),
        buildScheduleMap([email]),
        DoctorLeave.find({ doctorEmail: email, status: "Approved",
          startDate: { $lte: monthEndStr }, endDate: { $gte: monthStartStr } }).lean(),
        DoctorBreak.find({ doctorEmail: email,
          startDate: { $lte: monthEndStr }, endDate: { $gte: monthStartStr } }).lean(),
        DoctorDateOverride.find({ doctorEmail: email, date: { $gte: monthStartStr, $lte: monthEndStr } }).lean(),
      ]);

      if (!docProfile) {
        return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      const availableDates = availableDatesForDoctor(schedMap[email], leaves, monthBreaks, y, m, dateOverrides);

      return res.json({
        success: true,
        month: m,
        year: y,
        doctor: {
          email,
          name: doctorName(docProfile),
          profileId: docProfile._id,
        },
        availableDates,
      });
    }

    // ── Case B: specialty (no specific doctor) ────────────────────────────────
    if (specialtyId) {
      // Resolve specialtyId — can be ObjectId or name substring
      let specialtyDoc = null;
      if (mongoose.Types.ObjectId.isValid(specialtyId)) {
        specialtyDoc = await SpecialtyMaster.findById(specialtyId).lean();
      } else {
        specialtyDoc = await SpecialtyMaster.findOne({
          $or: [
            { name_en: { $regex: specialtyId, $options: "i" } },
            { name_ru: { $regex: specialtyId, $options: "i" } },
          ],
        }).lean();
      }

      if (!specialtyDoc) {
        return res.status(404).json({ success: false, message: "Specialty not found" });
      }

      // Find all doctors with this specialty
      const doctors = await DoctorsProfile.find({ specialtyIds: specialtyDoc._id })
        .select("firstName middleName lastName email specialtyIds")
        .lean();

      if (!doctors.length) {
        return res.json({
          success: true,
          month: m,
          year: y,
          specialty: { id: specialtyDoc._id, name_en: specialtyDoc.name_en, name_ru: specialtyDoc.name_ru },
          doctors: [],
        });
      }

      const emails = doctors.map((d) => d.email.toLowerCase().trim());

      // Fetch all schedules, leaves, breaks, and date overrides in parallel
      const [schedMap, allLeaves, allMonthBreaks, allDateOverrides] = await Promise.all([
        buildScheduleMap(emails),
        DoctorLeave.find({
          doctorEmail: { $in: emails },
          status: "Approved",
          startDate: { $lte: monthEndStr },
          endDate: { $gte: monthStartStr },
        }).lean(),
        DoctorBreak.find({
          doctorEmail: { $in: emails },
          startDate: { $lte: monthEndStr },
          endDate: { $gte: monthStartStr },
        }).lean(),
        DoctorDateOverride.find({
          doctorEmail: { $in: emails },
          date: { $gte: monthStartStr, $lte: monthEndStr },
        }).lean(),
      ]);

      // Group leaves by doctor
      const leavesByEmail = {};
      for (const l of allLeaves) {
        if (!leavesByEmail[l.doctorEmail]) leavesByEmail[l.doctorEmail] = [];
        leavesByEmail[l.doctorEmail].push(l);
      }

      // Group breaks by doctor
      const breaksByEmailMonth = {};
      for (const b of allMonthBreaks) {
        if (!breaksByEmailMonth[b.doctorEmail]) breaksByEmailMonth[b.doctorEmail] = [];
        breaksByEmailMonth[b.doctorEmail].push(b);
      }

      // Group date overrides by doctor
      const overridesByEmail = {};
      for (const ov of allDateOverrides) {
        if (!overridesByEmail[ov.doctorEmail]) overridesByEmail[ov.doctorEmail] = [];
        overridesByEmail[ov.doctorEmail].push(ov);
      }

      const doctorResults = doctors.map((doc) => {
        const email = doc.email.toLowerCase().trim();
        const availableDates = availableDatesForDoctor(
          schedMap[email],
          leavesByEmail[email] || [],
          breaksByEmailMonth[email] || [],
          y, m,
          overridesByEmail[email] || []
        );
        return {
          email,
          name: doctorName(doc),
          profileId: doc._id,
          availableDates,
        };
      }).filter((d) => d.availableDates.length > 0); // only include doctors who have at least one free day

      return res.json({
        success: true,
        month: m,
        year: y,
        specialty: { id: specialtyDoc._id, name_en: specialtyDoc.name_en, name_ru: specialtyDoc.name_ru },
        doctors: doctorResults,
      });
    }

    return res.status(400).json({ success: false, message: "Either doctorEmail, doctorId, or specialtyId is required" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/doctor-availability/slots
 *
 * Returns available time slots for a specific doctor on a specific date.
 * Also accepts specialtyId to return slots for all available doctors in that
 * specialty on the given date (when no doctorEmail is specified).
 *
 * Query params:
 *   doctorEmail   {string}  (optional if specialtyId given)
 *   specialtyId   {string}  (optional if doctorEmail given)
 *   date          {string}  "YYYY-MM-DD" (required)
 *   slotDuration  {number}  minutes per slot (optional, default 30)
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorEmail, doctorId, specialtyId, date, slotDuration, appointmentDuration } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: "date is required (YYYY-MM-DD)" });
    }

    const slotMins        = parseInt(slotDuration, 10)        || 30;
    const apptDurationMins = parseInt(appointmentDuration, 10) || APPOINTMENT_DURATION_MINS;

    // ── Resolve doctor list ───────────────────────────────────────────────────
    let doctors = [];

    if (doctorEmail || doctorId) {
      const query = doctorId && mongoose.Types.ObjectId.isValid(doctorId)
        ? { _id: doctorId }
        : { email: doctorEmail.toLowerCase().trim() };
      const doc = await DoctorsProfile.findOne(query)
        .select("firstName middleName lastName email specialtyIds")
        .lean();
      if (!doc) return res.status(404).json({ success: false, message: "Doctor not found" });
      doctors = [doc];
    } else if (specialtyId) {
      let specialtyDoc = null;
      if (mongoose.Types.ObjectId.isValid(specialtyId)) {
        specialtyDoc = await SpecialtyMaster.findById(specialtyId).lean();
      } else {
        specialtyDoc = await SpecialtyMaster.findOne({
          $or: [
            { name_en: { $regex: specialtyId, $options: "i" } },
            { name_ru: { $regex: specialtyId, $options: "i" } },
          ],
        }).lean();
      }
      if (!specialtyDoc) return res.status(404).json({ success: false, message: "Specialty not found" });

      doctors = await DoctorsProfile.find({ specialtyIds: specialtyDoc._id })
        .select("firstName middleName lastName email specialtyIds")
        .lean();
    } else {
      return res.status(400).json({ success: false, message: "Either doctorEmail, doctorId, or specialtyId is required" });
    }

    if (!doctors.length) {
      return res.json({ success: true, date, slots: [] });
    }

    const emails = doctors.map((d) => d.email.toLowerCase().trim());
    const dateStart = new Date(date + "T00:00:00");
    const dateEnd   = new Date(date + "T23:59:59");

    // Fetch schedule, leaves, breaks, date overrides, and appointments for all doctors on this date
    const [schedMap, leaves, breakDocs, dateOverrideDocs, appointments] = await Promise.all([
      buildScheduleMap(emails),

      DoctorLeave.find({
        doctorEmail: { $in: emails },
        status: "Approved",
        startDate: { $lte: date },
        endDate:   { $gte: date },
      }).lean(),

      DoctorBreak.find({
        doctorEmail: { $in: emails },
        startDate: { $lte: date },
        endDate:   { $gte: date },
      }).lean(),

      DoctorDateOverride.find({
        doctorEmail: { $in: emails },
        date,
      }).lean(),

      NewAppointment.find({
        doctorProfile: { $in: doctors.map((d) => d._id) },
        date: { $gte: dateStart, $lte: dateEnd },
        appointmentStatus: { $nin: ["cancelled"] },
      }).select("doctorProfile startTime").lean(),
    ]);

    // Build date override lookup by email
    const overrideByEmail = {};
    for (const ov of dateOverrideDocs) overrideByEmail[ov.doctorEmail] = ov;

    // Group leaves by email
    const leavesByEmail = {};
    for (const l of leaves) {
      if (!leavesByEmail[l.doctorEmail]) leavesByEmail[l.doctorEmail] = [];
      leavesByEmail[l.doctorEmail].push(l);
    }

    // Group breaks by email (normalise — a break spans startDate→endDate)
    const breaksByEmail = {};
    for (const b of breakDocs) {
      // Only include if this specific date falls within the break range
      if (date >= b.startDate && date <= b.endDate) {
        if (!breaksByEmail[b.doctorEmail]) breaksByEmail[b.doctorEmail] = [];
        breaksByEmail[b.doctorEmail].push(b);
      }
    }

    // Build profileId → email map for appointments
    const profileIdToEmail = {};
    for (const doc of doctors) profileIdToEmail[String(doc._id)] = doc.email.toLowerCase().trim();

    // Group booked start-times by email
    const bookedByEmail = {};
    for (const appt of appointments) {
      const em = profileIdToEmail[String(appt.doctorProfile)];
      if (!em) continue;
      if (!bookedByEmail[em]) bookedByEmail[em] = [];
      bookedByEmail[em].push(appt.startTime);
    }

    // ── If single doctor → return simple slot list ────────────────────────────
    if (doctorEmail || doctorId) {
      const email = doctors[0].email.toLowerCase().trim();

      if (isOnLeave(date, leavesByEmail[email] || [])) {
        return res.json({ success: true, date, doctorEmail: email, slots: [], reason: "leave" });
      }

      // If there's a date override, use it instead of the weekly schedule
      const override = overrideByEmail[email];
      let effectiveSchedule = schedMap[email];
      if (override) {
        if (override.isDayOff) {
          return res.json({ success: true, date, doctorEmail: email, slots: [], reason: "day_off_override" });
        }
        const dayName = DAY_NAMES[new Date(date + "T00:00:00").getDay()];
        effectiveSchedule = { ...schedMap[email], [dayName]: { isDayOff: false, slots: override.slots } };
      }

      const slots = generateSlots(
        effectiveSchedule,
        date,
        breaksByEmail[email] || [],
        bookedByEmail[email] || [],
        slotMins,
        apptDurationMins
      );

      return res.json({
        success: true,
        date,
        slotDuration: slotMins,
        doctor: {
          email,
          name: doctorName(doctors[0]),
          profileId: doctors[0]._id,
        },
        slots,
      });
    }

    // ── Specialty mode → return slots per available doctor ───────────────────
    const doctorSlots = doctors.map((doc) => {
      const email = doc.email.toLowerCase().trim();

      if (isOnLeave(date, leavesByEmail[email] || [])) {
        return { email, name: doctorName(doc), profileId: doc._id, slots: [], reason: "leave" };
      }

      // If there's a date override, use it instead of the weekly schedule
      const override = overrideByEmail[email];
      let effectiveSchedule = schedMap[email];
      if (override) {
        if (override.isDayOff) {
          return { email, name: doctorName(doc), profileId: doc._id, slots: [], reason: "day_off_override" };
        }
        const dayName = DAY_NAMES[new Date(date + "T00:00:00").getDay()];
        effectiveSchedule = { ...schedMap[email], [dayName]: { isDayOff: false, slots: override.slots } };
      }

      const slots = generateSlots(
        effectiveSchedule,
        date,
        breaksByEmail[email] || [],
        bookedByEmail[email] || [],
        slotMins,
        apptDurationMins
      );

      return { email, name: doctorName(doc), profileId: doc._id, slots };
    }).filter((d) => d.slots.length > 0); // only doctors with at least one free slot

    return res.json({
      success: true,
      date,
      slotDuration: slotMins,
      doctors: doctorSlots,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/doctors/weekly-schedule/:email
exports.getWeeklySchedule = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const doc = await DoctorWeeklySchedule.findOne({ doctorEmail: email }).lean();
    const schedule = doc ? doc.schedule : DoctorWeeklySchedule.DEFAULT_SCHEDULE;
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/doctors/date-override/:email/:date
exports.getDateOverride = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const date  = req.params.date;
    const override = await DoctorDateOverride.findOne({ doctorEmail: email, date }).lean();
    res.json({ success: true, override: override || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/doctor-availability/day-closure/:email
exports.getDayClosure = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const doc = await DoctorDayClosure.findOne({ doctorEmail: email }).lean();
    res.json({ success: true, isClosed: doc ? doc.isClosed : false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/doctor-availability/day-closure  { doctorEmail }
exports.closeDaySchedule = async (req, res) => {
  try {
    const email = (req.body.doctorEmail || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "doctorEmail required" });
    await DoctorDayClosure.findOneAndUpdate(
      { doctorEmail: email },
      { doctorEmail: email, isClosed: true },
      { upsert: true, new: true }
    );
    res.json({ success: true, isClosed: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/doctor-availability/day-closure/:email
exports.reopenDaySchedule = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    await DoctorDayClosure.findOneAndDelete({ doctorEmail: email });
    res.json({ success: true, isClosed: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/doctor-availability/weekly-schedule  { doctorEmail, schedule }
exports.saveWeeklySchedule = async (req, res) => {
  try {
    const email = (req.body.doctorEmail || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "doctorEmail required" });
    const schedule = req.body.schedule;
    if (!Array.isArray(schedule)) return res.status(400).json({ message: "schedule must be an array" });
    const doc = await DoctorWeeklySchedule.findOneAndUpdate(
      { doctorEmail: email },
      { doctorEmail: email, schedule },
      { upsert: true, new: true }
    );
    res.json({ success: true, schedule: doc.schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/doctor-availability/date-override  { doctorEmail, date, isDayOff, slots }
exports.saveDateOverride = async (req, res) => {
  try {
    const email = (req.body.doctorEmail || "").toLowerCase().trim();
    const date  = req.body.date;
    if (!email || !date) return res.status(400).json({ message: "doctorEmail and date required" });
    const override = await DoctorDateOverride.findOneAndUpdate(
      { doctorEmail: email, date },
      { doctorEmail: email, date, isDayOff: !!req.body.isDayOff, slots: req.body.slots || [] },
      { upsert: true, new: true }
    );
    res.json({ success: true, override });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/doctor-availability/date-override/:email/:date
exports.deleteDateOverride = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const date  = req.params.date;
    await DoctorDateOverride.findOneAndDelete({ doctorEmail: email, date });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
