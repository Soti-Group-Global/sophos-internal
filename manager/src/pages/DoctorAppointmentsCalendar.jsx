import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  ArrowLeft,
  Search,
  Users,
  User,
  MoreVertical,
} from "lucide-react";
import {
  getDoctorByEmail,
  getDoctors,
  getDoctorAppointmentsByDate,
  getApplicationsByDate,
  getDoctorBreaks,
  saveDoctorBreaks,
  createDoctorLeave,
  getDoctorLeaves,
} from "../utils/api";
import { toast } from "react-toastify";
import CreateAppointmentModal from "../components/Applications/CreateAppointmentModal";
import { getApptStatusClass } from "../utils/appointmentStatus";
import "../components/Applications/CalendarView.css";
import "../styles/DoctorAppointmentsCalendar.css";

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

const DoctorAppointmentsCalendar = () => {
  const { t, i18n } = useTranslation();
  const { email } = useParams();
  const navigate = useNavigate();

  // â”€â”€ Mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [viewMode, setViewMode] = useState("doctor"); // "doctor" | "all"

  // â”€â”€ Doctor mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [doctor, setDoctor] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(email || "");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [weekApplications, setWeekApplications] = useState({});

  // â”€â”€ All mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allApplications, setAllApplications] = useState([]);
  // breaksMap: { [email_date]: [{ startTime, endTime }] }  e.g. { "doc@x.com_2026-03-03": [...] }
  const [breaksMap, setBreaksMap] = useState({});
  // leavesMap: { [email_date]: true }  — true if doctor has an approved leave on that date
  const [leavesMap, setLeavesMap] = useState({});

  // â”€â”€ Shared UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calMonthDate, setCalMonthDate] = useState(new Date());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [hoveredWeekRow, setHoveredWeekRow] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalData, setCreateModalData] = useState(null);

  // â”€â”€ Doctor selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [allDoctorsList, setAllDoctorsList] = useState([]);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const dropdownRef = useRef(null);
  const doctorMenuRef = useRef(null);
  const allMenuRef = useRef(null);

  // — Doctor action menu ————————————————————————————————————
  const [showDoctorMenu, setShowDoctorMenu] = useState(false);
  const [activeDoctorMenu, setActiveDoctorMenu] = useState(null); // email of open column menu

  // — Break modal —————————————————————————————————————————————
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakSlots, setBreakSlots] = useState([{ startTime: "18:00", endTime: "22:00" }]);
  const [breakComment, setBreakComment] = useState("");
  const [breakDoctorEmail, setBreakDoctorEmail] = useState("");
  const [breakDoctorName, setBreakDoctorName] = useState("");
  const [breakDate, setBreakDate] = useState(new Date());

  // — Cancel confirm dialog ————————————————————————————————
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConfirmData, setCancelConfirmData] = useState(null); // { doctorEmail, dateStr, doctorName }

  // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    getDoctors()
      .then((data) => {
        const list = data?.doctors || data?.data || (Array.isArray(data) ? data : []);
        setAllDoctorsList(list);
      })
      .catch(() => setAllDoctorsList([]));
  }, []);

  useEffect(() => {
    if (!selectedEmail) return;
    getDoctorByEmail(selectedEmail)
      .then((res) => { const doc = res?.data?.data || res?.data?.doctor; if (doc) setDoctor(doc); })
      .catch(() => setDoctor(null));
  }, [selectedEmail]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDoctorDropdown(false);
      if (doctorMenuRef.current && !doctorMenuRef.current.contains(e.target)) setShowDoctorMenu(false);
      if (allMenuRef.current && !allMenuRef.current.contains(e.target)) setActiveDoctorMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // hasTimeConflict helper for breaks
  const hasTimeConflict = (slots, idx, start, end) => {
    if (!start || !end) return false;
    const toMins = (t) => { const [h,m]=t.split(":").map(Number); return h*60+m; };
    const s1=toMins(start), e1=toMins(end);
    return slots.some((slot,i)=>{
      if(i===idx||!slot.startTime||!slot.endTime) return false;
      const s2=toMins(slot.startTime), e2=toMins(slot.endTime);
      return s1<e2 && e1>s2;
    });
  };

  // Sync mini-cal month when week/date changes
  useEffect(() => {
    setCalMonthDate(new Date(viewMode === "doctor" ? weekStart : selectedDate));
  }, [weekStart, selectedDate, viewMode]);

  // Fetch week appointments (doctor mode)
  const fetchWeekApplications = useCallback(async () => {
    if (viewMode !== "doctor" || !selectedEmail) return;
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
  }, [viewMode, selectedEmail, weekStart]);

  useEffect(() => { fetchWeekApplications(); }, [fetchWeekApplications]);

  // Fetch breaks for doctor mode (one doctor, whole week)
  useEffect(() => {
    if (viewMode !== "doctor" || !selectedEmail) return;
    const days = getWeekDays(weekStart);
    Promise.all(days.map(async (day) => {
      const ds = toDateStr(day);
      const key = `${selectedEmail}_${ds}`;
      try {
        const res = await getDoctorBreaks(selectedEmail, ds);
        return [key, res.data?.breaks || []];
      } catch { return [key, []]; }
    })).then((entries) => {
      setBreaksMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [viewMode, selectedEmail, weekStart]);

  // Fetch leaves for doctor mode (one doctor, whole week)
  useEffect(() => {
    if (viewMode !== "doctor" || !selectedEmail) return;
    const days = getWeekDays(weekStart);
    Promise.all(days.map(async (day) => {
      const ds = toDateStr(day);
      const key = `${selectedEmail}_${ds}`;
      try {
        const res = await getDoctorLeaves({ doctorEmail: selectedEmail, from: ds, to: ds, status: "Approved" });
        return [key, (res.data?.leaves || []).length > 0];
      } catch { return [key, false]; }
    })).then((entries) => {
      setLeavesMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [viewMode, selectedEmail, weekStart]);

  // Fetch leaves for all mode (all doctors, selected date)
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    const ds = toDateStr(selectedDate);
    Promise.all(allDoctorsList.map(async (doc) => {
      const key = `${doc.email}_${ds}`;
      try {
        const res = await getDoctorLeaves({ doctorEmail: doc.email, from: ds, to: ds, status: "Approved" });
        return [key, (res.data?.leaves || []).length > 0];
      } catch { return [key, false]; }
    })).then((entries) => {
      setLeavesMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [viewMode, selectedDate, allDoctorsList]);

  // Fetch breaks for all mode (all doctors, selected date)
  useEffect(() => {
    if (viewMode !== "all" || allDoctorsList.length === 0) return;
    const ds = toDateStr(selectedDate);
    Promise.all(allDoctorsList.map(async (doc) => {
      const key = `${doc.email}_${ds}`;
      try {
        const res = await getDoctorBreaks(doc.email, ds);
        return [key, res.data?.breaks || []];
      } catch { return [key, []]; }
    })).then((entries) => {
      setBreaksMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [viewMode, selectedDate, allDoctorsList]);

  // Fetch all applications (all mode)
  const fetchAllApplications = useCallback(async () => {
    if (viewMode !== "all") return;
    setLoading(true);
    try {
      const res = await getApplicationsByDate(toDateStr(selectedDate));
      setAllApplications(res.data || []);
    } catch { setAllApplications([]); }
    finally { setLoading(false); }
  }, [viewMode, selectedDate]);

  useEffect(() => { fetchAllApplications(); }, [fetchAllApplications]);

  // â”€â”€ Doctor columns for "all" mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Build columns from the full doctors list — every doctor is always visible
  const allDoctorColumns = useMemo(() => {
    if (viewMode !== "all") return [];
    const lang = i18n.language === "ru" ? "ru" : "en";
    const fb = lang === "en" ? "ru" : "en";
    return allDoctorsList.map((doc) => {
      const first = doc.firstName?.[lang] || doc.firstName?.[fb] || doc.firstName || "";
      const last  = doc.lastName?.[lang]  || doc.lastName?.[fb]  || doc.lastName  || "";
      const name  = `${first} ${last}`.trim() || doc.email || t("calendar.unknown");
      let spec = '';
      if (doc.specialtyIds?.length) {
        const s = doc.specialtyIds[0];
        spec = lang === "ru" ? (s.name_ru || s.name_en || '') : (s.name_en || s.name_ru || '');
      }
      if (!spec && doc.specialty) {
        spec = typeof doc.specialty === "string" ? doc.specialty : (doc.specialty?.[lang] || '');
      }
      if (!spec) spec = t("calendar.specialist");
      return { email: doc.email, name, initials: getInitials(name), specialty: spec };
    });
  }, [viewMode, allDoctorsList, i18n.language, t]);

  // â”€â”€ Time slot logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const timeSlots = useMemo(() => {
    const s = [];
    for (let h = 9; h < 18; h++) for (let m = 0; m < 60; m += 15)
      s.push({ hour: h, minute: m, display: `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}` });
    return s;
  }, []);

  const parseTime = (t) => {
    if (!t) return [0, 0];
    if (t.includes("T")) { const d = new Date(t); return [d.getUTCHours(), d.getUTCMinutes()]; }
    return t.split(":").map(Number);
  };

  const getAppsForDayTime = (ds, hour, minute) =>
    (weekApplications[ds] || []).filter((app) => { if (!app.startTime) return false; const [sh,sm] = parseTime(app.startTime); return sh===hour && sm===minute; });

  // Check if a given time slot falls inside any saved break for a doctor on a date
  const isInBreak = (doctorEmail, dateStr, hour, minute) => {
    const breaks = breaksMap[`${doctorEmail}_${dateStr}`] || [];
    const slotMins = hour * 60 + minute;
    return breaks.some((b) => {
      if (!b.startTime || !b.endTime) return false;
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      return slotMins >= sh * 60 + sm && slotMins < eh * 60 + em;
    });
  };

  // True if the appointment range [startMin, startMin+60) overlaps ANY break
  const hasBreakInRange = (doctorEmail, dateStr, startMin) => {
    const endMin = startMin + 60;
    const breaks = breaksMap[`${doctorEmail}_${dateStr}`] || [];
    return breaks.some((b) => {
      if (!b.startTime || !b.endTime) return false;
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      return startMin < eh * 60 + em && endMin > sh * 60 + sm;
    });
  };

  const isOnLeave = (doctorEmail, dateStr) => !!leavesMap[`${doctorEmail}_${dateStr}`];

  const getAppsForDoctorTime = (doctorEmail, hour, minute) =>
    allApplications.filter((app) => {
      // doctors[] is an array of { doctorEmail, doctorName, ... }
      const hasDoc = app.doctors?.some((d) => d.doctorEmail === doctorEmail)
        || app.doctorEmail === doctorEmail;
      if (!hasDoc) return false;
      if (!app.startTime) return false;
      const [sh, sm] = parseTime(app.startTime);
      return sh === hour && sm === minute;
    });

  const getSlotCount = (s, e) => { const [sh,sm]=parseTime(s), [eh,em]=parseTime(e); return Math.max(1, Math.ceil((eh*60+em-sh*60-sm)/15)); };
  const fmtTime = (t) => { if (!t) return ""; if (t.includes("T")) { const d=new Date(t); return `${d.getUTCHours().toString().padStart(2,"0")}:${d.getUTCMinutes().toString().padStart(2,"0")}`; } return t; };
  const fmtPatient = (app) => { if (app.patientName) return app.patientName; if (app.patient) { const {lastName="",firstName="",middleName=""}=app.patient; return [lastName,firstName,middleName].filter(Boolean).join(" ").trim(); } return t("calendar.unknown"); };

  // â”€â”€ Doctor helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fmtDocName = (doc) => {
    if (!doc) return "";
    const lang = i18n.language === "ru" ? "ru" : "en", fb = lang==="en"?"ru":"en";
    const first = doc.firstName?.[lang]||doc.firstName?.[fb]||doc.firstName||"";
    const last  = doc.lastName?.[lang] ||doc.lastName?.[fb] ||doc.lastName ||"";
    return `${first} ${last}`.trim() || doc.email || t("calendar.unknown");
  };
  const fmtDocSpec = (doc) => {
    if (!doc) return t("calendar.specialist");
    const lang = i18n.language === "ru" ? "ru" : "en";
    // Try populated specialtyIds first
    if (doc.specialtyIds?.length) {
      const s = doc.specialtyIds[0];
      const name = lang === "ru" ? (s.name_ru || s.name_en) : (s.name_en || s.name_ru);
      if (name) return name;
    }
    // Fallback to legacy specialty field
    if (doc.specialty) {
      if (typeof doc.specialty === "string") return doc.specialty;
      return doc.specialty[lang] || doc.specialty[lang === "en" ? "ru" : "en"] || t("calendar.specialist");
    }
    return t("calendar.specialist");
  };
  const filteredDoctors = allDoctorsList.filter((d) => { const q=doctorSearch.toLowerCase(); return !q||fmtDocName(d).toLowerCase().includes(q)||(d.email||"").toLowerCase().includes(q); });
  const getDoctorName = () => doctor ? fmtDocName(doctor) : "...";
  const getDoctorInitials = () => getInitials(getDoctorName());
  const getSpecialty = () => fmtDocSpec(doctor);

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const goToPrev = () => {
    if (viewMode === "doctor") { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }
    else { const d=new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }
  };
  const goToNext = () => {
    if (viewMode === "doctor") { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }
    else { const d=new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }
  };
  const goToToday = () => {
    const now = new Date();
    if (viewMode === "doctor") setWeekStart(getWeekStart(now)); else setSelectedDate(now);
  };

  // â”€â”€ Mini calendar helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const prevMonth = () => { const d=new Date(calMonthDate); d.setMonth(d.getMonth()-1); setCalMonthDate(d); };
  const nextMonth = () => { const d=new Date(calMonthDate); d.setMonth(d.getMonth()+1); setCalMonthDate(d); };
  const handleMonthChange = (idx) => { const d=new Date(calMonthDate); d.setMonth(idx); setCalMonthDate(d); setShowMonthDropdown(false); };
  const handleYearChange  = (yr)  => { const d=new Date(calMonthDate); d.setFullYear(yr); setCalMonthDate(d); setShowYearDropdown(false); };
  const getYearOptions = () => { const cy=new Date().getFullYear(); return Array.from({length:21},(_,i)=>cy-10+i); };
  const getMonthNames  = () => Array.from({length:12},(_,i)=>({ index:i, name:new Date(2000,i,1).toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{month:"long"}) }));

  const getMiniCalDays = () => {
    const year=calMonthDate.getFullYear(), month=calMonthDate.getMonth();
    const firstDay=new Date(year,month,1), lastDay=new Date(year,month+1,0), prevLast=new Date(year,month,0);
    const offset = firstDay.getDay()===0?6:firstDay.getDay()-1;
    const days=[];
    for (let i=offset-1;i>=0;i--) days.push({day:prevLast.getDate()-i, isCurrentMonth:false, date:new Date(year,month-1,prevLast.getDate()-i)});
    for (let i=1;i<=lastDay.getDate();i++) days.push({day:i, isCurrentMonth:true, date:new Date(year,month,i)});
    for (let i=1;days.length<42;i++) days.push({day:i, isCurrentMonth:false, date:new Date(year,month+1,i)});
    return days;
  };

  const miniCalDays = getMiniCalDays();
  const miniCalRows = [];
  for (let i=0;i<miniCalDays.length;i+=7) miniCalRows.push(miniCalDays.slice(i,i+7));

  const today = new Date();
  const weekDays = getWeekDays(weekStart);
  const isRowSelected = (row) => viewMode==="doctor" && row.some((d)=>toDateStr(d.date)===toDateStr(weekStart));

  const weekLabelParts = (() => {
    const loc = i18n.language==="ru"?"ru-RU":"en-US";
    return [
      weekDays[0].toLocaleDateString(loc,{month:"short",day:"numeric"}),
      weekDays[6].toLocaleDateString(loc,{month:"short",day:"numeric",year:"numeric"}),
    ];
  })();

  // â”€â”€ Appointment block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AppBlock = ({ app }) => {
    const dur = getSlotCount(app.startTime, app.endTime);
    return (
      <div
        className={`appointment-block ${getApptStatusClass(app.appointmentStatus)}`}
        style={{ height:`${dur*36-4}px` }}
        onClick={() => navigate(`/applications/appointment/${encodeURIComponent(app.applicationId||app._id)}`)}
      >
        <div className="appointment-time">{fmtTime(app.startTime)} â€“ {fmtTime(app.endTime)}</div>
        <div className="appointment-patient">{fmtPatient(app)}</div>
        {dur > 1 && <div className="appointment-status-badge">{t(`applications.status_${app.appointmentStatus?.toLowerCase().replace(/\s+/g, "_")}`, app.appointmentStatus)}</div>}
      </div>
    );
  };

  // â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="calendar-view-layout">

      {/* â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className={`calendar-sidebar${sidebarOpen ? ' sidebar-responsive-open' : ''}`}>
        <div className="dac-header">
          <button className="dac-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /><span>{t("back") || "Back"}</span>
          </button>

          {/* Mode toggle */}
          <div className="dac-mode-toggle">
            <button className={`dac-mode-btn ${viewMode==="doctor"?"active":""}`} onClick={() => setViewMode("doctor")}>
              <User size={13} /><span>{t("calendar.modeDoctor") || "Doctor"}</span>
            </button>
            <button className={`dac-mode-btn ${viewMode==="all"?"active":""}`} onClick={() => setViewMode("all")}>
              <Users size={13} /><span>{t("calendar.modeAll") || "All"}</span>
            </button>
          </div>

          {/* Doctor selector â€” doctor mode only */}
          {viewMode === "doctor" && (
            <div className="dac-doctor-selector" ref={dropdownRef}>
              <div className="dac-doctor-info dac-doctor-trigger" onClick={() => setShowDoctorDropdown((v)=>!v)}>
                <div className="dac-doctor-avatar">{getDoctorInitials()}</div>
                <div className="dac-doctor-details">
                  <div className="dac-doctor-name">Dr. {getDoctorName()}</div>
                  <div className="dac-doctor-specialty">{getSpecialty()}</div>
                </div>
                <ChevronDown size={14} className={`dac-chevron ${showDoctorDropdown?"open":""}`} />
              </div>

              {showDoctorDropdown && (
                <div className="dac-doctor-dropdown">
                  <div className="dac-dropdown-search">
                    <Search size={13} />
                    <input type="text" placeholder={t("calendar.searchDoctor") || "Search doctor..."} value={doctorSearch}
                      onChange={(e)=>setDoctorSearch(e.target.value)} autoFocus onClick={(e)=>e.stopPropagation()} />
                  </div>
                  <div className="dac-dropdown-list">
                    {filteredDoctors.length === 0
                      ? <div className="dac-dropdown-empty">{t("calendar.noDoctorsFound") || "No doctors found"}</div>
                      : filteredDoctors.map((d) => (
                        <div key={d.email||d._id} className={`dac-dropdown-item ${d.email===selectedEmail?"active":""}`}
                          onClick={() => { setSelectedEmail(d.email); setShowDoctorDropdown(false); setDoctorSearch(""); navigate(`/doctors/${encodeURIComponent(d.email)}/appointments`,{replace:true}); }}>
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
          <div className="current-date-display">
            <CalendarIcon size={16} />
            <span>{(viewMode==="doctor"?weekDays[0]:selectedDate).toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{month:"long",day:"numeric"})}</span>
            <button className="collapse-btn" onClick={() => setSidebarOpen(false)}><ChevronLeft size={16} /></button>
          </div>

          <div className="mini-calendar">
            <div className="mini-calendar-header">
              <button onClick={prevMonth} className="nav-btn"><ChevronLeft size={16} /></button>
              <div className="month-year-display">
                <div className="month-selector">
                  <span className="month-name clickable" onClick={()=>{setShowMonthDropdown(!showMonthDropdown);setShowYearDropdown(false);}}>
                    {calMonthDate.toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{month:"long"})}
                  </span>
                  <ChevronDown size={14} className="chevron-icon clickable" onClick={()=>{setShowMonthDropdown(!showMonthDropdown);setShowYearDropdown(false);}} />
                  {showMonthDropdown && (
                    <div className="custom-dropdown month-dropdown">
                      {getMonthNames().map((m)=>(
                        <div key={m.index} className={`dropdown-item ${calMonthDate.getMonth()===m.index?"selected":""}`} onClick={()=>handleMonthChange(m.index)}>{m.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="year-selector">
                  <span className="year-name clickable" onClick={()=>{setShowYearDropdown(!showYearDropdown);setShowMonthDropdown(false);}}>
                    {calMonthDate.getFullYear()}
                  </span>
                  <ChevronDown size={14} className="chevron-icon clickable" onClick={()=>{setShowYearDropdown(!showYearDropdown);setShowMonthDropdown(false);}} />
                  {showYearDropdown && (
                    <div className="custom-dropdown year-dropdown">
                      {getYearOptions().map((yr)=>(
                        <div key={yr} className={`dropdown-item ${calMonthDate.getFullYear()===yr?"selected":""}`} onClick={()=>handleYearChange(yr)}>{yr}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={nextMonth} className="nav-btn"><ChevronRight size={16} /></button>
            </div>

            <div className="mini-calendar-grid">
              <div className="weekday-labels">
                {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d)=>(
                  <div key={d} className="weekday-label">{d}</div>
                ))}
              </div>

              {/* Doctor mode â†’ click whole week row */}
              {viewMode === "doctor" ? (
                <div className="dac-week-rows">
                  {miniCalRows.map((row, rowIdx) => (
                    <div
                      key={rowIdx}
                      className={`dac-week-row ${isRowSelected(row)?"selected":""} ${hoveredWeekRow===rowIdx?"hovered":""}`}
                      onClick={() => setWeekStart(getWeekStart(row[0].date))}
                      onMouseEnter={() => setHoveredWeekRow(rowIdx)}
                      onMouseLeave={() => setHoveredWeekRow(null)}
                    >
                      {row.map((dayObj, i) => (
                        <div key={i} className={`calendar-day ${!dayObj.isCurrentMonth?"other-month":""} ${dayObj.date.toDateString()===today.toDateString()?"today":""}`}>
                          {dayObj.day}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                /* All mode â†’ click individual day */
                <div className="calendar-days">
                  {miniCalDays.map((dayObj, idx) => (
                    <button key={idx}
                      className={`calendar-day ${!dayObj.isCurrentMonth?"other-month":""} ${dayObj.date.toDateString()===today.toDateString()?"today":""} ${dayObj.date.toDateString()===selectedDate.toDateString()?"selected":""}`}
                      onClick={() => setSelectedDate(new Date(dayObj.date))}>
                      {dayObj.day}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Main grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="calendar-main-content">
        {/* Top nav */}
        <div className="dac-topbar">
          <button className="dac-nav-btn" onClick={goToPrev}><ChevronLeft size={18} /></button>
          <span className="dac-date-label">
            {viewMode==="doctor"
              ? <>{weekLabelParts[0]}&nbsp;&ndash;&nbsp;{weekLabelParts[1]}</>
              : selectedDate.toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </span>
          <button className="dac-nav-btn" onClick={goToNext}><ChevronRight size={18} /></button>
          <button className="dac-today-btn" onClick={goToToday}>{t("today")||"Today"}</button>
        </div>

        {loading ? (
          <div className="calendar-loading"><div className="loading-spinner" /></div>
        ) : (
          <div className={`dac-content-frame${viewMode === "all" ? " dac-all-hscroll" : ""}`}>
          <div className={viewMode === "all" ? "dac-all-inner" : "dac-doctor-inner"}>
            {/* Column headers */}
            <div className="calendar-header">
              <div className="time-column-header">
                <button
                  className={`cv-sidebar-toggle${sidebarOpen ? ' cv-sidebar-toggle--open' : ''}`}
                  onClick={() => setSidebarOpen((v) => !v)}
                  aria-label="Toggle calendar sidebar">
                  {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
                <Clock size={16} className="cv-clock-icon" />
              </div>
              {viewMode === "doctor"
                ? weekDays.map((day, i) => {
                    const isToday = day.toDateString()===today.toDateString();
                    return (
                      <div key={i} className={`doctor-column-header dac-day-col-header ${isToday?"dac-today-col":""}`} style={{flex:1,minWidth:0}}>
                        <div className="dac-day-label">{day.toLocaleDateString(i18n.language==="ru"?"ru-RU":"en-US",{weekday:"short"})}</div>
                        <div className={`dac-day-number ${isToday?"today":""}`}>{day.getDate()}</div>
                      </div>
                    );
                  })
                : allDoctorColumns.length === 0
                  ? <div className="dac-no-doctors">{t("calendar.noDoctorsRegistered") || "No doctors registered"}</div>
                  : allDoctorColumns.map((doc) => (
                    <div key={doc.email} className="doctor-column-header dac-all-col-header" style={{ position: "relative" }}
                      ref={activeDoctorMenu === doc.email ? allMenuRef : null}
                    >
                      <div
                        className="doctor-header-content"
                        onClick={() => setActiveDoctorMenu(activeDoctorMenu === doc.email ? null : doc.email)}
                      >
                        <div className="doctor-avatar"><span>{doc.initials}</span></div>
                        <div className="doctor-info">
                          <div className="doctor-name">{doc.name}</div>
                          <div className="doctor-specialty">{doc.specialty}</div>
                        </div>
                      </div>
                      {activeDoctorMenu === doc.email && (
                        <div className="doctor-menu-dropdown">
                          <div className="doctor-menu-item" onClick={() => { setActiveDoctorMenu(null); navigate(`/doctors/${encodeURIComponent(doc.email)}/schedule`); }}>
                            <CalendarIcon size={16} />
                            <span>{t("calendar.weeklySchedule") || "Weekly schedule"}</span>
                          </div>
                          <div className="doctor-menu-item" onClick={async () => {
                            setActiveDoctorMenu(null);
                            const dateStr = toDateStr(selectedDate);
                            setBreakDoctorEmail(doc.email);
                            setBreakDoctorName(doc.name);
                            setBreakDate(selectedDate);
                            try {
                              const res = await getDoctorBreaks(doc.email, dateStr);
                              if (res.data?.breaks?.length > 0) { setBreakSlots(res.data.breaks); setBreakComment(res.data.comment || ""); }
                              else { setBreakSlots([{ startTime: "18:00", endTime: "22:00" }]); setBreakComment(""); }
                            } catch { setBreakSlots([{ startTime: "18:00", endTime: "22:00" }]); setBreakComment(""); }
                            setShowBreakModal(true);
                          }}>
                            <Clock size={16} />
                            <span>{t("calendar.addBreak") || "Add a break"}</span>
                          </div>
                          <div className="doctor-menu-item" onClick={() => {
                            setActiveDoctorMenu(null);
                            const dateStr = toDateStr(selectedDate);
                            setCancelConfirmData({ doctorEmail: doc.email, dateStr, doctorName: doc.name });
                            setShowCancelConfirm(true);
                          }}>
                            <CalendarIcon size={16} />
                            <span>{t("calendar.cancelWorkingDay") || "Cancel the working day"}</span>
                          </div>
                          <div className="doctor-menu-item" onClick={() => { setActiveDoctorMenu(null); navigate(`/doctors-profile/${doc.email}`); }}>
                            <User size={16} />
                            <span>{t("calendar.employeeProfile") || "Employee profile"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
            </div>

            {/* Time grid */}
            <div className="calendar-body">
              <div className="time-slots-column">
                {timeSlots.map((slot,i) => (
                  <div key={i} className={`time-slot ${slot.minute===0||slot.minute===30?"half-hour-mark":""}`}>
                    {(slot.minute===0||slot.minute===30) && <span className="time-label">{slot.display}</span>}
                  </div>
                ))}
              </div>

              <div className="appointments-grid">
                {viewMode === "doctor"
                  ? weekDays.map((day, dayIdx) => {
                      const ds = toDateStr(day);
                      return (
                        <div key={dayIdx} className="doctor-column" style={{flex:1,minWidth:0}}>
                          {timeSlots.map((slot, slotIdx) => {
                            const appts = getAppsForDayTime(ds, slot.hour, slot.minute);
                            const onLeave = isOnLeave(selectedEmail, ds);
                            const inBreak = !onLeave && isInBreak(selectedEmail, ds, slot.hour, slot.minute);
                            const slotStartMin = slot.hour * 60 + slot.minute;
                            const blockedByBreak = !onLeave && (inBreak || hasBreakInRange(selectedEmail, ds, slotStartMin));
                            const blocked = onLeave || blockedByBreak;
                            const isInSpan = !blocked && hoveredSlot?.dayIdx===dayIdx && hoveredSlot?.hour===slot.hour && slot.minute>=hoveredSlot.minute && slot.minute<hoveredSlot.minute+60;
                            const isHovered = !blocked && hoveredSlot?.dayIdx===dayIdx && hoveredSlot?.hour===slot.hour && hoveredSlot?.minute===slot.minute;
                            const startStr = `${slot.hour.toString().padStart(2,"0")}:${slot.minute.toString().padStart(2,"0")}`;
                            return (
                              <div key={slotIdx}
                                className={`time-cell ${slot.minute===0||slot.minute===30?"half-hour-mark":""} ${isInSpan?"hover-span":""} ${onLeave?"dac-leave-cell":inBreak?"dac-break-cell":""}`}
                                style={isHovered && !appts.length ? {cursor:"pointer"} : undefined}
                                onClick={() => {
                                  if (!blocked && isHovered && !appts.length) {
                                    const endTotal = slot.hour * 60 + slot.minute + 60;
                                    const endH = Math.floor(endTotal / 60);
                                    const endM = endTotal % 60;
                                    const endStr = `${endH.toString().padStart(2,"0")}:${endM.toString().padStart(2,"0")}`;
                                    setCreateModalData({
                                      doctorEmail: selectedEmail,
                                      date: ds,
                                      startTime: new Date(`${ds}T${startStr}:00`).toISOString(),
                                      endTime: new Date(`${ds}T${endStr}:00`).toISOString(),
                                    });
                                    setShowCreateModal(true);
                                  }
                                }}
                                onMouseEnter={() => { if (!blocked && !appts.length) setHoveredSlot({dayIdx,hour:slot.hour,minute:slot.minute}); }}
                                onMouseLeave={() => setHoveredSlot(null)}>
                                {onLeave && slot.hour === 9 && slot.minute === 0 && (
                                  <div className="dac-leave-label">{t("calendar.dayOff") || "Day Off"}</div>
                                )}
                                {!onLeave && inBreak && slot.minute === 0 && (
                                  <div className="dac-break-label">{t("calendar.breakLabel") || "Break"}</div>
                                )}
                                {!onLeave && !inBreak && isHovered && !appts.length && (() => {
                                  const total=slot.hour*60+slot.minute+60, eh=Math.floor(total/60), em=total%60;
                                  const s=`${slot.hour.toString().padStart(2,"0")}:${slot.minute.toString().padStart(2,"0")}`;
                                  const e=`${eh.toString().padStart(2,"0")}:${em.toString().padStart(2,"0")}`;
                                  return (<div className="create-appointment-hover"><span className="create-icon">+</span><span className="create-text">{t("calendar.create_appointment")||"New"}</span><span className="create-time">{s}&nbsp;&ndash;&nbsp;{e}</span></div>);
                                })()}
                                {appts.map((app) => <AppBlock key={app._id} app={app} />)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  : allDoctorColumns.length === 0
                    ? <div className="dac-empty-state">{t("calendar.noDoctorsRegistered") || "No doctors registered."}</div>
                    : allDoctorColumns.map((doc) => (
                      <div key={doc.email} className="doctor-column dac-all-col-body">
                        {timeSlots.map((slot, slotIdx) => {
                          const appts = getAppsForDoctorTime(doc.email, slot.hour, slot.minute);
                          const onLeave = isOnLeave(doc.email, toDateStr(selectedDate));
                          const inBreak = !onLeave && isInBreak(doc.email, toDateStr(selectedDate), slot.hour, slot.minute);
                          const slotStartMin = slot.hour * 60 + slot.minute;
                          const blockedByBreak = !onLeave && (inBreak || hasBreakInRange(doc.email, toDateStr(selectedDate), slotStartMin));
                          const blocked = onLeave || blockedByBreak;
                          const isHovered = !blocked && hoveredSlot?.doctorEmail===doc.email && hoveredSlot?.hour===slot.hour && hoveredSlot?.minute===slot.minute;
                          const isInSpan = !blocked && hoveredSlot?.doctorEmail===doc.email && hoveredSlot?.hour===slot.hour && slot.minute>=hoveredSlot.minute && slot.minute<hoveredSlot.minute+60;
                          const allStartStr = `${slot.hour.toString().padStart(2,"0")}:${slot.minute.toString().padStart(2,"0")}`;
                          return (
                            <div key={slotIdx}
                              className={`time-cell ${slot.minute===0||slot.minute===30?"half-hour-mark":""} ${isInSpan?"hover-span":""} ${onLeave?"dac-leave-cell":inBreak?"dac-break-cell":""}`}
                              style={isHovered && !appts.length ? {cursor:"pointer"} : undefined}
                              onClick={() => {
                                if (!blocked && isHovered && !appts.length) {
                                  const endTotal = slot.hour * 60 + slot.minute + 60;
                                  const endH = Math.floor(endTotal / 60);
                                  const endM = endTotal % 60;
                                  const endStr = `${endH.toString().padStart(2,"0")}:${endM.toString().padStart(2,"0")}`;
                                  const dateStr = toDateStr(selectedDate);
                                  setCreateModalData({
                                    doctorEmail: doc.email,
                                    date: dateStr,
                                    startTime: new Date(`${dateStr}T${allStartStr}:00`).toISOString(),
                                    endTime: new Date(`${dateStr}T${endStr}:00`).toISOString(),
                                  });
                                  setShowCreateModal(true);
                                }
                              }}
                              onMouseEnter={() => { if (!blocked && !appts.length) setHoveredSlot({doctorEmail:doc.email,hour:slot.hour,minute:slot.minute}); }}
                              onMouseLeave={() => setHoveredSlot(null)}>
                              {onLeave && slot.hour === 9 && slot.minute === 0 && (
                                <div className="dac-leave-label">{t("calendar.dayOff") || "Day Off"}</div>
                              )}
                              {!onLeave && inBreak && slot.minute === 0 && (
                                <div className="dac-break-label">{t("calendar.breakLabel") || "Break"}</div>
                              )}
                              {!onLeave && !inBreak && isHovered && !appts.length && (() => {
                                const total=slot.hour*60+slot.minute+60, eh=Math.floor(total/60), em=total%60;
                                const s=`${slot.hour.toString().padStart(2,"0")}:${slot.minute.toString().padStart(2,"0")}`;
                                const e=`${eh.toString().padStart(2,"0")}:${em.toString().padStart(2,"0")}`;
                                return (
                                  <div className="create-appointment-hover">
                                    <span className="create-icon">+</span>
                                    <span className="create-text">{t("calendar.create_appointment")||"New appointment"}</span>
                                    <span className="create-time">{s}&nbsp;&ndash;&nbsp;{e}</span>
                                  </div>
                                );
                              })()}
                              {appts.map((app) => <AppBlock key={app._id} app={app} />)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
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
          }}
        />
      )}

      {/* Break Modal */}
      {showBreakModal && (
        <div className="modal-overlay" onClick={() => setShowBreakModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="break-modal-header">
              <h3 className="break-modal-title">{t("calendar.addBreak") || "Add a break"}</h3>
              <button className="break-modal-close" onClick={() => setShowBreakModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="doctor-name-display">{breakDoctorName}</div>

              {/* Date selector — only visible in doctor (week) mode */}
              {viewMode === "doctor" && (
                <div className="break-date-row">
                  <label className="comment-label">{t("calendar.date") || "Date"}</label>
                  <select
                    className="break-date-select"
                    value={toDateStr(breakDate)}
                    onChange={async (e) => {
                      const newDate = new Date(e.target.value + "T00:00:00");
                      setBreakDate(newDate);
                      try {
                        const res = await getDoctorBreaks(breakDoctorEmail, e.target.value);
                        if (res.data?.breaks?.length > 0) { setBreakSlots(res.data.breaks); setBreakComment(res.data.comment || ""); }
                        else { setBreakSlots([{ startTime: "18:00", endTime: "22:00" }]); setBreakComment(""); }
                      } catch { setBreakSlots([{ startTime: "18:00", endTime: "22:00" }]); setBreakComment(""); }
                    }}
                  >
                    {weekDays.map((day) => {
                      const ds = toDateStr(day);
                      return (
                        <option key={ds} value={ds}>
                          {day.toLocaleDateString(i18n.language === "ru" ? "ru-RU" : "en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {breakSlots.map((slot, index) => (
                <div key={index} className="break-time-row">
                  <input type="time" className="time-input" value={slot.startTime}
                    onChange={(e) => {
                      if (hasTimeConflict(breakSlots, index, e.target.value, slot.endTime)) { toast.warning(t("calendar.timeConflictError")); return; }
                      const s=[...breakSlots]; s[index].startTime=e.target.value; setBreakSlots(s);
                    }} />
                  <span className="time-separator">–</span>
                  <input type="time" className="time-input" value={slot.endTime}
                    onChange={(e) => {
                      if (hasTimeConflict(breakSlots, index, slot.startTime, e.target.value)) { toast.warning(t("calendar.timeConflictError")); return; }
                      const s=[...breakSlots]; s[index].endTime=e.target.value; setBreakSlots(s);
                    }} />
                  {breakSlots.length > 1 && (
                    <button className="delete-break-btn" onClick={() => setBreakSlots(breakSlots.filter((_,i)=>i!==index))}>×</button>
                  )}
                </div>
              ))}
              <button className="add-break-btn" onClick={() => setBreakSlots([...breakSlots, { startTime:"", endTime:"" }])}>+ {t("calendar.break") || "Break"}</button>
              <div className="comment-section">
                <label className="comment-label">{t("calendar.comment") || "Comment"}</label>
                <textarea className="comment-textarea" value={breakComment} onChange={(e)=>setBreakComment(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="save-btn" onClick={async () => {
                const dateStr = toDateStr(breakDate);
                const validBreaks = breakSlots.filter(s => s.startTime && s.endTime);
                try {
                  await saveDoctorBreaks({ doctorEmail: breakDoctorEmail, date: dateStr, breaks: validBreaks, comment: breakComment });
                  // Immediately reflect new breaks in the calendar grid
                  setBreaksMap((prev) => ({ ...prev, [`${breakDoctorEmail}_${dateStr}`]: validBreaks }));
                  toast.success(t("calendar.saveSuccess") || "Breaks saved!");
                  setShowBreakModal(false);
                  setBreakComment("");
                  setBreakSlots([{ startTime: "18:00", endTime: "22:00" }]);
                } catch { toast.error(t("calendar.saveError") || "Failed to save breaks."); }
              }}>{t("calendar.save") || "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Working Day Confirmation */}
      {showCancelConfirm && cancelConfirmData && (
        <div className="dac-confirm-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="dac-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dac-confirm-icon">⚠️</div>
            <h3 className="dac-confirm-title">{t("calendar.cancelConfirmTitle") || "Cancel Working Day?"}</h3>
            <p className="dac-confirm-message">
              {t("calendar.cancelConfirmMessage", { name: cancelConfirmData.doctorName, date: cancelConfirmData.dateStr }) ||
                `This will mark ${cancelConfirmData.doctorName} as absent on ${cancelConfirmData.dateStr}. This action cannot be undone.`}
            </p>
            <div className="dac-confirm-actions">
              <button className="dac-confirm-btn dac-confirm-no" onClick={() => setShowCancelConfirm(false)}>
                {t("calendar.cancelConfirmNo") || "No, keep it"}
              </button>
              <button className="dac-confirm-btn dac-confirm-yes" onClick={async () => {
                setShowCancelConfirm(false);
                try {
                  await createDoctorLeave({
                    doctorEmail: cancelConfirmData.doctorEmail,
                    startDate: cancelConfirmData.dateStr,
                    endDate: cancelConfirmData.dateStr,
                    leaveType: "Vacation",
                    isGivenByAdmin: true,
                    comment: "Working day cancelled by admin",
                  });
                  setLeavesMap((prev) => ({ ...prev, [`${cancelConfirmData.doctorEmail}_${cancelConfirmData.dateStr}`]: true }));
                  toast.success(t("calendar.workingDayCancelled") || "Working day cancelled");
                } catch (err) {
                  toast.error(err.response?.data?.message || t("calendar.failedToCancelDay") || "Failed to cancel working day");
                }
              }}>
                {t("calendar.cancelConfirmYes") || "Yes, cancel day"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorAppointmentsCalendar;
