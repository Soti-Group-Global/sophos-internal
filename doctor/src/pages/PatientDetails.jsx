import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/PatientDetails.css";
import PatientDetailsTab from "../components/PatientDetails/PatientDetailsTab";
import AppointmentTab from "../components/PatientDetails/AppointmentTab";
import MedicalHistoryTab from "../components/PatientDetails/MedicalHistoryTab";
import DiagnosisTab from "../components/PatientDetails/DiagnosisTab";
import { usePatient } from "../context/PatientContext";
import { useTranslation } from "react-i18next";

const PatientDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentPatient } = usePatient();

  const { appointmentId, activeTab: initialTab } = location.state || {};
  const [activeTab, setActiveTab] = useState(initialTab || "appointment");

  useEffect(() => {
    if (!currentPatient || currentPatient.email !== id) {
      navigate("/patients", { replace: true });
    }
  }, [currentPatient, id, navigate]);

  if (!currentPatient || currentPatient.email !== id) return null;

  const calculateAge = (dob) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const appointments = currentPatient?.appointments || [];

  const selectedAppointment = appointmentId
    ? appointments.find((appt) => appt._id === appointmentId)
    : currentPatient.appointment || appointments[0] || null;

  const patient = {
    ...currentPatient,
    name: `${currentPatient.firstName || ""} ${
      currentPatient.middleName || ""
    } ${currentPatient.lastName || ""}`.trim(),
    age: currentPatient.dateOfBirth
      ? calculateAge(currentPatient.dateOfBirth)
      : t("patientDetails.notAvailable"),
    email: currentPatient.email || t("patientDetails.notAvailable"),
    phone: currentPatient.telephone || t("patientDetails.notAvailable"),
    address: currentPatient.address || t("patientDetails.notAvailable"),
    bloodType: currentPatient.bloodType || t("patientDetails.notAvailable"),
    allergies: currentPatient.allergies || t("patientDetails.notAvailable"),
    gender: currentPatient.gender || t("patientDetails.notAvailable"),
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "appointment":
        return (
          <AppointmentTab appointmentId={appointmentId} patient={patient} />
        );
      case "details":
        return <PatientDetailsTab patient={patient} />;
      case "medical":
        return <MedicalHistoryTab email={patient.email} />;
      default:
        return null;
    }
  };

  return (
    <div className="patient-details-container">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span onClick={() => navigate("/patients")} className="breadcrumb-back">
          ← {t("patientDetails.backToPatients")}
        </span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">{patient.name}</span>
      </div>

      {/* Patient Header */}
      <div className="patient-header">
        <div className="patient-avatar">
          {patient.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <h1 className="patient-title">{patient.name}</h1>
          <div className="patient-meta">
            <span>{t("patientDetails.age")}: {patient.age}</span>
            <span>{t("patientDetails.gender")}: {patient.gender}</span>
          </div>
          <div className="patient-meta">
            <span>{t("patientDetails.email")}: {patient.email}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          onClick={() => setActiveTab("appointment")}
          className={activeTab === "appointment" ? "tab active" : "tab"}
        >
          {t("patientDetails.tabs.appointment")}
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={activeTab === "details" ? "tab active" : "tab"}
        >
          {t("patientDetails.tabs.details")}
        </button>
        <button
          onClick={() => setActiveTab("medical")}
          className={activeTab === "medical" ? "tab active" : "tab"}
        >
          {t("patientDetails.tabs.medicalHistory")}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
};

export default PatientDetails;