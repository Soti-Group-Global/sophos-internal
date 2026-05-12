import React from "react";
import { User, Calendar, FileText, Clock, Edit2, ChevronsRight, ChevronsLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const EDTabBar = ({ activeTab, setActiveTab, navExpanded, setNavExpanded }) => {
  const { t } = useTranslation();

  const tabs = [
    { key: "patient",            Icon: User,     label: t("earlyDiagnosis.patientInformation") || "Patient details" },
    { key: "appointmentDetails", Icon: Calendar, label: t("earlyDiagnosis.appointmentDetails") || "Appointment Details" },
    { key: "medicalHistory",     Icon: FileText, label: t("earlyDiagnosis.medicalHistory") || "Medical History" },
    { key: "history",            Icon: Clock,    label: t("earlyDiagnosis.historyLogs") || "History" },
    { key: "notes",              Icon: Edit2,    label: t("earlyDiagnosis.internalNotes") || "Notes" },
  ];

  return (
    <div className="edb-tab-bar" role="tablist" aria-label="Booking details tabs">
      {setNavExpanded && (
        <button
          type="button"
          className="edb-tab-toggle"
          onClick={() => setNavExpanded((v) => !v)}
          title={navExpanded ? "Collapse" : "Expand"}
        >
          {navExpanded ? <ChevronsLeft size={15} /> : <ChevronsRight size={15} />}
        </button>
      )}
      {tabs.map(({ key, Icon, label }) => (
        <button
          key={key}
          type="button"
          className={`edb-tab edb-tab--section${activeTab === key ? " active" : ""}`}
          data-label={label}
          onClick={() => setActiveTab(key)}
          aria-label={label}
        >
          <span className="edb-tab-icon">
            <Icon size={20} />
          </span>
          {navExpanded && <span className="edb-tab-label">{label}</span>}
        </button>
      ))}
    </div>
  );
};

export default EDTabBar;
