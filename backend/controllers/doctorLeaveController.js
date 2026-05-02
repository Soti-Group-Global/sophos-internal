const DoctorLeave = require("../models/DoctorLeave");
const Manager = require("../models/Manager");

exports.createLeave = async (req, res) => {
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

    const adminEmail = isGivenByAdmin ? (req.user?.email || "admin") : null;
    let reviewedByName = null;
    if (isGivenByAdmin && adminEmail && adminEmail !== "admin") {
      try {
        const mgr = await Manager.findOne({ email: adminEmail });
        if (mgr) reviewedByName = [mgr.firstName, mgr.middleName, mgr.lastName].filter(Boolean).join(" ").trim();
      } catch (_) {}
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
      reviewedBy: adminEmail,
      reviewedByName,
      reviewedAt: isGivenByAdmin ? new Date() : null,
    });

    await leave.save();
    res.status(201).json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getLeaves = async (req, res) => {
  try {
    const { doctorEmail, status, from, to } = req.query;
    const query = {};
    if (doctorEmail) query.doctorEmail = doctorEmail.toLowerCase().trim();
    if (status) query.status = status;
    if (from || to) {
      // Return any leave that overlaps the requested range:
      //   leave.startDate <= to  AND  leave.endDate >= from
      const overlap = {};
      if (to)   overlap.startDate = { $lte: to };
      if (from) overlap.endDate   = { ...(overlap.endDate || {}), $gte: from };
      Object.assign(query, overlap);
    }
    const leaves = await DoctorLeave.find(query).sort({ startDate: -1 });
    res.json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getLeaveById = async (req, res) => {
  try {
    const leave = await DoctorLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    res.json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, reviewComment = "" } = req.body;
    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const reviewerEmail = req.user?.email || "admin";
    let reviewedByName = null;
    if (reviewerEmail && reviewerEmail !== "admin") {
      try {
        const mgr = await Manager.findOne({ email: reviewerEmail });
        if (mgr) reviewedByName = [mgr.firstName, mgr.middleName, mgr.lastName].filter(Boolean).join(" ").trim();
      } catch (_) {}
    }
    const leave = await DoctorLeave.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewComment,
        reviewedBy: reviewerEmail,
        reviewedByName,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    res.json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    await DoctorLeave.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
