import React, { useState, useMemo, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../context/AuthContext";
import { getEarlyDetectionBookingsByDoctor, getAssistantDoctors } from "../utils/api";
import moment from "moment-timezone";
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
  for (let h = 9; h < 18; h++)
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

const WEEKDAYS_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAYS_RU = ["Пн",  "Вт",  "Ср",  "Чт",  "Пт",  "Сб",  "Вс" ];

/* ─── Component ─── */
const EarlyDetectionCalendarView = ({ bookings = [], loading = true }) => {
  const { user }      = useContext(AuthContext);
  const { i18n }      = useTranslation();
  const navigate      = useNavigate();
  const locale        = i18n.language === "ru" ? "ru-RU" : "en-US";
  const isRu          = i18n.language === "ru";

  const today         = useMemo(() => new Date(), []);
  const todayYMD      = toYMD(today);

  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [showMonthDrop, setShowMonthDrop] = useState(false);
  const [showYearDrop,  setShowYearDrop]  = useState(false);
  const [applications,  setApplications]  = useState(bookings);

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
  const miniWeeks   = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < miniDays.length; i += 7) weeks.push(miniDays.slice(i, i + 7));
    return weeks;
  }, [miniDays]);
  const weekStartYMD = useMemo(() => toYMD(getWeekDays(currentDate)[0]), [currentDate]);

  const yearOptions = useMemo(() => {
    const cy = today.getFullYear();
    return Array.from({ length: 21 }, (_, i) => cy - 10 + i);
  }, [today]);

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

  /* sync applications with bookings prop */
  useEffect(() => {
    setApplications(bookings || []);
  }, [bookings]);

  /* Helper: Combine date + time into ISO datetime */
  const getFullDateTime = (booking) => {
    if (!booking.date) return null;
    
    // If startTime is already ISO, use it directly
    if (booking.startTime && booking.startTime.includes('T')) {
      return booking.startTime;
    }
    
    // Otherwise combine date + startTime (time only)
    const dateStr = booking.date instanceof Date 
      ? booking.date.toISOString().split('T')[0]
      : String(booking.date).split('T')[0];
    
    const timeStr = booking.startTime || "09:00";
    return `${dateStr}T${timeStr}:00`;
  };

  /* group by date key (Moscow timezone from startTime) */
  const byDay = useMemo(() => {
    const map = {};
    applications.forEach((appt) => {
      let key = null;
      const fullDateTime = getFullDateTime(appt);
      
      if (fullDateTime) {
        key = moment(fullDateTime).tz("Europe/Moscow").format("YYYY-MM-DD");
      }
      
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    });
    return map;
  }, [applications]);

  const miniByDay = useMemo(() => {
    const map = {};
    applications.forEach((appt) => {
      let key = null;
      const fullDateTime = getFullDateTime(appt);
      
      if (fullDateTime) {
        key = moment(fullDateTime).tz("Europe/Moscow").format("YYYY-MM-DD");
      }
      
      if (!key) return;

      if (!map[key]) map[key] = new Set();
      const doctorKey = Array.isArray(appt.doctors)
        ? appt.doctors.map((doctor) => doctor || "").join(",")
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
  }, [applications]);

  const getBookingsAtSlot = (dayApps, hour, minute) => {
    const result = dayApps.filter((appt) => {
      const fullDateTime = getFullDateTime(appt);
      if (!fullDateTime) return false;
      
      const m = moment(fullDateTime).tz("Europe/Moscow");
      const matches = m.hour() === hour && m.minute() >= minute && m.minute() < minute + 30;
      if (matches) {
      }
      return matches;
    });
    return result;
  };

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
            {miniWeeks.map((week, wIdx) => {
              const isWeekSelected = toYMD(week[0].date) === weekStartYMD;
              return (
                <div
                  key={wIdx}
                  className={`edcv2-week-row${isWeekSelected ? " edcv2-week-row--selected" : ""}`}
                  onClick={() => setCurrentDate(new Date(week[0].date))}
                >
                  {week.map((obj, dIdx) => {
                    const ymd      = toYMD(obj.date);
                    const isToday  = ymd === todayYMD;
                    const dayCount = miniByDay[ymd] || 0;
                    return (
                      <button key={dIdx}
                        className={[
                          "edcv2-day",
                          !obj.current ? "edcv2-day--other" : "",
                          isToday      ? "edcv2-day--today" : "",
                        ].join(" ")}
                        onClick={(e) => { e.stopPropagation(); setCurrentDate(new Date(obj.date)); }}>
                        {obj.day}
                        {dayCount > 0 && <span className="edcv2-day-count-badge">{dayCount}</span>}
                      </button>
                    );
                  })}
                </div>
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
            { key: "pending",   en: "Pending",   ru: "Ожидание"     },
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

        {/* Body — header is sticky inside the scroll container so columns always align */}
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
                const ymd     = toYMD(day);
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
                  {slot.minute === 0 && (
                    <span className="edcv2-time-lbl">{slot.display}</span>
                  )}
                </div>
              ))}
            </div>

            {/* 7 × day columns */}
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
                          const fullDateTime = getFullDateTime(appt);
                          const sm = fullDateTime ? moment(fullDateTime).tz("Europe/Moscow") : null;
                          
                          // Parse endTime if it's just HH:mm
                          let em = null;
                          if (appt.endTime && appt.date) {
                            const dateStr = appt.date instanceof Date 
                              ? appt.date.toISOString().split('T')[0]
                              : String(appt.date).split('T')[0];
                            const endDateTime = `${dateStr}T${appt.endTime}:00`;
                            em = moment(endDateTime).tz("Europe/Moscow");
                          }
                          
                          const timeLabel = sm
                            ? `${sm.format("HH:mm")}${em ? ` – ${em.format("HH:mm")}` : ""}`
                            : "";
                          return (
                            <div key={appt.applicationId}
                              className="edcv2-booking-block"
                              style={{ background: statusColor(appt.appointmentStatus) }}
                              onClick={() =>
                                navigate(
                                  `/early-detection/${encodeURIComponent(appt.applicationId)}`,
                                  { state: { doctorEmail: appt.doctorEmail, patientEmail: appt.patientEmail } }
                                )
                              }>
                              <div className="edcv2-block-time">{timeLabel}</div>
                              <div className="edcv2-block-name">{appt.patientName || "Unknown"}</div>
                              <div className="edcv2-block-pkg">{appt.serviceType || "—"}</div>
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

export default EarlyDetectionCalendarView;
