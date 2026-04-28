const express = require("express");
const router = express.Router();
const meetingController = require("../controllers/meetingController");
const auth = require("../middleware/auth");

// Room lifecycle
router.post("/create", auth, meetingController.createRoom);
router.post("/create-or-join", auth, meetingController.createOrJoinRoom);
router.post("/:roomId/end", auth, meetingController.endRoom);

// NEW: Doctor-specific endpoint (handles room creation + token generation)
router.post("/doctor/:doctorId/join", auth, meetingController.joinDoctorRoom);
// Generic join that resolves user role/name from User + respective profile
router.post("/join-by-user", auth, meetingController.joinMeetingByUser);

// Status and info
router.get("/active", auth, meetingController.getActiveRoomsInfo);
router.get("/:roomId/active", auth, meetingController.isRoomActive);
router.get("/:roomId/info", auth, meetingController.getActiveRoomInfo);

// Tokens
router.post("/join-token", auth, meetingController.getJoinToken);

// Doctor room provisioning
router.post("/doctor/:doctorId/create-room", auth, meetingController.createDoctorRoom);

// Past rooms
router.post("/past", auth, meetingController.fetchPastRooms);

// Recordings
router.post("/recordings/fetch", auth, meetingController.fetchRecordings);
router.get("/recordings/:recordId/stream", meetingController.streamRecording); // No auth middleware - handles token in query

module.exports = router;
