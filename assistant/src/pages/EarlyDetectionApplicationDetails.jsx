import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import EarlyDetectionApplicationDetail from "../components/EarlyDetectionTabs/EarlyDetectionApplicationDetail";
import EarlyDetectionPatientDetails from "../components/EarlyDetectionTabs/EarlyDetectionPatientDetails";
import EarlyDetectionMedicalHistory from "../components/EarlyDetectionTabs/EarlyDetectionMedicalHistory";
import "../styles/PatientDetails.css";

const EarlyDetectionApplicationDetails = () => {
  const { t } = useTranslation();
  const { applicationId } = useParams();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { doctorEmail: doctorEmailFromState } = location.state || {};
  const { patientEmail: patientEmailFromState } = location.state || {};
  const doctorEmail = doctorEmailFromState;

  const patientEmail = patientEmailFromState;

 

  const [activeTab, setActiveTab] = useState("application");

  useEffect(() => {
    if (!id || !doctorEmail) {
      navigate("/early-detection", { replace: true });
    }
  }, [applicationId, doctorEmail, navigate]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "application":
        return (
          <EarlyDetectionApplicationDetail
            applicationId={applicationId}
            doctorEmail={doctorEmail}
          />
        );
      case "patient":
        return (
          <EarlyDetectionPatientDetails
            applicationId={id}
            patientEmail={patientEmail}
          />
        );
      case "history":
        return (
          <EarlyDetectionMedicalHistory
            applicationId={id}
            patientEmail={patientEmail}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="patient-details-container">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span onClick={() => navigate(-1)} className="breadcrumb-back">
          {t("EarlyDetectionApplications.earlyDetection")}
        </span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">{t("EarlyDetectionApplications.application")}: {id}</span>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          onClick={() => setActiveTab("application")}
          className={activeTab === "application" ? "tab active" : "tab"}
        >
          {t("EarlyDetectionApplications.applications")}
        </button>
        <button
          onClick={() => setActiveTab("patient")}
          className={activeTab === "patient" ? "tab active" : "tab"}
        >
          {t("EarlyDetectionApplications.patientDetails")}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={activeTab === "history" ? "tab active" : "tab"}
        >
          {t("EarlyDetectionApplications.appointmentHistory")}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
};

export default EarlyDetectionApplicationDetails;
