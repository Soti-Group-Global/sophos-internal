import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { AuthContext } from "../context/AuthContext";
import {
  getDoctorEarlyDetectionApplications,
  getDoctor,
  getEmailFromToken,
  addDoctorBreak,
  getDoctorBreaks,
  deleteDoctorBreak,
  updateDoctorBreak,
  getDoctorWeeklySchedule,
  getDoctorDateOverride,
} from "../utils/api";
import { useNavigate, Link } from "react-router-dom";
import "../styles/EarlyDetectionApplications.css";
import CalendarSelect from "./CalendarSelect";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/Appointments.css";
import moment from "moment-timezone";
import "moment/locale/ru";
import {
  Calendar,
  ArrowLeft,
  ArrowRight,
  Table,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import SearchBar from "./SearchBar/SearchBar";
import FilterDropdown from "./Filter/Filter";
import {
  formatDateISO,
  formatTimeHHMM,
  formatAppointmentDateTime,
} from "../utils/dateFormat";

// move date helpers inside component so they can use i18n language
// (they will be redefined later after useTranslation is called)

// placeholder definitions – will be replaced inside the component when
// the hooks are available
let formatDate = (dateStr) => {
  const formatted = formatDateISO(dateStr);
  return formatted || "N/A";
};

let formatDateTimeForCSV = (dateString) => {
  if (!dateString) return "N/A";
  const datePart = formatDateISO(dateString);
  const timePart = formatTimeHHMM(dateString);
  if (!datePart || !timePart) return "Invalid date";
  return `${datePart} ${timePart}`;
};

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const key = (status || "").toLowerCase();
  const className =
    {
      upcoming: "status-upcoming",
      completed: "status-completed",
      cancelled: "status-cancelled",
      unconfirmed: "status-unconfirmed",
      confirmed: "status-confirmed",
    }[key] || "status-default";

  return (
    <span className={`early-detect-status-badge ${className}`}>
      {t(`appointmentStatus.${key}`, status || t("common.unknown"))}
    </span>
  );
};

const EarlyDetectionApplications = () => {
  const { user, isLoading } = useContext(AuthContext);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // "table" or "calendar"
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Calendar state
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    moment().startOf("isoWeek"),
  );
  const [selectedDay, setSelectedDay] = useState(() => moment());
  const [miniCalMonth, setMiniCalMonth] = useState(() =>
    moment().startOf("month"),
  );

  // Header menu + break modal state
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showDayMenu, setShowDayMenu] = useState(false);
  const [dayMenuPos, setDayMenuPos] = useState({ x: 0, y: 0 });
  const [selectedBreakDate, setSelectedBreakDate] = useState(null);
  const [doctorInfo, setDoctorInfo] = useState({ name: "", email: "" });
  const [breakEntries, setBreakEntries] = useState([
    { startTime: "12:00", endTime: "12:30" },
  ]);
  const [breakComment, setBreakComment] = useState("");
  const [breakSaving, setBreakSaving] = useState(false);
  const [existingBreaksForDate, setExistingBreaksForDate] = useState(null);
  const [existingBreakDocId, setExistingBreakDocId] = useState(null);
  const [deletingBreakIdx, setDeletingBreakIdx] = useState(null);
  const [weekBreaks, setWeekBreaks] = useState([]);
  const [miniCalOpen, setMiniCalOpen] = useState(false); // mobile toggle
  const [weeklyScheduleCache, setWeeklyScheduleCache] = useState(null);
  const [dateOverrideCache, setDateOverrideCache] = useState({});

  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // helpers that rely on the current locale
  const translateStatus = (s) =>
    t(`appointmentStatus.${(s || "").toLowerCase()}`);

  // Keep strict formatting: date => YYYY-MM-DD, time => HH:mm
  formatDate = (dateStr) => {
    if (!dateStr) return t("common.notAvailable");
    return formatDateISO(dateStr) || t("common.notAvailable");
  };

  formatDateTimeForCSV = (dateString) => {
    if (!dateString) return t("common.notAvailable");
    const datePart = formatDateISO(dateString);
    const timePart = formatTimeHHMM(dateString);
    if (!datePart || !timePart) return "Invalid date";
    return `${datePart} ${timePart}`;
  };

  const formatDateTime = (date, startTime, endTime) => {
    const formatted = formatAppointmentDateTime(date, startTime, endTime);
    return formatted || t("common.notAvailable");
  };

  // month/year dropdown options (localized via i18n)
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => t(`months.${i}`)),
    [t],
  );
  const currentYear = moment().year();
  const yearRange = [];
  for (let y = currentYear - 10; y <= currentYear + 10; y++) yearRange.push(y);

  // sync moment.js locale with current language for translations on calendar labels
  useEffect(() => {
    moment.locale(i18n.language);
    setMiniCalMonth((m) => m.clone());
  }, [i18n.language]);


  useEffect(() => {
    const fetchApplications = async () => {
      const doctorEmail = doctorInfo.email || user?.email;

      if (isLoading || !doctorEmail) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Use Promise.allSettled to safely handle the API response
        const [edResult] = await Promise.allSettled([
          getDoctorEarlyDetectionApplications(doctorEmail),
        ]);


        // Check if request was fulfilled before accessing data
        const edRaw =
          edResult.status === "fulfilled" &&
            Array.isArray(edResult.value?.data)
            ? edResult.value.data
            : [];
        const edAppointments = Array.from(
          new Map(edRaw.map((b) => [String(b?._id || b?.applicationId), b])).values()
        );



        setApplications(edAppointments);
      } catch (error) {
        console.error("[ED] Error fetching applications:", error);
        const errorMsg = error?.response?.data?.message || error?.message || "Failed to load applications";
        setError(errorMsg);
        setApplications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [doctorInfo.email, user?.email, isLoading]);

  // Fetch doctor breaks for calendar rendering
  const fetchBreaks = useCallback(async () => {
    try {
      const data = await getDoctorBreaks();
      const docs = data && data.breaks ? data.breaks : [];
      const breakEvents = [];
      docs.forEach((doc) => {
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
              start: startMoment,
              end: endMoment,
              isBreak: true,
            });
          }
        });
      });
      setWeekBreaks(breakEvents);
    } catch (err) {
      console.error("Breaks fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchBreaks();
  }, [fetchBreaks]);

  // Load doctor info once
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

  // Fetch weekly schedule once doctor email is known
  useEffect(() => {
    const email = doctorInfo.email || getEmailFromToken();
    if (!email) return;
    getDoctorWeeklySchedule(email)
      .then((res) => {
        const schedule = res?.schedule || res?.data?.schedule;
        if (Array.isArray(schedule)) {
          const map = {};
          schedule.forEach((d) => { map[d.day] = d; });
          setWeeklyScheduleCache(map);
        }
      })
      .catch(() => {});
  }, [doctorInfo.email]);

  // Fetch date overrides for all days in the visible week
  useEffect(() => {
    const email = doctorInfo.email || getEmailFromToken();
    if (!email || !selectedWeekStart) return;
    const weekDayStrs = Array.from({ length: 7 }, (_, i) =>
      selectedWeekStart.clone().add(i, "days").format("YYYY-MM-DD")
    );
    weekDayStrs.forEach((ds) => {
      getDoctorDateOverride(email, ds)
        .then((res) => {
          const override = res?.override || res?.data?.override;
          setDateOverrideCache((prev) => {
            if (override) return { ...prev, [ds]: override };
            const n = { ...prev };
            delete n[ds];
            return n;
          });
        })
        .catch(() => {});
    });
  }, [doctorInfo.email, selectedWeekStart]);

  // Close day menu when clicking outside
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

  // Load existing breaks when break modal opens for a date
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

  // Filtered + searched applications
  const filteredApplications = useMemo(() => {
    let result = [...applications];
    if (filter !== "all") {
      result = result.filter(
        (a) => a.appointmentStatus?.toLowerCase() === filter,
      );
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          (a.patientName || "").toLowerCase().includes(term) ||
          (a.patientEmail || "").toLowerCase().includes(term) ||
          (a.applicationId || "").toLowerCase().includes(term),
      );
    }
    if (result.length === 0 && applications.length > 0) {
      console.warn("[ED] All applications filtered out! Current filter:", filter);
    }
    if (applications.length > 0) {
      console.table(applications.map(a => ({
        id: a._id,
        applicationId: a.applicationId,
        patientName: a.patientName,
        date: a.date,
        startTime: a.startTime,
        status: a.appointmentStatus
      })));
    }
    return result;
  }, [applications, filter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage);
  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage,
  );


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

  const getPatientFirstName = (appt) => {
    const d = appt.patientDetails;
    if (d?.firstName) return typeof d.firstName === "object" ? d.firstName.en || "" : d.firstName;
    return (appt.patientName || "").split(" ")[0] || "";
  };

  const getPatientLastName = (appt) => {
    const d = appt.patientDetails;
    if (d?.lastName) return typeof d.lastName === "object" ? d.lastName.en || "" : d.lastName;
    // patientName is now the full name from the backend
    const parts = (appt.patientName || "").trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(" ") : "";
  };

  const getPatientGender = (appt) => (appt.patientDetails?.gender || "").toLowerCase();

  const getPatientDOB = (appt) => appt.patientDetails?.dateOfBirth || null;

  const handleFilterChange = (value) => {
    setFilter(value);
    setCurrentPage(1);
  };

  // --- Calendar helpers ---
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

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 18; h++) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
      if (h < 18) slots.push(`${String(h).padStart(2, "0")}:30`);
    }
    return slots;
  }, []);

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

  const handleDaySelect = (day) => {
    setSelectedDay(day.clone());
    setSelectedWeekStart(day.clone().startOf("isoWeek"));
    if (!day.isSame(miniCalMonth, "month")) {
      setMiniCalMonth(day.clone().startOf("month"));
    }
  };

  // ── Schedule helpers ────────────────────────────────────────────────────────
  const ED_DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const getEffectiveDay = (dateStr) => {
    const override = dateOverrideCache[dateStr];
    if (override) return override;
    if (!weeklyScheduleCache) return null;
    const dayName = ED_DAY_NAMES[new Date(dateStr + "T00:00:00").getDay()];
    return weeklyScheduleCache[dayName] || null;
  };
  const isScheduleDayOff = (dateStr) => {
    const d = getEffectiveDay(dateStr);
    return d ? d.isDayOff : false;
  };
  const isScheduleBreakSlot = (dateStr, hour, minute) => {
    const d = getEffectiveDay(dateStr);
    if (!d || d.isDayOff) return false;
    const slotMins = hour * 60 + minute;
    return (d.slots || []).some((s) => {
      if (s.type !== "break") return false;
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return slotMins >= sh * 60 + sm && slotMins < eh * 60 + em;
    });
  };
  const isOutsideWorkingHours = (dateStr, hour, minute) => {
    const d = getEffectiveDay(dateStr);
    if (!d || d.isDayOff || !d.slots || d.slots.length === 0) return false;
    const slotMins = hour * 60 + minute;
    return !d.slots.some((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return slotMins >= sh * 60 + sm && slotMins < eh * 60 + em;
    });
  };

  const canModifyDay = (day) => {
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

  // Map applications to calendar events (same source for both views)
  const weekEvents = useMemo(() => {
    const buildDateTime = (date, time) => {
      if (!time) return null;
      if (date) {
        const parsedDate = moment(date, "YYYY-MM-DD", true).isValid()
          ? date
          : moment(date).format("YYYY-MM-DD");
        const combined = moment(`${parsedDate} ${time}`, "YYYY-MM-DD HH:mm", true);
        return combined.isValid() ? combined : moment(time);
      }
      return moment(time);
    };

    const events = filteredApplications
      .map((app) => {
        const start = buildDateTime(app.date, app.startTime);
        const end = buildDateTime(app.date, app.endTime);

        return {
          id: app.applicationId || app._id,
          title: app.patientName || t("appointment.unknownPatient"),
          start,
          end,
          status: app.appointmentStatus || "unconfirmed",
          applicationId: app.applicationId,
          serviceType: app.serviceType,
        };
      })
      .filter(
        (ev) =>
          ev.start &&
          ev.end &&
          ev.start.isBetween(selectedWeekStart, selectedWeekEnd, "day", "[]"),
      );

    return events;
  }, [filteredApplications, selectedWeekStart, selectedWeekEnd, t]);

  const miniCalDayEventCounts = useMemo(() => {
    const counts = {};

    filteredApplications.forEach((app) => {
      let dayMoment = null;

      if (app?.date) {
        const parsedDate = moment(app.date, "YYYY-MM-DD", true);
        dayMoment = parsedDate.isValid() ? parsedDate : moment(app.date);
      } else if (app?.startTime) {
        dayMoment = moment(app.startTime);
      }

      if (!dayMoment || !dayMoment.isValid()) return;

      const key = dayMoment.format("YYYY-MM-DD");
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [filteredApplications]);


  const getEventStyle = (event) => {
    const startHour = event.start.hour() + event.start.minute() / 60;
    const endHour = event.end.hour() + event.end.minute() / 60;
    const gridStartHour = 9;
    const slotHeight = 60;
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
      unconfirmed: { border: "#fdba74", text: "#9a3412", bg: "#ffedd5" },
    };
    const colors =
      statusColors[event.status?.toLowerCase()] || statusColors.unconfirmed;
    return {
      top: `${top}px`,
      height: `${Math.max(height, 24)}px`,
      backgroundColor: colors.bg,
      borderLeft: `3px solid ${colors.border}`,
      color: colors.text,
    };
  };


  // CSV export
  const exportToCSV = () => {
    if (applications.length === 0) {
      toast.info(t("EarlyDetectionApplications.noDataToExport"));
      return;
    }
    const headers = [
      t("EarlyDetectionApplications.csv.id"),
      t("EarlyDetectionApplications.csv.patientName"),
      t("EarlyDetectionApplications.csv.patientEmail"),
      t("EarlyDetectionApplications.csv.serviceType"),
      t("EarlyDetectionApplications.csv.date"),
      t("EarlyDetectionApplications.csv.startTime"),
      t("EarlyDetectionApplications.csv.endTime"),
      t("EarlyDetectionApplications.csv.status"),
      t("EarlyDetectionApplications.csv.createdAt"),
    ];
    const rows = applications.map((appt) => [
      appt.applicationId || t("common.notAvailable"),
      appt.patientName || t("appointment.unknownPatient"),
      appt.patientEmail || t("common.noEmail"),
      appt.serviceType || t("appointment.notSpecified"),
      formatDate(appt.date),
      appt.startTime ? formatTimeHHMM(appt.startTime) : t("common.notAvailable"),
      appt.endTime ? formatTimeHHMM(appt.endTime) : t("common.notAvailable"),
      translateStatus(appt.appointmentStatus) || t("common.unknown"),
      appt.createdAt
        ? formatDateTimeForCSV(appt.createdAt)
        : t("common.notAvailable"),
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `early_detection_applications_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("EarlyDetectionApplications.exportSuccess"));
  };

  return (
    <div className="early-detect-container">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Error display */}
      {error && (
        <div style={{
          padding: "12px",
          marginBottom: "15px",
          backgroundColor: "#fee2e2",
          border: "1px solid #fca5a5",
          borderRadius: "6px",
          color: "#991b1b",
          fontSize: "14px"
        }}>
          Error loading applications: {error}
        </div>
      )}

      {/* Header with search, filter, view toggle, export */}
      <div className="early-detect-header">
        <h2 className="early-detect-heading">
          {t("EarlyDetectionApplications.header")}
          {loading && <span style={{ fontSize: "12px", marginLeft: "5px", color: "#ff6b6b" }}>Loading...</span>}
        </h2>
        <div className="ed-controls-row">
          {/* Search */}
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            placeholder={t("EarlyDetectionApplications.searchPlaceholder")}
            style={{ width: "260px", flexShrink: 1, minWidth: "140px" }}
          />

          {/* Export */}
          {applications.length > 0 && (
            <button
              className="export-csv-button"
              style={{ background: "#0A2E5D", color: "white" }}
              onClick={exportToCSV}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}

          {/* Filter */}
          <FilterDropdown
            value={filter}
            onChange={handleFilterChange}
            placeholder={t("EarlyDetectionApplications.filter")}
            options={["all", "upcoming", "confirmed", "completed", "cancelled"].map((v) => ({
              value: v,
              label: t(`appointments.filters.${v}`, { defaultValue: v.charAt(0).toUpperCase() + v.slice(1) }),
            }))}
          />

          {/* View toggle */}
          <div className="ed-view-toggle">
            <button
              className={`ed-view-toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
              onClick={() => setViewMode("calendar")}
              title={t("EarlyDetectionApplications.calendarView")}
            >
              <CalendarDays size={16} />
            </button>
            <button
              className={`ed-view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title={t("EarlyDetectionApplications.tableView")}
            >
              <Table size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" ? (
        <div
          className="ed-table-container"
          style={{ overflowY: "auto", height: "calc(100vh - 220px)" }}
        >
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>{t("EarlyDetectionApplications.loading")}</p>
            </div>
          ) : paginatedApplications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <Calendar />
              </div>
              <h3>{t("EarlyDetectionApplications.noApplications")}</h3>
            </div>
          ) : (
            <div className="appt-table-wrap">
              <table className="appt-table">
                <thead>
                  <tr>
                    <th>{t("appointments.patient").toUpperCase()}</th>
                    <th>{t("appointments.sex", "SEX").toUpperCase()}</th>
                    <th>{t("appointments.age", "AGE").toUpperCase()}</th>
                    <th>{t("appointments.appointment", "APPOINTMENT").toUpperCase()}</th>
                    <th>{t("appointments.status", "STATUS").toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedApplications.map((appt) => (
                    <tr
                      key={appt._id || appt.applicationId}
                      className="appt-row"
                      onClick={() =>
                        window.open(
                          `/early-detection-bookings/${encodeURIComponent(appt.applicationId || appt._id)}`,
                          "_blank",
                        )
                      }
                    >
                      <td>
                        <div className="patient-name-cell">
                          <span className="patient-name-primary">{getPatientFirstName(appt) || t("appointment.unknownPatient")}</span>
                          {getPatientLastName(appt) && <span className="patient-name-secondary">{getPatientLastName(appt)}</span>}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const g = getPatientGender(appt);
                          if (g === "male") return <span className="sex-icon sex-icon--male">♂</span>;
                          if (g === "female") return <span className="sex-icon sex-icon--female">♀</span>;
                          return <span className="sex-icon sex-icon--unknown">—</span>;
                        })()}
                      </td>
                      <td>
                        <span className="age-text">
                          {(() => { const dob = getPatientDOB(appt); return dob ? (calculateAge(dob) ?? "—") : "—"; })()}
                        </span>
                      </td>
                      <td><span className="appt-cell-id">#{appt.invoiceNumber || appt.applicationId || appt._id}</span></td>
                      <td>
                        {(() => {
                          const s = appt.appointmentStatus;
                          const config = {
                            confirmed: { dot: "#00C853", bg: "#e8f5e9", color: "#1b5e20" },
                            completed: { dot: "#3b82f6", bg: "#eff6ff", color: "#1e40af" },
                            cancelled: { dot: "#FF1744", bg: "#fce4ec", color: "#b71c1c" },
                            upcoming: { dot: "#FFD600", bg: "#fffde7", color: "#f57f17" },
                            unconfirmed: { dot: "#FF9800", bg: "#fff3e0", color: "#e65100" },
                          }[s?.toLowerCase()] || { dot: "#9ca3af", bg: "#f9fafb", color: "#6b7280" };
                          return (
                            <span className="appt-status-badge" style={{ background: config.bg, color: config.color }}>
                              <span className="appt-status-dot" style={{ background: config.dot }} />
                              {t(`appointmentStatus.${s?.toLowerCase()}`, { defaultValue: s }) || t("common.unknown")}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="pagination-arrow"
              >
                <ArrowLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`pagination-button ${currentPage === i + 1 ? "active" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="pagination-arrow"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View - Mini Calendar + Weekly Time Grid */
        <div className="weekly-schedule-layout">
          {/* Mobile mini-cal toggle */}
          <button
            className="mini-cal-toggle-btn"
            onClick={() => setMiniCalOpen((v) => !v)}
            aria-label={t("EarlyDetectionApplications.toggleCalendar")}
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
                {t("EarlyDetectionApplications.legend.confirmed")}
              </div>
              <div className="legend-item">
                <span className="legend-dot upcoming"></span>{" "}
                {t("EarlyDetectionApplications.legend.upcoming")}
              </div>
              <div className="legend-item">
                <span className="legend-dot unconfirmed"></span>{" "}
                {t("EarlyDetectionApplications.legend.unconfirmed")}
              </div>
              <div className="legend-item">
                <span className="legend-dot cancelled"></span>{" "}
                {t("EarlyDetectionApplications.legend.cancelled")}
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
              <div className="week-range-wrapper" style={{ position: 'relative' }}>
                <h3
                  className="week-range-title"
                  onClick={() => setShowHeaderMenu(v => !v)}
                >
                  {(() => {
                    const fmt = (date, loc) => {
                      const optsStart = { month: 'short', day: 'numeric' };
                      const optsEnd = { month: 'short', day: 'numeric', year: 'numeric' };
                      const optsSingle = { month: 'short', day: 'numeric', year: 'numeric' };
                      if (date.start.isSame(date.end, 'day')) {
                        return new Intl.DateTimeFormat(loc, optsSingle).format(date.start.toDate());
                      }
                      const startStr = new Intl.DateTimeFormat(loc, optsStart).format(date.start.toDate());
                      const endStr = new Intl.DateTimeFormat(loc, optsEnd).format(date.end.toDate());
                      return `${startStr} – ${endStr}`;
                    };
                    const range = { start: selectedWeekStart, end: selectedWeekEnd };
                    const loc = fmt(range, i18n.language);
                    return loc;
                  })()}
                </h3>
                {showHeaderMenu && (
                  <div className="header-menu">
                    {canModifyDay(moment(selectedBreakDate)) && (
                  <>
                    <button
                      className="header-menu-item"
                      onClick={() => setShowHeaderMenu(false)}
                    >
                      {t("appointments.weeklySchedule")}
                    </button>
                {canModifyDay(moment(selectedBreakDate)) && (
                  <>
                    <button
                      className="header-menu-item"
                      onClick={() => {
                        setShowHeaderMenu(false);
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
                  </>
                )}
                    <button
                      className="header-menu-item"
                      onClick={() => {
                        setShowHeaderMenu(false);
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
                  </>
                )}
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
                      className={`week-day-header ${day.isSame(moment(), "day") ? "today" : ""}${day.isSame(selectedDay, "day") ? " selected-day" : ""}${!canModifyDay(day) ? " disabled-day" : ""}`}
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
                        className={`time-gutter-cell ${slot.endsWith(":30") ? "half" : ""}`}
                      >
                        {slot.endsWith(":00") ? slot : ""}
                      </div>
                    ))}
                  </div>

                  {weekDays.map((day, dayIdx) => {
                    const ds = day.format("YYYY-MM-DD");
                    const dayOff = isScheduleDayOff(ds);
                    return (
                    <div
                      key={dayIdx}
                      className={`week-day-column ${day.isSame(moment(), "day") ? "today" : ""}${day.isSame(selectedDay, "day") ? " selected-day" : ""}${dayOff ? " week-day-off-col" : ""}`}
                    >
                      {dayOff && (
                        <div className="week-day-off-banner">
                          {t("calendar.weeklyDayOff", "WEEKLY DAY OFF")}
                        </div>
                      )}

                      {timeSlots.map((slot) => {
                        const [h, m] = slot.split(":").map(Number);
                        const inScheduleBreak = !dayOff && isScheduleBreakSlot(ds, h, m);
                        const outsideHours = !dayOff && !inScheduleBreak && isOutsideWorkingHours(ds, h, m);
                        const cellClass = dayOff
                          ? "dac-leave-cell"
                          : inScheduleBreak
                            ? "dac-break-cell"
                            : outsideHours
                              ? "dac-outside-hours"
                              : weeklyScheduleCache
                                ? "dac-working-hours"
                                : "";
                        return (
                        <div
                          key={slot}
                          className={`week-time-cell ${slot.endsWith(":30") ? "half" : ""} ${cellClass}`}
                        />
                        );
                      })}

                      {weekEvents
                        .filter((ev) => ev.start.isSame(day, "day"))
                        .map((ev) => (
                          <div
                            key={ev.id}
                            className="week-event"
                            style={getEventStyle(ev)}
                            onClick={() =>
                              navigate(
                                `/early-detection-bookings/${encodeURIComponent(ev.applicationId || ev.id)}`,
                                {
                                  state: {
                                    doctorEmail: user?.email,
                                    appointmentData: {
                                      _id: ev?.id,
                                      applicationId: ev?.applicationId || ev?.id,
                                      patientEmail: ev?.patientEmail || null,
                                      patientName: ev?.title || null,
                                      appointmentStatus: ev?.status || null,
                                      date: ev?.start ? formatDateISO(ev.start.toDate()) : null,
                                      startTime: ev?.start ? formatTimeHHMM(ev.start.toDate()) : null,
                                      endTime: ev?.end ? formatTimeHHMM(ev.end.toDate()) : null,
                                    },
                                  },
                                },
                              )
                            }
                            title={`${ev.title} (${ev.start.format("HH:mm")} - ${ev.end.format("HH:mm")})`}
                          >
                            <Link
                              to={`/early-detection-bookings/${encodeURIComponent(ev.applicationId || ev.id)}`}
                              state={{
                                doctorEmail: user?.email,
                                appointmentData: {
                                  _id: ev?.id,
                                  applicationId: ev?.applicationId || ev?.id,
                                  patientEmail: ev?.patientEmail || null,
                                  patientName: ev?.title || null,
                                  appointmentStatus: ev?.status || null,
                                  date: ev?.start ? formatDateISO(ev.start.toDate()) : null,
                                  startTime: ev?.start ? formatTimeHHMM(ev.start.toDate()) : null,
                                  endTime: ev?.end ? formatTimeHHMM(ev.end.toDate()) : null,
                                },
                              }}
                              className="event-link"
                            />
                            <div className="week-event-title">{ev.title}</div>
                            <div className="week-event-time">
                              <Clock size={10} />
                              {ev.start.format("HH:mm")} -{" "}
                              {ev.end.format("HH:mm")}
                            </div>
                            <div className="week-event-status">
                              {translateStatus(ev.status)}
                            </div>
                          </div>
                        ))}

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
                              style={{ top: `${top}px`, height: `${height}px` }}
                              title={t("EarlyDetectionApplications.breakTooltip", {
                                start: b.start.format("HH:mm"),
                                end: b.end.format("HH:mm"),
                              })}
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
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day header context menu */}
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

      {/* Break modal */}
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
              {existingBreaksForDate === null && selectedBreakDate && (
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
                              fetchBreaks();
                              toast.success(t("appointments.breakRemoved"));
                            } catch {
                              toast.error(t("appointments.breakRemoveFailed"));
                            } finally {
                              setDeletingBreakIdx(null);
                            }
                          }}
                          title={t("EarlyDetectionApplications.removeBreak")}
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
                        title={t("EarlyDetectionApplications.removeBreak")}
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
                    fetchBreaks();
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
    </div>
  );
};

export default EarlyDetectionApplications;
