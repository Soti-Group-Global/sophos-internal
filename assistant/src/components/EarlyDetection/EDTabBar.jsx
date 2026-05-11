import React from "react";
import { User, Calendar, FileText, Clock, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Horizontal top tab bar for the Early Detection Booking Details page
 * (assistant interface uses a tab bar rather than the icon sidebar).
 *
 * Props:
 *   activeTab    – current tab key string
 *   setActiveTab – setter
 */
const EDTabBar = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();

  return (
    <div className="edb-tab-bar" role="tablist" aria-label="Booking details tabs">
      <button
        type="button"
        className={`edb-tab ${activeTab === "patient" ? "active" : ""}`}
        data-label={t("earlyDiagnosis.patientInformation") || "Patient details"}
        onClick={() => setActiveTab("patient")}
      >
        <span className="edb-tab-icon">
          <User size={15} />
        </span>
        {t("earlyDiagnosis.patientInformation") || "Patient details"}
      </button>

      <button
        type="button"
        className={`edb-tab edb-tab--section ${activeTab === "appointmentDetails" ? "active" : ""}`}
        data-label={t("earlyDiagnosis.appointmentDetails") || "Appointment Details"}
        onClick={() => setActiveTab("appointmentDetails")}
      >
        <span className="edb-tab-icon">
          <Calendar size={15} />
        </span>
        {t("earlyDiagnosis.appointmentDetails") || "Appointment Details"}
      </button>

      <button
        type="button"
        className={`edb-tab edb-tab--section ${activeTab === "medicalHistory" ? "active" : ""}`}
        data-label={t("earlyDiagnosis.medicalHistory") || "Medical History"}
        onClick={() => setActiveTab("medicalHistory")}
      >
        <span className="edb-tab-icon">
          <FileText size={15} />
        </span>
        {t("earlyDiagnosis.medicalHistory") || "Medical History"}
      </button>

      <button
        type="button"
        className={`edb-tab edb-tab--section ${activeTab === "history" ? "active" : ""}`}
        data-label={t("earlyDiagnosis.historyLogs") || "History"}
        onClick={() => setActiveTab("history")}
      >
        <span className="edb-tab-icon">
          <Clock size={15} />
        </span>
        {t("earlyDiagnosis.historyLogs") || "History"}
      </button>

      <button
        type="button"
        className={`edb-tab edb-tab--section ${activeTab === "notes" ? "active" : ""}`}
        data-label={t("earlyDiagnosis.internalNotes") || "Notes"}
        onClick={() => setActiveTab("notes")}
      >
        <span className="edb-tab-icon">
          <Edit2 size={15} />
        </span>
        {t("earlyDiagnosis.internalNotes") || "Notes"}
      </button>
    </div>
  );
};

export default EDTabBar;
