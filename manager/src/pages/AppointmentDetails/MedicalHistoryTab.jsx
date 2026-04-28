import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiActivity, FiCalendar, FiUser, FiClock, FiBriefcase } from "react-icons/fi";
import { MdOutlineMedicalServices } from "react-icons/md";
import { getApptStatusClass } from "../../utils/appointmentStatus";
import "./MedicalHistoryTab.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
};

const statusClass = (status) => getApptStatusClass(status);

/* Resolve a multilingual field object or plain string */
const getField = (f, lang) => {
  if (!f) return "";
  if (typeof f === "string") return f;
  if (typeof f === "object") return f[lang] || f.ru || f.en || Object.values(f).find(v => typeof v === "string") || "";
  return "";
};

/* ── Single card ── */
const AppCard = ({ app, doctorsMap }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("appointment_details_page");
  const lang = i18n.language?.slice(0, 2) || "ru";

  const handleClick = () => {
    navigate(`/applications/appointment/${encodeURIComponent(app.applicationId)}`);
  };

  const translatedServiceType = app.serviceType
    ? t(`service_types.${app.serviceType}`, app.serviceType)
    : null;

  /* Resolve doctor name from profile schema with language awareness */
  const resolveDoctorName = (d) => {
    const docEmail = d?.doctorEmail;
    const profile = docEmail && doctorsMap ? doctorsMap[docEmail] : null;
    if (profile) {
      const name = [profile.lastName, profile.firstName, profile.middleName]
        .map(f => getField(f, lang))
        .filter(Boolean)
        .join(" ");
      if (name) return name;
    }
    /* Fallback: use embedded doctor object fields */
    if (app.doctor) {
      const name = [app.doctor.lastName, app.doctor.firstName, app.doctor.middleName]
        .map(f => getField(f, lang))
        .filter(Boolean)
        .join(" ");
      if (name) return name;
    }
    return d?.doctorName || "—";
  };

  const doctors = app.doctors?.length
    ? app.doctors
    : app.doctorName ? [{ doctorName: app.doctorName, doctorEmail: app.doctorEmail }] : [];

  return (
    <div className="mht-card mht-card--clickable" onClick={handleClick}>
      {/* ── Header ── */}
      <div className="mht-card-header">

        {/* Row 1: icon + ID + badges | service type */}
        <div className="mht-card-header-top">
          <div className="mht-card-left">
            <div className="mht-card-icon">
              <MdOutlineMedicalServices size={13} />
            </div>
            <span className="mht-app-id">№{app.applicationId}</span>
            <span className={`appt-status-badge ${statusClass(app.appointmentStatus)}`}>
              {t(`statuses.${app.appointmentStatus?.toLowerCase().replace(/\s+/g, "_")}`, app.appointmentStatus)}
            </span>
          </div>
          <div className="mht-card-right">
            {translatedServiceType && <span className="mht-info-chip"><FiBriefcase size={10} />{translatedServiceType}</span>}
          </div>
        </div>

        {/* Row 2: date + time */}
        <div className="mht-card-date-row">
          <FiCalendar size={10} />
          <span>{app.date || formatDate(app.createdAt)}</span>
          {app.startTime && (
            <><span className="mht-divider" /><FiClock size={10} /><span>{app.startTime}</span></>
          )}
        </div>

      </div>

      {/* ── Body: doctors always visible ── */}
      {doctors.length > 0 && (
        <div className="mht-card-body">
          {doctors.map((d, i) => (
            <div key={i} className="mht-doctor-row">
              <FiUser size={13} />
              <span>{resolveDoctorName(d)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   MedicalHistoryTab
   Props: { history, patient, currentApplicationId, doctorsMap }
══════════════════════════════════════════════ */
const MedicalHistoryTab = ({ history, patient, currentApplicationId, doctorsMap }) => {
  const { t } = useTranslation("appointment_details_page");
  /* Exclude current, sort by date desc */
  const sorted = (history || [])
    .filter((a) => a.applicationId !== currentApplicationId)
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  if (sorted.length === 0) {
    return (
      <div className="adp-empty-state">
        <FiActivity size={40} />
        <p>{t("empty_archive")}</p>
      </div>
    );
  }

  return (
    <div className="mht-wrapper">
      <div className="mht-grid">
        {sorted.map((app) => (
          <AppCard
            key={app._id || app.applicationId}
            app={app}
            doctorsMap={doctorsMap}
          />
        ))}
      </div>
    </div>
  );
};

export default MedicalHistoryTab;
