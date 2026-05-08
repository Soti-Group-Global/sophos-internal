import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiActivity, FiCalendar, FiUser, FiClock, FiBriefcase } from "react-icons/fi";
import { MdOutlineMedicalServices } from "react-icons/md";
import "./MedicalHistoryTab.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
};

const statusClass = (status = "") => {
  const s = status.toLowerCase();
  if (s.includes("confirm"))                               return "mht-status--confirmed";
  if (s.includes("upcoming"))                              return "mht-status--upcoming";
  if (s.includes("unconfirm") || s.includes("pending"))   return "mht-status--unconfirmed";
  if (s.includes("cancel"))                               return "mht-status--cancelled";
  return "mht-status--default";
};

/* Resolve a name that may be { en, ru } object or a plain string */
const resolveName = (name, lang = "en") => {
  if (!name) return "";
  if (typeof name === "object") return name[lang] || name.en || name.ru || "";
  return name;
};

/* ── Single card ── */
const AppCard = ({ app }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  /* Doctor name: backend enriches doctors[].doctorName as { en, ru } */
  const doctorDisplay = resolveName(app.doctors?.[0]?.doctorName, lang)
    || resolveName(app.doctorName, lang)
    || "";

  const handleClick = () => {
    navigate(`/appointments/${encodeURIComponent(app.applicationId)}`);
  };

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
            <span className={`mht-status-badge ${statusClass(app.appointmentStatus)}`}>
              {t(`application.status.${app.appointmentStatus?.toLowerCase()}`, { defaultValue: app.appointmentStatus })}
            </span>
          </div>
          <div className="mht-card-right">
            {app.serviceType && <span className="mht-info-chip"><FiBriefcase size={10} />{t(`application.service_type.${app.serviceType.toLowerCase().replace(/\s+/g, "_")}`, { defaultValue: app.serviceType })}</span>}
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

      {/* ── Body: doctor ── */}
      {doctorDisplay && (
        <div className="mht-card-body">
          <div className="mht-doctor-row">
            <FiUser size={13} />
            <span>{doctorDisplay}</span>
            {app.serviceType && (
              <span className="mht-doctor-specialty">{t(`application.service_type.${app.serviceType.toLowerCase().replace(/\s+/g, "_")}`, { defaultValue: app.serviceType })}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   MedicalHistoryTab
   Props: { history, patient, currentApplicationId }
══════════════════════════════════════════════ */
const MedicalHistoryTab = ({ history, patient, currentApplicationId }) => {
  const { t } = useTranslation();
  /* Exclude current, sort by date desc */
  const sorted = (history || [])
    .filter((a) => a.applicationId !== currentApplicationId)
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  if (sorted.length === 0) {
    return (
      <div className="adp-empty-state">
        <FiActivity size={40} />
        <p>{t("application.emptyStates.noMedicalHistory.description", "No other appointment records found for this patient.")}</p>
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
          />
        ))}
      </div>
    </div>
  );
};

export default MedicalHistoryTab;
