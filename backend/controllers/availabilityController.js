const Availability = require("../models/Availability");
const Application = require("../models/Application");
const Patient = require("../models/Patient");
const DoctorsProfile = require("../models/DoctorsProfile");

// Helper function to extract multilingual field value
const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};

// Post availability for a specific doctor
const createAvailability = async (req, res) => {
  try {
    const { doctorEmail, start, end, status, notes } = req.body;
    if (!doctorEmail || !start || !end || !status) {
      return res
        .status(400)
        .json({ message: "doctorEmail, start, end, and status are required" });
    }
    const newSlot = new Availability({
      doctorEmail: doctorEmail.toLowerCase(),
      start: new Date(start),
      end: new Date(end),
      status,
      notes: notes || "",
    });
    await newSlot.save();
    res.status(201).json({ message: "Availability saved", slot: newSlot });
  } catch (err) {
    res.status(500).json({ message: "Server error saving availability" });
  }
};

// Get availability within date range for a specific doctor
const getAvailability = async (req, res) => {
  try {
    const { doctorEmail, start, end } = req.query;

    if (!doctorEmail || !start || !end) {
      return res.status(400).json({
        message: "Missing required parameters: doctorEmail, start, or end",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doctorEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res
        .status(400)
        .json({ message: "Invalid date format for start or end" });
    }

    // Ensure endDate includes the entire day
    endDate.setHours(23, 59, 59, 999);

    const slots = await Availability.find({
      doctorEmail: doctorEmail.toLowerCase(),
      start: { $lte: endDate },
      end: { $gte: startDate },
    });

    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: "Server error retrieving availability." });
  }
};

// Delete availability slot
const deleteAvailability = async (req, res) => {
  try {
    const { doctorEmail } = req.query;
    if (!doctorEmail) {
      return res
        .status(400)
        .json({ message: "doctorEmail query parameter is required" });
    }
    const slot = await Availability.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: "Availability slot not found" });
    }
    if (slot.doctorEmail !== doctorEmail.toLowerCase()) {
      return res
        .status(400)
        .json({ message: "doctorEmail does not match availability slot" });
    }
    await slot.deleteOne();
    res.json({ message: "Availability slot deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Server error deleting availability slot" });
  }
};

// Get applications for calendar
const getCalendarApplications = async (req, res) => {
  try {
    const { start, end, status, followup, doctorEmail, serviceType, branch } =
      req.query;

    if (!start || !end) {
      return res
        .status(400)
        .json({ message: "Start and End dates are required" });
    }

    const startDateStr = start.slice(0, 10);
    const endDateStr = end.slice(0, 10);

    const query = {
      date: { $gte: startDateStr, $lte: endDateStr },
    };

    // --- Status filter ---
    const validStatuses = [
      "unconfirmed",
      "confirmed",
      "completed",
      "cancelled",
      "awaiting for payment",
    ];

    if (status && validStatuses.includes(status.toLowerCase())) {
      query.appointmentStatus = new RegExp(`^${status}$`, "i");
    }

    // --- Follow-up filter ---
    if (followup === "true") {
      query["followUp.needed"] = true;
    } else if (followup === "false") {
      query["$or"] = [
        { "followUp.needed": { $exists: false } },
        { "followUp.needed": false },
      ];
    }

    // --- Doctor filter ---
    if (doctorEmail && doctorEmail !== "all") {
      query.doctorEmail = doctorEmail;
    }

    // --- Service filter ---
    if (serviceType && serviceType !== "all") {
      query.serviceType = serviceType;
    }

    if (branch && branch !== "All") {
      const branchCondition = {
        $or: [
          { appointmentMode: "Online" },
          {
            $and: [
              { appointmentMode: "Offline" },
              {
                branch: {
                  $exists: true,
                  $regex: `^${branch}$`,
                  $options: "i",
                },
              },
            ],
          },
        ],
      };
      query.$and = [...(query.$and || []), branchCondition];
    }

    // --- Fetch base applications ---
    const applications = await Application.find(query)
      .sort({ startTime: 1 })
      .lean();

    const results = [];

    for (const app of applications) {
      const [patient, doctorProfile] = await Promise.all([
        Patient.findOne({ email: app.patientEmail })
          .select("firstName middleName lastName")
          .lean(),
        DoctorsProfile.findOne({ email: app.doctorEmail })
          .select("firstName middleName lastName notificationLanguage")
          .lean(),
      ]);

      const patientName = patient
        ? `${patient.lastName || ""} ${patient.firstName || ""} ${patient.middleName || ""}
          `.trim()
        : app.patientEmail;

      const lang = doctorProfile?.notificationLanguage || 'en';
      const doctorName = doctorProfile
        ? `${getFieldValue(doctorProfile.firstName, lang)} ${getFieldValue(doctorProfile.middleName, lang)} ${getFieldValue(doctorProfile.lastName, lang)}`.trim()
        : app.doctorEmail;

      results.push({
        applicationId: app.applicationId || app._id,
        date: app.date,
        startTime: app.startTime,
        endTime: app.endTime,
        serviceType: app.serviceType || "",
        appointmentStatus: app.appointmentStatus,
        appointmentMode: app.appointmentMode,
        branch: app.branch || null,
        isFollowUp: false,
        patientName,
        doctorName,
        followUpApplicationId: app.followUp?.applicationId || null,
      });

      // --- Add follow-up application if booked ---
      if (
        app.followUp?.needed &&
        app.followUp.booked &&
        app.followUp.applicationId
      ) {
        const followUpApp = await Application.findOne({
          applicationId: app.followUp.applicationId,
        }).lean();

        if (followUpApp) {
          const [followUpPatient, followUpDoctorProfile] = await Promise.all([
            Patient.findOne({ email: followUpApp.patientEmail })
              .select("firstName middleName lastName")
              .lean(),
            DoctorsProfile.findOne({ email: followUpApp.doctorEmail })
              .select("firstName middleName lastName notificationLanguage")
              .lean(),
          ]);

          const followUpPatientName = followUpPatient
            ? `${followUpPatient.lastName || ""} ${followUpPatient.firstName || ""} ${followUpPatient.middleName || ""}
              `.trim()
            : followUpApp.patientEmail;

          const followUpLang = followUpDoctorProfile?.notificationLanguage || 'en';
          const followUpDoctorName = followUpDoctorProfile
            ? `${getFieldValue(followUpDoctorProfile.firstName, followUpLang)} ${getFieldValue(followUpDoctorProfile.middleName, followUpLang)} ${getFieldValue(followUpDoctorProfile.lastName, followUpLang)}`.trim()
            : followUpApp.doctorEmail;

          results.push({
            applicationId: followUpApp.applicationId || followUpApp._id,
            date: followUpApp.date,
            startTime: followUpApp.startTime,
            endTime: followUpApp.endTime,
            serviceType: followUpApp.serviceType || "",
            appointmentStatus: followUpApp.appointmentStatus,
            appointmentMode: followUpApp.appointmentMode,
            branch: followUpApp.branch || null,
            isFollowUp: true,
            parentApplicationId: app.applicationId,
            patientName: followUpPatientName,
            doctorName: followUpDoctorName,
            followUpComment: app.followUp.comment || "",
          });
        }
      }
    }

    // --- Final followup filter ---
    let filteredResults = results;
    if (followup === "true") {
      filteredResults = results.filter((r) => r.isFollowUp);
    } else if (followup === "false") {
      filteredResults = results.filter((r) => !r.isFollowUp);
    }

    res.json({ applications: filteredResults });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createAvailability,
  getAvailability,
  deleteAvailability,
  getCalendarApplications,
};
