import React, { useState, useEffect } from "react";
import {
  FaMars,
  FaVenus,
  FaPhoneAlt,
  FaWhatsapp,
  FaPlus,
  FaTh,
  FaList,
  FaExternalLinkAlt,
  FaFilePdf,
  FaFileCsv,
  FaTrash,
} from "react-icons/fa";
import PatientExportPDFModal from "../components/Patients/PatientExportPDFModal";
import { CiEdit } from "react-icons/ci";
import { IoMail } from "react-icons/io5";
import { PiTelegramLogo } from "react-icons/pi";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { toast } from "react-toastify";
import "../styles/Patients.css";
import { useNavigate } from "react-router-dom";
import { getPatients, sendPatientEmail, deletePatient } from "../utils/api";
import WhatsAppChatBot from "./WhatsAppChatBot";
import TelegramChatBot from "./TelegramChatBot";
import LoadingComponent from "../components/Loading/LoadingComponent";
import SearchBar from "../components/SearchBar/SearchBar";

const Patients = () => {
  const { t } = useTranslation("patients");
  const [layout, setLayout] = useState("Compact");
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [chatPatient, setChatPatient] = useState(null);
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [showTelegramChat, setShowTelegramChat] = useState(false);
  const [exportModalPatients, setExportModalPatients] = useState(null); // null = closed
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await getPatients();
        const patientsList = Array.isArray(response) ? response : [];
        setPatients(patientsList);
        setFilteredPatients(patientsList);
        setLoading(false);
      } catch (err) {
        setError(t("error_fetch"));
        setLoading(false);
      }
    };
    fetchPatients();
  }, [t]);

  useEffect(() => {
    const filtered = patients.filter((patient) => {
      const fullName = [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const email = patient.email || "";
      const phone = patient.phoneNumber || "";
      const searchLower = searchQuery.toLowerCase();

      return (
        fullName.includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        phone.toLowerCase().includes(searchLower)
      );
    });
    setFilteredPatients(filtered);
  }, [searchQuery, patients]);

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return t("unknown_age");
    const dob = new Date(dateOfBirth);
    if (isNaN(dob)) return t("unknown_age");
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return `${age} ${t("years")}`;
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const exportPatientsAsCsv = () => {
    if (!filteredPatients.length) {
      toast.error("No patients to export");
      return;
    }

    const headers = Array.from(
      filteredPatients.reduce((keys, patient) => {
        Object.keys(patient || {}).forEach((key) => {
          keys.add(key);
        });
        return keys;
      }, new Set())
    );

    const normalizeValue = (value) => {
      if (value == null) return "";

      if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item)).filter(Boolean).join(" | ");
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      if (typeof value === "object") {
        const namedParts = [
          value.lastName,
          value.firstName,
          value.middleName,
        ].filter(Boolean);

        if (namedParts.length) {
          return namedParts.join(" ");
        }

        return Object.entries(value)
          .filter(([, nestedValue]) => nestedValue != null && nestedValue !== "")
          .map(([key, nestedValue]) => `${key}: ${normalizeValue(nestedValue)}`)
          .join("; ");
      }

      return String(value);
    };

    const escapeCsv = (value) => `"${normalizeValue(value).replace(/"/g, '""')}"`;
    const rows = [
      headers.map(escapeCsv).join(","),
      ...filteredPatients.map((patient) =>
        headers.map((header) => escapeCsv(patient?.[header])).join(",")
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patients_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleWhatsAppClick = (patient) => {
    if (!patient.phoneNumber) {
      toast.error(t("no_phone"));
      return;
    }
    setChatPatient(patient);
    setShowWhatsAppChat(true);
  };

  const handleTelegramClick = (patient) => {
    if (!patient.phoneNumber) {
      toast.error(t("no_phone"));
      return;
    }
    setChatPatient(patient);
    setShowTelegramChat(true);
  };

  const handleEmailClick = (patient) => {
    if (!patient.email) {
      toast.error(t("no_email"));
      return;
    }
    setChatPatient(patient);
    setEmailRecipient(patient.email);
    setEmailSubject("");
    setEmailBody("");
    setEmailError("");
    setShowEmailPopup(true);
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await deletePatient(patient._id);
      setPatients((prev) => prev.filter((p) => p._id !== patient._id));
      toast.success(t("delete_success"));
    } catch {
      toast.error(t("delete_failed"));
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipient || !emailSubject.trim() || !emailBody.trim()) {
      setEmailError(t("email_fields_required"));
      toast.error(t("email_fields_required"));
      return;
    }
    setEmailLoading(true);
    try {
      await sendPatientEmail(chatPatient._id, {
        to: emailRecipient,
        subject: emailSubject,
        body: emailBody,
      });
      setShowEmailPopup(false);
      setEmailRecipient("");
      setEmailSubject("");
      setEmailBody("");
      setChatPatient(null);
      toast.success(t("email_sent"));
    } catch (error) {
      setEmailError(error.response?.data?.message || t("email_failed"));
      toast.error(error.response?.data?.message || t("email_failed"));
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const renderActionIcons = (patient) => (
    <>
      <button
        className="action-icon-i phone-icon"
        title={t("phone")}
        onClick={(e) => { e.stopPropagation(); window.open(`tel:${patient.phoneNumber}`); }}
      >
        <FaPhoneAlt />
      </button>
      <button
        className="action-icon-i email-icon"
        title={t("email")}
        onClick={(e) => { e.stopPropagation(); handleEmailClick(patient); }}
      >
        <IoMail />
      </button>
      <button
        className="action-icon-i whatsapp-icon"
        title={t("whatsapp")}
        onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(patient); }}
      >
        <FaWhatsapp />
      </button>
      <button
        className="action-icon-i telegram-icon"
        title={t("telegram")}
        onClick={(e) => { e.stopPropagation(); handleTelegramClick(patient); }}
      >
        <PiTelegramLogo />
      </button>
    </>
  );

  const renderPatientCard = (patient) => {
    const genderIcon =
      patient.gender === "Male" ? (
        <FaMars className="gender-icon male" />
      ) : (
        <FaVenus className="gender-icon female" />
      );

    const fullName = [patient.firstName, patient.middleName, patient.lastName]
      .filter(Boolean)
      .join(" ");

    const avatarInitials = fullName
      .split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    if (layout === "Compact") {
      return (
        <div key={patient._id} className="patient-card compact-card">
          <div className="patient-card-header">
            <div className="patient-info">
              <div className="patient-profile-avatar large">
                <span>{avatarInitials}</span>
                <div className="gender-badge">{genderIcon}</div>
              </div>
              <div className="patient-details">
                <h3
                  className="patient-name"
                  onClick={() => navigate(`/patients/edit/${patient._id}`)}
                >
                  {fullName}
                  <CiEdit className="edit-icon" />
                </h3>
                <div className="patient-meta">
                  <span className="age-badge">{calculateAge(patient.dateOfBirth)}</span>
                  <span className="email-text">{patient.email}</span>
                </div>
              </div>
            </div>

            <div className="action-icons">
              {renderActionIcons(patient)}

              <button
                className="action-icon-i"
                title="Export as PDF"
                onClick={(e) => { e.stopPropagation(); setExportModalPatients([patient]); }}
              >
                <FaFilePdf size={13} />
              </button>

              <button
                className="action-icon-i"
                onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.patientId}`); }}
                title={t("view_details")}
              >
                <FaExternalLinkAlt size={13} />
              </button>

              <button
                className="action-icon-i action-icon-delete"
                title={t("delete_patient")}
                onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient); }}
              >
                <FaTrash size={13} />
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div key={patient._id} className="patient-card expanded-card" onClick={() => navigate(`/patients/${patient.patientId}`)} style={{ cursor: 'pointer' }}>
          <div className="patient-card-content">
            <div className="patient-profile-avatar large">
              <span>{avatarInitials}</span>
              <div className="gender-badge large">{genderIcon}</div>
            </div>
            <div className="patient-info">
              <h3
                className="patient-name"
                onClick={(e) => { e.stopPropagation(); navigate(`/patients/edit/${patient._id}`); }}
              >
                {fullName} <CiEdit className="edit-icon" />
              </h3>
              <div className="action-icons">
                {renderActionIcons(patient)}
                <button
                  className="action-icon-i"
                  title="Export as PDF"
                  onClick={(e) => { e.stopPropagation(); setExportModalPatients([patient]); }}
                >
                  <FaFilePdf size={13} />
                </button>
                <button
                  className="action-icon-i action-icon-delete"
                  title={t("delete_patient")}
                  onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient); }}
                >
                  <FaTrash size={13} />
                </button>
              </div>
              <div className="patient-stats">
                <div className="stat">
                  <span className="stat-label">{t("email")}</span>
                  <span className="stat-value">{patient.email}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">{t("phone")}</span>
                  <span className="stat-value">{patient.phoneNumber}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  if (loading) {
    return <LoadingComponent message={t("loading_patients")} />;
  }

  return (
    <div className="patients-page">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="patient-page-title">{t("title")}</h1>
          <p className="page-subtitle">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => navigate("/patients/add")}
          className="add-patient-btn"
        >
          <FaPlus />
          {t("add_new_patient")}
        </button>
      </div>

      <div className="patients-toolbar">
        <div className="search-section">
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t("search_placeholder")}
            size="md"
          />
        </div>

        <div className="view-controls">
          <div className="layout-switcher">
            <button
              onClick={() => setLayout("Compact")}
              className={clsx("layout-btn", layout === "Compact" && "active")}
              title={t("list_view")}
            >
              <FaList />
            </button>
            <button
              onClick={() => setLayout("Expanded")}
              className={clsx("layout-btn", layout === "Expanded" && "active")}
              title={t("grid_view")}
            >
              <FaTh />
            </button>
          </div>

          {/* Export all filtered patients */}
          <button
            className="patient-export-all-btn"
            title="Export as CSV"
            onClick={exportPatientsAsCsv}
          >
            <FaFileCsv />
          </button>

          <div className="results-count">
            {filteredPatients.length} {t("of")} {patients.length} {t("patients")}
          </div>
        </div>
      </div>

      <div className={clsx("patients-container", layout.toLowerCase())}>
        {error ? (
          <div className="error-state">
            <p>{t("error_loading")}: {error}</p>
          </div>
        ) : filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => renderPatientCard(patient))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>{t("no_patients")}</h3>
            <p>
              {searchQuery
                ? t("no_results_search")
                : t("no_results_add_first")}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate("/patients/add")}
                className="add-patient-btn"
              >
                <FaPlus />
                {t("add_first_patient")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Email Popup */}
      {showEmailPopup && (
        <div className="modal-overlay">
          <div className="email-modal">
            <div className="modal-header">
              <h2>{t("send_email")}</h2>
              <button
                className="email-close-btn"
                onClick={() => setShowEmailPopup(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("to")}:</label>
                <input
                  type="email"
                  value={emailRecipient}
                  readOnly
                  className="form-input readonly"
                />
              </div>
              <div className="form-group">
                <label>{t("subject")}:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t("email_subject_placeholder")}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>{t("message")}:</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={t("email_body_placeholder")}
                  className="form-textarea"
                  rows={6}
                />
              </div>
              {emailError && <div className="error-message">{emailError}</div>}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowEmailPopup(false)}
                className="btn-secondary"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailLoading}
                className="btn-primary"
              >
                {emailLoading ? t("sending") : t("send_email_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Components */}
      {showWhatsAppChat && chatPatient && (
        <WhatsAppChatBot
          isOpen={showWhatsAppChat}
          onClose={() => setShowWhatsAppChat(false)}
          phoneNumber={chatPatient.phoneNumber.replace("@c.us", "")}
          profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_WHATSAPP}
        />
      )}

      {showTelegramChat && chatPatient && (
        <TelegramChatBot
          isOpen={showTelegramChat}
          onClose={() => setShowTelegramChat(false)}
          phoneNumber={chatPatient.phoneNumber}
          profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_TELEGRAM}
        />
      )}

      {exportModalPatients && (
        <PatientExportPDFModal
          patients={exportModalPatients}
          onClose={() => setExportModalPatients(null)}
        />
      )}
    </div>
  );
};

export default Patients;
