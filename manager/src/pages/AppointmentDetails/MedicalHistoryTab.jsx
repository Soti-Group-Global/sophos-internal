import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiActivity, FiCalendar, FiUser, FiClock, FiBriefcase } from "react-icons/fi";
import { MdOutlineMedicalServices } from "react-icons/md";
import { getApptStatusClass } from "../../utils/appointmentStatus";
import "./MedicalHistoryTab.css";


const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
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
          <span>{formatDate(app.date || app.createdAt)}</span>
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

  if (sorted.length === 0) {
    return (
      <div className="mht-empty-state">
        <FiActivity size={40} />
        <p>{t("empty_archive")}</p>
      </div>
    );
  }
  

  return (
    <div className="mht-layout">
      {/* ── Content area ── */}
      <div className="mht-content">
        <div className="mht-cards-grid">
          {sorted.map((app) => (
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
