const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Assistant = require("../models/Assistant");
const Manager = require("../models/Manager");
const HeadDoctor = require("../models/HeadDoctor");
const HeadAssistant = require("../models/HeadAssistant");
const Specialist = require("../models/Specialist");
const Project = require("../models/Project");
const Availability = require("../models/Availability");
const ManagerAvailability = require("../models/ManagerAvailabilitySchema");
const HeadAssistantAvailability = require("../models/HeadAssistantAvailability");
const Application = require("../models/Application");
const Patient = require("../models/Patient");

exports.getEmployees = async (req, res) => {
  try {
    const { projectId } = req.query; // optional: projectId passed as query param

    // Fetch all non-patient users
    const users = await User.find(
      { role: { $ne: "patient" } },
      "email role"
    ).lean();

    if (!users.length) {
      return res.status(404).json({ message: "No employees found" });
    }

    // If projectId provided, fetch its members (emails)
    let assignedEmails = [];
    if (projectId) {
      const project = await Project.findById(projectId).lean();
      assignedEmails = project?.members?.map((e) => e.toLowerCase()) || [];
    }

    // Role → Model mapping
    const roleModels = {
      doctor: Doctor,
      assistant: Assistant,
      manager: Manager,
      head_doctor: HeadDoctor,
      head_assistant: HeadAssistant,
      specialist: Specialist,
    };

    // Build enriched employee list
    const employees = await Promise.all(
      users.map(async (user) => {
        const Model = roleModels[user.role];
        let fullName = "N/A";

        if (Model) {
          const record = await Model.findOne({ email: user.email }).select(
            "firstName middleName lastName"
          );

          if (record) {
            const parts = [record.firstName, record.middleName, record.lastName]
              .filter(Boolean)
              .join(" ");
            fullName = parts || "N/A";
          }
        }

        return {
          email: user.email,
          role: user.role,
          name: fullName,
          assigned: assignedEmails.includes(user.email.toLowerCase()),
        };
      })
    );

    res.status(200).json({
      message: "Employees fetched successfully",
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error while fetching employees",
      error: error.message,
    });
  }
};

exports.getApplicationByDate = async (req, res) => {
  try {
    const { doctorEmail, date } = req.query;

    if (!doctorEmail || !date) {
      return res
        .status(400)
        .json({ message: "doctorEmail and date are required." });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Aggregation pipeline to fetch appointments and patient details
    const applications = await Application.aggregate([
      {
        $match: {
          doctorEmail,
          startTime: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $lookup: {
          from: "patients", // collection name in MongoDB (usually lowercase plural)
          localField: "patientEmail",
          foreignField: "email",
          as: "patientDetails",
        },
      },
      {
        $unwind: { path: "$patientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          patientEmail: 1,
          startTime: 1,
          endTime: 1,
          appointmentStatus: 1,
          serviceType: 1,
          appointmentMode: 1,
          applicationId: 1,
          "patientDetails.firstName": 1,
          "patientDetails.middleName": 1,
          "patientDetails.lastName": 1,
        },
      },
      { $sort: { startTime: 1 } },
    ]);

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getAllAvailabilities = async (req, res) => {
  try {
    const { startDate, endDate, branch } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Both startDate and endDate are required." });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    const baseDateFilter = {
      start: { $lte: endDateObj },
      end: { $gte: startDateObj },
    };

    // 1️⃣ Fetch all availabilities (without branch filter)
    const [doctorAvail, managerAvail, headAssistAvail, assistants] =
      await Promise.all([
        Availability.find(baseDateFilter),
        ManagerAvailability.find(baseDateFilter),
        HeadAssistantAvailability.find(baseDateFilter),
        Assistant.find({
          "doctors.startDateTime": { $lte: endDateObj },
          "doctors.endDateTime": { $gte: startDateObj },
        }).select("email firstName middleName lastName doctors branches"),
      ]);

    // 2️⃣ Collect emails for each role
    const doctorEmails = doctorAvail.map((a) => a.doctorEmail);
    const managerEmails = managerAvail.map((a) => a.managerEmail);
    const headAssistantEmails = headAssistAvail.map((a) => a.headAssistantEmail);

    // 3️⃣ Fetch users (doctors/managers/head assistants) including branches
    const [doctors, managers, headAssistants] = await Promise.all([
      Doctor.find({ email: { $in: doctorEmails } }).select(
        "email firstName middleName lastName branches"
      ),
      Manager.find({ email: { $in: managerEmails } }).select(
        "email firstName middleName lastName branches"
      ),
      HeadAssistant.find({ email: { $in: headAssistantEmails } }).select(
        "email firstName middleName lastName branches"
      ),
    ]);

    const doctorMap = Object.fromEntries(doctors.map((d) => [d.email, d]));
    const managerMap = Object.fromEntries(managers.map((m) => [m.email, m]));
    const headAssistantMap = Object.fromEntries(
      headAssistants.map((h) => [h.email, h])
    );

    // 4️⃣ Utility: Split availability across days
    const splitByDays = (record) => {
      const result = [];
      let cur = new Date(record.start);
      const end = new Date(record.end);
      cur.setHours(0, 0, 0, 0);

      while (cur <= end) {
        const dayStart = new Date(cur);
        const dayEnd = new Date(cur);
        dayEnd.setHours(23, 59, 59, 999);

        const startTime = record.start > dayStart ? record.start : dayStart;
        const endTime = record.end < dayEnd ? record.end : dayEnd;

        result.push({
          ...record,
          start: startTime,
          end: endTime,
          date: dayStart.toISOString().split("T")[0],
        });
        cur.setDate(cur.getDate() + 1);
      }

      return result;
    };

    // 5️⃣ Combine and filter by branch logic
    const branchMatch = (userBranches) =>
      !branch ||
      branch === "All" ||
      (Array.isArray(userBranches) && userBranches.includes(branch));

    const combined = [
      ...doctorAvail
        .filter((a) => branchMatch(doctorMap[a.doctorEmail]?.branches))
        .flatMap((a) =>
          splitByDays({
            role: "doctor",
            email: a.doctorEmail,
            firstName: doctorMap[a.doctorEmail]?.firstName || "",
            middleName: doctorMap[a.doctorEmail]?.middleName || "",
            lastName: doctorMap[a.doctorEmail]?.lastName || "",
            start: a.start,
            end: a.end,
            status: a.status,
            notes: a.notes || "",
            branch:
              doctorMap[a.doctorEmail]?.branches?.join(", ") || "Unassigned",
          })
        ),
      ...managerAvail
        .filter((a) => branchMatch(managerMap[a.managerEmail]?.branches))
        .flatMap((a) =>
          splitByDays({
            role: "manager",
            email: a.managerEmail,
            firstName: managerMap[a.managerEmail]?.firstName || "",
            middleName: managerMap[a.managerEmail]?.middleName || "",
            lastName: managerMap[a.managerEmail]?.lastName || "",
            start: a.start,
            end: a.end,
            status: a.status,
            notes: a.notes || "",
            branch:
              managerMap[a.managerEmail]?.branches?.join(", ") || "Unassigned",
          })
        ),
      ...headAssistAvail
        .filter((a) =>
          branchMatch(headAssistantMap[a.headAssistantEmail]?.branches)
        )
        .flatMap((a) =>
          splitByDays({
            role: "headAssistant",
            email: a.headAssistantEmail,
            firstName: headAssistantMap[a.headAssistantEmail]?.firstName || "",
            middleName: headAssistantMap[a.headAssistantEmail]?.middleName || "",
            lastName: headAssistantMap[a.headAssistantEmail]?.lastName || "",
            start: a.start,
            end: a.end,
            status: a.status,
            notes: a.notes || "",
            branch:
              headAssistantMap[a.headAssistantEmail]?.branches?.join(", ") ||
              "Unassigned",
          })
        ),
      ...assistants
        .filter((a) => branchMatch(a.branches))
        .flatMap((assistant) =>
          assistant.doctors
            .filter(
              (d) =>
                d.startDateTime <= endDateObj &&
                d.endDateTime >= startDateObj &&
                ["Access Granted", "Pending", "Request Sent"].includes(d.status)
            )
            .flatMap((d) =>
              splitByDays({
                role: "assistant",
                email: assistant.email,
                firstName: assistant.firstName,
                middleName: assistant.middleName,
                lastName: assistant.lastName,
                start: d.startDateTime,
                end: d.endDateTime,
                status: d.status,
                notes: `Access to Doctor: ${d.doctorEmail}`,
                branch: assistant.branches?.join(", ") || "Unassigned",
              })
            )
        ),
    ];

    // 6️⃣ Merge duplicate assistant shifts
    const mergedAssistants = {};
    for (const rec of combined) {
      if (rec.role !== "assistant") continue;
      const key = `${rec.email}_${rec.notes}_${rec.date}`;
      if (!mergedAssistants[key]) {
        mergedAssistants[key] = { ...rec };
      } else {
        mergedAssistants[key].start = new Date(
          Math.min(new Date(mergedAssistants[key].start), new Date(rec.start))
        );
        mergedAssistants[key].end = new Date(
          Math.max(new Date(mergedAssistants[key].end), new Date(rec.end))
        );
      }
    }

    const cleanedCombined = [
      ...combined.filter((r) => r.role !== "assistant"),
      ...Object.values(mergedAssistants),
    ];

    res.status(200).json(cleanedCombined);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


