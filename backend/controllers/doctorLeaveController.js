const DoctorLeave = require("../models/DoctorLeave");
const { setAuditLogContext } = require("../utils/auditLogHelper");

const createDoctorLeave = async (req, res) => {
  try {
    const {
      doctorEmail,
      startDate,
      endDate,
      leaveType = "Vacation",
      comment = "",
      isGivenByAdmin = false,
    } = req.body;

    if (!doctorEmail || !startDate || !endDate) {
      return res.status(400).json({ message: "doctorEmail, startDate and endDate are required" });
    }

    if (startDate > endDate) {
      return res.status(400).json({ message: "startDate must be <= endDate" });
    }

    let workingDays = 0;
    const cursor = new Date(startDate + "T00:00:00");
    const last = new Date(endDate + "T00:00:00");
    while (cursor <= last) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
      cursor.setDate(cursor.getDate() + 1);
    }

    const leave = new DoctorLeave({
      doctorEmail: doctorEmail.toLowerCase().trim(),
      startDate,
      endDate,
      workingDays,
      leaveType,
      comment,
      isGivenByAdmin,
      status: isGivenByAdmin ? "Approved" : "Pending",
      reviewedBy: isGivenByAdmin ? req.user?.email || "admin" : null,
      reviewedAt: isGivenByAdmin ? new Date() : null,
    });

    await leave.save();
    setAuditLogContext(req, {
      actionType: "CREATE",
      entity: "DoctorLeave",
      entityId: leave._id,
      message: `Created doctor leave for ${leave.doctorEmail} (${leave.startDate} to ${leave.endDate})`,
    });
    return res.status(201).json({ success: true, leave });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getDoctorLeaves = async (req, res) => {
  try {
    const { doctorEmail, status, from, to } = req.query;
    const query = {};
    if (doctorEmail) query.doctorEmail = doctorEmail.toLowerCase().trim();
    if (status) query.status = status;
    if (from || to) {
      query.startDate = {};
      if (from) query.startDate.$gte = from;
      if (to) query.startDate.$lte = to;
    }
    const leaves = await DoctorLeave.find(query).sort({ startDate: -1 });
    return res.json({ success: true, leaves });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getDoctorLeaveById = async (req, res) => {
  try {
    const leave = await DoctorLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    return res.json({ success: true, leave });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateDoctorLeaveStatus = async (req, res) => {
  try {
    const { status, reviewComment = "" } = req.body;
    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const leave = await DoctorLeave.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewComment,
        reviewedBy: req.user?.email || "admin",
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    setAuditLogContext(req, {
      actionType: "UPDATE",
      entity: "DoctorLeave",
      entityId: leave._id,
      message: `Updated doctor leave status to ${leave.status} for ${leave.doctorEmail}`,
    });
    return res.json({ success: true, leave });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const deleteDoctorLeave = async (req, res) => {
  try {
    const deleted = await DoctorLeave.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Leave not found" });

    setAuditLogContext(req, {
      actionType: "DELETE",
      entity: "DoctorLeave",
      entityId: deleted._id,
      message: `Deleted doctor leave for ${deleted.doctorEmail}`,
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createDoctorLeave,
  getDoctorLeaves,
  getDoctorLeaveById,
  updateDoctorLeaveStatus,
  deleteDoctorLeave,
};
