const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const doctorLeaveController = require("../controllers/doctorLeaveController");

router.post("/", auth, doctorLeaveController.createLeave);
router.get("/", auth, doctorLeaveController.getLeaves);
router.get("/:id", auth, doctorLeaveController.getLeaveById);
router.patch("/:id/status", auth, doctorLeaveController.updateLeaveStatus);
router.delete("/:id", auth, doctorLeaveController.deleteLeave);

module.exports = router;
