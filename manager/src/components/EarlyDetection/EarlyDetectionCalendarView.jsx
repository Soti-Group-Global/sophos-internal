import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  Clock,
} from "lucide-react";
import { getApptStatusColor } from "../../utils/appointmentStatus";
import "./EarlyDetectionCalendarView.css";

/* ── Helpers ── */
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

function generateTimeSlots() {
  const slots = [];
  for (let h = 9; h < 18; h++)
    for (let m = 0; m < 60; m += 15)
      slots.push({ hour: h, minute: m, display: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` });
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

function getWeekDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    return wd;
  });
}

function parseHHMM(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  return isNaN(h) ? null : { hour: h, minute: m };
}

const statusColor = (s) => getApptStatusColor(s);

function getMonthNames(locale) {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })
  );
}

const WEEKDAYS_EN = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const WEEKDAYS_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

/* ── Component ── */
const EarlyDetectionCalendarView = ({ bookings = [] }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale   = i18n.language === "ru" ? "ru-RU" : "en-US";
  const isRu     = i18n.language === "ru";

  const today    = useMemo(() => new Date(), []);
  const todayYMD = toYMD(today);

  const [currentDate, setCurrentDate]     = useState(new Date());
  const [showMonthDrop, setShowMonthDrop] = useState(false);
  const [showYearDrop, setShowYearDrop]   = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [hoveredSlot, setHoveredSlot]     = useState(null);
  const yearDropRef  = useRef(null);
  const timeLineRef  = useRef(null);

  const SLOT_HEIGHT   = 36;
  const CAL_START_MIN = 9 * 60;

  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const isViewingToday = toYMD(currentDate) === todayYMD;
  const nowTop = isViewingToday
    ? ((nowMinutes - CAL_START_MIN) / 15) * SLOT_HEIGHT
    : -1;

  useEffect(() => {
    if (nowTop >= 0 && timeLineRef.current) {
      timeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isViewingToday]);

  const selectedYMD = toYMD(currentDate);
  const miniDays    = useMemo(() => getMiniCalendarDays(currentDate), [currentDate]);
  const monthNames  = useMemo(() => getMonthNames(locale), [locale]);
  const weekdays    = isRu ? WEEKDAYS_RU : WEEKDAYS_EN;

  const yearOptions = useMemo(() => {
    const cy = today.getFullYear();
    return Array.from({ length: 21 }, (_, i) => cy - 10 + i);
  }, [today]);

  useEffect(() => {
    if (showYearDrop && yearDropRef.current) {
      const sel = yearDropRef.current.querySelector(".edcv2-dropdown-item.selected");
      sel?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [showYearDrop]);

  const byDay = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      // Add specialist consultations as separate events
      if (b.schedule?.specialistConsultations && Array.isArray(b.schedule.specialistConsultations)) {
        b.schedule.specialistConsultations.forEach((spec, idx) => {
          if (!spec.date) return;
          const key = toYMD(spec.date);
          if (!map[key]) map[key] = [];
          map[key].push({
            _id: `${b._id}-spec-${idx}`,
            type: "specialist",
            booking: b,
            specialist: spec,
            patient: b.patient,
            customer: b.customer,
            package: b.package,
            payment: b.payment,
            status: b.status,
            doctor: spec.doctor,
            startTime: spec.startTime,
            endTime: spec.endTime,
            date: spec.date,
            title: spec.title,
          });
        });
      }
      // Also add main appointment as fallback if no specialists
      if (b.appointmentDate && (!b.schedule?.specialistConsultations || b.schedule.specialistConsultations.length === 0)) {
        const key = toYMD(b.appointmentDate);
        if (!map[key]) map[key] = [];
        map[key].push({
          _id: b._id,
          type: "booking",
          booking: b,
          specialist: null,
          patient: b.patient,
          customer: b.customer,
          package: b.package,
          payment: b.payment,
          status: b.status,
          appointmentTime: b.appointmentTime,
        });
      }
    });
    return map;
  }, [bookings]);

  const dayBookings = useMemo(() => byDay[selectedYMD] || [], [byDay, selectedYMD]);

  const getBookingsAtSlot = (hour, minute) =>
    dayBookings.filter((event) => {
      const t = event.type === "specialist" 
        ? parseHHMM(event.startTime) 
        : parseHHMM(event.appointmentTime);
      return t && t.hour === hour && t.minute === minute;
    });

  const readNameField = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
      const lang = isRu ? "ru" : "en";
      const localized = value[lang] || value.en || value.ru;
      if (typeof localized === "string") return localized.trim();
      const firstString = Object.values(value).find((v) => typeof v === "string");
      return firstString ? firstString.trim() : "";
    }
    return "";
  };

  const getFullName = (c) => {
    if (!c) return "N/A";
    const parts = [c.lastName, c.firstName, c.middleName]
      .map(readNameField)
      .filter(Boolean);
    return parts.join(" ") || "N/A";
  };

  const slotToMinutes = (hour, minute) => (hour * 60) + minute;

  const doesBookingOccupySlot = (event, hour, minute) => {
    const timeStr = event.type === "specialist" ? event.startTime : event.appointmentTime;
    const start = parseHHMM(timeStr);
    if (!start) return false;

    const slotMinutes = slotToMinutes(hour, minute);
    const bookingStart = slotToMinutes(start.hour, start.minute);
    return slotMinutes >= bookingStart && slotMinutes < bookingStart + 60;
  };

  const hasBookingConflict = (eventsForDay, hour, minute) => {
    const slotStart = slotToMinutes(hour, minute);
    const slotEnd = slotStart + 60;

    return eventsForDay.some((event) => {
      const timeStr = event.type === "specialist" ? event.startTime : event.appointmentTime;
      const start = parseHHMM(timeStr);
      if (!start) return false;

      const bookingStart = slotToMinutes(start.hour, start.minute);
      const bookingEnd = bookingStart + 60;
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  };

  const formatSlotTime = (hour, minute) =>
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const getSlotEndTime = (hour, minute) => {
    const totalMinutes = slotToMinutes(hour, minute) + 60;
    return formatSlotTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  const openCreateBooking = (date, hour, minute) => {
    const params = new URLSearchParams({
      preferredDate: toYMD(date),
      preferredTime: formatSlotTime(hour, minute),
    });
    navigate(`/early-detection-bookings/create?${params.toString()}`);
  };

  return (
    <div className="edcv2-layout">

      {/* ═══════════════════════════════════════
          LEFT SIDEBAR
      ═══════════════════════════════════════ */}
      <aside className={`edcv2-sidebar${sidebarOpen ? ' edcv2-sidebar--open' : ''}`}>

        {/* Current date chip */}
        <div className="edcv2-current-date">
          <CalendarIcon size={15} />
          <span>{currentDate.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}</span>
          <button className="edcv2-collapse-btn" onClick={() => setSidebarOpen(false)}><ChevronLeft size={15} /></button>
        </div>

        {/* Mini Calendar card */}
        <div className="edcv2-mini-cal">
          {/* Month / Year nav */}
          <div className="edcv2-mini-cal-header">
            <button className="edcv2-nav-btn"
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <ChevronLeft size={15} />
            </button>

            <div className="edcv2-month-year">
              {/* Month selector */}
              <div className="edcv2-selector">
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

              {/* Year selector */}
              <div className="edcv2-selector">
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

          {/* Weekday headers */}
          <div className="edcv2-weekday-row">
            {weekdays.map(wd => <div key={wd} className="edcv2-weekday-lbl">{wd}</div>)}
          </div>

          {/* Day buttons */}
          <div className="edcv2-days-grid">
            {miniDays.map((obj, idx) => {
              const ymd     = toYMD(obj.date);
              const isToday = ymd === todayYMD;
              const isSel   = ymd === selectedYMD;
              const count = obj.current ? (byDay[ymd]?.length || 0) : 0;
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
                  {count > 0 && (
                    <span className="edcv2-day-count">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="edcv2-legend">
          {[
            { key: "confirmed", en: "Confirmed",  ru: "Подтверждено" },
            { key: "completed", en: "Completed",  ru: "Завершено"    },
            { key: "upcoming",  en: "Upcoming",   ru: "Предстоящее"  },
            { key: "cancelled", en: "Cancelled",  ru: "Отменено"     },
          ].map(({ key, en, ru }) => (
            <div key={key} className="edcv2-legend-row">
              <span className="edcv2-legend-dot" style={{ background: statusColor(key) }} />
              <span>{isRu ? ru : en}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ═══════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════ */}
      <div className="edcv2-main">
       <div className="edcv2-scroll-wrapper">
        {/* Column header */}
        <div className="edcv2-col-header">
          <div className="edcv2-time-col-hdr">
            <button
              className={`edcv2-sidebar-toggle${sidebarOpen ? ' edcv2-sidebar-toggle--open' : ''}`}
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle calendar sidebar">
              {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            <Clock size={15} className="edcv2-clock-icon" />
          </div>
        {/* Weekly day columns header */}
          {getWeekDays(currentDate).map((wd, i) => {
            const ymd = toYMD(wd);
            const isToday = ymd === todayYMD;
            const isSel   = ymd === selectedYMD;
            const dayName = wd.toLocaleDateString(locale, { weekday: 'short' }).toUpperCase().slice(0, 3);
            return (
              <div
                key={i}
                className={`edcv2-week-col-hdr${isSel ? ' edcv2-week-col-hdr--selected' : ''}`}
                onClick={() => setCurrentDate(new Date(wd))}
              >
                <span className="edcv2-week-day-name">{dayName}</span>
                <span className={`edcv2-week-day-num${isToday ? ' edcv2-week-day-num--today' : ''}${isSel && !isToday ? ' edcv2-week-day-num--selected' : ''}`}>
                  {wd.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time-slot body */}
        <div className="edcv2-body" style={{ position: 'relative' }}>
          {nowTop >= 0 && (
            <div ref={timeLineRef} className="cal-now-line" style={{ top: `${nowTop}px` }}>
              <span className="cal-now-dot" />
            </div>
          )}
          {/* Time labels column */}
          <div className="edcv2-time-col">
            {TIME_SLOTS.map((slot, i) => (
              <div key={i} className={`edcv2-time-slot${slot.minute === 0 || slot.minute === 30 ? " half" : ""}`}>
                {(slot.minute === 0 || slot.minute === 30) && (
                  <span className="edcv2-time-lbl">{slot.display}</span>
                )}
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {getWeekDays(currentDate).map((wd, di) => {
            const ymd = toYMD(wd);
            const colEvents = byDay[ymd] || [];
            return (
              <div key={di} className="edcv2-slots-col">
                {TIME_SLOTS.map((slot, i) => {
                  const slotEvents = colEvents.filter((event) => {
                    const t = event.type === "specialist" 
                      ? parseHHMM(event.startTime) 
                      : parseHHMM(event.appointmentTime);
                    return t && t.hour === slot.hour && t.minute === slot.minute;
                  });
                  const occupied = colEvents.some((event) => doesBookingOccupySlot(event, slot.hour, slot.minute));
                  const canCreate = !hasBookingConflict(colEvents, slot.hour, slot.minute);
                  const isHovered =
                    canCreate &&
                    hoveredSlot?.dayIndex === di &&
                    hoveredSlot?.hour === slot.hour &&
                    hoveredSlot?.minute === slot.minute;
                  const isInHoverSpan =
                    canCreate &&
                    hoveredSlot?.dayIndex === di &&
                    hoveredSlot?.hour === slot.hour &&
                    slot.minute >= hoveredSlot.minute &&
                    slot.minute < hoveredSlot.minute + 60;
                  return (
                    <div
                      key={i}
                      className={`edcv2-slot${slot.minute === 0 || slot.minute === 30 ? " half" : ""}${isInHoverSpan ? " edcv2-slot--hover-span" : ""}`}
                      style={isHovered ? { cursor: "pointer" } : undefined}
                      onMouseEnter={() => {
                        if (!occupied && canCreate) {
                          setHoveredSlot({ dayIndex: di, hour: slot.hour, minute: slot.minute });
                        }
                      }}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onClick={() => {
                        if (!occupied && isHovered) {
                          openCreateBooking(wd, slot.hour, slot.minute);
                        }
                      }}
                    >
                      {isHovered && !occupied && (
                        <div className="edcv2-create-hover">
                          <span className="edcv2-create-icon">+</span>
                          <span className="edcv2-create-text">
                            {t("calendar.create_appointment") || t("earlyDiagnosis.createNewBooking")}
                          </span>
                          <span className="edcv2-create-time">
                            {formatSlotTime(slot.hour, slot.minute)}&nbsp;&ndash;&nbsp;{getSlotEndTime(slot.hour, slot.minute)}
                          </span>
                        </div>
                      )}
                      {slotEvents.map((event) => {
                        const timeStr = event.type === "specialist" 
                          ? `${event.startTime} - ${event.endTime}` 
                          : event.appointmentTime;
                        const doctorName = event.type === "specialist"
                          ? getFullName(event.doctor)
                          : getFullName(event.patient) || getFullName(event.customer) || "—";
                        const specTitle = event.type === "specialist"
                          ? readNameField(event.title) || "—"
                          : readNameField(event.package?.name) || "—";
                        return (
                          <div
                            key={event._id}
                            className="edcv2-booking-block"
                            style={{ background: statusColor(event.status) }}
                            onClick={() => navigate(`/early-detection-bookings/${event.booking._id}`)}
                          >
                            <div className="edcv2-block-time">{timeStr}</div>
                            <div className="edcv2-block-name">{doctorName}</div>
                            <div className="edcv2-block-pkg">{specTitle}</div>
                            <span className="edcv2-block-pay">{isRu ? ({paid: "Оплачено", pending: "Ожидание", failed: "Ошибка"}[event.payment?.status] || event.payment?.status || "Ожидание") : (event.payment?.status || "pending")}</span>
                          </div>
                        );
                      })}
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

export default EarlyDetectionCalendarView;
