import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  getAppointmentsByDoctor,
  getDoctorEarlyDetectionApplications,
  getEmailFromToken,
  getCalendarApplications,
  getDoctor,
  addDoctorBreak,
  getDoctorBreaks,
  deleteDoctorBreak,
  updateDoctorBreak,
} from "../utils/api";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";
import "moment/locale/ru";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { formatAppointmentDateTime, formatTimeHHMM, formatDateISO } from "../utils/dateFormat";
import {
  Calendar,
  CheckCircle,
  User,
  Mail,
  Phone,
  MessageCircle,
  Send,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Table,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Clock,
  Plus,
  Trash2,
  Download,
} from "lucide-react";
import SearchBar from "../components/SearchBar/SearchBar";
import FilterDropdown from "../components/Filter/Filter";
import "../styles/Appointments.css";
import CalendarSelect from "../components/CalendarSelect";

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "asc",
  });
  const [viewMode, setViewMode] = useState("calendar"); // "table" or "calendar"
  const translateStatus = (s) =>
    t(`appointmentStatus.${(s || "").toLowerCase()}`);

  // --- Calendar view state ---
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    moment().startOf("isoWeek"),
  );
  const [selectedDay, setSelectedDay] = useState(() => moment());
  const [miniCalMonth, setMiniCalMonth] = useState(() =>
    moment().startOf("month"),
  );
  const [weekEvents, setWeekEvents] = useState([]);
  const [weekBreaks, setWeekBreaks] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [miniCalOpen, setMiniCalOpen] = useState(false); // mobile toggle

  // header menu states
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showDayMenu, setShowDayMenu] = useState(false);
  const [dayMenuPos, setDayMenuPos] = useState({ x: 0, y: 0 });
  const [selectedBreakDate, setSelectedBreakDate] = useState(null);

  // Doctor profile info for the break modal
  const [doctorInfo, setDoctorInfo] = useState({ name: "", email: "" });

  // Break form state
  const [breakEntries, setBreakEntries] = useState([
    { startTime: "12:00", endTime: "12:30" },
  ]);
  const [breakComment, setBreakComment] = useState("");
  const [breakSaving, setBreakSaving] = useState(false);
  const [existingBreaksForDate, setExistingBreaksForDate] = useState(null); // null=loading, [] = none
  const [existingBreakDocId, setExistingBreakDocId] = useState(null);
  const [deletingBreakIdx, setDeletingBreakIdx] = useState(null);

  // When the modal opens for a date, load existing breaks for that date
  useEffect(() => {
    if (!showBreakModal || !selectedBreakDate) {
      setExistingBreaksForDate(null);
      setExistingBreakDocId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getDoctorBreaks(selectedBreakDate);
        if (cancelled) return;
        const docs = data.breaks || [];
        // Find doc for this date
        const doc = docs.find((d) => d.date === selectedBreakDate);
        if (doc) {
          setExistingBreaksForDate(doc.breaks || []);
          setExistingBreakDocId(doc._id);
        } else {
          setExistingBreaksForDate([]);
          setExistingBreakDocId(null);
        }
      } catch {
        if (!cancelled) setExistingBreaksForDate([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBreakModal, selectedBreakDate]);

  // Fetch doctor info once
  useEffect(() => {
    const loadDoctor = async () => {
      try {
        const res = await getDoctor();
        const doc = res.doctor || res;
        const firstName = doc.firstName?.en || doc.firstName || "";
        const lastName = doc.lastName?.en || doc.lastName || "";
        setDoctorInfo({
          name: `${firstName} ${lastName}`.trim() || doc.email || "",
          email: doc.email || getEmailFromToken() || "",
        });
      } catch {
        const email = getEmailFromToken() || "";
        setDoctorInfo({ name: email, email });
      }
    };
    loadDoctor();
  }, []);

  // close day menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (
        !e.target.closest(".day-header-menu") &&
        !e.target.closest(".week-day-header")
      ) {
        setShowDayMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { t, i18n } = useTranslation();
  moment.locale(i18n.language);

  const calendarRef = useRef(null);

  // month/year dropdown options for mini calendar (localized via i18n)
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => t(`months.${i}`)),
    [t],
  );
  const currentYear = moment().year();
  const yearRange = [];
  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    yearRange.push(y);
  }

  // keep moment in sync with i18n language so month/day names translate
  useEffect(() => {
    moment.locale(i18n.language);
    // also ensure miniCalMonth updates if language change affects locale-specific data
    setMiniCalMonth((m) => m.clone());
  }, [i18n.language]);
  const recordsPerPage = 10;

  const displayedAppointments = useMemo(() => {
    const startIdx = (currentPage - 1) * recordsPerPage;
    return appointments.slice(startIdx, startIdx + recordsPerPage);
  }, [appointments, currentPage]);

  const getAppointmentTypeLabel = (appt) => {
    if (appt.type === "earlyDetection") {
      return t("appointments.types.earlyDetection", "Early Detection");
    }
    return t("appointments.types.application", "Application");
  };

  // helper for clicking calendar events
  const handleCalendarEventClick = (ev) => {
    const appointmentId = ev.applicationId || ev.id;

    if (!appointmentId) return;
    // don't pass the full ev object (contains functions/moment instances)
    if (ev.type === "earlyDetection") {
      window.open(`/early-detection-bookings/${encodeURIComponent(appointmentId)}`, "_blank");
    } else {
      window.open(`/appointments/${encodeURIComponent(appointmentId)}`, "_blank");
    }
  };

  // --- Mini-calendar helpers ---
  const miniCalWeeks = useMemo(() => {
    const startOfMonth = miniCalMonth.clone().startOf("month");
    const endOfMonth = miniCalMonth.clone().endOf("month");
    const startDate = startOfMonth.clone().startOf("isoWeek");
    const endDate = endOfMonth.clone().endOf("isoWeek");
    const weeks = [];
    const day = startDate.clone();
    while (day.isSameOrBefore(endDate, "day")) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(day.clone());
        day.add(1, "day");
      }
      weeks.push(week);
    }
    return weeks;
  }, [miniCalMonth]);

  const miniCalDayEventCounts = useMemo(() => {
    const allowedRegularStatuses = new Set(["confirmed", "upcoming", "completed"]);
    const allowedEarlyDetectionStatuses = new Set([
      "pending",
      "confirmed",
      "completed",
    ]);
    const counts = {};
    appointments.forEach((appt) => {
      const statusKey = (appt?.appointmentStatus || appt?.status || "").toLowerCase();
      const isEarlyDetection = appt?.type === "earlyDetection";
      const allowed = isEarlyDetection
        ? allowedEarlyDetectionStatuses
        : allowedRegularStatuses;
      if (!allowed.has(statusKey)) return;

      const datePart = formatDateISO(appt?.date);
      const startPart = formatTimeHHMM(appt?.startTime);
      const startMoment =
        datePart && startPart
          ? moment(`${datePart} ${startPart}`, "YYYY-MM-DD HH:mm")
          : appt?.startTime
            ? moment(appt.startTime)
            : appt?.date
              ? moment(appt.date)
              : null;
      if (!startMoment || !startMoment.isValid()) return;

      const key = startMoment.format("YYYY-MM-DD");
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  const selectedWeekEnd = useMemo(
    () => selectedWeekStart.clone().endOf("isoWeek"),
    [selectedWeekStart],
  );

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(selectedWeekStart.clone().add(i, "days"));
    }
    return days;
  }, [selectedWeekStart]);

  // Time slots from 09:00 to 18:00 (half-hour)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 18; h++) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
      if (h < 18) slots.push(`${String(h).padStart(2, "0")}:30`);
    }
    return slots;
  }, []);

  // Fetch events for the selected week
  const fetchWeekEvents = useCallback(async () => {
    setCalendarLoading(true);
    try {
      // Fetch appointments, early detection appointments, and breaks in parallel
      const [appResponse, earlyDetectionResponse, breaksResponse] =
        await Promise.allSettled([
          getCalendarApplications({
            start: selectedWeekStart.toISOString(),
            end: selectedWeekEnd.toISOString(),
            status: filter !== "all" ? filter : undefined,
            doctorEmail: getEmailFromToken(),
          }),
          getDoctorEarlyDetectionApplications(getEmailFromToken()),
          getDoctorBreaks(),
        ]);

      // Map regular appointments
      const apps =
        appResponse.status === "fulfilled"
          ? appResponse.value.data?.applications || []
          : [];
      const mapped = apps
        .map((app) => ({
          id: app.applicationId || app._id,
          title:
            app.patientName ||
            app.patient?.email ||
            t("appointment.unknownPatient"),
          start: app.startTime ? moment(app.startTime) : null,
          end: app.endTime ? moment(app.endTime) : null,
          status: app.appointmentStatus || "unconfirmed",
          applicationId: app.applicationId,
          type: "application",
          isBreak: false,
        }))
        .filter((ev) => ev.start && ev.end);

      const earlyDetectionApps =
        earlyDetectionResponse.status === "fulfilled" &&
          Array.isArray(earlyDetectionResponse.value?.data)
          ? earlyDetectionResponse.value.data
          : [];
      const earlyMapped = earlyDetectionApps
        .map((app) => {
          const datePart = formatDateISO(app?.date);
          const startPart = formatTimeHHMM(app?.startTime);
          const endPart = formatTimeHHMM(app?.endTime);

          const start =
            datePart && startPart
              ? moment(`${datePart} ${startPart}`, "YYYY-MM-DD HH:mm")
              : app?.startTime
                ? moment(app.startTime)
                : null;
          const end =
            datePart && endPart
              ? moment(`${datePart} ${endPart}`, "YYYY-MM-DD HH:mm")
              : app?.endTime
                ? moment(app.endTime)
                : null;
          return {
            id: app.applicationId || app._id || app.id,
            title:
              app.patientName ||
              app.patientEmail ||
              app.patient?.email ||
              t("appointment.unknownPatient"),
            start,
            end,
            status: app.appointmentStatus || "unconfirmed",
            applicationId: app.applicationId,
            type: "earlyDetection",
            isBreak: false,
          };
        })
        .filter((ev) => ev.start && ev.end);

      if (appResponse.status === "rejected") {
        // Fallback dummy events for development
        if (process.env.NODE_ENV !== "production") {
          const dummyStart = selectedWeekStart
            .clone()
            .add(1, "day")
            .set({ hour: 10, minute: 0 });
          const dummyEnd = dummyStart.clone().add(1, "hour");
          mapped.push({
            id: "demo-1",
            title: "N Sasikumar",
            start: dummyStart,
            end: dummyEnd,
            status: "unconfirmed",
            applicationId: "demo-1",
            type: "application",
            isBreak: false,
          });
        }
      }

      const combinedEvents = [...mapped, ...earlyMapped];
      setWeekEvents(combinedEvents);

      // Map breaks – each DoctorBreak document has breaks[] array
      const breakDocs =
        breaksResponse.status === "fulfilled"
          ? breaksResponse.value.breaks || []
          : [];
      const breakEvents = [];
      breakDocs.forEach((doc) => {
        (doc.breaks || []).forEach((b, bIdx) => {
          const startMoment = moment(
            `${doc.date} ${b.startTime}`,
            "YYYY-MM-DD HH:mm",
          );
          const endMoment = moment(
            `${doc.date} ${b.endTime}`,
            "YYYY-MM-DD HH:mm",
          );
          if (startMoment.isValid() && endMoment.isValid()) {
            breakEvents.push({
              id: `break-${doc._id}-${bIdx}`,
              docId: doc._id,
              title: t("common.break"),
              comment: doc.comment || "",
              start: startMoment,
              end: endMoment,
              isBreak: true,
            });
          }
        });
      });
      setWeekBreaks(breakEvents);
    } catch (err) {
      console.error("Week events fetch error:", err);
    } finally {
      setCalendarLoading(false);
    }
  }, [selectedWeekStart, selectedWeekEnd, filter]);

  useEffect(() => {
    if (viewMode === "calendar") {
      fetchWeekEvents();
    }
  }, [viewMode, fetchWeekEvents]);

  const handleDaySelect = (day) => {
    setSelectedDay(day.clone());
    setSelectedWeekStart(day.clone().startOf("isoWeek"));
    if (!day.isSame(miniCalMonth, "month")) {
      setMiniCalMonth(day.clone().startOf("month"));
    }
  };

  const canModifyDay = (day) => {
    // don't allow break/cancel on past days or days where all events are completed
    if (day.isBefore(moment(), "day")) return false;
    const events = weekEvents.filter((ev) => ev.start.isSame(day, "day"));
    if (
      events.length &&
      events.every((ev) => ev.status?.toLowerCase() === "completed")
    ) {
      return false;
    }
    return true;
  };

  // Position helpers for week grid events
  // make a light version of a hex colour by increasing each channel
  const lightenColor = (hex, amount = 40) => {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((v) => v + v).join("");
    const num = parseInt(c, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00ff) + amount;
    let b = (num & 0x0000ff) + amount;
    r = r > 255 ? 255 : r;
    g = g > 255 ? 255 : g;
    b = b > 255 ? 255 : b;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  const getEventStyle = (event, dayIndex) => {
    const startHour = event.start.hour() + event.start.minute() / 60;
    const endHour = event.end.hour() + event.end.minute() / 60;
    const gridStartHour = 9;
    const slotHeight = 60; // px per 30 min (matched CSS row height)
    const top = (startHour - gridStartHour) * slotHeight * 2;
    const height = (endHour - startHour) * slotHeight * 2;
    const statusColors = {
      confirmed: { border: "#86efac", text: "#166534", bg: "#dcfce7" },
      completed: { border: "#86efac", text: "#166534", bg: "#dcfce7" },
      paid: { border: "#6ee7b7", text: "#065f46", bg: "#d1fae5" },
      upcoming: { border: "#fde68a", text: "#854d0e", bg: "#fef9c3" },
      new: { border: "#c4b5fd", text: "#5b21b6", bg: "#ede9fe" },
      "pending payment": { border: "#f9a8d4", text: "#9d174d", bg: "#fce7f3" },
      "awaiting for payment": { border: "#fcd34d", text: "#92400e", bg: "#fef3c7" },
      cancelled: { border: "#fca5a5", text: "#991b1b", bg: "#fee2e2" },
      unconfirmed: { border: "#fdba74", text: "#9a3412", bg: "#fed7aa" },
    };
    const key = (event.status || "").toLowerCase();
    const colors = statusColors[key] || statusColors.unconfirmed;
    return {
      top: `${top}px`,
      // Keep enough room for type badge + title + time + status lines.
      height: `${Math.max(height, 72)}px`,
      backgroundColor: colors.bg,
      borderLeft: `3px solid ${colors.border}`,
      color: colors.text,
    };
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    const tokenEmail = getEmailFromToken();
    const doctorEmail = doctorInfo.email || tokenEmail;


    if (!doctorEmail) {
      setError("Doctor not authenticated");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [regularResult, earlyDetectionResult] = await Promise.allSettled([
        getAppointmentsByDoctor(
          doctorEmail,
          1,
          1000,
          filter,
          debouncedSearchTerm,
        ),
        getDoctorEarlyDetectionApplications(doctorEmail),
      ]);

      const regularAppointments =
        regularResult.status === "fulfilled"
          ? regularResult.value.appointments || []
          : [];

      const earlyDetectionRaw =
        earlyDetectionResult.status === "fulfilled" &&
          Array.isArray(earlyDetectionResult.value?.data)
          ? earlyDetectionResult.value.data
          : [];
      const earlyDetectionAppointments = Array.from(
        new Map(earlyDetectionRaw.map((b) => [String(b?._id || b?.applicationId), b])).values()
      );

      const normalizedRegular = regularAppointments.map((appt) => ({
        ...appt,
        type: "application",
        appointmentId: appt.applicationId || appt._id || appt.id,
      }));

      const normalizedEarlyDetection = earlyDetectionAppointments.map((appt) => ({
        ...appt,
        type: "earlyDetection",
        appointmentId: appt.applicationId || appt._id || appt.id,
      }));

      const mergedAppointments = [...normalizedRegular, ...normalizedEarlyDetection];

      setAppointments(mergedAppointments);
      setTotalRecords(mergedAppointments.length);
      setCurrentPage(1);
    } catch (err) {
      console.error("[PAGE] fetchAppointments error:", err);
      setError(err.message || t("appointment.toast.failedLoadAppointments"));
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearchTerm, doctorInfo.email]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    const formattedAppointments = appointments.map((appt) => ({
      appointmentId: appt.applicationId || appt._id,
      date: appt.date ? formatDateISO(appt.date) : "",
      startTime: appt.startTime ? formatTimeHHMM(appt.startTime) : "",
      endTime: appt.endTime ? formatTimeHHMM(appt.endTime) : "",
    }));

  }, [appointments]);

  const getPatientName = (appt) => {
    if (appt.patientName) return appt.patientName;
    if (appt.patientDetails?.firstName) {
      const fn =
        appt.patientDetails.firstName?.en ||
        appt.patientDetails.firstName ||
        "";
      const mn =
        appt.patientDetails.middleName?.en ||
        appt.patientDetails.middleName ||
        "";
      const ln =
        appt.patientDetails.lastName?.en || appt.patientDetails.lastName || "";
      return (
        [fn, mn, ln].filter(Boolean).join(" ").trim() ||
        appt.patientEmail ||
        t("appointment.unknownPatient")
      );
    }
    return appt.patientEmail || appt.patient || t("appointment.unknownPatient");
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth)) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const getPatientFirstName = (appt) => {
    if (appt.patientDetails?.firstName) {
      return appt.patientDetails.firstName?.en || appt.patientDetails.firstName || "";
    }
    const name = appt.patientName || "";
    return name.split(" ")[0] || "";
  };

  const getPatientLastName = (appt) => {
    if (appt.patientDetails?.lastName) {
      return appt.patientDetails.lastName?.en || appt.patientDetails.lastName || "";
    }
    const name = appt.patientName || "";
    return name.split(" ").slice(1).join(" ") || "";
  };

  const formatDateTime = (date, startTime, endTime) => {
    const formatted = formatAppointmentDateTime(date, startTime, endTime);
    return formatted || t("common.notAvailable");
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    const sorted = [...appointments].sort((a, b) => {
      if (!a[key]) return 1;
      if (!b[key]) return -1;
      if (typeof a[key] === "string") {
        return direction === "asc"
          ? a[key].localeCompare(b[key])
          : b[key].localeCompare(a[key]);
      }
      return direction === "asc"
        ? new Date(a[key]) - new Date(b[key])
        : new Date(b[key]) - new Date(a[key]);
    });
    setAppointments(sorted);
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const paginate = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getStatusBadge = (status, t) => {
    const statusStyles = {
      confirmed: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
      completed: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
      upcoming: { bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
      cancelled: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
      unconfirmed: { bg: "#fed7aa", color: "#9a3412", border: "#fdba74" },
      new: { bg: "#ede9fe", color: "#5b21b6", border: "#c4b5fd" },
      paid: { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
      "pending payment": { bg: "#fce7f3", color: "#9d174d", border: "#f9a8d4" },
      "awaiting for payment": {
        bg: "#fef3c7",
        color: "#92400e",
        border: "#fcd34d",
      },
    };

    const key = (status || "").toLowerCase();
    const style = statusStyles[key] || statusStyles.unconfirmed;

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "3px 10px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 600,
          background: style.bg,
          color: style.color,
          border: `1px solid ${style.border}`,
          whiteSpace: "nowrap",
        }}
      >
        {t(`appointmentStatus.${key}`, status || t("common.unknown"))}
      </span>
    );
  };

  const handleFilterChange = (value) => {
    setFilter(value);
    setCurrentPage(1);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!appointments || appointments.length === 0) {
      toast.info(t("appointments.noDataToExport"));
      return;
    }
    const headers = [
      t("appointments.csv.id"),
      t("appointments.csv.patientName"),
      t("appointments.csv.patientEmail"),
      t("appointments.csv.serviceType"),
      t("appointments.csv.type"),
      t("appointments.csv.date"),
      t("appointments.csv.startTime"),
      t("appointments.csv.endTime"),
      t("appointments.csv.status"),
    ];
    const rows = appointments.map((a) => [
      a.applicationId || a._id,
      getPatientName(a),
      a.patientEmail || "",
      a.serviceType || "",
      getAppointmentTypeLabel(a),
      a.date ? formatDateISO(a.date) : "",
      a.startTime ? formatTimeHHMM(a.startTime) : "",
      a.endTime ? formatTimeHHMM(a.endTime) : "",
      a.appointmentStatus || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `appointments_${formatDateISO(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("appointments.exportSuccess"));
  };

  return (
    <div className="applications-layout">
      <ToastContainer position="top-right" autoClose={3000} />
      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            border: "1px solid #fca5a5",
          }}
        >
          {error}
        </div>
      )}
      <div className="appt-page-header">
        <div className="appt-page-header-left">
          <h1 className="appt-page-title">
            {t("appointments.title")}
          </h1>
        </div>
        <div className="appt-page-header-right">
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            placeholder={t("appointments.searchPlaceholder")}
            style={{ width: "260px" }}
          />
          <FilterDropdown
            value={filter}
            onChange={handleFilterChange}
            placeholder={t("appointments.filter")}
            options={["all", "upcoming", "confirmed", "completed", "cancelled"].map((v) => ({
              value: v,
              label: t(`appointments.filters.${v}`),
            }))}
          />
          <button className="appt-export-btn" onClick={handleExportCSV}>
            <Download size={16} />
          </button>
          <div className="appt-view-toggle">
            <button
              className={`appt-view-toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
              onClick={() => setViewMode("calendar")}
              title="Calendar View"
            >
              <CalendarDays size={16} />
            </button>
            <button
              className={`appt-view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <Table size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Day menu + Break modal + Views */}
      {showDayMenu && (
        <div
          className="day-header-menu"
          style={{ top: dayMenuPos.y, left: dayMenuPos.x }}
          onMouseLeave={() => setShowDayMenu(false)}
        >
          <button
            className="header-menu-item"
            onClick={() => setShowDayMenu(false)}
          >
            {t("appointments.weeklySchedule")}
          </button>
          {canModifyDay(moment(selectedBreakDate)) && (
            <>
              <button
                className="header-menu-item"
                onClick={() => {
                  setShowDayMenu(false);
                  setShowBreakModal(true);
                }}
              >
                {t("appointments.addBreak")}
              </button>
              <button
                className="header-menu-item"
                onClick={() => {
                  setShowDayMenu(false);
                  toast.info(t("appointments.workingDayCancelled"));
                }}
              >
                {t("appointments.cancelWorkingDay")}
              </button>
            </>
          )}
        </div>
      )}
      {showBreakModal && (
        <div
          className="break-modal-overlay"
          onClick={() => {
            setShowBreakModal(false);
            setExistingBreaksForDate(null);
            setExistingBreakDocId(null);
          }}
        >
          <div
            className="break-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — dark navy */}
            <div className="break-modal-header">
              <h3>{t("appointments.addBreak")}</h3>
              <button
                className="break-modal-close"
                onClick={() => {
                  setShowBreakModal(false);
                  setExistingBreaksForDate(null);
                  setExistingBreakDocId(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="break-modal-body">
              {/* Doctor name */}
              {doctorInfo.name && (
                <p className="break-doctor-name">{doctorInfo.name}</p>
              )}

              {/* Existing breaks for this date */}
              {existingBreaksForDate === null && (
                <p className="break-loading-text">
                  {t("appointments.loadingBreaks")}
                </p>
              )}
              {Array.isArray(existingBreaksForDate) &&
                existingBreaksForDate.length > 0 && (
                  <div className="existing-breaks-list">
                    <p className="existing-breaks-title">
                      {t("appointments.savedBreaksFor", {
                        date: selectedBreakDate || "today",
                      })}
                    </p>
                    {existingBreaksForDate.map((b, idx) => (
                      <div key={idx} className="existing-break-row">
                        <span className="existing-break-time">
                          {b.startTime} – {b.endTime}
                        </span>
                        <button
                          className="existing-break-delete"
                          disabled={deletingBreakIdx === idx}
                          onClick={async () => {
                            if (!existingBreakDocId) return;
                            setDeletingBreakIdx(idx);
                            try {
                              // Remove just this slot by updating the breaks array
                              const updated = existingBreaksForDate.filter(
                                (_, i) => i !== idx,
                              );
                              if (updated.length === 0) {
                                await deleteDoctorBreak(existingBreakDocId);
                                setExistingBreaksForDate([]);
                                setExistingBreakDocId(null);
                              } else {
                                await updateDoctorBreak(existingBreakDocId, {
                                  breaks: updated,
                                });
                                setExistingBreaksForDate(updated);
                              }
                              fetchWeekEvents();
                              toast.success(t("appointments.breakRemoved"));
                            } catch {
                              toast.error(t("appointments.breakRemoveFailed"));
                            } finally {
                              setDeletingBreakIdx(null);
                            }
                          }}
                          title="Remove this break"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              {/* Break time ranges */}
              <div className="break-times-list">
                {breakEntries.map((entry, idx) => (
                  <div key={idx} className="break-time-row">
                    <input
                      type="time"
                      className="break-time-input"
                      value={entry.startTime}
                      onChange={(e) => {
                        const updated = [...breakEntries];
                        updated[idx].startTime = e.target.value;
                        setBreakEntries(updated);
                      }}
                    />
                    <span className="break-time-dash">–</span>
                    <input
                      type="time"
                      className="break-time-input"
                      value={entry.endTime}
                      onChange={(e) => {
                        const updated = [...breakEntries];
                        updated[idx].endTime = e.target.value;
                        setBreakEntries(updated);
                      }}
                    />
                    {breakEntries.length > 1 && (
                      <button
                        className="break-remove-btn"
                        onClick={() =>
                          setBreakEntries(
                            breakEntries.filter((_, i) => i !== idx),
                          )
                        }
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* + Break link */}
              <button
                className="break-add-link"
                onClick={() =>
                  setBreakEntries([
                    ...breakEntries,
                    { startTime: "13:00", endTime: "13:30" },
                  ])
                }
              >
                <Plus size={14} /> {t("appointments.breakLabel")}
              </button>

              {/* Comment */}
              <div className="break-comment-group">
                <label className="break-comment-label">
                  {t("appointments.breakComment")}
                </label>
                <textarea
                  className="break-comment-textarea"
                  value={breakComment}
                  onChange={(e) => setBreakComment(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {/* Footer — Save only */}
            <div className="break-modal-footer">
              <button
                className="break-save-btn"
                disabled={breakSaving}
                onClick={async () => {
                  const dateVal =
                    selectedBreakDate || moment().format("YYYY-MM-DD");
                  const validBreaks = breakEntries.filter(
                    (b) => b.startTime && b.endTime && b.startTime < b.endTime,
                  );
                  if (validBreaks.length === 0) {
                    toast.error(t("appointments.breakValidation"));
                    return;
                  }
                  setBreakSaving(true);
                  try {
                    await addDoctorBreak({
                      date: dateVal,
                      breaks: validBreaks,
                      comment: breakComment,
                    });
                    toast.success(t("appointments.breakAdded"));
                    setShowBreakModal(false);
                    setBreakEntries([{ startTime: "12:00", endTime: "12:30" }]);
                    setBreakComment("");
                    setSelectedBreakDate(null);
                    setExistingBreaksForDate(null);
                    setExistingBreakDocId(null);
                    fetchWeekEvents(); // refresh calendar to show the new break
                  } catch (err) {
                    toast.error(
                      err?.response?.data?.message ||
                      t("appointments.breakAddFailed"),
                    );
                  } finally {
                    setBreakSaving(false);
                  }
                }}
              >
                {breakSaving
                  ? t("appointments.savingBreak")
                  : t("appointments.saveBreak")}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewMode === "table" ? (
        <div className="table-view-container">
          <div className="application-modern-table">
            <table className="application-modern-data-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <span>{t("appointments.patient").toUpperCase()}</span>
                    </div>
                  </th>

                  <th>
                    <div className="th-content">
                      <span>{t("appointments.sex").toUpperCase()}</span>
                    </div>
                  </th>

                  <th>
                    <div className="th-content">
                      <span>{t("appointments.age").toUpperCase()}</span>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort("applicationId")}
                    className="sortable-header"
                  >
                    <div className="th-content">
                      <span>{t("appointments.appointment").toUpperCase()}</span>
                    </div>
                  </th>

                  <th>
                    <div className="th-content">
                      <span>{t("appointments.typeOfService").toUpperCase()}</span>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort("date")}
                    className="sortable-header"
                  >
                    <div className="th-content">
                      <span>{t("appointments.date").toUpperCase()}</span>
                    </div>
                  </th>

                  <th>
                    <div className="th-content">
                      <span>{t("appointments.status").toUpperCase()}</span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayedAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="no-data-row">
                      {loading
                        ? t("appointments.loading")
                        : t("appointments.noAppointments")}
                    </td>
                  </tr>
                ) : (
                  displayedAppointments.map((appt) => (
                    <tr
                      key={appt._id}
                      className="table-row"
                      onClick={() => {
                        const appointmentId = appt.applicationId || appt._id || appt.id;
                        if (appt.type === "earlyDetection") {
                          window.open(
                            `/early-detection-bookings/${encodeURIComponent(appointmentId)}`,
                            "_blank",
                          );
                        } else {
                          window.open(
                            `/appointments/${encodeURIComponent(appointmentId)}`,
                            "_blank",
                          );
                        }
                      }}
                    >
                      {/* Patient Column */}
                      <td>
                        <div className="patient-name-cell">
                          <span className="patient-name-primary">
                            {getPatientFirstName(appt) || getPatientName(appt)}
                          </span>
                          {getPatientLastName(appt) && (
                            <span className="patient-name-secondary">
                              {getPatientLastName(appt)}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Sex Column */}
                      <td>
                        {(() => {
                          const g = (appt.patientDetails?.gender || "").toLowerCase();
                          if (g === "male") return <span className="sex-icon sex-icon--male">♂</span>;
                          if (g === "female") return <span className="sex-icon sex-icon--female">♀</span>;
                          return <span className="sex-icon sex-icon--unknown">—</span>;
                        })()}
                      </td>
                      {/* Age Column */}
                      <td>
                        <span className="age-text">
                          {appt.patientDetails?.dateOfBirth
                            ? calculateAge(appt.patientDetails.dateOfBirth) ?? "—"
                            : "—"}
                        </span>
                      </td>
                      {/* Appointment Column */}
                      <td>
                        <span className="applicationId-text">
                          #{appt.applicationId || appt._id}
                        </span>
                      </td>
                      {/* Type of Service Column */}
                      <td>
                        <span className="appointment-type-label">
                          {getAppointmentTypeLabel(appt)}
                        </span>
                      </td>
                      {/* Date Column */}
                      <td>
                        <div className="appt-date-cell">
                          <span className="appt-date-text">
                            {appt.date ? formatDateDDMMYYYY(appt.date) : t("common.notAvailable")}
                          </span>
                          {(appt.startTime || appt.endTime) && (
                            <span className="appt-time-sub">
                              {appt.startTime ? formatTimeHHMM(appt.startTime) : ""}
                              {appt.endTime ? " – " + formatTimeHHMM(appt.endTime) : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Status Column */}
                      <td>{getStatusBadge(appt.appointmentStatus, t)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination / Results count */}
          <div className="table-footer">
            <span className="results-count">
              {t("appointments.resultsCount", {
                from:
                  displayedAppointments.length > 0
                    ? (currentPage - 1) * recordsPerPage + 1
                    : 0,
                to: Math.min(currentPage * recordsPerPage, totalRecords),
                total: totalRecords,
              })}
            </span>
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => paginate(currentPage - 1)}
                className="pagination-btn"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map(
                (p) => (
                  <button
                    key={p}
                    className={`pagination-btn ${currentPage === p ? "active" : ""}`}
                    onClick={() => paginate(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => paginate(currentPage + 1)}
                className="pagination-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Calendar View - Mini Calendar + Weekly Time Grid */
        <div className="weekly-schedule-layout">
          {/* Mobile mini-cal toggle */}
          <button
            className="mini-cal-toggle-btn"
            onClick={() => setMiniCalOpen((v) => !v)}
            aria-label="Toggle calendar"
          >
            <Calendar size={16} />
            {miniCalOpen
              ? t("appointments.hideCalendar")
              : t("appointments.showCalendar")}
          </button>
          {/* Left: Mini Calendar */}
          <div
            className={`mini-calendar-panel${miniCalOpen ? " mini-cal-open" : ""}`}
          >
            <div className="mini-cal-top-info">
              <div className="mini-cal-current">
                <Calendar size={18} className="mini-cal-icon" />
                <span>
                  {new Intl.DateTimeFormat(i18n.language, {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(selectedDay.toDate())}
                </span>
              </div>
            </div>
            <div className="mini-cal-header">
              <button
                className="mini-cal-nav"
                onClick={() =>
                  setMiniCalMonth((m) => m.clone().subtract(1, "month"))
                }
              >
                <ChevronLeft size={16} />
              </button>
              <div className="mini-cal-title-selects">
                <CalendarSelect
                  value={miniCalMonth.month()}
                  onChange={(m) =>
                    setMiniCalMonth((prev) => prev.clone().month(m))
                  }
                  options={monthNames.map((name, idx) => ({
                    value: idx,
                    label: name,
                  }))}
                />
                <CalendarSelect
                  value={miniCalMonth.year()}
                  onChange={(y) =>
                    setMiniCalMonth((prev) => prev.clone().year(y))
                  }
                  options={yearRange.map((y) => ({
                    value: y,
                    label: String(y),
                  }))}
                />
              </div>
              <button
                className="mini-cal-nav"
                onClick={() =>
                  setMiniCalMonth((m) => m.clone().add(1, "month"))
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mini-cal-grid">
              <div className="mini-cal-day-headers">
                {[
                  t("days.mon"),
                  t("days.tue"),
                  t("days.wed"),
                  t("days.thur"),
                  t("days.fri"),
                  t("days.sat"),
                  t("days.sun"),
                ].map((d) => (
                  <div key={d} className="mini-cal-day-header">
                    {d}
                  </div>
                ))}
              </div>
              {miniCalWeeks.map((week, wIdx) => {
                const isWeekSelected = week.some((day) =>
                  day.isSameOrAfter(selectedWeekStart, "day") &&
                  day.isSameOrBefore(selectedWeekStart.clone().endOf("isoWeek"), "day")
                );
                return (
                  <div
                    key={wIdx}
                    className={`mini-cal-week-row${isWeekSelected ? " selected" : ""}`}
                    onClick={() => handleDaySelect(week[0])}
                  >
                    {week.map((day, dIdx) => {
                      const isCurrentMonth = day.month() === miniCalMonth.month();
                      const isToday = day.isSame(moment(), "day");
                      const dayKey = day.format("YYYY-MM-DD");
                      const dayCount = miniCalDayEventCounts[dayKey] || 0;
                      return (
                        <div
                          key={dIdx}
                          className={`mini-cal-day ${!isCurrentMonth ? "outside" : ""} ${isToday ? "today" : ""}`}
                          onClick={(e) => { e.stopPropagation(); handleDaySelect(day); }}
                        >
                          <span>{day.date()}</span>
                          {dayCount > 0 && (
                            <span className="mini-cal-day-count">
                              {dayCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <button
              className="mini-cal-today-btn"
              onClick={() => {
                const today = moment();
                setMiniCalMonth(today.clone().startOf("month"));
                handleDaySelect(today);
              }}
            >
              {t("calendar.today")}
            </button>
            <div className="mini-cal-legend">
              <div className="legend-item">
                <span className="legend-dot confirmed"></span>{" "}
                {t("appointments.filters.confirmed")}
              </div>
              <div className="legend-item">
                <span className="legend-dot upcoming"></span>{" "}
                {t("appointments.filters.upcoming")}
              </div>
              <div className="legend-item">
                <span className="legend-dot unconfirmed"></span>{" "}
                {t("appointments.filters.unconfirmed")}
              </div>
              <div className="legend-item">
                <span className="legend-dot cancelled"></span>{" "}
                {t("appointments.filters.cancelled")}
              </div>
            </div>
          </div>

          {/* Right: Weekly Time Grid */}
          <div className="week-grid-panel">
            {/* <div className="week-grid-toolbar">
              <button
                className="week-nav-btn"
                onClick={() => {
                  setSelectedWeekStart((w) => {
                    const newWeek = w.clone().subtract(1, "week");
                    setMiniCalMonth(newWeek.clone().startOf("month"));
                    return newWeek;
                  });
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div
                className="week-range-wrapper"
                style={{ position: "relative" }}
              >
                <h3
                  className="week-range-title"
                  onClick={() => setShowHeaderMenu((v) => !v)}
                >
                  {(() => {
                    const fmt = (date, loc) => {
                      const optsStart = { month: "short", day: "numeric" };
                      const optsEnd = {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      };
                      const optsSingle = {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      };
                      if (date.start.isSame(date.end, "day")) {
                        return new Intl.DateTimeFormat(loc, optsSingle).format(
                          date.start.toDate(),
                        );
                      }
                      const startStr = new Intl.DateTimeFormat(
                        loc,
                        optsStart,
                      ).format(date.start.toDate());
                      const endStr = new Intl.DateTimeFormat(
                        loc,
                        optsEnd,
                      ).format(date.end.toDate());
                      return `${startStr} – ${endStr}`;
                    };
                    const range = {
                      start: selectedWeekStart,
                      end: selectedWeekEnd,
                    };
                    const loc = fmt(range, i18n.language);
                    return loc;
                  })()}
                </h3>
                {showHeaderMenu && (
                  <div className="header-menu">
                    <button
                      className="header-menu-item"
                      onClick={() => {
                        setShowHeaderMenu(false);
                      }}
                    >
                      {t("appointments.weeklySchedule")}
                    </button>
                    <button
                      className="header-menu-item"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setSelectedBreakDate(moment().format("YYYY-MM-DD"));
                        setShowBreakModal(true);
                      }}
                    >
                      {t("appointments.addBreak")}
                    </button>
                    <button
                      className="header-menu-item"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        toast.info(t("appointments.workingDayCancelled"));
                      }}
                    >
                      {t("appointments.cancelWorkingDay")}
                    </button>
                  </div>
                )}
              </div>
              <button
                className="week-nav-btn"
                onClick={() => {
                  setSelectedWeekStart((w) => {
                    const newWeek = w.clone().add(1, "week");
                    setMiniCalMonth(newWeek.clone().startOf("month"));
                    return newWeek;
                  });
                }}
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="week-today-btn"
                onClick={() => {
                  setSelectedWeekStart(moment().startOf("isoWeek"));
                  setMiniCalMonth(moment().startOf("month"));
                }}
              >
                {t("appointments.today")}
              </button>
            </div> */}

            {calendarLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>{t("appointments.loadingweek")}</p>
              </div>
            ) : (
              <div className="week-grid-scroll">
                <div className="week-grid">
                  {/* Day headers */}
                  <div className="week-grid-header">
                    <div className="time-gutter-header">
                      <Clock size={16} />
                    </div>
                    {weekDays.map((day, idx) => (
                      <div
                        key={idx}
                        className={`week-day-header ${day.isSame(moment(), "day") ? "today" : ""
                          }${day.isSame(selectedDay, "day") ? " selected-day" : ""}${!canModifyDay(day) ? " disabled-day" : ""}`}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDayMenuPos({
                            x: rect.left + window.scrollX,
                            y: rect.bottom + 4 + window.scrollY,
                          });
                          setSelectedBreakDate(day.format("YYYY-MM-DD"));
                          setShowDayMenu(true);
                          setShowHeaderMenu(false);
                        }}
                      >
                        <span className="week-day-name">
                          {
                            [
                              t("days.mon"),
                              t("days.tue"),
                              t("days.wed"),
                              t("days.thur"),
                              t("days.fri"),
                              t("days.sat"),
                              t("days.sun"),
                            ][day.isoWeekday() - 1]
                          }
                        </span>
                        <span className="week-day-date">{day.format("D")}</span>
                      </div>
                    ))}
                  </div>

                  {/* Time grid body */}
                  <div className="week-grid-body">
                    <div className="time-gutter">
                      {timeSlots.map((slot) => (
                        <div
                          key={slot}
                          className={`time-gutter-cell ${slot.endsWith(":30") ? "half" : ""
                            }`}
                        >
                          {slot.endsWith(":00") ? slot : ""}
                        </div>
                      ))}
                    </div>

                    {weekDays.map((day, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={`week-day-column ${day.isSame(moment(), "day") ? "today" : ""}${day.isSame(selectedDay, "day") ? " selected-day" : ""}`}
                      >
                        {/* Grid lines */}
                        {timeSlots.map((slot) => (
                          <div
                            key={slot}
                            className={`week-time-cell ${slot.endsWith(":30") ? "half" : ""
                              }`}
                          ></div>
                        ))}

                        {/* Appointment events for this day */}
                        {weekEvents
                          .filter((ev) => ev.start.isSame(day, "day"))
                          .map((ev) => {
                            const appointmentId = ev.applicationId || ev.id;
                            const linkPath = appointmentId
                              ? ev.type === "earlyDetection"
                                ? `/early-detection-bookings/${encodeURIComponent(appointmentId)}`
                                : `/appointments/${encodeURIComponent(appointmentId)}`
                              : null;
                            return (
                              <div
                                key={ev.id}
                                className="week-event"
                                style={getEventStyle(ev, dayIdx)}
                                onClick={() => handleCalendarEventClick(ev)}
                                title={`${ev.title} (${ev.start.format("HH:mm")} - ${ev.end.format("HH:mm")})`}
                              >
                                {/* make entire block a Link if we have a path */}
                                {linkPath ? (
                                  <Link to={linkPath} className="event-link" />
                                ) : null}
                                <div className="week-event-badge" style={{
                                  marginBottom: "4px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  color: ev.type === "earlyDetection" ? "#7C3AED" : "#0F172A",
                                }}>
                                  {getAppointmentTypeLabel(ev)}
                                </div>
                                <div className="week-event-title">
                                  {ev.title}
                                </div>
                                <div className="week-event-time">
                                  <Clock size={10} />
                                  {ev.start.format("HH:mm")} -{" "}
                                  {ev.end.format("HH:mm")}
                                </div>
                                <div className="week-event-status">
                                  {translateStatus(ev.status)}
                                </div>
                              </div>
                            );
                          })}

                        {/* Break blocks for this day */}
                        {weekBreaks
                          .filter((b) => b.start.isSame(day, "day"))
                          .map((b) => {
                            const startHour =
                              b.start.hour() + b.start.minute() / 60;
                            const endHour = b.end.hour() + b.end.minute() / 60;
                            const slotHeight = 60;
                            const top = (startHour - 8) * slotHeight * 2;
                            const height = Math.max(
                              (endHour - startHour) * slotHeight * 2,
                              20,
                            );
                            return (
                              <div
                                key={b.id}
                                className="week-break-block"
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                }}
                                title={`Break: ${b.start.format("HH:mm")} – ${b.end.format("HH:mm")}${b.comment ? ` · ${b.comment}` : ""}`}
                              >
                                <div className="week-break-label">
                                  {t("common.break")}
                                </div>
                                <div className="week-break-time">
                                  {b.start.format("HH:mm")} –{" "}
                                  {b.end.format("HH:mm")}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
