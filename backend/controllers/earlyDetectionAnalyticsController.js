const EarlyDetectionBooking = require("../models/EarlyDetectionBooking");

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const buildBaseQuery = ({ startDate, endDate, branch }) => {
  const query = {};

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (branch && branch !== "All") {
    query.$or = [
      { appointmentMode: "Online" },
      { $and: [{ appointmentMode: "Offline" }, { branch }] },
    ];
  }

  return query;
};

const getLatestPayment = (booking) => {
  if (!Array.isArray(booking?.paymentHistory) || booking.paymentHistory.length === 0) {
    return null;
  }
  return booking.paymentHistory[booking.paymentHistory.length - 1] || null;
};

const getPaymentStatus = (booking) =>
  normalize(getLatestPayment(booking)?.status || booking?.payment?.status || "pending");

const getPaymentAmountRub = (booking) => {
  const latest = getLatestPayment(booking);
  if (Number.isFinite(Number(latest?.amount))) {
    return Number(latest.amount) / 100;
  }
  if (Number.isFinite(Number(booking?.totalAmount))) {
    return Number(booking.totalAmount);
  }
  if (Number.isFinite(Number(booking?.package?.price))) {
    return Number(booking.package.price);
  }
  return 0;
};

const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getFullYear()}`;
};

const getMonthLabel = (date) => {
  const d = new Date(date);
  return d.toLocaleString("default", { month: "short", year: "numeric" });
};

const readLocalized = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.en || value.ru || Object.values(value).find((v) => typeof v === "string") || "";
  }
  return "";
};

const toDoctorName = (doctor) => {
  if (!doctor) return "Unknown";
  const first = readLocalized(doctor.firstName);
  const middle = readLocalized(doctor.middleName);
  const last = readLocalized(doctor.lastName);
  const fullName = [last, first, middle].filter(Boolean).join(" ").trim();
  return fullName || doctor.email || "Unknown";
};

const matchesAppointmentStatuses = (booking, appointmentStatuses) => {
  if (!appointmentStatuses.length) return true;
  const appointmentSet = new Set(appointmentStatuses.map(normalize));
  const bookingStatus = normalize(booking?.status);
  return appointmentSet.has(bookingStatus);
};

const matchesPaymentStatuses = (booking, paymentStatuses) => {
  if (!paymentStatuses.length) return true;
  const paymentSet = new Set(paymentStatuses.map(normalize));
  return paymentSet.has(getPaymentStatus(booking));
};

const loadBookings = async (query, { populateDoctors = false } = {}) => {
  const mongooseQuery = EarlyDetectionBooking.find(buildBaseQuery(query));

  if (populateDoctors) {
    mongooseQuery.populate({
      path: "schedule.specialistConsultations.doctor",
      select: "firstName middleName lastName email specialty",
    });
  }

  return mongooseQuery.lean();
};

exports.getEarlyDetectionSummary = async (req, res) => {
  try {
    const appointmentStatuses = parseList(req.query.appointmentStatus);
    const paymentStatuses = parseList(req.query.paymentStatus);
    const bookings = await loadBookings(req.query);
    const filtered = bookings.filter(
      (b) => matchesAppointmentStatuses(b, appointmentStatuses) && matchesPaymentStatuses(b, paymentStatuses),
    );
    const totalApplications = filtered.length;

  const overallRevenue = filtered.reduce((sum, booking) => {
      const amount = getPaymentAmountRub(booking);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const byServiceTypeMap = new Map();
    filtered.forEach((booking) => {
      const key = readLocalized(booking?.package?.name) || booking?.package?.id || "Unknown";
      byServiceTypeMap.set(key, (byServiceTypeMap.get(key) || 0) + 1);
    });

    let totalNeeded = 0;
    let totalBooked = 0;
    filtered.forEach((booking) => {
      const list = Array.isArray(booking?.schedule?.specialistConsultations)
        ? booking.schedule.specialistConsultations
        : [];
      totalNeeded += list.length;
      totalBooked += list.filter((item) => !!item?.isCompleted).length;
    });

    res.status(200).json({
      totalApplications,
      byServiceType: Array.from(byServiceTypeMap.entries()).map(([name, count]) => ({
        _id: name,
        count,
      })),
      revenueSummary: {
        byStatus: [],
        overallRevenue,
      },
      followUpStats: {
        totalNeeded,
        totalBooked,
      },
      topDoctors: [],
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching early detection summary" });
  }
};

exports.getEarlyDetectionRevenueTrend = async (req, res) => {
  try {
    const appointmentStatuses = parseList(req.query.appointmentStatus);
    const paymentStatuses = parseList(req.query.paymentStatus);

    const bookings = await loadBookings(req.query);
    const filtered = bookings.filter(
      (b) => matchesAppointmentStatuses(b, appointmentStatuses) && matchesPaymentStatuses(b, paymentStatuses),
    );

    const byMonth = new Map();

    filtered.forEach((booking) => {
      const latestPayment = getLatestPayment(booking);
      const dt = latestPayment?.paidAt || latestPayment?.changedAt || booking?.createdAt;
      if (!dt) return;

      const month = getMonthKey(dt);
      const status = getPaymentStatus(booking) || "unknown";
      const amount = getPaymentAmountRub(booking);

      if (!byMonth.has(month)) {
        byMonth.set(month, {
          month,
          statuses: {},
          totalRevenue: 0,
          totalApplications: 0,
        });
      }

      const row = byMonth.get(month);
      if (!row.statuses[status]) {
        row.statuses[status] = { revenue: 0, applications: 0 };
      }
      row.statuses[status].revenue += amount;
      row.statuses[status].applications += 1;
      row.totalRevenue += amount;
      row.totalApplications += 1;
    });

    const sorted = Array.from(byMonth.values()).sort((a, b) => {
      const [am, ay] = a.month.split("/").map(Number);
      const [bm, by] = b.month.split("/").map(Number);
      return new Date(ay, am - 1) - new Date(by, bm - 1);
    });

    res.status(200).json(sorted);
  } catch (err) {
    res.status(500).json({ message: "Error fetching revenue trend" });
  }
};

exports.getEarlyDetectionDoctorPerformance = async (req, res) => {
  try {
    const appointmentStatuses = parseList(req.query.appointmentStatus);
    const paymentStatuses = parseList(req.query.paymentStatus);

    const bookings = await loadBookings(req.query, { populateDoctors: true });
    const filtered = bookings.filter(
      (b) => matchesAppointmentStatuses(b, appointmentStatuses) && matchesPaymentStatuses(b, paymentStatuses),
    );

    const doctorMap = new Map();

    filtered.forEach((booking) => {
      const revenue = getPaymentAmountRub(booking);
      const consultations = Array.isArray(booking?.schedule?.specialistConsultations)
        ? booking.schedule.specialistConsultations
        : [];

      consultations.forEach((item) => {
        const doctor = item?.doctor;
        const doctorEmail = doctor?.email || String(doctor?._id || "unknown");
        const doctorName = toDoctorName(doctor);
        const specialty = readLocalized(item?.title) || "Specialist";

        if (!doctorMap.has(doctorEmail)) {
          doctorMap.set(doctorEmail, {
            _id: doctorEmail,
            doctorEmail,
            doctorName,
            specialty,
            totalRevenue: 0,
            totalApplications: 0,
            totalWorkingHours: 0,
            completed: 0,
            pending: 0,
            cancelled: 0,
            revenueByStatus: [],
          });
        }

        const row = doctorMap.get(doctorEmail);
        row.totalApplications += 1;
        row.totalRevenue += revenue;
        row.totalWorkingHours += 1;
        if (booking?.status === "completed") row.completed += 1;
        else if (booking?.status === "cancelled") row.cancelled += 1;
        else row.pending += 1;
      });
    });

    const result = Array.from(doctorMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: "Error fetching doctor performance" });
  }
};

exports.getEarlyDetectionModeSplit = async (_req, res) => {
  res.status(200).json([]);
};

exports.getEarlyDetectionVerificationStats = async (req, res) => {
  try {
    const appointmentStatuses = parseList(req.query.appointmentStatus);
    const paymentStatuses = parseList(req.query.paymentStatus);

    const bookings = await loadBookings(req.query);
    const filtered = bookings.filter(
      (b) => matchesAppointmentStatuses(b, appointmentStatuses) && matchesPaymentStatuses(b, paymentStatuses),
    );

    let prescriptionsVerified = 0;
    let prescriptionsPending = 0;
    let conclusionsVerified = 0;
    let conclusionsPending = 0;

    filtered.forEach((booking) => {
      const list = Array.isArray(booking?.schedule?.specialistConsultations)
        ? booking.schedule.specialistConsultations
        : [];

      list.forEach((item) => {
        const form = item?.historyForm || {};
        if (form?.treatmentPlan?.isVerified) prescriptionsVerified += 1;
        else prescriptionsPending += 1;

        if (form?.clinicalDiagnosis?.isVerified) conclusionsVerified += 1;
        else conclusionsPending += 1;
      });
    });

    res.status(200).json({
      prescriptionsVerified,
      prescriptionsPending,
      conclusionsVerified,
      conclusionsPending,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching verification stats" });
  }
};

exports.getEarlyDetectionServiceGrowth = async (req, res) => {
  try {
    const appointmentStatuses = parseList(req.query.appointmentStatus);
    const paymentStatuses = parseList(req.query.paymentStatus);
    const { startDate, endDate } = req.query;

    const bookings = await loadBookings(req.query);
    const filtered = bookings.filter(
      (b) => matchesAppointmentStatuses(b, appointmentStatuses) && matchesPaymentStatuses(b, paymentStatuses),
    );

    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;

    const byMonth = new Map();

    filtered.forEach((booking) => {
      const list = Array.isArray(booking?.schedule?.specialistConsultations)
        ? booking.schedule.specialistConsultations
        : [];

      list.forEach((item) => {
        const date = item?.date ? new Date(item.date) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        if (from && date < from) return;
        if (to && date > to) return;

        const month = getMonthLabel(date);
        const service = readLocalized(item?.title) || "Specialist";

        if (!byMonth.has(month)) byMonth.set(month, { month });
        const row = byMonth.get(month);
        row[service] = (row[service] || 0) + 1;
      });
    });

    const result = Array.from(byMonth.values()).sort((a, b) => {
      const da = new Date(`1 ${a.month}`);
      const db = new Date(`1 ${b.month}`);
      return da - db;
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: "Error fetching monthly service growth" });
  }
};

exports.getEarlyDetectionSpecialtyStats = async (req, res) => {
  try {
    const appointmentStatuses = parseList(req.query.appointmentStatus);
    const paymentStatuses = parseList(req.query.paymentStatus);

    const bookings = await loadBookings(req.query);
    const filtered = bookings.filter(
      (b) => matchesAppointmentStatuses(b, appointmentStatuses) && matchesPaymentStatuses(b, paymentStatuses),
    );

    const counter = new Map();

    filtered.forEach((booking) => {
      const list = Array.isArray(booking?.schedule?.specialistConsultations)
        ? booking.schedule.specialistConsultations
        : [];

      list.forEach((item) => {
        const name = readLocalized(item?.title) || "Specialist";
        counter.set(name, (counter.get(name) || 0) + 1);
      });
    });

    const result = Array.from(counter.entries())
      .map(([name, count]) => ({ _id: name, count }))
      .sort((a, b) => b.count - a.count);

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: "Error fetching early detection specialties" });
  }
};
