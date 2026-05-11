import { User, Calendar, FileText, Clock, Edit2, ChevronsRight, ChevronsLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getApptStatusClass } from "../../utils/appointmentStatus";

const EDIconSidebar = ({
  activeTab,
  setActiveTab,
  patientBookings,
  selectedBookingId,
  setSelectedBookingId,
  formatDate,
  normalizeId,
  navExpanded,
  setNavExpanded,
}) => {
  const { t } = useTranslation();

  const tabs = [
    { key: "patient",            Icon: User,     label: t("earlyDiagnosis.patientInformation", "Patient details") },
    { key: "appointmentDetails", Icon: Calendar, label: t("earlyDiagnosis.appointmentDetails", "Appointment Details") },
    { key: "medicalHistory",     Icon: FileText, label: t("earlyDiagnosis.medicalHistory", "Medical History") },
    { key: "history",            Icon: Clock,    label: t("earlyDiagnosis.historyLogs", "History") },
    { key: "notes",              Icon: Edit2,    label: t("earlyDiagnosis.internalNotes", "Notes") },
  ];

  return (
    <aside className={`ed-appointments-sidebar adp-app-sidebar${navExpanded ? " ed-appointments-sidebar--expanded" : ""}`}>
      <div className="ed-appointments-sidebar-tabs">
        <button
          type="button"
          className="ed-sidebar-nav-toggle"
          onClick={() => setNavExpanded((v) => !v)}
          title={navExpanded ? "Collapse" : "Expand"}
        >
          {navExpanded ? <ChevronsLeft size={15} /> : <ChevronsRight size={15} />}
        </button>
        {tabs.map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            className={`ed-appointments-sidebar-tab ${activeTab === key ? "active" : ""}`}
            onClick={() => setActiveTab(key)}
            title={navExpanded ? undefined : label}
            aria-label={label}
          >
            <span className="ed-appointments-sidebar-tab-icon"><Icon size={18} /></span>
            {navExpanded && <span className="ed-sidebar-tab-label">{label}</span>}
          </button>
        ))}
      </div>

      <div className="ed-appointments-sidebar-list adp-app-sidebar-list">
        {patientBookings.length === 0 ? (
          <div className="ed-appointments-sidebar-empty adp-app-sidebar-empty">
            {t("earlyDiagnosis.noAppointments", "No appointments")}
          </div>
        ) : (
          patientBookings.map((item) => {
            const itemId = normalizeId(item?._id);
            const isCurrent = itemId && itemId === normalizeId(selectedBookingId);
            const bookingRef = item?.invoiceNumber || item?.bookingNumber || item?._id?.slice(-6) || "-";
            const statusLabel = {
              confirmed: t("earlyDiagnosis.confirmed"),
              pending: t("earlyDiagnosis.pendingStatus"),
              cancelled: t("earlyDiagnosis.cancelled"),
              completed: t("earlyDiagnosis.completed"),
            }[String(item?.status || "").toLowerCase()] || item?.status || "-";
            return (
              <button
                key={itemId || bookingRef}
                type="button"
                className={`adp-app-card${isCurrent ? " adp-app-card--active" : ""}`}
                onClick={() => { if (!isCurrent && itemId) setSelectedBookingId(itemId); }}
              >
                <div className="adp-app-card-top">
                  <span className="adp-app-card-id">#{bookingRef}</span>
                  <span className={`appt-status-badge ${getApptStatusClass(item?.status)}`}>{statusLabel}</span>
                </div>
                <div className="adp-app-card-date">{formatDate(item?.appointmentDate || item?.createdAt)}</div>
                {isCurrent && <div className="adp-app-card-current-label">{t("sidebar_current", "Current")}</div>}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default EDIconSidebar;
