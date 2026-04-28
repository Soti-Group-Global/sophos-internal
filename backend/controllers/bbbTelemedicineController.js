const Application = require("../models/Application");
const Patient = require("../models/Patient");
const DoctorsProfile = require("../models/DoctorsProfile");
const User = require("../models/User");
const bbb = require("../services/bigBlueButonClient");

/**
 * Helper – resolve display name from role + email
 */
const resolveDisplayName = async (email, role) => {
  if (!email) return "Guest";
  const lower = email.toLowerCase();

  let profile = null;
  if (role === "doctor" || role === "head_doctor") {
    profile = await DoctorsProfile.findOne({ email: lower }).lean();
  } else if (role === "patient") {
    profile = await Patient.findOne({ email: lower }).lean();
  }

  if (profile) {
    const getField = (f) => {
      if (!f) return "";
      if (typeof f === "string") return f;
      if (typeof f === "object") return f.en || f.ru || Object.values(f).find((v) => typeof v === "string") || "";
      return "";
    };
    const full = [profile.lastName, profile.firstName, profile.middleName]
      .map(getField)
      .filter(Boolean)
      .join(" ");
    if (full) return full;
  }

  return email.split("@")[0] || "Guest";
};

// ─── Create BBB meeting room for an appointment ────────────────────────
exports.createTelemedicineRoom = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ status: false, message: "Application not found" });

    // Use applicationId as the BBB meeting ID for 1-to-1 mapping
    const roomId = `tele_${applicationId}`;
    const title = `Telemedicine – ${applicationId}`;

    // Get doctor name for welcome message
    const doctorEmail = app.doctors?.[0]?.doctorEmail || app.doctorEmail;
    const doctorName = doctorEmail ? await resolveDisplayName(doctorEmail, "doctor") : "Doctor";

    const result = await bbb.createOrJoinRoom(roomId, title, {
      maxParticipants: 10,
      record: true,
      duration: 0, // unlimited
      muteOnStart: false,
      meetingLayout: "CUSTOM_LAYOUT",
      bannerUrl: "", // no banner for telemedicine
      metadata: {
        appointment_id: applicationId,
        doctor_email: doctorEmail || "",
        patient_email: app.patientEmail || "",
        service_type: app.serviceType || "",
        created_at: new Date().toISOString(),
      },
    });

    if (!result.status) {
      throw new Error(result.message || "Failed to create BBB room");
    }

    // Persist room info in the application's meeting sub-doc
    app.meeting = {
      roomId,
      status: "active",
      startedAt: new Date(),
      createdBy: req.user?.id || null,
      notes: app.meeting?.notes || "",
    };
    await app.save();

    return res.json({
      status: true,
      roomId,
      isNewRoom: result.isNewRoom,
      moderatorPW: result.moderatorPW || result.roomInfo?.moderatorPW,
      attendeePW: result.attendeePW || result.roomInfo?.attendeePW,
      message: result.message,
    });
  } catch (error) {
    console.error("[BBB Telemedicine] createRoom error:", error.message);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─── Join the telemedicine BBB meeting ─────────────────────────────────
exports.joinTelemedicineRoom = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { role, name: bodyName } = req.body || {};

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ status: false, message: "Application not found" });

    const roomId = app.meeting?.roomId || `tele_${applicationId}`;

    // Ensure room exists
    const roomStatus = await bbb.isRoomActive(roomId);
    if (!roomStatus.is_active) {
      // Auto-create room if not running
      const title = `Telemedicine – ${applicationId}`;
      const created = await bbb.createOrJoinRoom(roomId, title, {
        maxParticipants: 10,
        record: true,
        duration: 0,
        meetingLayout: "CUSTOM_LAYOUT",
        bannerUrl: "",
      });
      if (!created.status) throw new Error(created.message || "Failed to create room");

      app.meeting = {
        roomId,
        status: "active",
        startedAt: new Date(),
        createdBy: req.user?.id || null,
        notes: app.meeting?.notes || "",
      };
      await app.save();
    }

    // Resolve who is joining
    const authUser = req.user || {};
    const email = (authUser.email || "").toLowerCase();
    const resolvedRole = role || authUser.role || "patient";
    const isAdmin = ["doctor", "head_doctor", "manager", "head_manager", "super_admin"].includes(resolvedRole);
    const displayName = bodyName || (await resolveDisplayName(email, resolvedRole));

    // Get join URL from BBB
    const tokenResult = await bbb.getJoinToken(roomId, {
      name: displayName,
      userId: authUser.id ? `${resolvedRole}_${authUser.id}` : `${resolvedRole}_${Date.now()}`,
      isAdmin,
    });

    if (!tokenResult.status) {
      throw new Error(tokenResult.msg || "Failed to generate join URL");
    }

    return res.json({
      status: true,
      roomId,
      joinUrl: tokenResult.joinUrl || tokenResult.token,
      role: resolvedRole,
      isAdmin,
      name: displayName,
    });
  } catch (error) {
    console.error("[BBB Telemedicine] joinRoom error:", error.message);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─── End the telemedicine meeting ──────────────────────────────────────
exports.endTelemedicineRoom = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ status: false, message: "Application not found" });

    const roomId = app.meeting?.roomId || `tele_${applicationId}`;

    // Try to get moderator password for ending
    let moderatorPW;
    try {
      const info = await bbb.getMeetingInfo(roomId);
      moderatorPW = info.moderatorPW;
    } catch {
      // deterministic fallback
      moderatorPW = undefined;
    }

    const result = await bbb.endRoom(roomId, moderatorPW);

    app.meeting = {
      ...app.meeting?.toObject?.() || {},
      roomId,
      status: "ended",
      endedAt: new Date(),
    };
    await app.save();

    return res.json({ status: true, message: "Meeting ended", ...result });
  } catch (error) {
    console.error("[BBB Telemedicine] endRoom error:", error.message);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ─── Check room status ─────────────────────────────────────────────────
exports.getRoomStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ status: false, message: "Application not found" });

    const roomId = app.meeting?.roomId || `tele_${applicationId}`;

    const roomStatus = await bbb.isRoomActive(roomId);

    let meetingInfo = null;
    if (roomStatus.is_active) {
      try {
        meetingInfo = await bbb.getMeetingInfo(roomId);
      } catch {
        /* ignore */
      }
    }

    return res.json({
      status: true,
      roomId,
      isActive: roomStatus.is_active,
      meetingStatus: app.meeting?.status || "scheduled",
      participantCount: meetingInfo?.participantCount || 0,
      startedAt: app.meeting?.startedAt || null,
    });
  } catch (error) {
    console.error("[BBB Telemedicine] getRoomStatus error:", error.message);
    return res.status(500).json({ status: false, message: error.message });
  }
};
