import { User, Calendar, FileText, Clock, Edit2, ChevronsRight, ChevronsLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const EDIconSidebar = ({ activeTab, setActiveTab, navExpanded, setNavExpanded }) => {
  const { t } = useTranslation();

  const tabs = [
    { key: "patient",            Icon: User,     label: t("earlyDiagnosis.patientInformation", "Patient details") },
    { key: "appointmentDetails", Icon: Calendar, label: t("earlyDiagnosis.appointmentDetails", "Appointment Details") },
    { key: "medicalHistory",     Icon: FileText, label: t("earlyDiagnosis.medicalHistory", "Medical History") },
    { key: "history",            Icon: Clock,    label: t("earlyDiagnosis.historyLogs", "History") },
    { key: "notes",              Icon: Edit2,    label: t("earlyDiagnosis.internalNotes", "Notes") },
  ];

  return (
    <aside className={`ed-appointments-sidebar${navExpanded ? " ed-appointments-sidebar--expanded" : ""}`}>
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
            className={`ed-appointments-sidebar-tab${activeTab === key ? " active" : ""}`}
            onClick={() => setActiveTab(key)}
            title={navExpanded ? undefined : label}
            aria-label={label}
          >
            <span className="ed-appointments-sidebar-tab-icon"><Icon size={18} /></span>
            {navExpanded && <span className="ed-sidebar-tab-label">{label}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default EDIconSidebar;
