const Application = require("../models/Application");

/**
 * Helper: Build date match filter
 */
const buildDateMatch = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) range.$lte = new Date(endDate);
  return { createdAt: range };
};

/**
 * Helper: Build match filter for appointment, payment status, and branch
 */
const buildFilterMatch = (query) => {
  const { appointmentStatus, paymentStatus, startDate, endDate, branch } = query;
  const match = {};

  // Date range filter
  const dateRange = buildDateMatch(startDate, endDate);
  Object.assign(match, dateRange);

  // Appointment status (can be multiple)
  if (appointmentStatus) {
    const statuses = Array.isArray(appointmentStatus)
      ? appointmentStatus
      : appointmentStatus.split(",");
    match.appointmentStatus = { $in: statuses };
  }

  // Branch filter — include Online appointments always, and Offline only for selected branch
  if (branch && branch !== "All") {
    match.$or = [
      { appointmentMode: "Online" },
      {
        $and: [
          { appointmentMode: "Offline" },
          { branch: branch },
        ],
      },
    ];
  }

  // Payment status (used inside pipelines after $unwind)
  const paymentStatuses = paymentStatus
    ? Array.isArray(paymentStatus)
      ? paymentStatus
      : paymentStatus.split(",")
    : [];

  return { match, paymentStatuses };
};

/**
 * @desc Summary Overview for Applications (with all payment statuses)
 * @route GET /api/applications/analytics/summary?startDate=&endDate=&appointmentStatus=&paymentStatus=&branch=
 */
exports.getApplicationSummary = async (req, res) => {
  try {
    const { match: baseMatch, paymentStatuses } = buildFilterMatch(req.query);

    const data = await Application.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          // Total applications count
          totalApplications: [{ $count: "total" }],

          // Breakdown by appointment status
          byStatus: [
            { $group: { _id: "$appointmentStatus", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],

          // Breakdown by service type
          byServiceType: [
            { $group: { _id: "$serviceType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],

          // Revenue summary
          revenueSummary: [
            { $unwind: "$payments" },
            ...(paymentStatuses.length
              ? [{ $match: { "payments.status": { $in: paymentStatuses } } }]
              : []),
            {
              $group: {
                _id: "$payments.status",
                totalRevenue: { $sum: { $toDouble: "$payments.finalAmount" } },
                totalPayments: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: null,
                byStatus: {
                  $push: {
                    status: "$_id",
                    revenue: "$totalRevenue",
                    count: "$totalPayments",
                  },
                },
                overallRevenue: { $sum: "$totalRevenue" },
              },
            },
          ],

          // Top 5 doctors
          topDoctors: [
            { $unwind: "$doctors" },
            { $unwind: "$payments" },
            ...(paymentStatuses.length
              ? [{ $match: { "payments.status": { $in: paymentStatuses } } }]
              : []),
            {
              $group: {
                _id: {
                  doctorEmail: "$doctors.doctorEmail",
                  status: "$payments.status",
                },
                storedDoctorName: { $first: "$doctors.doctorName" },
                totalRevenue: { $sum: { $toDouble: "$payments.finalAmount" } },
                totalApplications: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: "$_id.doctorEmail",
                storedDoctorName: { $first: "$storedDoctorName" },
                revenueByStatus: {
                  $push: {
                    status: "$_id.status",
                    revenue: "$totalRevenue",
                  },
                },
                totalRevenue: { $sum: "$totalRevenue" },
                totalApplications: { $sum: "$totalApplications" },
              },
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
          ],

          // Follow-up statistics
          followUpStats: [
            {
              $group: {
                _id: null,
                totalNeeded: {
                  $sum: { $cond: [{ $eq: ["$followUp.needed", true] }, 1, 0] },
                },
                totalBooked: {
                  $sum: { $cond: [{ $eq: ["$followUp.booked", true] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]);

    const result = data[0] || {};

    res.status(200).json({
      totalApplications: result.totalApplications?.[0]?.total || 0,
      byStatus: result.byStatus || [],
      byServiceType: result.byServiceType || [],
      revenueSummary: result.revenueSummary?.[0] || {
        byStatus: [],
        overallRevenue: 0,
      },
      topDoctors: result.topDoctors || [],
      followUpStats: result.followUpStats?.[0] || {
        totalNeeded: 0,
        totalBooked: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching application summary" });
  }
};

/**
 * @desc Monthly Revenue Trend (All Payment Statuses + Totals)
 * @route GET /api/applications/analytics/revenue-trend?startDate=&endDate=&appointmentStatus=&paymentStatus=&branch=
 */
exports.getApplicationRevenueTrend = async (req, res) => {
  try {
    const { match: baseMatch, paymentStatuses } = buildFilterMatch(req.query);

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$payments" },
      ...(paymentStatuses.length
        ? [{ $match: { "payments.status": { $in: paymentStatuses } } }]
        : []),
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            status: "$payments.status",
          },
          totalRevenue: { $sum: { $toDouble: "$payments.finalAmount" } },
          totalApplications: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ];

    const trend = await Application.aggregate(pipeline);

    // Prepare response
    const groupedByMonth = {};
    const ALL_STATUSES = [
      "new",
      "invoice-sent",
      "paid",
      "cancelled",
      "free",
      "pending",
    ];

    trend.forEach((t) => {
      const monthKey = `${t._id.month}/${t._id.year}`;
      const status = t._id.status || "unknown";

      if (!groupedByMonth[monthKey]) {
        groupedByMonth[monthKey] = {
          month: monthKey,
          statuses: {},
          totalRevenue: 0,
          totalApplications: 0,
        };
        ALL_STATUSES.forEach((s) => {
          groupedByMonth[monthKey].statuses[s] = {
            revenue: 0,
            applications: 0,
          };
        });
      }

      groupedByMonth[monthKey].statuses[status] = {
        revenue: t.totalRevenue,
        applications: t.totalApplications,
      };

      groupedByMonth[monthKey].totalRevenue += t.totalRevenue;
      groupedByMonth[monthKey].totalApplications += t.totalApplications;
    });

    res.status(200).json(Object.values(groupedByMonth));
  } catch (err) {
    res.status(500).json({ message: "Error fetching revenue trend" });
  }
};

/**
 * @desc Doctor Performance (with doctor details & all payment statuses)
 * @route GET /api/applications/analytics/doctor-performance?startDate=&endDate=&appointmentStatus=&paymentStatus=&branch=
 */
exports.getApplicationDoctorPerformance = async (req, res) => {
  try {
    const { match: baseMatch, paymentStatuses } = buildFilterMatch(req.query);

    const performance = await Application.aggregate([
      { $match: baseMatch },
      // Unwind the doctors array so we can group by each doctor
      { $unwind: { path: "$doctors", preserveNullAndEmptyArrays: false } },
      { $unwind: { path: "$payments", preserveNullAndEmptyArrays: true } },
      ...(paymentStatuses.length
        ? [{ $match: { "payments.status": { $in: paymentStatuses } } }]
        : []),

      {
        $group: {
          _id: {
            doctorEmail: "$doctors.doctorEmail",
            paymentStatus: "$payments.status",
          },
          storedDoctorName: { $first: "$doctors.doctorName" },
          totalApplications: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $convert: {
                input: "$payments.finalAmount",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$appointmentStatus", "Completed"] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$appointmentStatus", "Cancelled"] }, 1, 0],
            },
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ["$appointmentStatus", "Pending payment"] }, 1, 0],
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id.doctorEmail",
          storedDoctorName: { $first: "$storedDoctorName" },
          totalRevenue: { $sum: "$totalRevenue" },
          totalApplications: { $sum: "$totalApplications" },
          completed: { $sum: "$completed" },
          cancelled: { $sum: "$cancelled" },
          pending: { $sum: "$pending" },
          revenueByStatus: {
            $push: {
              status: "$_id.paymentStatus",
              revenue: "$totalRevenue",
              applications: "$totalApplications",
            },
          },
        },
      },
      // Lookup from both doctors and doctorsprofiles collections
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "email",
          as: "doctorInfo",
        },
      },
      { $unwind: { path: "$doctorInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "doctorsprofiles",
          localField: "_id",
          foreignField: "email",
          as: "profileInfo",
        },
      },
      { $unwind: { path: "$profileInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "availabilities",
          localField: "_id",
          foreignField: "doctorEmail",
          as: "availability",
        },
      },
      {
        $addFields: {
          totalWorkingHours: {
            $divide: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$availability",
                        as: "slot",
                        cond: { $eq: ["$$slot.status", "Available"] },
                      },
                    },
                    as: "slot",
                    in: {
                      $divide: [
                        { $subtract: ["$$slot.end", "$$slot.start"] },
                        1000 * 60 * 60,
                      ],
                    },
                  },
                },
              },
              1,
            ],
          },
        },
      },
      {
        $addFields: {
          doctorEmail: "$_id",
          // Build name: prefer doctorsprofiles (multilingual), then doctors, then stored name
          doctorName: {
            $cond: {
              if: { $ifNull: ["$profileInfo.firstName", false] },
              then: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: [{ $ifNull: ["$profileInfo.lastName.ru", "$profileInfo.lastName.en"] }, ""] },
                      " ",
                      { $ifNull: [{ $ifNull: ["$profileInfo.firstName.ru", "$profileInfo.firstName.en"] }, ""] },
                      " ",
                      { $ifNull: [{ $ifNull: ["$profileInfo.middleName.ru", "$profileInfo.middleName.en"] }, ""] },
                    ],
                  },
                },
              },
              else: {
                $cond: {
                  if: { $ifNull: ["$doctorInfo.firstName", false] },
                  then: {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ["$doctorInfo.lastName", ""] },
                          " ",
                          { $ifNull: ["$doctorInfo.firstName", ""] },
                          " ",
                          { $ifNull: ["$doctorInfo.middleName", ""] },
                        ],
                      },
                    },
                  },
                  else: { $ifNull: ["$storedDoctorName", ""] },
                },
              },
            },
          },
          specialty: {
            $ifNull: [
              "$doctorInfo.specialty",
              { $ifNull: ["$profileInfo.specialty.ru", "$profileInfo.specialty.en"] },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          doctorEmail: 1,
          doctorName: 1,
          specialty: 1,
          totalRevenue: 1,
          totalApplications: 1,
          completed: 1,
          cancelled: 1,
          pending: 1,
          revenueByStatus: 1,
          totalWorkingHours: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.status(200).json(performance);
  } catch (err) {
    console.error("Doctor performance error:", err);
    res.status(500).json({ message: "Error fetching doctor performance" });
  }
};

/**
 * @desc Verification Stats
 */
exports.getApplicationVerificationStats = async (req, res) => {
  try {
    const { match: baseMatch } = buildFilterMatch(req.query);

    const verification = await Application.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          prescriptionsVerified: {
            $sum: {
              $cond: [
                { $eq: ["$prescription.verificationStatus", "Verified"] },
                1,
                0,
              ],
            },
          },
          prescriptionsPending: {
            $sum: {
              $cond: [
                { $eq: ["$prescription.verificationStatus", "Under Review"] },
                1,
                0,
              ],
            },
          },
          conclusionsVerified: {
            $sum: {
              $cond: [
                { $eq: ["$conclusion.verificationStatus", "Verified"] },
                1,
                0,
              ],
            },
          },
          conclusionsPending: {
            $sum: {
              $cond: [
                { $eq: ["$conclusion.verificationStatus", "Under Review"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json(verification[0] || {});
  } catch (err) {
    res.status(500).json({ message: "Error fetching verification stats" });
  }
};

/**
 * @desc Specialty Distribution
 */
exports.getApplicationSpecialtyStats = async (req, res) => {
  try {
    const { match: baseMatch } = buildFilterMatch(req.query);

    const specialties = await Application.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$specialty", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json(specialties);
  } catch (err) {
    res.status(500).json({ message: "Error fetching specialty stats" });
  }
};

/**
 * @desc Monthly Service Type Growth
 */
exports.getApplicationServiceGrowth = async (req, res) => {
  try {
    const { match: baseMatch } = buildFilterMatch(req.query);

    const rawData = await Application.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            serviceType: "$serviceType",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const grouped = {};
    rawData.forEach((item) => {
      const monthLabel = new Date(
        item._id.year,
        item._id.month - 1
      ).toLocaleString("default", { month: "short", year: "numeric" });
      if (!grouped[monthLabel]) grouped[monthLabel] = { month: monthLabel };
      grouped[monthLabel][item._id.serviceType] = item.count;
    });

    res.status(200).json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ message: "Error fetching monthly service growth" });
  }
};
