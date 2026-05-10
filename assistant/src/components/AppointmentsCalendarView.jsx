import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getEmailFromToken, getAppointmentsForCalendar, getAppointmentsByDoctor } from "../utils/api";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  CalendarDays,
  Menu,
  X,
} from "lucide-react";
import "./EarlyDetectionCalendarView.css";

/* ─── Helpers ─── */
function toYMD(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMiniCalendarDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);
  const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const days = [];
  for (let i = firstDow - 1; i >= 0; i--)
    days.push({ day: prevLastDay.getDate() - i, current: false, date: new Date(year, month - 1, prevLastDay.getDate() - i) });
  for (let d = 1; d <= lastDay.getDate(); d++)
    days.push({ day: d, current: true, date: new Date(year, month, d) });
  let fill = 1;
  while (days.length < 42)
    days.push({ day: fill, current: false, date: new Date(year, month + 1, fill++) });
  return days;
}

function getWeekDays(date) {
  const d = new Date(date);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    return wd;
  });
}

function generateTimeSlots() {
  const slots = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 30)
      slots.push({ hour: h, minute: m, display: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` });
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

const STATUS_COLORS = {
  confirmed:   "#00C853",
  completed:   "#3b82f6",
  pending:     "#FF9800",
  unconfirmed: "#FF9800",
  upcoming:    "#FFD600",
  cancelled:   "#FF1744",
};
const statusColor = (s) => STATUS_COLORS[s?.toLowerCase()] || "#3b82f6";

function getMonthNames(locale) {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })
  );
}

function extractDate(appt) {
  if (appt.date) return String(appt.date).slice(0, 10);
  if (appt.appointmentDate) return String(appt.appointmentDate).slice(0, 10);
  if (appt.startTime && String(appt.startTime).includes("T")) {
    return String(appt.startTime).slice(0, 10);
  }
  return null;
}

function formatTime(value) {
  if (!value) return "";
  let t = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!isNaN(d)) {
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
  }
  return t;
}

const WEEKDAYS_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAYS_RU = ["Пн",  "Вт",  "Ср",  "Чт",  "Пт",  "Сб",  "Вс" ];

/* ─── Component ─── */
const AppointmentsCalendarView = () => {
  const { i18n } = useTranslation();
  const locale    = i18n.language === "ru" ? "ru-RU" : "en-US";
  const isRu      = i18n.language === "ru";
  const lang      = i18n.language === "ru" ? "ru" : "en";

  const assistantEmail = getEmailFromToken();

  const today    = useMemo(() => new Date(), []);
  const todayYMD = toYMD(today);

  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [showMonthDrop, setShowMonthDrop] = useState(false);
  const [showYearDrop,  setShowYearDrop]  = useState(false);
  const [appointments,  setAppointments]  = useState([]);
  const [miniCalendarAppointments, setMiniCalendarAppointments] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const yearDropRef       = useRef(null);
  const sidebarRef        = useRef(null);
  const monthSelectorRef  = useRef(null);
  const yearSelectorRef   = useRef(null);

  const selectedYMD = toYMD(currentDate);
  const miniDays    = useMemo(() => getMiniCalendarDays(currentDate), [currentDate]);
  const monthNames  = useMemo(() => getMonthNames(locale), [locale]);
  const weekdays    = isRu ? WEEKDAYS_RU : WEEKDAYS_EN;
  const weekDays    = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const yearOptions = useMemo(() => {
    const cy = today.getFullYear();
    return Array.from({ length: 21 }, (_, i) => cy - 10 + i);
  }, [today]);

  const weekStartYMD = toYMD(weekDays[0]);
  const weekEndYMD   = toYMD(weekDays[6]);

  /* scroll year dropdown to current year */
  useEffect(() => {
    if (showYearDrop && yearDropRef.current) {
      const sel = yearDropRef.current.querySelector(".edcv2-dropdown-item.selected");
      sel?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [showYearDrop]);

  /* close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (monthSelectorRef.current && !monthSelectorRef.current.contains(e.target)) {
        setShowMonthDrop(false);
      }
      if (yearSelectorRef.current && !yearSelectorRef.current.contains(e.target)) {
        setShowYearDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* fetch all appointments for both the week grid and mini-calendar */
  useEffect(() => {
    if (!assistantEmail) return;
    setLoading(true);
    getAppointmentsByDoctor(assistantEmail, 1, 2000, "all", "")
      .then(({ appointments: allAppointments }) => {
        const valid = Array.isArray(allAppointments)
          ? allAppointments.filter(appt => {
              const s = (appt.appointmentStatus || appt.status || "").toLowerCase();
              return ["confirmed", "completed"].includes(s);
            })
          : [];
        setMiniCalendarAppointments(valid);
        setAppointments(valid);
      })
      .catch((err) => console.error("Calendar fetch error:", err))
      .finally(() => setLoading(false));
  }, [assistantEmail]);

  /* group appointments by date string "YYYY-MM-DD" */
  const byDay = useMemo(() => {
    const map = {};
    appointments.forEach((appt) => {
      const key = extractDate(appt);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    });
    return map;
  }, [appointments]);

  const miniByDay = useMemo(() => {
    const map = {};
    miniCalendarAppointments.forEach((appt) => {
      const key = extractDate(appt);
      if (!key) return;
      if (!map[key]) map[key] = new Set();
      const doctorKey = Array.isArray(appt.doctors)
        ? appt.doctors.map((doctor) => doctor?.doctorEmail || doctor?.doctorName || "").join(",")
        : appt.doctorEmail || "";
      const uniqueKey = [
        key,
        appt.startTime || "",
        appt.endTime || "",
        appt.patientEmail || "",
        doctorKey,
        appt.serviceType || "",
        appt.appointmentStatus || "",
      ]
        .join("|")
        .toLowerCase();
      map[key].add(uniqueKey);
    });
    return Object.fromEntries(Object.entries(map).map(([dayKey, value]) => [dayKey, value.size]));
  }, [miniCalendarAppointments]);

  /* match slot — startTime might be a plain "HH:mm" string or ISO string */
  const getBookingsAtSlot = (dayApps, hour, minute) =>
    dayApps.filter((appt) => {
      if (!appt.startTime) return false;
      const t = formatTime(appt.startTime);
      if (!/^\d{1,2}:\d{2}$/.test(t)) return false;
      const [h, m] = t.split(":").map(Number);
      return h === hour && m >= minute && m < minute + 30;
    });

  return (
    <div className="edcv2-layout">

      {/* ═══════════ SIDEBAR TOGGLE – open (medium & small screens) ═══════════ */}
      {!sidebarOpen && (
        <button
          className="edcv2-sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open calendar"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay behind sidebar on small screens */}
      {sidebarOpen && (
        <div
          className="edcv2-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      <aside className={`edcv2-sidebar${sidebarOpen ? " edcv2-sidebar--open" : ""}`} ref={sidebarRef}>

        {/* Selected date chip */}
        <div className="edcv2-current-date">
          <CalendarDays size={15} />
          <span>{currentDate.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</span>
          <button
            className="edcv2-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close calendar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mini Calendar */}
        <div className="edcv2-mini-cal">
          <div className="edcv2-mini-cal-header">
            <button className="edcv2-nav-btn"
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <ChevronLeft size={15} />
            </button>

            <div className="edcv2-month-year">
              {/* Month */}
              <div className="edcv2-selector" ref={monthSelectorRef}>
                <span className="edcv2-selector-label"
                  onClick={() => { setShowMonthDrop(v => !v); setShowYearDrop(false); }}>
                  {monthNames[currentDate.getMonth()]}
                </span>
                <ChevronDown size={12} className="edcv2-chev"
                  onClick={() => { setShowMonthDrop(v => !v); setShowYearDrop(false); }} />
                {showMonthDrop && (
                  <div className="edcv2-dropdown">
                    {monthNames.map((mn, i) => (
                      <div key={i}
                        className={`edcv2-dropdown-item${currentDate.getMonth() === i ? " selected" : ""}`}
                        onClick={() => { setCurrentDate(d => new Date(d.getFullYear(), i, 1)); setShowMonthDrop(false); }}>
                        {mn}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Year */}
              <div className="edcv2-selector" ref={yearSelectorRef}>
                <span className="edcv2-selector-label"
                  onClick={() => { setShowYearDrop(v => !v); setShowMonthDrop(false); }}>
                  {currentDate.getFullYear()}
                </span>
                <ChevronDown size={12} className="edcv2-chev"
                  onClick={() => { setShowYearDrop(v => !v); setShowMonthDrop(false); }} />
                {showYearDrop && (
                  <div className="edcv2-dropdown edcv2-dropdown--year" ref={yearDropRef}>
                    {yearOptions.map((yr) => (
                      <div key={yr}
                        className={`edcv2-dropdown-item${currentDate.getFullYear() === yr ? " selected" : ""}`}
                        onClick={() => { setCurrentDate(d => new Date(yr, d.getMonth(), 1)); setShowYearDrop(false); }}>
                        {yr}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button className="edcv2-nav-btn"
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="edcv2-weekday-row">
            {weekdays.map(wd => <div key={wd} className="edcv2-weekday-lbl">{wd}</div>)}
          </div>

          {/* Day grid */}
          <div className="edcv2-days-grid">
            {miniDays.map((obj, idx) => {
              const ymd     = toYMD(obj.date);
              const isToday = ymd === todayYMD;
              const isSel   = ymd === selectedYMD;
              const dayCount = miniByDay[ymd] || 0;
              return (
                <button key={idx}
                  className={[
                    "edcv2-day",
                    !obj.current ? "edcv2-day--other"    : "",
                    isToday      ? "edcv2-day--today"    : "",
                    isSel        ? "edcv2-day--selected" : "",
                  ].join(" ")}
                  onClick={() => setCurrentDate(new Date(obj.date))}>
                  {obj.day}
                  {dayCount > 0 && <span className="edcv2-day-count-badge">{dayCount}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Today button */}
        <button className="edcv2-today-btn" onClick={() => setCurrentDate(new Date())}>
          {isRu ? "Сегодня" : "Today"}
        </button>

        {/* Legend */}
        <div className="edcv2-legend">
          {[
            { key: "confirmed", en: "Confirmed", ru: "Подтверждено" },
            { key: "completed", en: "Completed", ru: "Завершено"    },
            { key: "upcoming",  en: "Upcoming",  ru: "Предстоящее"  },
            { key: "cancelled", en: "Cancelled", ru: "Отменено"     },
          ].map(({ key, en, ru }) => (
            <div key={key} className="edcv2-legend-row">
              <span className="edcv2-legend-dot" style={{ background: STATUS_COLORS[key] }} />
              <span>{isRu ? ru : en}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="edcv2-main">

        {/* Body — header lives inside so columns always align */}
        {loading ? (
          <div className="edcv2-loading">
            {isRu ? "Загрузка..." : "Loading..."}
          </div>
        ) : (
          <div className="edcv2-body">
            <div className="edcv2-calendar-grid">
              {/* Row 1: header cells (sticky) */}
              <div className="edcv2-time-col-hdr"><Clock size={15} /></div>
              {weekDays.map((day, i) => {
                const ymd   = toYMD(day);
                const isToday = ymd === todayYMD;
                const isSel   = ymd === selectedYMD;
                return (
                  <div key={i}
                    className={`edcv2-day-col-hdr${isToday ? " is-today" : ""}${isSel ? " is-selected" : ""}`}
                    onClick={() => setCurrentDate(new Date(day))}>
                    <span className="edcv2-col-weekday">{weekdays[i]}</span>
                    <span className="edcv2-col-daynum">{day.getDate()}</span>
                  </div>
                );
              })}

              {/* Row 2: body cells */}
              <div className="edcv2-time-col">
              {TIME_SLOTS.map((slot, i) => (
                <div key={i} className={`edcv2-time-slot${slot.minute === 0 ? " full" : " half"}`}>
                  {slot.minute === 0 && <span className="edcv2-time-lbl">{slot.display}</span>}
                </div>
              ))}
            </div>

            {/* 7 day columns */}
            {weekDays.map((day, dayIdx) => {
              const ymd     = toYMD(day);
              const dayApps = byDay[ymd] || [];
              const isToday = ymd === todayYMD;
              const isSel   = ymd === selectedYMD;
              return (
                <div key={dayIdx}
                  className={`edcv2-slots-col${isToday ? " is-today" : ""}${isSel ? " is-selected" : ""}`}>
                  {TIME_SLOTS.map((slot, i) => {
                    const slotBookings = getBookingsAtSlot(dayApps, slot.hour, slot.minute);
                    return (
                      <div key={i} className={`edcv2-slot${slot.minute === 0 ? " full" : " half"}`}>
                        {slotBookings.map((appt) => {
                          const timeLabel = appt.startTime && appt.endTime
                            ? `${formatTime(appt.startTime)} – ${formatTime(appt.endTime)}`
                            : formatTime(appt.startTime);

                          const patientName = appt.patientDetails
                            ? [
                                appt.patientDetails.lastName?.[lang] || appt.patientDetails.lastName,
                                appt.patientDetails.firstName?.[lang] || appt.patientDetails.firstName,
                              ].filter(Boolean).join(" ")
                            : appt.patientName || (isRu ? "Неизвестно" : "Unknown");

                          const doctorName = appt.doctorDetails
                            ? [
                                appt.doctorDetails.lastName?.[lang] || appt.doctorDetails.lastName?.en,
                                appt.doctorDetails.firstName?.[lang] || appt.doctorDetails.firstName?.en,
                              ].filter(Boolean).join(" ")
                            : appt.doctors?.[0]?.doctorName || "";

                          return (
                            <div
                              key={appt._id || appt.applicationId}
                              className="edcv2-booking-block"
                              style={{ background: statusColor(appt.appointmentStatus) }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `/appointments/${encodeURIComponent(appt.applicationId || appt._id)}`,
                                  "_blank"
                                );
                              }}
                            >
                              <div className="edcv2-block-time">{timeLabel}</div>
                              <div className="edcv2-block-name">{patientName}</div>
                              <div className="edcv2-block-pkg">{doctorName || appt.serviceType || "—"}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            </div>{/* end edcv2-calendar-grid */}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentsCalendarView;
