import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "react-toastify";
import { getEmailFromToken } from "../utils/api";
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
  const doctorEmail = doctorEmailFromState || getEmailFromToken();
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
          <EarlyDetectionMedicalHistory applicationId={id} patientEmail={patientEmail} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="patient-details-container">
      <ToastContainer position="top-right" autoClose={3000} />
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span onClick={() => navigate(-1)} className="breadcrumb-back">
          {t("sidebar.backToEarlyDetection")}
        </span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">{t("sidebar.application")}: {id}</span>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          onClick={() => setActiveTab("application")}
          className={activeTab === "application" ? "tab active" : "tab"}
        >
          {t("sidebar.application")}
        </button>
        <button
          onClick={() => setActiveTab("patient")}
          className={activeTab === "patient" ? "tab active" : "tab"}
        >
          {t("sidebar.personalDetails")}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={activeTab === "history" ? "tab active" : "tab"}
        >
          {t("sidebar.applicationHistory")}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
};

export default EarlyDetectionApplicationDetails;
