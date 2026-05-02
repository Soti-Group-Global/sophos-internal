import { useState, useEffect, useCallback, useRef, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  Search,
  Users,
  User,
  Edit3,
  XCircle,
} from "lucide-react";
import {
  getDoctors,
  getDoctorByEmail,
  getDoctorAppointmentsByDate,
  getApplicationsByDate,
  getDoctorBreaks,
  saveDoctorBreaks,
  deleteDoctorBreaks,
  deleteDoctorBreakById,
  getDoctorWeeklySchedule,
  saveDoctorWeeklySchedule,
  getDoctorDateOverride,
  saveDoctorDateOverride,
  deleteDoctorDateOverride,
  createDoctorLeave,
  getDoctorLeaves,
  deleteDoctorLeave,
  getProfile,
  closeDaySchedule,
  reopenDaySchedule,
  getDayClosureStatus,
} from "../utils/api";
import { toast } from "react-toastify";
import TimePickerInput from "../components/TimePickerInput/TimePickerInput";
import CreateAppointmentModal from "../components/Applications/CreateAppointmentModal";
import { getApptStatusClass } from "../utils/appointmentStatus";
import "../components/Applications/CalendarView.css";
import "../styles/DoctorAppointmentsCalendar.css";
import "../styles/ScheduleManagementCalendar.css";
import { AuthContext } from "../context/AuthContext";

// ── Utilities ──────────────────────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
}
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function getInitials(name) {
  if (!name) return "??";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
}
const LEAVE_TYPE_KEY = {
  "Vacation":           "leaveTypeVacation",
  "Sick Leave":         "leaveTypeSick",
  "Unpaid Leave":       "leaveTypeUnpaid",
  "Personal Leave":     "leaveTypePersonal",
  "Maternity/Paternity":"leaveTypeMaternity",
  "Other":              "leaveTypeOther",
};

// Always formats date as "22 Apr 2026" (day month year) regardless of locale display order
function fmtDate(date, lang, opts = {}) {
  const loc = lang === "ru" ? "ru-RU" : "en-GB"; // en-GB gives DD Mon YYYY order
  const base = { day: "numeric", month: "short", year: "numeric", ...opts };
  return date.toLocaleDateString(loc, base);
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const prevLast = new Date(year, month, 0);
  const offset   = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const days = [];
  for (let i = offset - 1; i >= 0; i--) days.push({ day: prevLast.getDate() - i, isCurrentMonth: false, date: new Date(year, month - 1, prevLast.getDate() - i) });
  for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
  for (let i = 1; days.length < 42; i++) days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
  return days;
}

const ScheduleManagementCalendar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // ── Fetch current manager's display name ─────────────────────────────────────
  useEffect(() => {
    getProfile().then((res) => {
      const p = res.data?.profile || res.data;
      if (p?.firstName) {
        setManagerName([p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ").trim());
      } else if (user?.email) {
        setManagerName(user.email);
      }
    }).catch(() => {
      if (user?.email) setManagerName(user.email);
    });
  }, []);

  // ── Mode & sub-view ─────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("doctor"); // "doctor" | "all"
  const [calView, setCalView]   = useState("week");   // "day" | "week" | "month" (doctor); "month" always (all)

  // ── Doctor selection ────────────────────────────────────────────────────────
  const [doctor, setDoctor]             = useState(null);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [allDoctorsList, setAllDoctorsList] = useState([]);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [doctorSearch, setDoctorSearch]   = useState("");
  const dropdownRef   = useRef(null);
  const allMenuRef    = useRef(null);
  const dayMenuRef    = useRef(null);
  const monthMenuRef  = useRef(null);
  const allScrollRef  = useRef(null);
  const scrollAllCols = (dir) => {
    if (!allScrollRef.current) return;
    allScrollRef.current.scrollBy({ left: dir * 160 * 3, behavior: "smooth" });
  };
  const [activeDoctorMenu, setActiveDoctorMenu] = useState(null);
  const [activeDayMenu, setActiveDayMenu] = useState(null); // dateStr of open day column menu
  const [activeMonthMenuDate, setActiveMonthMenuDate] = useState(null); // dateStr of open month-day menu

  // ── Navigation dates ─────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart]       = useState(() => getWeekStart(new Date()));
  const [calMonthDate, setCalMonthDate] = useState(new Date());   // sidebar mini-cal month
  const [viewMonthDate, setViewMonthDate] = useState(new Date()); // main month grid month

  // ── Data caches ──────────────────────────────────────────────────────────────
  const [dayApplications, setDayApplications]   = useState([]);
  const [weekApplications, setWeekApplications] = useState({});
  const [monthAppsCache, setMonthAppsCache]     = useState({}); // {dateStr: apps[]}
  const [allApplications, setAllApplications]   = useState([]);
  const [allMonthCache, setAllMonthCache]       = useState({}); // {dateStr: apps[]} for all-doctors month

  // ── Breaks & leaves ──────────────────────────────────────────────────────────
  const [breaksMap, setBreaksMap] = useState({});
  const [leavesMap, setLeavesMap] = useState({});
  const [weeklyScheduleCache, setWeeklyScheduleCache] = useState({}); // { email: { dayName: {isDayOff,slots} } }

  // ── Shared UI ────────────────────────────────────────────────────────────────
  const [loading, setLoading]             = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown]   = useState(false);
  const [hoveredWeekRow, setHoveredWeekRow]       = useState(null);
  const [hoveredSlot, setHoveredSlot]             = useState(null);
  const [showCreateModal, setShowCreateModal]     = useState(false);
  const [createModalData, setCreateModalData]     = useState(null);


  // ── Break modal ──────────────────────────────────────────────────────────────
  const [showBreakModal, setShowBreakModal]   = useState(false);
  const [breakStartDate, setBreakStartDate]   = useState("");
  const [breakStartTime, setBreakStartTime]   = useState("09:00");
  const [breakEndDate, setBreakEndDate]       = useState("");
  const [breakEndTime, setBreakEndTime]       = useState("09:15");
  const [breakComment, setBreakComment]       = useState("");
  const [breakDoctorEmail, setBreakDoctorEmail] = useState("");
  const [breakDoctorName, setBreakDoctorName]   = useState("");
  const [breakContextDate, setBreakContextDate] = useState(""); // date used to fetch existing breaks
  const [breakModalExistingBreaks, setBreakModalExistingBreaks] = useState([]);

  // ── Weekly schedule modal ─────────────────────────────────────────────────
  const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const DEFAULT_WEEK = DAYS_ORDER.map((day) => ({
    day,
    isDayOff: ["Saturday","Sunday"].includes(day),
    slots: ["Saturday","Sunday"].includes(day) ? [] : [{ startTime: "09:00", endTime: "18:00", type: "working" }]
  }));
  const [showWeeklyModal, setShowWeeklyModal]     = useState(false);
  const [weeklyModalEmail, setWeeklyModalEmail]   = useState("");
  const [weeklyModalName, setWeeklyModalName]     = useState("");
  const [weeklySchedule, setWeeklySchedule]       = useState(DEFAULT_WEEK);
  const [weeklySaving, setWeeklySaving]           = useState(false);

  // ── Date override modal ───────────────────────────────────────────────────
  const [showDateOverrideModal, setShowDateOverrideModal] = useState(false);
  const [dateOverrideEmail, setDateOverrideEmail]         = useState("");
  const [dateOverrideName, setDateOverrideName]           = useState("");
  const [dateOverrideDate, setDateOverrideDate]           = useState("");
  const [dateOverrideIsDayOff, setDateOverrideIsDayOff]   = useState(false);
  const [dateOverrideSlots, setDateOverrideSlots]         = useState([]);
  const [dateOverrideSaving, setDateOverrideSaving]       = useState(false);
  const [dateOverrideCache, setDateOverrideCache]         = useState({}); // { "email_date": override }

  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  const previousWeeklyRef = useRef({});

  const openDateOverrideModal = async (email, name, dateStr) => {
    setDateOverrideEmail(email);
    setDateOverrideName(name);
    setDateOverrideDate(dateStr);
    setDateOverrideIsDayOff(false);

    const dayName = getDayName(dateStr);
    const weekly = weeklyScheduleCache[email]?.[dayName];
    const defaultSlots = weekly && !weekly.isDayOff
      ? (weekly.slots || []).map(s => ({ ...s }))
      : [{ startTime: "09:00", endTime: "18:00", type: "working" }];

    try {
      const res = await getDoctorDateOverride(email, dateStr);
      const override = apiResult(res)?.override;
      
      if (override) {
        // Check if this is a stale override (matches the previous weekly schedule)
        const previousWeeklyDay = previousWeeklyRef.current[dayName] || DEFAULT_WEEK.find(d => d.day === dayName);
        if (previousWeeklyDay && schedulesMatch(override, previousWeeklyDay) && !schedulesMatch(override, weekly)) {
          // It's a stale override from the database! Ignore it and use current weekly defaults.
          setDateOverrideSlots(defaultSlots);
          // Also, let's proactively delete this stale override in the background
          deleteDoctorDateOverride(email, dateStr).catch(() => {});
        } else {
          setDateOverrideIsDayOff(override.isDayOff);
          setDateOverrideSlots(override.slots?.length ? override.slots : defaultSlots);
        }
      } else {
        setDateOverrideSlots(defaultSlots);
      }
    } catch {
      setDateOverrideSlots(defaultSlots);
    } finally {
      setShowDateOverrideModal(true);
    }
  };

  const addDateOverrideSlot = () =>
    setDateOverrideSlots(prev => [...prev, { startTime: "09:00", endTime: "18:00", type: "working" }]);

  const removeDateOverrideSlot = (idx) =>
    setDateOverrideSlots(prev => prev.filter((_, i) => i !== idx));

  const updateDateOverrideSlot = (idx, field, value) =>
    setDateOverrideSlots(prev => prev.map((s, i) => i !== idx ? s : { ...s, [field]: value }));

  const openWeeklyModal = async (email, name) => {
    setWeeklyModalEmail(email);
    setWeeklyModalName(name);
    setWeeklySchedule(DEFAULT_WEEK);
    setShowWeeklyModal(true);
    try {
      const res = await getDoctorWeeklySchedule(email);
      const schedule = apiResult(res)?.schedule;
      if (schedule?.length) {
        const map = Object.fromEntries(schedule.map((d) => [d.day, d]));
        // Store for stale override detection
        previousWeeklyRef.current = map;
        
        setWeeklySchedule(DAYS_ORDER.map((day) => {
          const saved = map[day];
          const def   = DEFAULT_WEEK.find((d) => d.day === day);
          if (!saved) return def;
          // Normalize — ensure slots are always present and formatted correctly
          return { ...normalizeScheduleDay(saved), day };
        }));
      }
    } catch { /* keep defaults */ }
  };

  const normalizeScheduleDay = (day) => ({
    isDayOff: !!day?.isDayOff,
    slots: Array.isArray(day?.slots)
      ? day.slots.map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          type: slot.type || "working",
        }))
      : [],
  });

  const schedulesMatch = (left, right) => {
    if (!left || !right) return false;
    return JSON.stringify(normalizeScheduleDay(left)) === JSON.stringify(normalizeScheduleDay(right));
  };

  const toggleDayOff = (dayIdx) =>
    setWeeklySchedule((prev) => prev.map((d, i) => i !== dayIdx ? d : {
      ...d,
      isDayOff: !d.isDayOff,
      slots: d.isDayOff ? [{ startTime: "09:00", endTime: "18:00", type: "working" }] : [],
    }));

  const addSlot = (dayIdx) =>
    setWeeklySchedule((prev) => prev.map((d, i) => i !== dayIdx ? d : {
      ...d,
      slots: [...d.slots, { startTime: "09:00", endTime: "18:00", type: "working" }],
    }));

  const removeSlot = (dayIdx, slotIdx) =>
    setWeeklySchedule((prev) => prev.map((d, i) => i !== dayIdx ? d : {
      ...d,
      slots: d.slots.filter((_, j) => j !== slotIdx),
    }));

  const updateSlot = (dayIdx, slotIdx, field, value) =>
    setWeeklySchedule((prev) => prev.map((d, i) => i !== dayIdx ? d : {
      ...d,
      slots: d.slots.map((s, j) => j !== slotIdx ? s : { ...s, [field]: value }),
    }));

  // ── Drag-to-select (Google Calendar style) ────────────────────────────────────
  const dragStateRef    = useRef(null);  // { active, dateStr, startIdx, endIdx }
  const [dragHighlight, setDragHighlight] = useState(null); // { dateStr, minIdx, maxIdx }
  const onDragEndRef    = useRef(null);  // always-current finalise handler

  // ── All-doctors drag-to-select ────────────────────────────────────────────────
  const allDragStateRef = useRef(null);  // { active, docEmail, startIdx, endIdx }
  const [allDragHighlight, setAllDragHighlight] = useState(null); // { docEmail, minIdx, maxIdx }
  const onAllDragEndRef = useRef(null);  // always-current finalise handler for all-doctors grid

  // ── Cancel confirm ───────────────────────────────────────────────────────────
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConfirmData, setCancelConfirmData] = useState(null);
  const [cancelLeaveType, setCancelLeaveType] = useState("Vacation");
  const [cancelLeaveComment, setCancelLeaveComment] = useState("");
  const [cancelStartDate, setCancelStartDate] = useState("");
  const [cancelEndDate, setCancelEndDate] = useState("");
  const [managerName, setManagerName] = useState("");

  // ── Close schedule confirm ───────────────────────────────────────────────────
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeConfirmData, setCloseConfirmData] = useState(null); // { doctorEmail, doctorName }
  const [closedDaysMap, setClosedDaysMap] = useState({}); // { "email_dateStr": true }

  // ── Kill page blur when break modal is open ───────────────────────────────────
  useEffect(() => {
    if (showBreakModal) {
      document.body.classList.add("break-modal-open");
    } else {
      document.body.classList.remove("break-modal-open");
    }
    return () => document.body.classList.remove("break-modal-open");
  }, [showBreakModal]);

  // ── Fetch existing breaks when modal opens ─────────────────────────────────
  useEffect(() => {
    if (!showBreakModal || !breakDoctorEmail || !breakContextDate) {
      setBreakModalExistingBreaks([]);
      return;
    }
    getDoctorBreaks(breakDoctorEmail, breakContextDate)
      .then((res) => setBreakModalExistingBreaks(res.data?.breaks || []))
      .catch(() => setBreakModalExistingBreaks([]));
  }, [showBreakModal, breakDoctorEmail, breakContextDate]);

  // ── Global mouseup: finalise drag-to-select ───────────────────────────────────
  useEffect(() => {
    const handler = () => {
      onDragEndRef.current?.();
      onAllDragEndRef.current?.();
    };
    document.addEventListener("mouseup", handler);
    return () => document.removeEventListener("mouseup", handler);
  }, []);

  // ── Outside-click handler ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDoctorDropdown(false);
      if (allMenuRef.current && !allMenuRef.current.contains(e.target)) setActiveDoctorMenu(null);
      if (dayMenuRef.current && !dayMenuRef.current.contains(e.target)) setActiveDayMenu(null);
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target)) setActiveMonthMenuDate(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (calView !== "month") setActiveMonthMenuDate(null);
  }, [calView, viewMode]);

  // ── Load doctors list ─────────────────────────────────────────────────────────
  useEffect(() => {
    getDoctors()
      .then((data) => {
        const list = data?.doctors || data?.data || (Array.isArray(data) ? data : []);
        setAllDoctorsList(list);
        // Auto-select first doctor
        if (!selectedEmail && list.length > 0) setSelectedEmail(list[0].email);
      })
      .catch(() => setAllDoctorsList([]));
  }, []);

  // ── Load selected doctor details ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEmail) return;
    getDoctorByEmail(selectedEmail)
      .then((res) => { const doc = res?.data?.data || res?.data?.doctor; if (doc) setDoctor(doc); })
      .catch(() => setDoctor(null));
  }, [selectedEmail]);

  // ── Sync sidebar mini-cal month ───────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === "doctor") {
      if (calView === "week") setCalMonthDate(new Date(weekStart));
      else setCalMonthDate(new Date(selectedDate));
    } else {
      setCalMonthDate(new Date(viewMonthDate));
    }
  }, [weekStart, selectedDate, viewMonthDate, viewMode, calView]);

  // ── Fetch DAY applications (doctor + day view) ────────────────────────────────
  const fetchDayApplications = useCallback(async () => {
    if (viewMode !== "doctor" || calView !== "day" || !selectedEmail) return;
    setLoading(true);
    try {
      const res = await getDoctorAppointmentsByDate(selectedEmail, toDateStr(selectedDate));
      setDayApplications(res.data || []);
    } catch { setDayApplications([]); }
    finally { setLoading(false); }
  }, [viewMode, calView, selectedEmail, selectedDate]);

  useEffect(() => { fetchDayApplications(); }, [fetchDayApplications]);

  // ── Fetch WEEK applications (doctor + week view) ──────────────────────────────
  const fetchWeekApplications = useCallback(async () => {
    if (viewMode !== "doctor" || calView !== "week" || !selectedEmail) return;
    setLoading(true);
    const days = getWeekDays(weekStart);
    const results = {};
    await Promise.all(days.map(async (day) => {
      const ds = toDateStr(day);
      try { const res = await getDoctorAppointmentsByDate(selectedEmail, ds); results[ds] = res.data || []; }
      catch { results[ds] = []; }
    }));
    setWeekApplications(results);
    setLoading(false);
  }, [viewMode, calView, selectedEmail, weekStart]);

  useEffect(() => { fetchWeekApplications(); }, [fetchWeekApplications]);

  // ── Fetch MONTH applications (doctor + month view) ────────────────────────────
  const fetchMonthApplications = useCallback(async () => {
    if (viewMode !== "doctor" || calView !== "month" || !selectedEmail) return;
    setLoading(true);
    const year = viewMonthDate.getFullYear(), month = viewMonthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const results = {};
    await Promise.all(
      Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
        const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        try { const res = await getDoctorAppointmentsByDate(selectedEmail, ds); results[ds] = res.data || []; }
        catch { results[ds] = []; }
      })
    );
    setMonthAppsCache(results);
    setLoading(false);
  }, [viewMode, calView, selectedEmail, viewMonthDate]);

  useEffect(() => { fetchMonthApplications(); }, [fetchMonthApplications]);

  // ── Fetch breaks for MONTH view ───────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "doctor" || calView !== "month" || !selectedEmail) return;
    const year = viewMonthDate.getFullYear(), month = viewMonthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    Promise.all(
      Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
        const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const key = `${selectedEmail}_${ds}`;
        try { const res = await getDoctorBreaks(selectedEmail, ds); return [key, res.data?.breaks || []]; }
        catch { return [key, []]; }
      })
    ).then((entries) => setBreaksMap((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
  }, [viewMode, calView, selectedEmail, viewMonthDate]);

  // ── Fetch leaves for MONTH view ───────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "doctor" || calView !== "month" || !selectedEmail) return;
    const year = viewMonthDate.getFullYear(), month = viewMonthDate.getMonth();
    const firstDay = `${year}-${String(month+1).padStart(2,"0")}-01`;
    const lastDay  = `${year}-${String(month+1).padStart(2,"0")}-${String(new Date(year, month+1, 0).getDate()).padStart(2,"0")}`;
    getDoctorLeaves({ doctorEmail: selectedEmail, from: firstDay, to: lastDay, status: "Approved" })
      .then((res) => {
        const entries = {};
        (res.data?.leaves || []).forEach((leave) => {
          // expand leave across all its days within the month
          const start = new Date(leave.startDate + "T00:00:00");
          const end   = new Date(leave.endDate   + "T00:00:00");
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const ds = toDateStr(d);
            entries[`${selectedEmail}_${ds}`] = { _id: leave._id, leaveType: leave.leaveType, comment: leave.comment };
          }
        });
        setLeavesMap((prev) => ({ ...prev, ...entries }));
      })
      .catch(() => {});
  }, [viewMode, calView, selectedEmail, viewMonthDate]);

  // ── Fetch ALL-DOCTORS MONTH applications ──────────────────────────────────────
  const fetchAllMonthApplications = useCallback(async () => {
    if (viewMode !== "all") return;
    setLoading(true);
    const year = viewMonthDate.getFullYear(), month = viewMonthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const results = {};
    await Promise.all(
      Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
        const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        try { const res = await getApplicationsByDate(ds); results[ds] = res.data || []; }
        catch { results[ds] = []; }
      })
    );
    setAllMonthCache(results);
    setLoading(false);
  }, [viewMode, viewMonthDate]);

  useEffect(() => { fetchAllMonthApplications(); }, [fetchAllMonthApplications]);

  // ── Fetch ALL-DOCTORS DAY applications ───────────────────────────────────────
  const fetchAllDayApplications = useCallback(async () => {
    if (viewMode !== "all") return;
    setLoading(true);
    try {
      const res = await getApplicationsByDate(toDateStr(selectedDate));
      setAllApplications(res.data || []);
    } catch { setAllApplications([]); }
    finally { setLoading(false); }
  }, [viewMode, selectedDate]);

  useEffect(() => { fetchAllDayApplications(); }, [fetchAllDayApplications]);

  // ── Fetch breaks for ALL mode (all doctors, selected date) ────────────────────
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    const ds = toDateStr(selectedDate);
    Promise.all(allDoctorsList.map(async (doc) => {
      const key = `${doc.email}_${ds}`;
      try { const res = await getDoctorBreaks(doc.email, ds); return [key, res.data?.breaks || []]; }
      catch { return [key, []]; }
    })).then((entries) => setBreaksMap((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
  }, [viewMode, selectedDate, allDoctorsList]);

  // ── Fetch leaves for ALL mode (all doctors, selected date) ────────────────────
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    const ds = toDateStr(selectedDate);
    Promise.all(allDoctorsList.map(async (doc) => {
      const key = `${doc.email}_${ds}`;
      try {
        const res = await getDoctorLeaves({ doctorEmail: doc.email, from: ds, to: ds, status: "Approved" });
        const leave = (res.data?.leaves || [])[0];
        return [key, leave ? { _id: leave._id, leaveType: leave.leaveType, comment: leave.comment, reviewedBy: leave.reviewedByName || leave.reviewedBy } : null];
      } catch { return [key, null]; }
    })).then((entries) => setLeavesMap((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
  }, [viewMode, selectedDate, allDoctorsList]);

  // ── Fetch breaks for WEEK view ────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "doctor" || calView !== "week" || !selectedEmail) return;
    const days = getWeekDays(weekStart);
    Promise.all(days.map(async (day) => {
      const ds = toDateStr(day);
      const key = `${selectedEmail}_${ds}`;
      try { const res = await getDoctorBreaks(selectedEmail, ds); return [key, res.data?.breaks || []]; }
      catch { return [key, []]; }
    })).then((entries) => setBreaksMap((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
  }, [viewMode, calView, selectedEmail, weekStart]);

  // ── Fetch leaves for WEEK view ────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "doctor" || calView !== "week" || !selectedEmail) return;
    const days = getWeekDays(weekStart);
    Promise.all(days.map(async (day) => {
      const ds = toDateStr(day);
      const key = `${selectedEmail}_${ds}`;
      try {
        const res = await getDoctorLeaves({ doctorEmail: selectedEmail, from: ds, to: ds, status: "Approved" });
        const leave = (res.data?.leaves || [])[0];
        return [key, leave ? { _id: leave._id, leaveType: leave.leaveType, comment: leave.comment, reviewedBy: leave.reviewedByName || leave.reviewedBy } : null];
      } catch { return [key, null]; }
    })).then((entries) => setLeavesMap((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
  }, [viewMode, calView, selectedEmail, weekStart]);

  // ── Fetch breaks for DAY view ─────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "doctor" || calView !== "day" || !selectedEmail) return;
    const ds = toDateStr(selectedDate);
    const key = `${selectedEmail}_${ds}`;
    getDoctorBreaks(selectedEmail, ds)
      .then((res) => setBreaksMap((prev) => ({ ...prev, [key]: res.data?.breaks || [] })))
      .catch(() => setBreaksMap((prev) => ({ ...prev, [key]: [] })));
  }, [viewMode, calView, selectedEmail, selectedDate]);

  // ── Fetch leaves for DAY view ─────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "doctor" || calView !== "day" || !selectedEmail) return;
    const ds = toDateStr(selectedDate);
    const key = `${selectedEmail}_${ds}`;
    getDoctorLeaves({ doctorEmail: selectedEmail, from: ds, to: ds, status: "Approved" })
      .then((res) => {
        const leave = (res.data?.leaves || [])[0];
        setLeavesMap((prev) => ({ ...prev, [key]: leave ? { _id: leave._id, leaveType: leave.leaveType, comment: leave.comment, reviewedBy: leave.reviewedByName || leave.reviewedBy } : null }));
      })
      .catch(() => setLeavesMap((prev) => ({ ...prev, [key]: null })));
  }, [viewMode, calView, selectedEmail, selectedDate]);

  // ── Fetch weekly schedule for selected doctor ────────────────────────────────
  useEffect(() => {
    if (!selectedEmail) return;
    getDoctorWeeklySchedule(selectedEmail).then((res) => {
      const schedule = apiResult(res)?.schedule;
      if (schedule) {
        const map = {};
        schedule.forEach((d) => { map[d.day] = d; });
        setWeeklyScheduleCache((prev) => ({ ...prev, [selectedEmail]: map }));
      }
    }).catch(() => {});
  }, [selectedEmail]);

  // ── Fetch weekly schedules for all doctors (all mode) ─────────────────────────
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    allDoctorsList.forEach((doc) => {
      getDoctorWeeklySchedule(doc.email).then((res) => {
        const schedule = apiResult(res)?.schedule;
        if (schedule) {
          const map = {};
          schedule.forEach((d) => { map[d.day] = d; });
          setWeeklyScheduleCache((prev) => ({ ...prev, [doc.email]: map }));
        }
      }).catch(() => {});
    });
  }, [viewMode, allDoctorsList]);

  // ── Fetch date overrides for current visible dates ────────────────────────────
  useEffect(() => {
    if (!selectedEmail || viewMode !== "doctor") return;
    let dates = [];
    if (calView === "day") {
      dates = [toDateStr(selectedDate)];
    } else if (calView === "week") {
      dates = getWeekDays(weekStart).map(toDateStr);
    } else if (calView === "month") {
      const y = viewMonthDate.getFullYear(), m = viewMonthDate.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      dates = Array.from({ length: daysInMonth }, (_, i) =>
        `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
      );
    }
    dates.forEach((ds) => {
      getDoctorDateOverride(selectedEmail, ds).then((res) => {
        const key = `${selectedEmail}_${ds}`;
        const override = apiResult(res)?.override;
        if (override) {
          setDateOverrideCache((prev) => ({ ...prev, [key]: override }));
        } else {
          setDateOverrideCache((prev) => { const n = { ...prev }; delete n[key]; return n; });
        }
      }).catch(() => {});
    });
  }, [viewMode, calView, selectedEmail, selectedDate, weekStart, viewMonthDate]);

  // ── Fetch date overrides for all-doctors mode ─────────────────────────────────
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    const ds = toDateStr(selectedDate);
    allDoctorsList.forEach((doc) => {
      getDoctorDateOverride(doc.email, ds).then((res) => {
        const key = `${doc.email}_${ds}`;
        const override = apiResult(res)?.override;
        if (override) {
          setDateOverrideCache((prev) => ({ ...prev, [key]: override }));
        } else {
          setDateOverrideCache((prev) => { const n = { ...prev }; delete n[key]; return n; });
        }
      }).catch(() => {});
    });
  }, [viewMode, selectedDate, allDoctorsList]);

  // ── Fetch day closure status for selected doctor ───────────────────────────────
  useEffect(() => {
    if (!selectedEmail || viewMode !== "doctor") return;
    getDayClosureStatus(selectedEmail)
      .then((res) => {
        setClosedDaysMap((prev) => ({ ...prev, [selectedEmail]: apiResult(res)?.isClosed || false }));
      }).catch(() => {});
  }, [viewMode, selectedEmail]);

  // ── Fetch day closure status for all-doctors mode ─────────────────────────────
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    allDoctorsList.forEach((doc) => {
      getDayClosureStatus(doc.email)
        .then((res) => {
          setClosedDaysMap((prev) => ({ ...prev, [doc.email]: apiResult(res)?.isClosed || false }));
        }).catch(() => {});
    });
  }, [viewMode, allDoctorsList]);

  // Keep current-time line updated every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // ── Time slots — dynamic range derived from weekly schedule ──────────────────
  const timeSlots = useMemo(() => {
    // Inline day-name helper (avoids forward-reference to getDayName)
    const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const toDN = (dateStr) => DAY_NAMES[new Date(dateStr + "T00:00:00").getDay()];

    let startMin = 9 * 60;   // fallback 09:00
    let endMin   = 18 * 60;  // fallback 18:00
    let found    = false;

    // Expand [startMin, endMin] to cover every slot in a day object
    const scan = (dayObj) => {
      if (!dayObj || dayObj.isDayOff) return;
      (dayObj.slots || []).forEach((s) => {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        if (!found) { startMin = sh * 60 + sm; endMin = eh * 60 + em; found = true; }
        else { startMin = Math.min(startMin, sh * 60 + sm); endMin = Math.max(endMin, eh * 60 + em); }
      });
    };

    // Scan effective schedule for a date — override takes precedence over weekly
    const scanDate = (email, dateStr) => {
      const override = dateOverrideCache[`${email}_${dateStr}`];
      if (override) { scan(override); return; }
      const sched = weeklyScheduleCache[email];
      if (sched) scan(sched[toDN(dateStr)]);
    };

    if (viewMode === "doctor" && selectedEmail) {
      if (calView === "day") {
        scanDate(selectedEmail, toDateStr(selectedDate));
      } else if (calView === "week") {
        // Cover all visible week days so the grid fits every column
        getWeekDays(weekStart).forEach((d) => scanDate(selectedEmail, toDateStr(d)));
      }
    } else if (viewMode === "all") {
      // All-doctors day view — union of every doctor's effective schedule for this date
      const ds = toDateStr(selectedDate);
      Object.keys(weeklyScheduleCache).forEach((email) => scanDate(email, ds));
    }

    // If no schedule loaded yet, stay with defaults
    if (!found) { startMin = 9 * 60; endMin = 18 * 60; }

    const slots = [];
    for (let mins = startMin; mins < endMin; mins += 15) {
      const h = Math.floor(mins / 60), m = mins % 60;
      slots.push({ hour: h, minute: m, display: `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}` });
    }
    return slots.length ? slots : [{ hour: 9, minute: 0, display: "09:00" }];
  }, [viewMode, selectedEmail, calView, selectedDate, weekStart, weeklyScheduleCache, dateOverrideCache]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const parseTime = (t) => {
    if (!t) return [0, 0];
    if (t.includes("T")) { const d = new Date(t); return [d.getUTCHours(), d.getUTCMinutes()]; }
    return t.split(":").map(Number);
  };
  const fmtTime = (t) => {
    if (!t) return "";
    if (t.includes("T")) { const d = new Date(t); return `${d.getUTCHours().toString().padStart(2,"0")}:${d.getUTCMinutes().toString().padStart(2,"0")}`; }
    return t;
  };
  const fmtPatient = (app) => {
    if (app.patientName) return app.patientName;
    if (app.patient) { const { lastName="", firstName="", middleName="" } = app.patient; return [lastName, firstName, middleName].filter(Boolean).join(" ").trim(); }
    return t("calendar.unknown");
  };
  const getSlotCount = (s, e) => { const [sh,sm]=parseTime(s), [eh,em]=parseTime(e); return Math.max(1, Math.ceil((eh*60+em-sh*60-sm)/15)); };
  const isInBreak = (email, dateStr, hour, minute) => {
    const breaks = breaksMap[`${email}_${dateStr}`] || [];
    const slotMins = hour * 60 + minute;
    return breaks.some((b) => { if (!b.startTime || !b.endTime) return false; const [sh,sm]=b.startTime.split(":").map(Number); const [eh,em]=b.endTime.split(":").map(Number); return slotMins >= sh*60+sm && slotMins < eh*60+em; });
  };
  const hasBreakInRange = (email, dateStr, startMin) => {
    const endMin = startMin + 60;
    const breaks = breaksMap[`${email}_${dateStr}`] || [];
    return breaks.some((b) => { if (!b.startTime || !b.endTime) return false; const [sh,sm]=b.startTime.split(":").map(Number); const [eh,em]=b.endTime.split(":").map(Number); return startMin < eh*60+em && endMin > sh*60+sm; });
  };
  const isOnLeave = (email, dateStr) => !!leavesMap[`${email}_${dateStr}`];
  const getLeaveId = (email, dateStr) => leavesMap[`${email}_${dateStr}`]?._id || null;
  const getLeaveDetails = (email, dateStr) => leavesMap[`${email}_${dateStr}`] || null;

  const restoreLeave = async (email, dateStr) => {
    const leaveId = getLeaveId(email, dateStr);
    if (!leaveId) return;
    try {
      await deleteDoctorLeave(leaveId);
      setLeavesMap((prev) => ({ ...prev, [`${email}_${dateStr}`]: null }));
      toast.success(t("calendar.workingDayRestored") || "Working day restored");
    } catch {
      toast.error(t("calendar.failedToRestoreDay") || "Failed to restore working day");
    }
  };

  // ── Weekly schedule helpers (with date override support) ────────────────────
  const getDayName = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];
  };
  const getDateOverrideFor = (email, dateStr) => {
    const key = `${email}_${dateStr}`;
    return dateOverrideCache[key] || null;
  };
  const getWeeklyDay = (email, dateStr) => {
    const sched = weeklyScheduleCache[email];
    if (!sched) return null;
    return sched[getDayName(dateStr)] || null;
  };
  /** Returns the effective schedule for a date, preferring override over weekly */
  const getEffectiveDay = (email, dateStr) => {
    const override = getDateOverrideFor(email, dateStr);
    if (override) return override;
    return getWeeklyDay(email, dateStr);
  };
  const isWeeklyDayOff = (email, dateStr) => {
    const d = getEffectiveDay(email, dateStr);
    return d ? d.isDayOff : false;
  };
  const isWeeklyBreakSlot = (email, dateStr, hour, minute) => {
    const d = getEffectiveDay(email, dateStr);
    if (!d || d.isDayOff) return false;
    const slotMins = hour * 60 + minute;
    return (d.slots || []).some((s) => {
      if (s.type !== "break") return false;
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return slotMins >= sh * 60 + sm && slotMins < eh * 60 + em;
    });
  };
  const isOutsideWorkingHours = (email, dateStr, hour, minute) => {
    const d = getEffectiveDay(email, dateStr);
    if (!d || d.isDayOff || !d.slots || d.slots.length === 0) return false;
    const slotMins = hour * 60 + minute;
    return !d.slots.some((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return slotMins >= sh * 60 + sm && slotMins < eh * 60 + em;
    });
  };
  const getWorkingRanges = (email, dateStr) => {
    const d = getEffectiveDay(email, dateStr);
    if (!d || d.isDayOff || !Array.isArray(d.slots)) return [];
    return d.slots
      .filter((s) => s.type === "working" && s.startTime && s.endTime)
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
  };
  const hasDateOverride = (email, dateStr) => !!getDateOverrideFor(email, dateStr);

  // ── Doctor helpers ────────────────────────────────────────────────────────────
  const fmtDocName = (doc) => {
    if (!doc) return "";
    const lang = i18n.language === "ru" ? "ru" : "en", fb = lang==="en"?"ru":"en";
    const str = (v) => (typeof v === "string" ? v : "");
    const last   = str(doc.lastName?.[lang])   || str(doc.lastName?.[fb])   || str(doc.lastName)   || "";
    const first  = str(doc.firstName?.[lang])  || str(doc.firstName?.[fb])  || str(doc.firstName)  || "";
    const middle = str(doc.middleName?.[lang]) || str(doc.middleName?.[fb]) || str(doc.middleName) || "";
    return [last, first, middle].filter(Boolean).join(" ").trim() || doc.email || t("calendar.unknown");
  };
  const fmtDocSpec = (doc) => {
    if (!doc) return t("calendar.specialist");
    const lang = i18n.language === "ru" ? "ru" : "en";
    if (doc.specialtyIds?.length) { const s = doc.specialtyIds[0]; const name = lang==="ru"?(s.name_ru||s.name_en):(s.name_en||s.name_ru); if (name) return name; }
    if (doc.specialty) { if (typeof doc.specialty === "string") return doc.specialty; return doc.specialty[lang] || doc.specialty[lang==="en"?"ru":"en"] || t("calendar.specialist"); }
    return t("calendar.specialist");
  };
  const filteredDoctors = allDoctorsList.filter((d) => { const q=doctorSearch.toLowerCase(); return !q||fmtDocName(d).toLowerCase().includes(q)||(d.email||"").toLowerCase().includes(q); });
  const getDoctorName     = () => doctor ? fmtDocName(doctor) : "...";
  const getDoctorInitials = () => getInitials(getDoctorName());
  const getSpecialty      = () => fmtDocSpec(doctor);

  // ── All-doctor columns (same pattern as DoctorAppointmentsCalendar) ───────────
  const allDoctorColumns = useMemo(() => {
    if (viewMode !== "all") return [];
    const lang = i18n.language === "ru" ? "ru" : "en", fb = lang==="en"?"ru":"en";
    return allDoctorsList.map((doc) => {
      const last   = doc.lastName?.[lang]  ||doc.lastName?.[fb]  ||doc.lastName  ||"";
      const first  = doc.firstName?.[lang] ||doc.firstName?.[fb] ||doc.firstName ||"";
      const middle = doc.middleName?.[lang]||doc.middleName?.[fb]||doc.middleName||"";
      const name   = [last, first, middle].filter(Boolean).join(" ").trim() || doc.email || t("calendar.unknown");
      let spec = "";
      if (doc.specialtyIds?.length) { const s=doc.specialtyIds[0]; spec = lang==="ru"?(s.name_ru||s.name_en||""):(s.name_en||s.name_ru||""); }
      if (!spec && doc.specialty) spec = typeof doc.specialty==="string" ? doc.specialty : (doc.specialty?.[lang]||"");
      if (!spec) spec = t("calendar.specialist");
      return { email: doc.email, name, initials: getInitials(name), specialty: spec };
    });
  }, [viewMode, allDoctorsList, i18n.language, t]);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goToPrev = () => {
    if (viewMode === "all") {
      const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d);
    } else if (calView === "month") {
      const d = new Date(viewMonthDate); d.setMonth(d.getMonth()-1); setViewMonthDate(d);
    } else if (calView === "week") {
      const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d);
    } else {
      const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d);
    }
  };
  const goToNext = () => {
    if (viewMode === "all") {
      const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d);
    } else if (calView === "month") {
      const d = new Date(viewMonthDate); d.setMonth(d.getMonth()+1); setViewMonthDate(d);
    } else if (calView === "week") {
      const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d);
    } else {
      const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d);
    }
  };
  const goToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setWeekStart(getWeekStart(now));
    setViewMonthDate(new Date(now));
  };

  // ── Mini-calendar helpers ─────────────────────────────────────────────────────
  const prevMonth = () => { const d=new Date(calMonthDate); d.setMonth(d.getMonth()-1); setCalMonthDate(d); };
  const nextMonth = () => { const d=new Date(calMonthDate); d.setMonth(d.getMonth()+1); setCalMonthDate(d); };
  const handleMonthChange = (idx) => { const d=new Date(calMonthDate); d.setMonth(idx); setCalMonthDate(d); setShowMonthDropdown(false); };
  const handleYearChange  = (yr)  => { const d=new Date(calMonthDate); d.setFullYear(yr); setCalMonthDate(d); setShowYearDropdown(false); };
  const getYearOptions    = () => { const cy=new Date().getFullYear(); return Array.from({length:21},(_,i)=>cy-10+i); };
  const getMonthNames     = () => Array.from({length:12},(_,i)=>({ index:i, name:new Date(2000,i,1).toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{month:"long"}) }));

  const miniCalDays = useMemo(() => getMonthDays(calMonthDate.getFullYear(), calMonthDate.getMonth()), [calMonthDate]);
  const miniCalRows = useMemo(() => { const rows=[]; for(let i=0;i<miniCalDays.length;i+=7) rows.push(miniCalDays.slice(i,i+7)); return rows; }, [miniCalDays]);

  const today    = new Date();
  const weekDays = getWeekDays(weekStart);

  const isRowSelected = (row) => calView==="week" && row.some((d) => toDateStr(d.date) === toDateStr(weekStart));

  const weekLabelParts = useMemo(() => {
    return [
      fmtDate(weekDays[0], i18n.language, { year: undefined }),
      fmtDate(weekDays[6], i18n.language),
    ];
  }, [weekDays, i18n.language]);

  const apiResult = (res) => res?.data ?? res;

  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  // ── App getters for time slots ────────────────────────────────────────────────
  const getAppsForDayTime = (ds, hour, minute, source) =>
    (source[ds] || []).filter((app) => { if(!app.startTime) return false; const [sh,sm]=parseTime(app.startTime); return sh===hour && sm===minute; });

  const getAppsForDoctorTime = (doctorEmail, hour, minute) =>
    allApplications.filter((app) => {
      const hasDoc = app.doctors?.some((d) => d.doctorEmail === doctorEmail) || app.doctorEmail === doctorEmail;
      if (!hasDoc) return false;
      if (!app.startTime) return false;
      const [sh, sm] = parseTime(app.startTime);
      return sh === hour && sm === minute;
    });

  // ── Appointment block component ───────────────────────────────────────────────
  const AppBlock = ({ app }) => {
    const dur = getSlotCount(app.startTime, app.endTime);
    return (
      <div
        className={`appointment-block ${getApptStatusClass(app.appointmentStatus)}`}
        style={{ height:`${dur*36-4}px` }}
        onClick={() => navigate(`/applications/appointment/${encodeURIComponent(app.applicationId||app._id)}`)}
      >
        <div className="appointment-time">{fmtTime(app.startTime)} – {fmtTime(app.endTime)}</div>
        <div className="appointment-patient">{fmtPatient(app)}</div>
        {dur > 1 && <div className="appointment-status-badge">{t(`applications.status_${app.appointmentStatus?.toLowerCase().replace(/\s+/g,"_")}`,app.appointmentStatus)}</div>}
      </div>
    );
  };

  // ── Month grid for doctor/all mode ────────────────────────────────────────────
  const MonthGrid = ({ cache, onDayClick }) => {
    const monthDays = useMemo(() => getMonthDays(viewMonthDate.getFullYear(), viewMonthDate.getMonth()), [viewMonthDate]);
    const monthRows = [];
    for (let i = 0; i < monthDays.length; i+=7) monthRows.push(monthDays.slice(i,i+7));
    const loc = i18n.language==="ru"?"ru-RU":"en-US";
    return (
      <div className="smc-month-grid">
        <div className="smc-month-header-row">
          {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
            <div key={d} className="smc-month-dow">{t(`calendar.short_${d.toLowerCase()}`,d)}</div>
          ))}
        </div>
        <div className="smc-month-body">
          {monthRows.map((row, ri) => (
            <div key={ri} className="smc-month-week-row">
              {row.map((cell, ci) => {
                const ds = toDateStr(cell.date);
                const apps = cache[ds] || [];
                const isToday = cell.date.toDateString() === today.toDateString();
                const isSelected = toDateStr(cell.date) === toDateStr(selectedDate);
                const leave   = selectedEmail ? leavesMap[`${selectedEmail}_${ds}`] : null;
                const apiBreaks = selectedEmail ? (breaksMap[`${selectedEmail}_${ds}`] || []) : [];
                const dayOff  = selectedEmail ? isWeeklyDayOff(selectedEmail, ds) : false;
                const weekDay = selectedEmail ? getWeeklyDay(selectedEmail, ds) : null;
                const weeklyBreaks = (weekDay?.slots || []).filter((s) => s.type === "break");
                const workingRanges = (weekDay?.slots || []).filter((s) => s.type === "working" && s.startTime && s.endTime);
                // merge weekly schedule breaks + one-off DoctorBreak records
                const breaks = [
                  ...weeklyBreaks,
                  ...apiBreaks.filter((b) => !weeklyBreaks.some((wb) => wb.startTime === b.startTime && wb.endTime === b.endTime)),
                ];
                return (
                  <div
                    key={ci}
                    className={`smc-month-day${!cell.isCurrentMonth?" smc-other-month":""}${isToday?" smc-today":""}${isSelected&&viewMode==="doctor"?" smc-selected":""}${leave?" smc-month-day--leave":dayOff?" smc-month-day--dayoff":""}`}
                    onClick={() => {
                      if (!cell.isCurrentMonth) return;
                      setSelectedDate(new Date(cell.date));
                      setActiveMonthMenuDate((prev) => (prev === ds ? null : ds));
                    }}
                    style={{ position: "relative" }}
                    ref={activeMonthMenuDate === ds ? monthMenuRef : null}
                  >
                    <div className="smc-day-number">{cell.day}</div>
                    {cell.isCurrentMonth && selectedEmail && activeMonthMenuDate === ds && (
                      <div className="doctor-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                        <div className="doctor-menu-item" onClick={() => {
                          setActiveMonthMenuDate(null);
                          onDayClick && onDayClick(cell.date);
                        }}>
                          <CalendarIcon size={16}/><span>{t("calendar.openDayView") || "Open day view"}</span>
                        </div>
                        <div className="doctor-menu-item" onClick={(e) => {
                          e.stopPropagation();
                          openDateOverrideModal(selectedEmail, getDoctorName(), ds);
                          setActiveMonthMenuDate(null);
                        }}>
                          <Edit3 size={16}/><span>{t("calendar.editDateSchedule") || "Edit this date's schedule"}</span>
                        </div>
                        <div className="doctor-menu-item" onClick={(e) => {
                          e.stopPropagation();
                          setBreakDoctorEmail(selectedEmail);
                          setBreakDoctorName(getDoctorName());
                          setBreakContextDate(ds);
                          setBreakStartDate(""); setBreakStartTime("09:00");
                          setBreakEndDate("");   setBreakEndTime("09:15");
                          setBreakComment("");
                          setShowBreakModal(true);
                          setActiveMonthMenuDate(null);
                        }}>
                          <Clock size={16}/><span>{t("calendar.addBreak") || "Add a break"}</span>
                        </div>
                        <div className="doctor-menu-item" onClick={() => {
                          setActiveMonthMenuDate(null);
                          if (isOnLeave(selectedEmail, ds)) {
                            restoreLeave(selectedEmail, ds);
                          } else {
                            setCancelConfirmData({ doctorEmail: selectedEmail, dateStr: ds, doctorName: getDoctorName() });
                            setCancelStartDate(ds);
                            setCancelEndDate(ds);
                            setShowCancelConfirm(true);
                          }
                        }}>
                          <CalendarIcon size={16}/><span>{isOnLeave(selectedEmail, ds) ? (t("calendar.restoreWorkingDay") || "Restore working day") : (t("calendar.cancelWorkingDay") || "Cancel the working day")}</span>
                        </div>
                      </div>
                    )}
                    {cell.isCurrentMonth && selectedEmail && (
                      <div className="smc-day-tags">
                        {leave ? (
                          <span className="smc-tag smc-tag--leave">{leave.leaveType ? t(`calendar.${LEAVE_TYPE_KEY[leave.leaveType]}`, leave.leaveType) : t("calendar.leave","Leave")}</span>
                        ) : dayOff ? (
                          <span className="smc-tag smc-tag--dayoff">{t("calendar.day_off","Day off")}</span>
                        ) : (
                          <>
                            {workingRanges.map((range, rangeIdx) => (
                              <span key={rangeIdx} className="smc-tag smc-tag--available">
                                {range.startTime}–{range.endTime}
                              </span>
                            ))}
                            {breaks.map((br, bi) => (
                              <span key={bi} className="smc-tag smc-tag--break">
                                {br.startTime}–{br.endTime}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                    {apps.length > 0 && (
                      <div className="smc-day-events">
                        {apps.slice(0, 3).map((app, ai) => (
                          <div
                            key={ai}
                            className={`smc-event-pill ${getApptStatusClass(app.appointmentStatus)}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/applications/appointment/${encodeURIComponent(app.applicationId||app._id)}`); }}
                          >
                            {fmtTime(app.startTime)} {fmtPatient(app)}
                          </div>
                        ))}
                        {apps.length > 3 && (
                          <div className="smc-more-events">+{apps.length - 3} {t("calendar.more","more")}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── All-doctors month grid: aggregate by day ──────────────────────────────────
  const AllDoctorsMonthGrid = () => {
    const monthDays = useMemo(() => getMonthDays(viewMonthDate.getFullYear(), viewMonthDate.getMonth()), [viewMonthDate]);
    const monthRows = [];
    for (let i = 0; i < monthDays.length; i+=7) monthRows.push(monthDays.slice(i,i+7));
    return (
      <div className="smc-month-grid">
        <div className="smc-month-header-row">
          {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
            <div key={d} className="smc-month-dow">{t(`calendar.short_${d.toLowerCase()}`,d)}</div>
          ))}
        </div>
        <div className="smc-month-body">
          {monthRows.map((row, ri) => (
            <div key={ri} className="smc-month-week-row">
              {row.map((cell, ci) => {
                const ds = toDateStr(cell.date);
                const apps = allMonthCache[ds] || [];
                const isToday = cell.date.toDateString() === today.toDateString();
                // Count unique doctors with appointments
                const doctorSet = new Set(apps.map((a) => a.doctorEmail || a.doctors?.[0]?.doctorEmail).filter(Boolean));
                return (
                  <div
                    key={ci}
                    className={`smc-month-day${!cell.isCurrentMonth?" smc-other-month":""}${isToday?" smc-today":""}`}
                  >
                    <div className="smc-day-number">{cell.day}</div>
                    {apps.length > 0 && (
                      <div className="smc-day-events">
                        <div className="smc-all-day-summary">
                          <span className="smc-all-count">{apps.length} {t("calendar.appts","appts")}</span>
                          {doctorSet.size > 0 && (
                            <span className="smc-all-doctors">{doctorSet.size} {t("calendar.doctors","drs")}</span>
                          )}
                        </div>
                        {apps.slice(0, 2).map((app, ai) => (
                          <div
                            key={ai}
                            className={`smc-event-pill ${getApptStatusClass(app.appointmentStatus)}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/applications/appointment/${encodeURIComponent(app.applicationId||app._id)}`); }}
                          >
                            {fmtTime(app.startTime)} {fmtPatient(app)}
                          </div>
                        ))}
                        {apps.length > 2 && (
                          <div className="smc-more-events">+{apps.length - 2} {t("calendar.more","more")}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Topbar date label ─────────────────────────────────────────────────────────
  const getTopbarLabel = () => {
    const loc = i18n.language==="ru"?"ru-RU":"en-US";
    if (viewMode === "all") {
      return fmtDate(selectedDate, i18n.language, { weekday: "long", month: "long" });
    }
    if (calView === "month") {
      return viewMonthDate.toLocaleDateString(loc, { month:"long", year:"numeric" });
    }
    if (calView === "week") return <>{weekLabelParts[0]}&nbsp;–&nbsp;{weekLabelParts[1]}</>;
    return fmtDate(selectedDate, i18n.language, { weekday: "long", month: "long" });
  };

  // ── Always-fresh drag finalise handler (updated every render) ─────────────────
  onDragEndRef.current = () => {
    if (!dragStateRef.current?.active) return;
    const { dateStr, startIdx, endIdx } = dragStateRef.current;
    if (startIdx === endIdx) {
      dragStateRef.current = null;
      setDragHighlight(null);
      return;
    }
    const minI = Math.min(startIdx, endIdx);
    const maxI = Math.max(startIdx, endIdx);
    const startSlot = timeSlots[minI];
    const endTotalMin = timeSlots[maxI].hour * 60 + timeSlots[maxI].minute + 15;
    const pad = (n) => String(n).padStart(2, "0");
    setBreakStartDate(dateStr);
    setBreakStartTime(`${pad(startSlot.hour)}:${pad(startSlot.minute)}`);
    setBreakEndDate(dateStr);
    setBreakEndTime(`${pad(Math.floor(endTotalMin / 60))}:${pad(endTotalMin % 60)}`);
    setBreakDoctorEmail(selectedEmail);
    setBreakDoctorName(getDoctorName());
    setBreakComment("");
    setBreakContextDate(dateStr);
    setShowBreakModal(true);
    dragStateRef.current = null;
    setDragHighlight(null);
  };

  // ── All-doctors drag finalise handler (updated every render) ──────────────────
  onAllDragEndRef.current = () => {
    if (!allDragStateRef.current?.active) return;
    const { docEmail, docName, startIdx, endIdx } = allDragStateRef.current;
    if (startIdx === endIdx) {
      allDragStateRef.current = null;
      setAllDragHighlight(null);
      return;
    }
    const minI = Math.min(startIdx, endIdx);
    const maxI = Math.max(startIdx, endIdx);
    const startSlot = timeSlots[minI];
    const endTotalMin = timeSlots[maxI].hour * 60 + timeSlots[maxI].minute + 15;
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = toDateStr(selectedDate);
    setBreakStartDate(dateStr);
    setBreakStartTime(`${pad(startSlot.hour)}:${pad(startSlot.minute)}`);
    setBreakEndDate(dateStr);
    setBreakEndTime(`${pad(Math.floor(endTotalMin / 60))}:${pad(endTotalMin % 60)}`);
    setBreakDoctorEmail(docEmail);
    setBreakDoctorName(docName);
    setBreakComment("");
    setBreakContextDate(dateStr);
    setShowBreakModal(true);
    allDragStateRef.current = null;
    setAllDragHighlight(null);
  };

  // ── Render time-slot grid (shared for day and week) ───────────────────────────
  const renderTimeGrid = () => {
    const isDayView = calView === "day";
    const dayDs = toDateStr(selectedDate);
    const columns  = isDayView
      ? [dayDs]
      : getWeekDays(weekStart).map((d) => toDateStr(d));
    const appSource = isDayView
      ? { [dayDs]: dayApplications }
      : weekApplications;

    return (
      <div className={`dac-content-frame dac-doctor-hscroll`}>
        <div className="dac-doctor-inner">
          {/* Column headers */}
          <div className="calendar-header">
            <div className="time-column-header">
              <button
                className={`cv-sidebar-toggle${sidebarOpen?" cv-sidebar-toggle--open":""}`}
                onClick={() => setSidebarOpen((v)=>!v)}
                aria-label="Toggle calendar sidebar"
              >
                {sidebarOpen ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
              </button>
              <Clock size={16} className="cv-clock-icon"/>
            </div>
            {isDayView ? (
              <div className={`doctor-column-header dac-day-col-header${selectedDate.toDateString()===today.toDateString()?" dac-today-col":""}`}
                style={{flex:1,minWidth:0,position:"relative"}}
                ref={activeDayMenu === dayDs ? dayMenuRef : null}
              >
                <div className="dac-day-col-inner" onClick={() => setActiveDayMenu(activeDayMenu === dayDs ? null : dayDs)}>
                  <div className="dac-day-label">{selectedDate.toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{weekday:"short"})}</div>
                  <div className={`dac-day-number${selectedDate.toDateString()===today.toDateString()?" today":""}`}>{selectedDate.getDate()}</div>
                </div>
                {activeDayMenu === dayDs && (
                  <div className="doctor-menu-dropdown">
                    <div className="doctor-menu-item" onClick={(e) => {
                      e.stopPropagation();
                      openWeeklyModal(selectedEmail, getDoctorName());
                      setActiveDayMenu(null);
                    }}>
                      <CalendarIcon size={16}/><span>{t("calendar.weeklySchedule") || "Weekly schedule"}</span>
                    </div>
                    <div className="doctor-menu-item" onClick={(e) => {
                      e.stopPropagation();
                      openDateOverrideModal(selectedEmail, getDoctorName(), dayDs);
                      setActiveDayMenu(null);
                    }}>
                      <Edit3 size={16}/><span>{t("calendar.editDateSchedule") || "Edit this date's schedule"}</span>
                    </div>
                    <div className="doctor-menu-item" onClick={(e) => {
                      e.stopPropagation();
                      setBreakDoctorEmail(selectedEmail);
                      setBreakDoctorName(getDoctorName());
                      setBreakContextDate(dayDs);
                      setBreakStartDate(""); setBreakStartTime("09:00");
                      setBreakEndDate("");   setBreakEndTime("09:15");
                      setBreakComment("");
                      setShowBreakModal(true);
                      setActiveDayMenu(null);
                    }}>
                      <Clock size={16}/><span>{t("calendar.addBreak") || "Add a break"}</span>
                    </div>
                    <div className="doctor-menu-item" onClick={() => {
                      setActiveDayMenu(null);
                      if (isOnLeave(selectedEmail, dayDs)) {
                        restoreLeave(selectedEmail, dayDs);
                      } else {
                        setCancelConfirmData({ doctorEmail: selectedEmail, dateStr: dayDs, doctorName: getDoctorName() });
                        setCancelStartDate(dayDs);
                        setCancelEndDate(dayDs);
                        setShowCancelConfirm(true);
                      }
                    }}>
                      <CalendarIcon size={16}/><span>{isOnLeave(selectedEmail, dayDs) ? (t("calendar.restoreWorkingDay") || "Restore working day") : (t("calendar.cancelWorkingDay") || "Cancel the working day")}</span>
                    </div>
                    <div className="doctor-menu-item doctor-menu-item--danger" onClick={() => {
                      setActiveDayMenu(null);
                      setCloseConfirmData({ doctorEmail: selectedEmail, doctorName: getDoctorName() });
                      setShowCloseConfirm(true);
                    }}>
                      <XCircle size={16}/><span>{closedDaysMap[selectedEmail] ? (t("calendar.reopenSchedule") || "Reopen schedule") : (t("calendar.closeAllSchedule") || "Close all the schedule")}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : weekDays.map((day, i) => {
              const isToday = day.toDateString()===today.toDateString();
              const ds = toDateStr(day);
              return (
                <div key={i} className={`doctor-column-header dac-day-col-header${isToday?" dac-today-col":""}`}
                  style={{flex:1,minWidth:0,position:"relative"}}
                  ref={activeDayMenu === ds ? dayMenuRef : null}
                >
                  <div className="dac-day-col-inner" onClick={() => setActiveDayMenu(activeDayMenu === ds ? null : ds)}>
                    <div className="dac-day-label">{day.toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{weekday:"short"})}</div>
                    <div className={`dac-day-number${isToday?" today":""}`}>{day.getDate()}</div>
                  </div>
                  {activeDayMenu === ds && (
                    <div className="doctor-menu-dropdown">
                      <div className="doctor-menu-item" onClick={(e) => {
                        e.stopPropagation();
                        openWeeklyModal(selectedEmail, getDoctorName());
                        setActiveDayMenu(null);
                      }}>
                        <CalendarIcon size={16}/><span>{t("calendar.weeklySchedule") || "Weekly schedule"}</span>
                      </div>
                      <div className="doctor-menu-item" onClick={(e) => {
                        e.stopPropagation();
                        openDateOverrideModal(selectedEmail, getDoctorName(), ds);
                        setActiveDayMenu(null);
                      }}>
                        <Edit3 size={16}/><span>{t("calendar.editDateSchedule") || "Edit this date's schedule"}</span>
                      </div>
                      <div className="doctor-menu-item" onClick={(e) => {
                        e.stopPropagation();
                        setBreakDoctorEmail(selectedEmail);
                        setBreakDoctorName(getDoctorName());
                        setBreakContextDate(ds);
                        setBreakStartDate(""); setBreakStartTime("09:00");
                        setBreakEndDate("");   setBreakEndTime("09:15");
                        setBreakComment("");
                        setShowBreakModal(true);
                        setActiveDayMenu(null);
                      }}>
                        <Clock size={16}/><span>{t("calendar.addBreak") || "Add a break"}</span>
                      </div>
                      <div className="doctor-menu-item" onClick={() => {
                        setActiveDayMenu(null);
                        if (isOnLeave(selectedEmail, ds)) {
                          restoreLeave(selectedEmail, ds);
                        } else {
                          setCancelConfirmData({ doctorEmail: selectedEmail, dateStr: ds, doctorName: getDoctorName() });
                          setCancelStartDate(ds);
                          setCancelEndDate(ds);
                          setShowCancelConfirm(true);
                        }
                      }}>
                        <CalendarIcon size={16}/><span>{isOnLeave(selectedEmail, ds) ? (t("calendar.restoreWorkingDay") || "Restore working day") : (t("calendar.cancelWorkingDay") || "Cancel the working day")}</span>
                      </div>
                      <div className="doctor-menu-item doctor-menu-item--danger" onClick={() => {
                        setActiveDayMenu(null);
                        setCloseConfirmData({ doctorEmail: selectedEmail, doctorName: getDoctorName() });
                        setShowCloseConfirm(true);
                      }}>
                        <XCircle size={16}/><span>{closedDaysMap[selectedEmail] ? (t("calendar.reopenSchedule") || "Reopen schedule") : (t("calendar.closeAllSchedule") || "Close all the schedule")}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time grid body */}
          <div className="calendar-body">
            {/* Current-time red line */}
            {(() => {
              const isToday = (calView === "day"
                ? selectedDate.toDateString() === today.toDateString()
                : getWeekDays(weekStart).some((d) => d.toDateString() === today.toDateString()));
              if (!isToday || !timeSlots.length) return null;
              const startMin = timeSlots[0].hour * 60 + timeSlots[0].minute;
              const endMin   = timeSlots[timeSlots.length - 1].hour * 60 + timeSlots[timeSlots.length - 1].minute + 15;
              const offset   = nowMinutes - startMin;
              if (offset < 0 || nowMinutes >= endMin) return null;
              const top = (offset / 15) * 36;
              return (
                <div className="cal-now-line" style={{ top: `${top}px` }}>
                  <span className="cal-now-dot" />
                </div>
              );
            })()}
            <div className="time-slots-column">
              {timeSlots.map((slot,i) => (
                <div key={i} className={`time-slot${slot.minute===0||slot.minute===30?" half-hour-mark":""}`}>
                  {(slot.minute===0||slot.minute===30) && <span className="time-label">{slot.display}</span>}
                </div>
              ))}
            </div>
            <div className={`appointments-grid${dragHighlight ? " bm-dragging" : ""}`}>
              {columns.map((ds, colIdx) => {
                const isClosed = !!closedDaysMap[selectedEmail];
                const onLeave = !isClosed && isOnLeave(selectedEmail, ds);
                const weeklyOff = !isClosed && !onLeave && isWeeklyDayOff(selectedEmail, ds);
                const isOff = onLeave || weeklyOff;
                const workingRanges = getWorkingRanges(selectedEmail, ds);
                return (
                  <div key={colIdx} className="doctor-column" style={{flex:1,minWidth:0}}>
                    {timeSlots.map((slot, slotIdx) => {
                      const appts = getAppsForDayTime(ds, slot.hour, slot.minute, appSource);
                      const inBreak = !isClosed && !isOff && isInBreak(selectedEmail, ds, slot.hour, slot.minute);
                      const inWeeklyBreak = !isClosed && !isOff && !inBreak && isWeeklyBreakSlot(selectedEmail, ds, slot.hour, slot.minute);
                      const slotStartMin = slot.hour*60+slot.minute;
                      const outsideHours = !isClosed && !isOff && !inBreak && !inWeeklyBreak && isOutsideWorkingHours(selectedEmail, ds, slot.hour, slot.minute);
                      const blockedByBreak = !isClosed && !isOff && (inBreak || inWeeklyBreak || hasBreakInRange(selectedEmail, ds, slotStartMin));
                      const blocked = isClosed || isOff || blockedByBreak || outsideHours;
                      const isDragHighlighted = !blocked && dragHighlight
                        && dragHighlight.dateStr === ds
                        && slotIdx >= dragHighlight.minIdx
                        && slotIdx <= dragHighlight.maxIdx;
                      const isDragFirst = isDragHighlighted && slotIdx === dragHighlight.minIdx;
                      const isDragLast  = isDragHighlighted && slotIdx === dragHighlight.maxIdx;
                      return (
                        <div key={slotIdx}
                          className={`time-cell${slot.minute===0||slot.minute===30?" half-hour-mark":""}${isClosed?" dac-closed-cell":isOff?" dac-leave-cell":inBreak||inWeeklyBreak?" dac-break-cell":outsideHours?" dac-outside-hours":" dac-working-hours"}${isDragHighlighted?" bm-drag-highlight":""}${isDragFirst?" bm-drag-first":""}${isDragLast?" bm-drag-last":""}`}
                          onMouseDown={(e) => {
                            if (e.button !== 0 || blocked) return;
                            e.preventDefault();
                            const s = { active: true, dateStr: ds, startIdx: slotIdx, endIdx: slotIdx };
                            dragStateRef.current = s;
                            setDragHighlight({ dateStr: ds, minIdx: slotIdx, maxIdx: slotIdx });
                          }}
                          onMouseEnter={() => {
                            if (!dragStateRef.current?.active || dragStateRef.current.dateStr !== ds || blocked) return;
                            dragStateRef.current.endIdx = slotIdx;
                            const minI = Math.min(dragStateRef.current.startIdx, slotIdx);
                            const maxI = Math.max(dragStateRef.current.startIdx, slotIdx);
                            setDragHighlight({ dateStr: ds, minIdx: minI, maxIdx: maxI });
                          }}
                        >
                          {isDragFirst && dragHighlight && (
                            <span className="bm-drag-time-start">
                              {timeSlots[dragHighlight.minIdx]?.display}
                            </span>
                          )}
                          {isDragLast && dragHighlight && (
                            <span className="bm-drag-time-end">
                              {(() => {
                                const em = timeSlots[dragHighlight.maxIdx].hour * 60 + timeSlots[dragHighlight.maxIdx].minute + 15;
                                return `${String(Math.floor(em / 60)).padStart(2, "0")}:${String(em % 60).padStart(2, "0")}`;
                              })()}
                            </span>
                          )}
                          {isClosed && slot.hour===9 && slot.minute===0 && (
                            <div className="dac-closed-label"><XCircle size={10}/>{t("calendar.scheduleClosed")||"Closed"}</div>
                          )}
                          {!isClosed && !isOff && workingRanges.filter((range) => {
                            const [sh, sm] = range.startTime.split(":").map(Number);
                            return sh === slot.hour && sm === slot.minute;
                          }).map((range, rangeIdx) => (
                            <div key={rangeIdx} className="dac-schedule-label">
                              <span className="dac-schedule-label-text">{range.startTime}–{range.endTime}</span>
                            </div>
                          ))}
                          {isOff && slot.hour===9 && slot.minute===0 && (() => {
                            const ld = onLeave ? getLeaveDetails(selectedEmail, ds) : null;
                            return (
                              <div className="dac-leave-label">
                                <div className="dac-leave-type-row">
                                  <span>{weeklyOff ? (t("calendar.weeklyDayOff")||"Day Off") : ld?.leaveType ? t(`calendar.${LEAVE_TYPE_KEY[ld.leaveType]}`, ld.leaveType) : (t("calendar.dayOff")||"Day Off")}</span>
                                  {onLeave && <button className="dac-restore-btn" onClick={() => restoreLeave(selectedEmail, ds)} title={t("calendar.restoreWorkingDay")||"Restore working day"}>↩</button>}
                                </div>
                                {ld && (ld.reviewedBy || ld.comment) && (
                                  <div className="dac-leave-meta">
                                    {ld.reviewedBy && <span className="dac-leave-by">by {ld.reviewedBy}</span>}
                                    {ld.comment && <span className="dac-leave-comment" title={ld.comment}>📝</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {!isOff && (inBreak || inWeeklyBreak) && slot.minute===0 && (
                            <div className="dac-break-label">{t("calendar.breakLabel")||"Break"}</div>
                          )}
                          {appts.map((app) => <AppBlock key={app._id} app={app}/>)}
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
    );
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <div className="calendar-view-layout">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div className={`calendar-sidebar${sidebarOpen?" sidebar-responsive-open":""}`}>
        <div className="dac-header">

          {/* Mode toggle */}
          <div className="dac-mode-toggle">
            <button className={`dac-mode-btn${viewMode==="doctor"?" active":""}`} onClick={() => setViewMode("doctor")}>
              <User size={13}/><span>{t("calendar.modeDoctor")||"Doctor"}</span>
            </button>
            <button className={`dac-mode-btn${viewMode==="all"?" active":""}`} onClick={() => setViewMode("all")}>
              <Users size={13}/><span>{t("calendar.modeAll")||"All"}</span>
            </button>
          </div>

          {/* View tabs – visible only in doctor mode */}
          {viewMode === "doctor" && (
            <div className="smc-view-tabs">
              {["day","week","month"].map((v) => (
                <button key={v} className={`smc-view-tab${calView===v?" active":""}`} onClick={() => setCalView(v)}>
                  {t(`calendar.view_${v}`, v.charAt(0).toUpperCase()+v.slice(1))}
                </button>
              ))}
            </div>
          )}

          {/* Doctor selector */}
          {viewMode === "doctor" && (
            <div className="dac-doctor-selector" ref={dropdownRef}>
              <div className="dac-doctor-info dac-doctor-trigger" onClick={() => setShowDoctorDropdown((v)=>!v)}>
                <div className="dac-doctor-avatar">{getDoctorInitials()}</div>
                <div className="dac-doctor-details">
                  <div className="dac-doctor-name">{getDoctorName()}</div>
                  <div className="dac-doctor-specialty">{getSpecialty()}</div>
                </div>
                <ChevronDown size={14} className={`dac-chevron${showDoctorDropdown?" open":""}`}/>
              </div>

              {showDoctorDropdown && (
                <div className="dac-doctor-dropdown">
                  <div className="dac-dropdown-search">
                    <Search size={13}/>
                    <input type="text" placeholder={t("calendar.searchDoctor")||"Search doctor..."} value={doctorSearch}
                      onChange={(e)=>setDoctorSearch(e.target.value)} autoFocus onClick={(e)=>e.stopPropagation()}/>
                  </div>
                  <div className="dac-dropdown-list">
                    {filteredDoctors.length === 0
                      ? <div className="dac-dropdown-empty">{t("calendar.noDoctorsFound")||"No doctors found"}</div>
                      : filteredDoctors.map((d) => (
                        <div key={d.email||d._id}
                          className={`dac-dropdown-item${d.email===selectedEmail?" active":""}`}
                          onClick={() => { setSelectedEmail(d.email); setShowDoctorDropdown(false); setDoctorSearch(""); }}>
                          <div className="dac-dropdown-avatar">{getInitials(fmtDocName(d))}</div>
                          <div className="dac-dropdown-info">
                            <div className="dac-dropdown-name">{fmtDocName(d)}</div>
                            <div className="dac-dropdown-specialty">{fmtDocSpec(d)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mini calendar */}
        <div className="sidebar-date-section">
          <div className="mini-calendar">
            <div className="mini-calendar-header">
              <button onClick={prevMonth} className="nav-btn"><ChevronLeft size={16}/></button>
              <div className="month-year-display">
                <div className="month-selector">
                  <span className="month-name clickable" onClick={()=>{setShowMonthDropdown(!showMonthDropdown);setShowYearDropdown(false);}}>
                    {calMonthDate.toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{month:"long"})}
                  </span>
                  <ChevronDown size={14} className="chevron-icon clickable" onClick={()=>{setShowMonthDropdown(!showMonthDropdown);setShowYearDropdown(false);}}/>
                  {showMonthDropdown && (
                    <div className="custom-dropdown month-dropdown">
                      {getMonthNames().map((m)=>(
                        <div key={m.index} className={`dropdown-item${calMonthDate.getMonth()===m.index?" selected":""}`} onClick={()=>handleMonthChange(m.index)}>{m.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="year-selector">
                  <span className="year-name clickable" onClick={()=>{setShowYearDropdown(!showYearDropdown);setShowMonthDropdown(false);}}>
                    {calMonthDate.getFullYear()}
                  </span>
                  <ChevronDown size={14} className="chevron-icon clickable" onClick={()=>{setShowYearDropdown(!showYearDropdown);setShowMonthDropdown(false);}}/>
                  {showYearDropdown && (
                    <div className="custom-dropdown year-dropdown">
                      {getYearOptions().map((yr)=>(
                        <div key={yr} className={`dropdown-item${calMonthDate.getFullYear()===yr?" selected":""}`} onClick={()=>handleYearChange(yr)}>{yr}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={nextMonth} className="nav-btn"><ChevronRight size={16}/></button>
            </div>

            <div className="mini-calendar-grid">
              <div className="weekday-labels">
                {[["MON","mon"],["TUE","tue"],["WED","wed"],["THU","thu"],["FRI","fri"],["SAT","sat"],["SUN","sun"]].map(([label, key])=>(
                  <div key={key} className="weekday-label">{t(`calendar.weekdays_short.${key}`, label)}</div>
                ))}
              </div>

              {/* Doctor week mode → click whole week row */}
              {viewMode === "doctor" && calView === "week" ? (
                <div className="dac-week-rows">
                  {miniCalRows.map((row, rowIdx) => (
                    <div key={rowIdx}
                      className={`dac-week-row${isRowSelected(row)?" selected":""}${hoveredWeekRow===rowIdx?" hovered":""}`}
                      onClick={() => setWeekStart(getWeekStart(row[0].date))}
                      onMouseEnter={() => setHoveredWeekRow(rowIdx)}
                      onMouseLeave={() => setHoveredWeekRow(null)}
                    >
                      {row.map((dayObj, i) => (
                        <div key={i} className={`calendar-day${!dayObj.isCurrentMonth?" other-month":""}${dayObj.date.toDateString()===today.toDateString()?" today":""}`}>
                          {dayObj.day}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                /* Day / month / all modes → click individual day */
                <div className="calendar-days">
                  {miniCalDays.map((dayObj, idx) => (
                    <button key={idx}
                      className={`calendar-day${!dayObj.isCurrentMonth?" other-month":""}${dayObj.date.toDateString()===today.toDateString()?" today":""}${dayObj.date.toDateString()===selectedDate.toDateString()?" selected":""}`}
                      onClick={() => {
                        const d = new Date(dayObj.date);
                        setSelectedDate(d);
                        if (viewMode === "all") setViewMonthDate(new Date(d));
                        else if (calView === "month") { setViewMonthDate(new Date(d)); setCalView("day"); }
                      }}>
                      {dayObj.day}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="calendar-main-content">

        {/* Top navigation bar */}
        <div className="dac-topbar">
          <button className="dac-nav-btn" onClick={goToPrev}><ChevronLeft size={18}/></button>
          <span className="dac-date-label">{getTopbarLabel()}</span>
          <button className="dac-nav-btn" onClick={goToNext}><ChevronRight size={18}/></button>
          <button className="dac-today-btn" onClick={goToToday}>{t("calendar.today")||"Today"}</button>
          {calView === "month" && (
            <div className="smc-legend">
              <span className="smc-legend-item"><span className="smc-legend-dot smc-legend-dot--available"/>{t("calendar.available","Available")}</span>
              <span className="smc-legend-item"><span className="smc-legend-dot smc-legend-dot--break"/>{t("calendar.break","Break")}</span>
              <span className="smc-legend-item"><span className="smc-legend-dot smc-legend-dot--leave"/>{t("calendar.leave","Leave")}</span>
              <span className="smc-legend-item"><span className="smc-legend-dot smc-legend-dot--dayoff"/>{t("calendar.day_off","Day off")}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="calendar-loading"><div className="loading-spinner"/></div>
        ) : (
          <>
            {/* Doctor mode views */}
            {viewMode === "doctor" && (calView === "day" || calView === "week") && renderTimeGrid()}

            {/* Doctor month view */}
            {viewMode === "doctor" && calView === "month" && (
              <div className="smc-month-wrapper">
                <MonthGrid
                  cache={monthAppsCache}
                  onDayClick={(date) => { setSelectedDate(date); setCalView("day"); }}
                />
              </div>
            )}

            {/* All doctors – day view with doctor columns */}
            {viewMode === "all" && (
              <>
              <div className="cal-hscroll-nav">
                <button className="cal-hscroll-arrow" onClick={() => scrollAllCols(-1)} title="Scroll left"><ChevronLeft size={16}/></button>
                <button className="cal-hscroll-arrow" onClick={() => scrollAllCols(1)} title="Scroll right"><ChevronRight size={16}/></button>
              </div>
              <div className="dac-content-frame dac-all-hscroll" ref={allScrollRef}>
                <div className="dac-all-inner">
                  {/* Column headers */}
                  <div className="calendar-header">
                    <div className="time-column-header">
                      <button
                        className={`cv-sidebar-toggle${sidebarOpen?" cv-sidebar-toggle--open":""}`}
                        onClick={() => setSidebarOpen((v)=>!v)}
                        aria-label="Toggle calendar sidebar">
                        {sidebarOpen ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
                      </button>
                      <Clock size={16} className="cv-clock-icon"/>
                    </div>
                    {allDoctorColumns.length === 0
                      ? <div className="dac-no-doctors">{t("calendar.noDoctorsRegistered") || "No doctors registered"}</div>
                      : allDoctorColumns.map((doc) => (
                        <div key={doc.email} className="doctor-column-header dac-all-col-header" style={{ position: "relative" }}
                          ref={activeDoctorMenu === doc.email ? allMenuRef : null}
                        >
                          <div className="doctor-header-content"
                            onClick={() => setActiveDoctorMenu(activeDoctorMenu === doc.email ? null : doc.email)}>
                            <div className="doctor-avatar"><span>{doc.initials}</span></div>
                            <div className="doctor-info">
                              <div className="doctor-name">{doc.name}</div>
                              <div className="doctor-specialty">{doc.specialty}</div>
                            </div>
                          </div>
                          {activeDoctorMenu === doc.email && (
                            <div className="doctor-menu-dropdown">
                              <div className="doctor-menu-item" onClick={(e) => {
                                e.stopPropagation();
                                openWeeklyModal(doc.email, doc.name);
                                setActiveDoctorMenu(null);
                              }}>
                                <CalendarIcon size={16}/>
                                <span>{t("calendar.weeklySchedule") || "Weekly schedule"}</span>
                              </div>
                              <div className="doctor-menu-item" onClick={(e) => {
                                e.stopPropagation();
                                openDateOverrideModal(doc.email, doc.name, toDateStr(selectedDate));
                                setActiveDoctorMenu(null);
                              }}>
                                <Edit3 size={16}/>
                                <span>{t("calendar.editDateSchedule") || "Edit this date's schedule"}</span>
                              </div>
                              <div className="doctor-menu-item" onClick={(e) => {
                                e.stopPropagation();
                                const dateStr = toDateStr(selectedDate);
                                setBreakDoctorEmail(doc.email);
                                setBreakDoctorName(doc.name);
                                setBreakContextDate(dateStr);
                                setBreakStartDate(""); setBreakStartTime("09:00");
                                setBreakEndDate("");   setBreakEndTime("09:15");
                                setBreakComment("");
                                setShowBreakModal(true);
                                setActiveDoctorMenu(null);
                              }}>
                                <Clock size={16}/>
                                <span>{t("calendar.addBreak") || "Add a break"}</span>
                              </div>
                              <div className="doctor-menu-item" onClick={() => {
                                setActiveDoctorMenu(null);
                                const dateStr = toDateStr(selectedDate);
                                if (isOnLeave(doc.email, dateStr)) {
                                  restoreLeave(doc.email, dateStr);
                                } else {
                                  setCancelConfirmData({ doctorEmail: doc.email, dateStr, doctorName: doc.name });
                                  setCancelStartDate(dateStr);
                                  setCancelEndDate(dateStr);
                                  setShowCancelConfirm(true);
                                }
                              }}>
                                <CalendarIcon size={16}/>
                                <span>{isOnLeave(doc.email, toDateStr(selectedDate)) ? (t("calendar.restoreWorkingDay") || "Restore working day") : (t("calendar.cancelWorkingDay") || "Cancel the working day")}</span>
                              </div>
                              <div className="doctor-menu-item doctor-menu-item--danger" onClick={() => {
                                setActiveDoctorMenu(null);
                                setCloseConfirmData({ doctorEmail: doc.email, doctorName: doc.name });
                                setShowCloseConfirm(true);
                              }}>
                                <XCircle size={16}/>
                                <span>{closedDaysMap[doc.email] ? (t("calendar.reopenSchedule") || "Reopen schedule") : (t("calendar.closeAllSchedule") || "Close all the schedule")}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Time grid body */}
                  <div className="calendar-body">
                    {/* Current-time red line */}
                    {(() => {
                      if (selectedDate.toDateString() !== today.toDateString()) return null;
                      if (!timeSlots.length) return null;
                      const startMin = timeSlots[0].hour * 60 + timeSlots[0].minute;
                      const endMin   = timeSlots[timeSlots.length - 1].hour * 60 + timeSlots[timeSlots.length - 1].minute + 15;
                      const offset   = nowMinutes - startMin;
                      if (offset < 0 || nowMinutes >= endMin) return null;
                      const top = (offset / 15) * 36;
                      return (
                        <div className="cal-now-line" style={{ top: `${top}px` }}>
                          <span className="cal-now-dot" />
                        </div>
                      );
                    })()}
                    <div className="time-slots-column">
                      {timeSlots.map((slot, i) => (
                        <div key={i} className={`time-slot${slot.minute===0||slot.minute===30?" half-hour-mark":""}`}>
                          {(slot.minute===0||slot.minute===30) && <span className="time-label">{slot.display}</span>}
                        </div>
                      ))}
                    </div>
                    <div className={`appointments-grid${allDragHighlight ? " bm-dragging" : ""}`}>
                      {allDoctorColumns.length === 0
                        ? <div className="dac-empty-state">{t("calendar.noDoctorsRegistered") || "No doctors registered."}</div>
                        : allDoctorColumns.map((doc) => (
                          <div key={doc.email} className="doctor-column dac-all-col-body">
                            {timeSlots.map((slot, slotIdx) => {
                              const appts = getAppsForDoctorTime(doc.email, slot.hour, slot.minute);
                              const dateStr = toDateStr(selectedDate);
                              const isClosed = !!closedDaysMap[doc.email];
                              const onLeave = !isClosed && isOnLeave(doc.email, dateStr);
                              const weeklyOff = !isClosed && !onLeave && isWeeklyDayOff(doc.email, dateStr);
                              const isOff = onLeave || weeklyOff;
                              const workingRanges = getWorkingRanges(doc.email, dateStr);
                              const inBreak = !isClosed && !isOff && isInBreak(doc.email, dateStr, slot.hour, slot.minute);
                              const inWeeklyBreak = !isClosed && !isOff && !inBreak && isWeeklyBreakSlot(doc.email, dateStr, slot.hour, slot.minute);
                              const slotStartMin = slot.hour * 60 + slot.minute;
                              const outsideHours = !isClosed && !isOff && !inBreak && !inWeeklyBreak && isOutsideWorkingHours(doc.email, dateStr, slot.hour, slot.minute);
                              const blockedByBreak = !isClosed && !isOff && (inBreak || inWeeklyBreak || hasBreakInRange(doc.email, dateStr, slotStartMin));
                              const blocked = isClosed || isOff || blockedByBreak || outsideHours;
                              const isDragHighlighted = !blocked && allDragHighlight
                                && allDragHighlight.docEmail === doc.email
                                && slotIdx >= allDragHighlight.minIdx
                                && slotIdx <= allDragHighlight.maxIdx;
                              const isDragFirst = isDragHighlighted && slotIdx === allDragHighlight.minIdx;
                              const isDragLast  = isDragHighlighted && slotIdx === allDragHighlight.maxIdx;
                              return (
                                <div key={slotIdx}
                                  className={`time-cell${slot.minute===0||slot.minute===30?" half-hour-mark":""}${isClosed?" dac-closed-cell":isOff?" dac-leave-cell":inBreak||inWeeklyBreak?" dac-break-cell":outsideHours?" dac-outside-hours":" dac-working-hours"}${isDragHighlighted?" bm-drag-highlight":""}${isDragFirst?" bm-drag-first":""}${isDragLast?" bm-drag-last":""}`}
                                  onMouseDown={(e) => {
                                    if (e.button !== 0 || blocked) return;
                                    e.preventDefault();
                                    allDragStateRef.current = { active: true, docEmail: doc.email, docName: doc.name, startIdx: slotIdx, endIdx: slotIdx };
                                    setAllDragHighlight({ docEmail: doc.email, minIdx: slotIdx, maxIdx: slotIdx });
                                  }}
                                  onMouseEnter={() => {
                                    if (!allDragStateRef.current?.active || allDragStateRef.current.docEmail !== doc.email || blocked) return;
                                    allDragStateRef.current.endIdx = slotIdx;
                                    const minI = Math.min(allDragStateRef.current.startIdx, slotIdx);
                                    const maxI = Math.max(allDragStateRef.current.startIdx, slotIdx);
                                    setAllDragHighlight({ docEmail: doc.email, minIdx: minI, maxIdx: maxI });
                                  }}
                                >
                                  {isDragFirst && allDragHighlight && (
                                    <span className="bm-drag-time-start">
                                      {timeSlots[allDragHighlight.minIdx]?.display}
                                    </span>
                                  )}
                                  {isDragLast && allDragHighlight && (() => {
                                    const endTotalMin = timeSlots[allDragHighlight.maxIdx].hour * 60 + timeSlots[allDragHighlight.maxIdx].minute + 15;
                                    const pad = (n) => String(n).padStart(2, "0");
                                    return <span className="bm-drag-time-end">{pad(Math.floor(endTotalMin/60))}:{pad(endTotalMin%60)}</span>;
                                  })()}
                                  {isClosed && slot.hour === 9 && slot.minute === 0 && (
                                    <div className="dac-closed-label"><XCircle size={10}/>{t("calendar.scheduleClosed")||"Closed"}</div>
                                  )}
                                  {!isClosed && !isOff && workingRanges.filter((range) => {
                                    const [sh, sm] = range.startTime.split(":").map(Number);
                                    return sh === slot.hour && sm === slot.minute;
                                  }).map((range, rangeIdx) => (
                                    <div key={rangeIdx} className="dac-schedule-label">
                                      <span className="dac-schedule-label-text">{range.startTime}–{range.endTime}</span>
                                    </div>
                                  ))}
                                  {isOff && slot.hour === 9 && slot.minute === 0 && (() => {
                                    const ld = onLeave ? getLeaveDetails(doc.email, dateStr) : null;
                                    return (
                                      <div className="dac-leave-label">
                                        <div className="dac-leave-type-row">
                                          <span>{weeklyOff ? (t("calendar.weeklyDayOff")||"Day Off") : ld?.leaveType ? t(`calendar.${LEAVE_TYPE_KEY[ld.leaveType]}`, ld.leaveType) : (t("calendar.dayOff")||"Day Off")}</span>
                                          {onLeave && <button className="dac-restore-btn" onClick={() => restoreLeave(doc.email, dateStr)} title={t("calendar.restoreWorkingDay")||"Restore working day"}>↩</button>}
                                        </div>
                                        {ld && (ld.reviewedBy || ld.comment) && (
                                          <div className="dac-leave-meta">
                                            {ld.reviewedBy && <span className="dac-leave-by">by {ld.reviewedBy}</span>}
                                            {ld.comment && <span className="dac-leave-comment" title={ld.comment}>📝</span>}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {!isOff && (inBreak || inWeeklyBreak) && slot.minute === 0 && (
                                    <div className="dac-break-label">{t("calendar.breakLabel") || "Break"}</div>
                                  )}
                                  {appts.map((app) => <AppBlock key={app._id} app={app}/>)}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Create appointment modal ────────────────────────────────────────── */}
      {showCreateModal && createModalData && (
        <CreateAppointmentModal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setCreateModalData(null); }}
          doctorEmail={createModalData.doctorEmail}
          date={createModalData.date}
          startTime={createModalData.startTime}
          endTime={createModalData.endTime}
          onSuccess={async () => {
            setShowCreateModal(false);
            setCreateModalData(null);
            fetchAllDayApplications();
          }}
        />
      )}

      {/* ── Break modal ──────────────────────────────────────────────── */}
      {showBreakModal && createPortal(
        <div className="bm-overlay" style={{ zIndex: 9999 }} onClick={() => setShowBreakModal(false)}>
          <div className="bm-content" onClick={(e) => e.stopPropagation()}>
            <div className="bm-header">
              <div className="bm-header-text">
                <h3 className="bm-title">{t("calendar.addBreak")||"Add a Break"}</h3>
                <p className="bm-subtitle">{breakDoctorName || (t("calendar.scheduleDowntime")||"Schedule downtime or personal leave")}</p>
              </div>
              <button className="bm-close" onClick={() => setShowBreakModal(false)}>×</button>
            </div>
            <div className="bm-body">
              {breakContextDate && (
                <div className="bm-field-group">
                  <label className="bm-field-label">{t("calendar.dateOfBreak")||"DATE"}</label>
                  <div className="bm-input-box bm-date-readonly">
                    <CalendarIcon size={16} className="bm-input-icon" />
                    <span className="bm-date-readonly-text">
                      {fmtDate(new Date(breakContextDate + "T00:00:00"), i18n.language, { weekday: "short", month: "long" })}
                    </span>
                  </div>
                </div>
              )}
              <div className="bm-times-row">
                <div className="bm-field-group">
                  <label className="bm-field-label">{t("calendar.startTime")||"START TIME"}</label>
                  <div className="bm-input-box">
                    <Clock size={16} className="bm-input-icon" />
                    <TimePickerInput value={breakStartTime} onChange={(v) => setBreakStartTime(v)} />
                  </div>
                </div>
                <div className="bm-field-group">
                  <label className="bm-field-label">{t("calendar.endTime")||"END TIME"}</label>
                  <div className="bm-input-box">
                    <Clock size={16} className="bm-input-icon" />
                    <TimePickerInput value={breakEndTime} onChange={(v) => setBreakEndTime(v)} />
                  </div>
                </div>
              </div>
              <div className="bm-field-group">
                <label className="bm-field-label">{t("calendar.internalComments")||"INTERNAL COMMENTS"}</label>
                <textarea className="bm-textarea" placeholder={t("calendar.breakNotesPlaceholder")||"Add specific notes about this break..."} value={breakComment} onChange={(e)=>setBreakComment(e.target.value)} rows={4}/>
              </div>
              {breakModalExistingBreaks.length > 0 && (
                <div className="bm-existing-section">
                  <label className="bm-field-label bm-existing-label">{t("calendar.existingBreaks")||"EXISTING BREAKS"}</label>
                  <div className="bm-existing-list">
                    {breakModalExistingBreaks.map((b, i) => (
                      <div key={i} className="bm-existing-item">
                        <Clock size={12} className="bm-existing-icon"/>
                        <span className="bm-existing-time">{b.startTime} – {b.endTime}</span>
                        {b.startDate !== b.endDate && (
                          <span className="bm-existing-dates">{b.startDate} → {b.endDate}</span>
                        )}
                        {b.comment && <span className="bm-existing-comment">{b.comment}</span>}
                        <button className="bm-existing-delete" title="Remove" onClick={async () => {
                          try {
                            const newBreaksArray = breakModalExistingBreaks.filter((_, j) => j !== i);
                            await saveDoctorBreaks({
                              doctorEmail: breakDoctorEmail,
                              date: breakContextDate,
                              breaks: newBreaksArray,
                              comment: breakComment
                            });
                            setBreakModalExistingBreaks(newBreaksArray);
                            setBreaksMap((prev) => {
                              const key = `${breakDoctorEmail}_${b.startDate || breakContextDate}`;
                              return { ...prev, [key]: newBreaksArray };
                            });
                            toast.success(t("calendar.breakDeleted")||"Break removed");
                          } catch { toast.error(t("calendar.saveError")||"Failed to remove break."); }
                        }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bm-footer">
              <button className="bm-cancel-btn" onClick={() => setShowBreakModal(false)}>{t("calendar.cancel")||"Cancel"}</button>
              <button className="bm-save-btn" onClick={async () => {
                if (!breakStartTime || !breakEndTime) {
                  toast.error(t("calendar.breakFieldsRequired") || "Please fill in start and end time.");
                  return;
                }
                const dateToUse = breakStartDate || breakContextDate;
                const newBreakObj = { startTime: breakStartTime, endTime: breakEndTime, startDate: dateToUse, endDate: dateToUse };
                const updatedBreaks = [...breakModalExistingBreaks, newBreakObj];

                try {
                  await saveDoctorBreaks({ 
                    doctorEmail: breakDoctorEmail, 
                    date: dateToUse, 
                    breaks: updatedBreaks, 
                    comment: breakComment 
                  });
                  setBreaksMap((prev) => {
                    const key = `${breakDoctorEmail}_${dateToUse}`;
                    return { ...prev, [key]: updatedBreaks };
                  });
                  setBreakModalExistingBreaks(updatedBreaks);
                  toast.success(t("calendar.saveSuccess")||"Break saved!");
                  setShowBreakModal(false);
                  setBreakComment("");
                  setBreakStartTime("09:00");
                  setBreakEndTime("09:15");
                } catch { toast.error(t("calendar.saveError")||"Failed to save break."); }
              }}>{t("calendar.saveBreak")||"Save Break"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Cancel working day — leave form ─────────────────────────────────── */}
      {showCancelConfirm && cancelConfirmData && createPortal(
        <div className="dac-confirm-overlay" onClick={() => { setShowCancelConfirm(false); setCancelLeaveType("Vacation"); setCancelLeaveComment(""); setCancelStartDate(""); setCancelEndDate(""); }}>
          <div className="dac-leave-form-modal" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="dac-lf-header">
              <div>
                <h3 className="dac-lf-title">{tr("calendar.leaveFormTitle","Mark as Leave")}</h3>
                <p className="dac-lf-subtitle">Dr. {cancelConfirmData.doctorName}</p>
              </div>
              <button className="dac-lf-close" onClick={() => { setShowCancelConfirm(false); setCancelLeaveType("Vacation"); setCancelLeaveComment(""); setCancelStartDate(""); setCancelEndDate(""); }}>×</button>
            </div>

            {/* Body */}
            <div className="dac-lf-body">

              {/* Leave type */}
              <div className="dac-lf-field">
                <label className="dac-lf-label">{tr("calendar.leaveTypeLabel","Leave Type")}</label>
                <select className="dac-lf-select" value={cancelLeaveType} onChange={(e) => setCancelLeaveType(e.target.value)}>
                  <option value="Vacation">{tr("calendar.leaveTypeVacation","Vacation")}</option>
                  <option value="Sick Leave">{tr("calendar.leaveTypeSick","Sick Leave")}</option>
                  <option value="Unpaid Leave">{tr("calendar.leaveTypeUnpaid","Unpaid Leave")}</option>
                  <option value="Maternity/Paternity">{tr("calendar.leaveTypeMaternity","Maternity/Paternity")}</option>
                  <option value="Other">{tr("calendar.leaveTypeOther","Other")}</option>
                </select>
              </div>

              {/* Start date */}
              <div className="dac-lf-field">
                <label className="dac-lf-label">{tr("calendar.leaveStartDateLabel","Start Date")}</label>
                <input
                  type="date"
                  className="dac-lf-select"
                  value={cancelStartDate}
                  onChange={(e) => {
                    setCancelStartDate(e.target.value);
                    if (cancelEndDate < e.target.value) setCancelEndDate(e.target.value);
                  }}
                />
              </div>

              {/* End date */}
              <div className="dac-lf-field">
                <label className="dac-lf-label">{tr("calendar.leaveEndDateLabel","End Date")}</label>
                <input
                  type="date"
                  className="dac-lf-select"
                  value={cancelEndDate}
                  min={cancelStartDate}
                  onChange={(e) => setCancelEndDate(e.target.value)}
                />
              </div>

              {/* Authorised by (read-only) */}
              <div className="dac-lf-field">
                <label className="dac-lf-label">{tr("calendar.leaveAuthorisedBy","Authorised By")}</label>
                <div className="dac-lf-readonly">{managerName || user?.email || "Admin"}</div>
              </div>

              {/* Reason / Comment */}
              <div className="dac-lf-field">
                <label className="dac-lf-label">{tr("calendar.leaveReasonLabel","Reason / Comment")}</label>
                <textarea
                  className="dac-lf-textarea"
                  rows={3}
                  placeholder={tr("calendar.leaveReasonPlaceholder","Enter a reason for the leave...")}
                  value={cancelLeaveComment}
                  onChange={(e) => setCancelLeaveComment(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="dac-lf-footer">
              <button className="dac-lf-btn dac-lf-cancel-btn" onClick={() => { setShowCancelConfirm(false); setCancelLeaveType("Vacation"); setCancelLeaveComment(""); setCancelStartDate(""); setCancelEndDate(""); }}>
                {tr("calendar.leaveCancelBtn","Cancel")}
              </button>
              <button className="dac-lf-btn dac-lf-submit-btn" onClick={async () => {
                if (!cancelStartDate || !cancelEndDate) {
                  toast.error(tr("calendar.leaveSelectDates","Please select start and end dates"));
                  return;
                }
                setShowCancelConfirm(false);
                try {
                  const res = await createDoctorLeave({
                    doctorEmail: cancelConfirmData.doctorEmail,
                    startDate: cancelStartDate,
                    endDate: cancelEndDate,
                    leaveType: cancelLeaveType,
                    isGivenByAdmin: true,
                    comment: cancelLeaveComment || "Working day cancelled by admin",
                  });
                  const leave = res.data?.leave;
                  // Expand leave across all days in the range and update leavesMap
                  const leaveEntry = leave
                    ? { _id: leave._id, leaveType: leave.leaveType, comment: leave.comment, reviewedBy: leave.reviewedByName || managerName || leave.reviewedBy }
                    : { _id: null, leaveType: cancelLeaveType, comment: cancelLeaveComment, reviewedBy: managerName };
                  setLeavesMap((prev) => {
                    const next = { ...prev };
                    const start = new Date(cancelStartDate + "T00:00:00");
                    const end   = new Date(cancelEndDate   + "T00:00:00");
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      const ds = toDateStr(d);
                      next[`${cancelConfirmData.doctorEmail}_${ds}`] = leaveEntry;
                    }
                    return next;
                  });
                  setCancelLeaveType("Vacation");
                  setCancelLeaveComment("");
                  setCancelStartDate("");
                  setCancelEndDate("");
                  toast.success(tr("calendar.workingDayCancelled","Working day cancelled"));
                } catch (err) {
                  toast.error(err.response?.data?.message||tr("calendar.failedToCancelDay","Failed to cancel working day"));
                }
              }}>
                {tr("calendar.leaveMarkBtn","Mark as Leave")}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── Close Schedule Confirm ───────────────────────────────────────────── */}
      {showCloseConfirm && closeConfirmData && createPortal(
        <div className="dac-confirm-overlay" onClick={() => { setShowCloseConfirm(false); setCloseConfirmData(null); }}>
          <div className="dac-close-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dac-lf-header">
              <div>
                <h3 className="dac-lf-title">
                  {closedDaysMap[closeConfirmData.doctorEmail]
                    ? tr("calendar.reopenSchedule", "Reopen schedule")
                    : tr("calendar.closeAllSchedule", "Close all the schedule")}
                </h3>
                <p className="dac-lf-subtitle">{closeConfirmData.doctorName}</p>
              </div>
              <button className="dac-lf-close" onClick={() => { setShowCloseConfirm(false); setCloseConfirmData(null); }}>×</button>
            </div>
            <div className="dac-lf-body">
              <p className="dac-close-confirm-text">
                {closedDaysMap[closeConfirmData.doctorEmail]
                  ? tr("calendar.reopenScheduleConfirmText", "This will reopen the schedule. Patients will be able to book appointments again.")
                  : tr("calendar.closeScheduleConfirmText", "This will close all appointment slots. No new bookings will be accepted.")}
              </p>
            </div>
            <div className="dac-lf-footer">
              <button className="dac-lf-btn dac-lf-cancel-btn" onClick={() => { setShowCloseConfirm(false); setCloseConfirmData(null); }}>
                {tr("calendar.leaveCancelBtn", "Cancel")}
              </button>
              <button
                className={`dac-lf-btn ${closedDaysMap[closeConfirmData.doctorEmail] ? "dac-lf-submit-btn" : "dac-lf-danger-btn"}`}
                onClick={async () => {
                  const { doctorEmail } = closeConfirmData;
                  const isCurrentlyClosed = !!closedDaysMap[doctorEmail];
                  setShowCloseConfirm(false);
                  setCloseConfirmData(null);
                  try {
                    if (isCurrentlyClosed) {
                      await reopenDaySchedule(doctorEmail);
                      setClosedDaysMap((prev) => ({ ...prev, [doctorEmail]: false }));
                      toast.success(tr("calendar.scheduleReopened", "Schedule reopened"));
                    } else {
                      await closeDaySchedule(doctorEmail);
                      setClosedDaysMap((prev) => ({ ...prev, [doctorEmail]: true }));
                      toast.success(tr("calendar.scheduleClosed", "Schedule closed"));
                    }
                  } catch (err) {
                    toast.error(err.response?.data?.message || tr("calendar.failedToCloseSchedule", "Failed to update schedule"));
                  }
                }}
              >
                {closedDaysMap[closeConfirmData.doctorEmail]
                  ? tr("calendar.reopenSchedule", "Reopen")
                  : tr("calendar.closeAllSchedule", "Close schedule")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Weekly Schedule Modal ─────────────────────────────────────────────── */}
      {showWeeklyModal && createPortal(
        <div className="wsm-overlay" onClick={() => setShowWeeklyModal(false)}>
          <div className="wsm-content" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="wsm-header">
              <div className="wsm-header-text">
                <h3 className="wsm-title">{t("calendar.weeklySchedule") || "Weekly Schedule"}</h3>
                <p className="wsm-subtitle">{weeklyModalName}</p>
              </div>
              <button className="wsm-close" onClick={() => setShowWeeklyModal(false)}>×</button>
            </div>

            {/* Day rows */}
            <div className="wsm-body">
              {weeklySchedule.map((row, dayIdx) => (
                <div key={row.day} className={`wsm-day-section${row.isDayOff ? " wsm-day-off" : ""}`}>
                  <div className="wsm-day-header">
                    <span className="wsm-day-name">{t(`calendar.day_${row.day}`) || row.day}</span>
                    <div className="wsm-day-actions">
                      {!row.isDayOff && (
                        <button className="wsm-add-slot-btn" onClick={() => addSlot(dayIdx)}>+ {t("calendar.wsAddSlot") || "Add Slot"}</button>
                      )}
                      <select
                        className={`wsm-status-select ${row.isDayOff ? "wsm-status-off" : "wsm-status-on"}`}
                        value={row.isDayOff ? "dayoff" : "working"}
                        onChange={() => toggleDayOff(dayIdx)}
                      >
                        <option value="working">{t("calendar.wsWorking") || "Working"}</option>
                        <option value="dayoff">{t("calendar.wsDayOff") || "Day Off"}</option>
                      </select>
                    </div>
                  </div>
                  {!row.isDayOff && (
                    <div className="wsm-slots-list">
                      {(row.slots || []).length === 0 && (
                        <span className="wsm-no-slots">{t("calendar.wsNoSlots") || "No slots — click \"+ Add Slot\" to begin"}</span>
                      )}
                      {(row.slots || []).map((slot, slotIdx) => (
                        <div key={slotIdx} className={`wsm-slot-row wsm-slot-${slot.type}`}>
                          <select
                            className={`wsm-slot-type-select wsm-slot-type-${slot.type}`}
                            value={slot.type}
                            onChange={(e) => updateSlot(dayIdx, slotIdx, "type", e.target.value)}
                          >
                            <option value="working">{t("calendar.wsWorking") || "Working"}</option>
                            <option value="break">{t("calendar.wsBreak") || "Break"}</option>
                          </select>
                          <TimePickerInput className="tpi--compact" value={slot.startTime} onChange={(v) => updateSlot(dayIdx, slotIdx, "startTime", v)} />
                          <span className="wsm-time-sep">→</span>
                          <TimePickerInput className="tpi--compact" value={slot.endTime} onChange={(v) => updateSlot(dayIdx, slotIdx, "endTime", v)} />
                          <button className="wsm-slot-remove" onClick={() => removeSlot(dayIdx, slotIdx)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="wsm-footer">
              <button className="wsm-cancel-btn" onClick={() => setShowWeeklyModal(false)}>
                {t("calendar.cancel") || "Cancel"}
              </button>
              <button className="wsm-save-btn" disabled={weeklySaving} onClick={async () => {
                setWeeklySaving(true);
                try {
                  const previousWeeklySchedule = weeklyScheduleCache[weeklyModalEmail] || {};
                  await saveDoctorWeeklySchedule(weeklyModalEmail, weeklySchedule);
                  // Update the weekly-schedule cache so the calendar re-renders immediately
                  const map = {};
                  weeklySchedule.forEach((d) => { map[d.day] = d; });
                  setWeeklyScheduleCache((prev) => ({ ...prev, [weeklyModalEmail]: map }));

                  const visibleDates = [];
                  if (viewMode === "doctor") {
                    if (calView === "day") {
                      visibleDates.push(toDateStr(selectedDate));
                    } else if (calView === "week") {
                      visibleDates.push(...getWeekDays(weekStart).map(toDateStr));
                    } else if (calView === "month") {
                      const year = viewMonthDate.getFullYear();
                      const month = viewMonthDate.getMonth();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      visibleDates.push(...Array.from({ length: daysInMonth }, (_, i) =>
                        `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
                      ));
                    }
                  } else {
                    visibleDates.push(toDateStr(selectedDate));
                  }

                  const updatedDayNames = new Set(weeklySchedule.map((day) => day.day));
                  const newOverrideCache = { ...dateOverrideCache };

                  await Promise.all(visibleDates.map(async (dateStr) => {
                    const dayName = getDayName(dateStr);
                    if (!updatedDayNames.has(dayName)) return;

                    const cacheKey = `${weeklyModalEmail}_${dateStr}`;
                    const previousWeeklyDay = previousWeeklySchedule[dayName] || DEFAULT_WEEK.find(d => d.day === dayName);
                    let overrideToCheck = newOverrideCache[cacheKey] || null;

                    // Cache might miss a persisted override due request timing; check backend too.
                    if (!overrideToCheck) {
                      try {
                        const res = await getDoctorDateOverride(weeklyModalEmail, dateStr);
                        overrideToCheck = apiResult(res)?.override || null;
                      } catch {
                        overrideToCheck = null;
                      }
                    }

                    // Stale override = mirrors previous weekly state; remove so new weekly applies immediately.
                    if (overrideToCheck && schedulesMatch(overrideToCheck, previousWeeklyDay)) {
                      delete newOverrideCache[cacheKey];
                      try { await deleteDoctorDateOverride(weeklyModalEmail, dateStr); } catch {}
                      return;
                    }

                    // If no override exists, ensure key is absent so weekly schedule is used.
                    if (!overrideToCheck) {
                      delete newOverrideCache[cacheKey];
                    }
                  }));

                  setDateOverrideCache(newOverrideCache);

                  toast.success(t("calendar.weeklyScheduleSaved") || "Weekly schedule saved!");
                  setShowWeeklyModal(false);
                } catch { toast.error(t("calendar.saveError") || "Failed to save."); }
                finally { setWeeklySaving(false); }
              }}>
                {weeklySaving ? "…" : (t("calendar.saveSchedule") || "Save Schedule")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Date Override Modal ───────────────────────────────────────────────── */}
      {showDateOverrideModal && createPortal(
        <div className="wsm-overlay" onClick={() => setShowDateOverrideModal(false)}>
          <div className="wsm-content" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="wsm-header">
              <div className="wsm-header-text">
                <h3 className="wsm-title">{t("calendar.editDateSchedule") || "Edit this date's schedule"}</h3>
                <p className="wsm-subtitle">{dateOverrideName} — {fmtDate(new Date(dateOverrideDate + "T00:00:00"), i18n.language, { weekday: "long", month: "long" })}</p>
              </div>
              <button className="wsm-close" onClick={() => setShowDateOverrideModal(false)}>×</button>
            </div>

            {/* Body */}
            <div className="wsm-body">
              <div className={`wsm-day-section${dateOverrideIsDayOff ? " wsm-day-off" : ""}`}>
                <div className="wsm-day-header">
                  <span className="wsm-day-name">{t("calendar.dateScheduleSlots") || "Working Slots"}</span>
                  <div className="wsm-day-actions">
                    {!dateOverrideIsDayOff && (
                      <button className="wsm-add-slot-btn" onClick={addDateOverrideSlot}>+ {t("calendar.wsAddSlot") || "Add Slot"}</button>
                    )}
                    <select
                      className={`wsm-status-select ${dateOverrideIsDayOff ? "wsm-status-off" : "wsm-status-on"}`}
                      value={dateOverrideIsDayOff ? "dayoff" : "working"}
                      onChange={(e) => {
                        const off = e.target.value === "dayoff";
                        setDateOverrideIsDayOff(off);
                        if (off) setDateOverrideSlots([]);
                        else setDateOverrideSlots([{ startTime: "09:00", endTime: "18:00", type: "working" }]);
                      }}
                    >
                      <option value="working">{t("calendar.wsWorking") || "Working"}</option>
                      <option value="dayoff">{t("calendar.wsDayOff") || "Day Off"}</option>
                    </select>
                  </div>
                </div>
                {!dateOverrideIsDayOff && (
                  <div className="wsm-slots-list">
                    {dateOverrideSlots.length === 0 && (
                      <span className="wsm-no-slots">{t("calendar.wsNoSlots") || "No slots — click \"+ Add Slot\" to begin"}</span>
                    )}
                    {dateOverrideSlots.map((slot, idx) => (
                      <div key={idx} className={`wsm-slot-row wsm-slot-${slot.type}`}>
                        <select
                          className={`wsm-slot-type-select wsm-slot-type-${slot.type}`}
                          value={slot.type}
                          onChange={(e) => updateDateOverrideSlot(idx, "type", e.target.value)}
                        >
                          <option value="working">{t("calendar.wsWorking") || "Working"}</option>
                          <option value="break">{t("calendar.wsBreak") || "Break"}</option>
                        </select>
                        <TimePickerInput className="tpi--compact" value={slot.startTime} onChange={(v) => updateDateOverrideSlot(idx, "startTime", v)} />
                        <span className="wsm-time-sep">→</span>
                        <TimePickerInput className="tpi--compact" value={slot.endTime} onChange={(v) => updateDateOverrideSlot(idx, "endTime", v)} />
                        <button className="wsm-slot-remove" onClick={() => removeDateOverrideSlot(idx)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="wsm-footer">
              <button className="wsm-cancel-btn" style={{ color: "#ef4444" }} onClick={async () => {
                try {
                  await deleteDoctorDateOverride(dateOverrideEmail, dateOverrideDate);
                  toast.success(t("calendar.dateOverrideDeleted") || "Date override removed — weekly schedule will apply.");
                  const cacheKey = `${dateOverrideEmail}_${dateOverrideDate}`;
                  setDateOverrideCache(prev => { const n = { ...prev }; delete n[cacheKey]; return n; });
                  setShowDateOverrideModal(false);
                  // Refresh weekly schedule cache to reflect changes
                  getDoctorWeeklySchedule(dateOverrideEmail).then(res => {
                    const schedule = apiResult(res)?.schedule;
                    if (schedule) {
                      const map = {};
                      schedule.forEach(d => { map[d.day] = d; });
                      setWeeklyScheduleCache(prev => ({ ...prev, [dateOverrideEmail]: map }));
                    }
                  }).catch(() => {});
                } catch { toast.error(t("calendar.saveError") || "Failed to delete."); }
              }}>
                {t("calendar.resetToWeekly") || "Reset to weekly schedule"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="wsm-cancel-btn" onClick={() => setShowDateOverrideModal(false)}>
                  {t("calendar.cancel") || "Cancel"}
                </button>
                <button className="wsm-save-btn" disabled={dateOverrideSaving} onClick={async () => {
                  setDateOverrideSaving(true);
                  try {
                    await saveDoctorDateOverride(
                      dateOverrideEmail,
                      dateOverrideDate,
                      {
                      isDayOff: dateOverrideIsDayOff,
                      slots: dateOverrideIsDayOff ? [] : dateOverrideSlots,
                      }
                    );
                    toast.success(t("calendar.dateOverrideSaved") || "Date schedule saved!");
                    const cacheKey = `${dateOverrideEmail}_${dateOverrideDate}`;
                    setDateOverrideCache(prev => ({
                      ...prev,
                      [cacheKey]: { isDayOff: dateOverrideIsDayOff, slots: dateOverrideIsDayOff ? [] : dateOverrideSlots },
                    }));
                    setShowDateOverrideModal(false);
                  } catch { toast.error(t("calendar.saveError") || "Failed to save."); }
                  finally { setDateOverrideSaving(false); }
                }}>
                  {dateOverrideSaving ? "…" : (t("calendar.saveSchedule") || "Save Schedule")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default ScheduleManagementCalendar;
