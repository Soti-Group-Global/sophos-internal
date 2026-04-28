const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/bbbTelemedicineController");

// Create / ensure BBB room for an appointment
router.post("/:applicationId/create", auth, ctrl.createTelemedicineRoom);

// Join the BBB room (returns joinUrl)
router.post("/:applicationId/join", auth, ctrl.joinTelemedicineRoom);

// End the BBB room
router.post("/:applicationId/end", auth, ctrl.endTelemedicineRoom);

// Check room status
router.get("/:applicationId/status", auth, ctrl.getRoomStatus);

module.exports = router;
