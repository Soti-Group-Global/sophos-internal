const { PlugNmeetClient } = require("../services/plugnmeetClient");
const Application = require("../models/Application");
const DoctorsProfile = require("../models/DoctorsProfile");
const Patient = require("../models/Patient");
const Assistant = require("../models/Assistant");
const HeadAssistant = require("../models/HeadAssistant");
const Manager = require("../models/Manager");
const HeadDoctor = require("../models/HeadDoctor");
const User = require("../models/User");

const plugClient = new PlugNmeetClient(
  process.env.PLUGNMEET_API_KEY,
  process.env.PLUGNMEET_API_SECRET,
  process.env.PLUGNMEET_BASE_URL
);

// Create a new room
exports.createRoom = async (req, res) => {
  try {
    const { roomId, title = "Meeting Room", options = {} } = req.body;
    if (!roomId) {
      return res.status(400).json({ status: false, message: "roomId is required" });
    }

    const data = await plugClient.createRoom(roomId, title, {
      ...options,
      emptyTimeout: options.emptyTimeout || 3600, // 1 hour instead of 5 minutes
    });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to create room",
      error: error.response?.data || error.message,
    });
  }
};

exports.createOrJoinRoom = async (req, res) => {
  try {
    const { applicationId, roomId: bodyRoomId, title: bodyTitle, user, options = {} } = req.body;

    // Prefer application data
    let applicationDoc = null;
    if (applicationId) {
      applicationDoc =
        (await Application.findOne({ applicationId })) || (await Application.findById(applicationId));
      if (!applicationDoc) {
        return res.status(404).json({ status: false, message: "Application not found" });
      }
    }

    // Resolve doctor room
    let doctorDoc = null;
    if (applicationDoc?.doctorEmail) {
      doctorDoc = await Doctor.findOne({ email: applicationDoc.doctorEmail.toLowerCase() });
      if (doctorDoc && !doctorDoc.meetingRoomId) {
        doctorDoc.meetingRoomId = doctorDoc._id.toString();
        await doctorDoc.save();
      }
    }

    const roomId =
      bodyRoomId ||
      doctorDoc?.meetingRoomId ||
      applicationDoc?._id?.toString() ||
      applicationDoc?.applicationId;

    if (!roomId) {
      return res.status(400).json({ status: false, message: "roomId or applicationId is required" });
    }

    const title = bodyTitle || (applicationDoc ? `Appointment ${applicationDoc.applicationId}` : "Meeting Room");

    const metadata = {
      appointment_id: applicationDoc?.applicationId,
      appointment_date: applicationDoc?.date,
      start_time: applicationDoc?.startTime,
      end_time: applicationDoc?.endTime,
      doctor_email: applicationDoc?.doctorEmail,
      patient_email: applicationDoc?.patientEmail,
      service_type: applicationDoc?.serviceType,
      appointment_mode: applicationDoc?.appointmentMode,
      branch: applicationDoc?.branch,
    };

    const mergedOptions = {
      ...options,
      metadata: { ...(options.metadata || {}), ...metadata },
      emptyTimeout: options.emptyTimeout || 3600,
    };

    const roomData = await plugClient.createOrJoinRoom(roomId, title, mergedOptions);

    if (!roomData.status) {
      throw new Error(roomData.msg);
    }

    // If user info provided, generate token immediately
    let tokenData = null;
    if (user) {
      tokenData = await plugClient.getJoinToken(roomId, {
        name: user.name || "Participant",
        userId: user.userId || `user_${Date.now()}`,
        isAdmin: user.isAdmin || false,
        profilePic: user.profilePic,
      });
    }

    if (applicationDoc) {
      applicationDoc.meeting = {
        roomId,
        joinUrl: tokenData?.status ?
          `${process.env.PLUGNMEET_BASE_URL}/?access_token=${tokenData.token}` : null,
        lastToken: tokenData?.token || null,
        lastGeneratedAt: new Date(),
        lastGeneratedBy: user?.userId || null,
      };
      await applicationDoc.save();
    }

    return res.json({
      status: true,
      roomId,
      isNewRoom: roomData.isNewRoom,
      token: tokenData?.token || null,
      joinUrl: tokenData?.status ?
        `${process.env.PLUGNMEET_BASE_URL}/?access_token=${tokenData.token}` : null,
      message: roomData.message,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to create or join room",
      error: error.response?.data || error.message,
    });
  }
};

// Join room by user email/role with name resolved from respective schema
exports.joinMeetingByUser = async (req, res) => {
  try {
    const {
      roomId: bodyRoomId,
      applicationId,
      userEmail,
      role: bodyRole,
      name: bodyName,
      profilePic,
    } = req.body || {};

    const authUser = req.user || {};


    if (!bodyRoomId && !applicationId) {
      return res
        .status(400)
        .json({ status: false, message: "roomId or applicationId is required" });
    }

    let resolvedRoomId = bodyRoomId;
    let applicationDoc = null;

    if (applicationId && !resolvedRoomId) {
      applicationDoc =
        (await Application.findOne({ applicationId })) ||
        (await Application.findById(applicationId));
      if (applicationDoc) {
        resolvedRoomId =
          applicationDoc.meeting?.roomId ||
          applicationDoc._id?.toString() ||
          applicationDoc.applicationId;
      }
    }

    if (!resolvedRoomId) {
      return res.status(400).json({ status: false, message: "roomId could not be resolved" });
    }

    const email = (userEmail || authUser.email || "").toLowerCase();
    const userDoc = authUser.id
      ? await User.findById(authUser.id)
      : email
        ? await User.findOne({ email })
        : null;
    const resolvedRole = bodyRole || authUser.role || userDoc?.role || "patient";

    // Resolve display name from respective collection
    let displayName =
      bodyName ||
      userDoc?.name ||
      email ||
      "Guest";

    const findByEmail = async (Model) => {
      try {
        return await Model.findOne({ email });
      } catch {
        return null;
      }
    };

    let profileDoc = null;
    if (email) {
      if (resolvedRole.includes("doctor")) {
        profileDoc = (await findByEmail(Doctor)) || (await findByEmail(HeadDoctor));
      } else if (resolvedRole.includes("manager")) {
        profileDoc = await findByEmail(Manager);
      } else if (resolvedRole.includes("assistant")) {
        profileDoc = (await findByEmail(Assistant)) || (await findByEmail(HeadAssistant));
      } else {
        profileDoc = await findByEmail(Patient);
      }
    }

    if (profileDoc) {
      const fullName = `${profileDoc.lastName || ""} ${profileDoc.firstName || ""} ${profileDoc.middleName || ""}`.trim();
      displayName = fullName || displayName;
    }

    const isAdmin = ["doctor", "head_doctor", "manager", "head_manager", "super_admin"].includes(
      resolvedRole
    );

    // Ensure room exists/active
    const title =
      (applicationDoc && `Appointment ${applicationDoc.applicationId}`) || "Meeting Room";
    const roomStatus = await plugClient.isRoomActive(resolvedRoomId);
    if (!roomStatus.is_active) {
      const created = await plugClient.createRoom(resolvedRoomId, title, {
        emptyTimeout: 7200,
      });
      if (!created.status) {
        throw new Error(created.msg || "Failed to create room");
      }
    }

    const tokenResult = await plugClient.getJoinToken(resolvedRoomId, {
      name: displayName,
      userId: authUser.id
        ? `${resolvedRole}_${authUser.id}`
        : `${resolvedRole}_${resolvedRoomId}_${Date.now()}`,
      isAdmin,
      profilePic:
        profilePic ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
    });

    if (!tokenResult.status) {
      throw new Error(tokenResult.msg || "Failed to generate token");
    }

    const joinUrl = `${process.env.PLUGNMEET_BASE_URL}/?access_token=${tokenResult.token}`;

    // Persist to application meeting details if we have it
    if (applicationDoc) {
      applicationDoc.meeting = {
        ...(applicationDoc.meeting || {}),
        roomId: resolvedRoomId,
        lastGeneratedAt: new Date(),
        lastGeneratedBy: email || resolvedRole,
        [`${resolvedRole}Token`]: tokenResult.token,
        [`${resolvedRole}Link`]: joinUrl,
      };
      await applicationDoc.save();
    }

    return res.json({
      status: true,
      roomId: resolvedRoomId,
      token: tokenResult.token,
      joinUrl,
      role: resolvedRole,
      isAdmin,
      name: displayName,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to join meeting",
      error: error.message,
    });
  }
};

exports.joinDoctorRoom = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { role = "doctor", profilePic, name } = req.body || {};

    if (!doctorId) {
      return res.status(400).json({ status: false, message: "doctorId is required" });
    }

    const doctorProfile = await DoctorsProfile.findById(doctorId);
    if (!doctorProfile) {
      return res.status(404).json({ status: false, message: "Doctor not found" });
    }

    const roomId = doctorProfile.meetingRoomId || `doctor_${doctorId}`;
    const getFieldValue = (field, lang = 'en') => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (typeof field === 'object') return field[lang] || field['en'] || '';
      return '';
    };
    const lang = doctorProfile.notificationLanguage || 'en';
    const doctorName = `${getFieldValue(doctorProfile.firstName, lang)} ${getFieldValue(doctorProfile.lastName, lang)}`.trim() || "Doctor";
    const displayName = (name || doctorName || "Guest").trim();
    const title = `${doctorName} - Consultation`;

    // Step 1: Check if room exists and is active
    let roomStatus = await plugClient.isRoomActive(roomId);
    let isNewRoom = false;

    // Step 2: If room doesn't exist or is inactive, create it
    if (!roomStatus.is_active) {
      const createResult = await plugClient.createRoom(roomId, title, {
        maxParticipants: 10,
        allowRecording: true,
        allowChat: true,
        allowScreenShare: true,
        muteOnStart: false,
        emptyTimeout: 7200, // 2 hours
        metadata: {
          doctorId: doctor._id.toString(),
          doctorName: doctorName,
          specialty: doctor.specialty,
          createdFor: "doctor_consultation",
          createdAt: new Date().toISOString(),
        }
      });

      if (!createResult.status) {
        throw new Error(`Failed to create room: ${createResult.msg}`);
      }

      isNewRoom = true;

      // Update doctor's room ID if not set
      if (!doctor.meetingRoomId) {
        doctor.meetingRoomId = roomId;
        await doctor.save();
      }
    }

    // Step 3: Generate fresh token for this session
    const isAdmin = role === "doctor" || role === "manager";
    const userPrefix = role || (isAdmin ? "doctor" : "participant");
    const tokenResult = await plugClient.getJoinToken(roomId, {
      name: displayName,
      userId: `${userPrefix}_${doctorId}_${Date.now()}`,
      isAdmin,
      profilePic:
        profilePic ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
    });

    if (!tokenResult.status) {
      throw new Error(`Failed to generate token: ${tokenResult.msg}`);
    }

    // Step 4: Return everything needed
    const joinUrl = `${process.env.PLUGNMEET_BASE_URL}/?access_token=${tokenResult.token}`;

    return res.json({
      status: true,
      roomId: roomId,
      token: tokenResult.token,
      joinUrl: joinUrl,
      isNewRoom: isNewRoom,
      doctorName: doctorName,
      role,
      isAdmin,
      message: isNewRoom ? "Created new room session" : "Joined existing room session",
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to join doctor room",
      error: error.message,
    });
  }
};

// Create or fetch persistent room for a doctor
exports.createDoctorRoom = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!doctorId) {
      return res.status(400).json({ status: false, message: "doctorId is required" });
    }

    const doctorProfile = await DoctorsProfile.findById(doctorId);
    if (!doctorProfile) {
      return res.status(404).json({ status: false, message: "Doctor not found" });
    }

    // Ensure doctor has a meetingRoomId
    if (!doctor.meetingRoomId) {
      doctor.meetingRoomId = `doctor_${doctor._id}`;
      await doctor.save();
    }

    const roomId = doctor.meetingRoomId;
    const doctorName = `${doctor.lastName || ""} ${doctor.firstName || ""} ${doctor.middleName || ""}`.trim() || "Doctor";
    const title = `${doctorName} - Consultation Room`;

    // Build metadata
    const metadata = {
      doctor_id: doctor._id.toString(),
      doctor_email: doctor.email,
      doctor_name: doctorName,
      specialty: doctor.specialty,
      services: doctor.services,
      created_at: new Date().toISOString(),
    };

    const options = {
      metadata,
      emptyTimeout: 7200, // 2 hours
      maxParticipants: 10,
      allowRecording: true,
    };

    const data = await plugClient.createOrJoinRoom(roomId, title, options);

    // Persist room info
    doctor.meetingRoomId = roomId;
    await doctor.save();

    return res.json({
      status: true,
      roomId,
      data,
      message: "Doctor room created/activated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to create doctor room",
      error: error.response?.data || error.message,
    });
  }
};

// Generate a join token for a user
exports.getJoinToken = async (req, res) => {
  try {
    const { roomId, user } = req.body;
    if (!roomId) {
      return res.status(400).json({ status: false, message: "roomId is required" });
    }
    if (!user || !user.name) {
      return res.status(400).json({ status: false, message: "user.name is required" });
    }

    // Check if room is active first
    const roomStatus = await plugClient.isRoomActive(roomId);
    if (!roomStatus.is_active) {
      return res.status(400).json({
        status: false,
        message: "Room is not active. Please create a room first.",
        code: "ROOM_NOT_ACTIVE"
      });
    }

    const data = await plugClient.getJoinToken(roomId, user);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to generate join token",
      error: error.response?.data || error.message,
    });
  }
};

// Check if room is active
exports.isRoomActive = async (req, res) => {
  try {
    const { roomId } = req.params;
    const data = await plugClient.isRoomActive(roomId);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch room status",
      error: error.response?.data || error.message,
    });
  }
};

// Get active room info
exports.getActiveRoomInfo = async (req, res) => {
  try {
    const { roomId } = req.params;
    const data = await plugClient.getActiveRoomInfo(roomId);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch room info",
      error: error.response?.data || error.message,
    });
  }
};

// Get all active rooms
exports.getActiveRoomsInfo = async (_req, res) => {
  try {
    const data = await plugClient.getActiveRoomsInfo();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch active rooms",
      error: error.response?.data || error.message,
    });
  }
};

// Fetch past rooms
exports.fetchPastRooms = async (req, res) => {
  try {
    const { roomIds = [], from = 0, limit = 20, orderBy = "DESC" } = req.body;
    const data = await plugClient.fetchPastRooms(roomIds, { from, limit, orderBy });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch past rooms",
      error: error.response?.data || error.message,
    });
  }
};

// End a room
exports.endRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const data = await plugClient.endRoom(roomId);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to end room",
      error: error.response?.data || error.message,
    });
  }
};
// Fetch recordings
exports.fetchRecordings = async (req, res) => {
  try {
    const { room_ids, from = 0, limit = 20, order_by = "DESC" } = req.body;

    if (!room_ids || !Array.isArray(room_ids) || room_ids.length === 0) {
      return res.status(400).json({
        status: false,
        message: "room_ids is required and must be a non-empty array"
      });
    }

    const data = await plugClient.fetchRecordings(room_ids, from, limit, order_by);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch recordings",
      error: error.response?.data || error.message,
    });
  }
};

// Download/stream recording using download token
exports.streamRecording = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { token } = req.query;

    if (!recordId) {
      return res.status(400).json({
        status: false,
        message: "recordId is required"
      });
    }

    // Verify token from query parameter
    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Authentication token required"
      });
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type && decoded.type !== "access") {
        return res.status(401).json({
          status: false,
          message: "Invalid token type"
        });
      }
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: "Invalid or expired token"
      });
    }

    // Get download token from PlugNmeet API
    const tokenResponse = await plugClient.getRecordingDownloadToken(recordId);

    if (!tokenResponse.status || !tokenResponse.token) {
      return res.status(400).json({
        status: false,
        message: "Failed to get download token from PlugNmeet",
        error: tokenResponse.msg
      });
    }

    const downloadToken = tokenResponse.token;
    const baseUrl = process.env.PLUGNMEET_BASE_URL || 'https://meet.sotiglobal.com';
    const downloadUrl = `${baseUrl}/download/recording/${downloadToken}`;

    // Stream the file from PlugNmeet using the download token
    const axios = require('axios');
    const fileResponse = await axios.get(downloadUrl, {
      responseType: 'stream',
      timeout: 30000
    });

    // Set appropriate headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', fileResponse.headers['content-length'] || '');

    fileResponse.data.pipe(res);

  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({
        status: false,
        message: "Recording not found",
        error: error.message
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to stream recording",
      error: error.message
    });
  }
};