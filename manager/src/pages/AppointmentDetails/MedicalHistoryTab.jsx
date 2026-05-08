import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiActivity, FiCalendar, FiUser, FiClock, FiBriefcase, FiSettings, FiChevronDown } from "react-icons/fi";
import { MdOutlineMedicalServices } from "react-icons/md";
import { getApptStatusClass } from "../../utils/appointmentStatus";
import "./MedicalHistoryTab.css";

/* index 0 → chevron, 1–2 → gear, rest → none */
const sectionIcon = (index) => index === 0 ? "chevron" : index <= 2 ? "settings" : null;

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
};

const getField = (f, lang) => {
  if (!f) return "";
  if (typeof f === "string") return f;
  if (typeof f === "object") return f[lang] || f.ru || f.en || Object.values(f).find(v => typeof v === "string") || "";
  return "";
};

/* ── Single history card ── */
const AppCard = ({ app, doctorsMap }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("appointment_details_page");
  const lang = i18n.language?.slice(0, 2) || "ru";

  const translatedServiceType = app.serviceType
    ? t(`service_types.${app.serviceType}`, app.serviceType)
    : null;

  const resolveDoctorName = (d) => {
    const docEmail = d?.doctorEmail;
    const profile = docEmail && doctorsMap ? doctorsMap[docEmail] : null;
    if (profile) {
      const name = [profile.lastName, profile.firstName, profile.middleName]
        .map(f => getField(f, lang)).filter(Boolean).join(" ");
      if (name) return name;
    }
    if (app.doctor) {
      const name = [app.doctor.lastName, app.doctor.firstName, app.doctor.middleName]
        .map(f => getField(f, lang)).filter(Boolean).join(" ");
      if (name) return name;
    }
    return d?.doctorName || "—";
  };

  const doctors = app.doctors?.length
    ? app.doctors
    : app.doctorName ? [{ doctorName: app.doctorName, doctorEmail: app.doctorEmail }] : [];

  return (
    <div
      className="mht-card mht-card--clickable"
      onClick={() => navigate(`/applications/appointment/${encodeURIComponent(app.applicationId)}`)}
    >
      <div className="mht-card-header">
        <div className="mht-card-header-top">
          <div className="mht-card-left">
            <div className="mht-card-icon">
              <MdOutlineMedicalServices size={13} />
            </div>
            <span className="mht-app-id">№{app.applicationId}</span>
            <span className={`appt-status-badge ${getApptStatusClass(app.appointmentStatus)}`}>
              {t(`statuses.${app.appointmentStatus?.toLowerCase().replace(/\s+/g, "_")}`, app.appointmentStatus)}
            </span>
          </div>
          {translatedServiceType && (
            <div className="mht-card-right">
              <span className="mht-info-chip"><FiBriefcase size={10} />{translatedServiceType}</span>
            </div>
          )}
        </div>

        <div className="mht-card-date-row">
          <FiCalendar size={10} />
          <span>{app.date || formatDate(app.createdAt)}</span>
          {app.startTime && (
            <><span className="mht-date-divider" /><FiClock size={10} /><span>{app.startTime}</span></>
          )}
        </div>
      </div>

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
══════════════════════════════════════════════ */
const MedicalHistoryTab = ({ history, currentApplicationId, doctorsMap }) => {
  const { t } = useTranslation("appointment_details_page");

  const sorted = (history || [])
    .filter((a) => a.applicationId !== currentApplicationId)
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  const sectionMap = {};
  sorted.forEach((app) => {
    const key = app.serviceType || "general";
    if (!sectionMap[key]) sectionMap[key] = [];
    sectionMap[key].push(app);
  });

  const sectionKeys = Object.keys(sectionMap);
  const [activeSection, setActiveSection] = useState(sectionKeys[0] || null);

  if (sorted.length === 0) {
    return (
      <div className="mht-empty-state">
        <FiActivity size={40} />
        <p>{t("empty_archive")}</p>
      </div>
    );
  }

  const visibleApps = sectionMap[activeSection] || [];

  return (
    <div className="mht-layout">
      {/* ── Sub-sidebar ── */}
      <aside className="mht-subnav">
        {sectionKeys.map((key, index) => {
          const isActive = key === activeSection;
          const label = t(`service_types.${key}`, key);
          const icon = sectionIcon(index);
          return (
            <button
              key={key}
              className={`mht-subnav-item${isActive ? " mht-subnav-item--active" : ""}`}
              onClick={() => setActiveSection(key)}
            >
              <span className="mht-subnav-label">{label}</span>
              {icon === "chevron"  && <FiChevronDown size={13} className="mht-subnav-icon" />}
              {icon === "settings" && <FiSettings    size={13} className="mht-subnav-icon" />}
            </button>
          );
        })}
      </aside>

      {/* ── Content area ── */}
      <div className="mht-content">
        <div className="mht-cards-grid">
          {visibleApps.map((app) => (
            <AppCard
              key={app._id || app.applicationId}
              app={app}
              doctorsMap={doctorsMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MedicalHistoryTab;
