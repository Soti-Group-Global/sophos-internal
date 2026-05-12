import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import { socket } from "../utils/socket";
import {
  getApplication,
  getAppointmentsByDoctor,
  getEmailFromToken,
  getPatientByPatientId,
  updateApplication,
  updateHistoryForm,
} from "../utils/api";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { FiArrowLeft, FiClock, FiChevronDown, FiChevronUp, FiFolder, FiRepeat, FiVideo, FiSettings } from "react-icons/fi";
import { MdOutlinePerson } from "react-icons/md";
import { LuClipboardList } from "react-icons/lu";
import "./AppointmentDetailsPage.css";
import GeneralInformationTab from "./AppointmentDetails/GeneralInformationTab";
import MedicalHistoryTab from "./AppointmentDetails/MedicalHistoryTab";
import HistoryTab from "./AppointmentDetails/HistoryTab";
import DocumentsTab from "./AppointmentDetails/DocumentsTab";
import FollowUpsTab from "./AppointmentDetails/FollowUpsTab";
import TelemedicineTab from "./AppointmentDetails/TelemedicineTab";
import AppointmentReport from "./AppointmentReport"
import Service from "./Service";


const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatDOB = (dateStr, locale = "en-US") => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const calculateAge = (dateStr) => {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (isNaN(birth)) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 1) {
    const months =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      now.getMonth() -
      birth.getMonth() -
      (now.getDate() < birth.getDate() ? 1 : 0);
    return months < 1 ? `${Math.max(0, now.getDate() - birth.getDate())}d` : `${months}mo`;
  }
  return years;
};

const AppointmentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("appointment_details_page");

  /* Build doctor display name from { firstName:{en,ru}, lastName:{en,ru}, … } */
  const buildDocName = (doc, lang = "en") => {
    if (!doc) return "";
    if (doc.firstName && typeof doc.firstName === "object") {
      const fn = doc.firstName?.[lang] || doc.firstName?.en || "";
      const mn = doc.middleName?.[lang] || doc.middleName?.en || "";
      const ln = doc.lastName?.[lang] || doc.lastName?.en || "";
      return [fn, mn, ln].filter(Boolean).join(" ");
    }
    return "";
  };

  const TABS = [
    { key: "general", label: t("tabs.general"), icon: <MdOutlinePerson size={16} /> },
    { key: "history", label: t("tabs.history"), icon: <FiClock size={15} /> },
    { key: "medical", label: t("tabs.medical"), icon: <LuClipboardList size={15} /> },
    { key: "documents", label: t("tabs.documents"), icon: <FiFolder size={15} /> },
    { key: "followups", label: t("tabs.followups"), icon: <FiRepeat size={15} /> },
    { key: "telemedicine", label: t("tabs.telemedicine"), icon: <FiVideo size={15} /> },
    { key: "service", label: t("tabs.service") || "Service", icon: <FiSettings size={15} /> },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const [application, setApplication] = useState(null);
  const [patient, setPatient] = useState(null);
  const [history] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeTab = searchParams.get("tab") || "general";
  const setActiveTab = (key) => setSearchParams({ tab: key }, { replace: true });
  const [saving, setSaving] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const isFirstLoad = useRef(true);
  const historyTabRef = useRef(null);
  const [patientApps, setPatientApps] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("hide-global-sidebar");
    return () => document.body.classList.remove("hide-global-sidebar");
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (isFirstLoad.current) {
        setLoading(true);
        isFirstLoad.current = false;
      } else {
        setContentLoading(true);
      }
      try {
        const appRes = await getApplication(id);
        const app = appRes.data;
        setApplication(app);

        // Fetch all appointments for this patient for the sidebar
        const email = app?.patientEmail || app?.patient?.email;
        if (email) {
          try {
            const assistantEmail = getEmailFromToken();
            const { appointments: list } = await getAppointmentsByDoctor(
              assistantEmail, 1, 50, "all", "", "", email
            );
            setPatientApps(Array.isArray(list) ? list : []);
          } catch { /* non-critical */ }
        }

        const patientId = app?.patientId || app?.patient?.patientId || app?.patient?._id;
        if (patientId) {
          try {
            const patRes = await getPatientByPatientId(patientId);
            const fullPatient = patRes?.patient || patRes;
            if (fullPatient && (fullPatient.firstName || fullPatient.lastName || fullPatient.email)) {
              setPatient(fullPatient);
            }
          } catch { /* keep embedded patient from app.patient */ }
        } else if (app?.patient) {
          setPatient(app.patient);
        }
      } catch (err) {
        toast.error(t("load_error"));
        console.error(err);
      } finally {
        setLoading(false);
        setContentLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSave = async () => {
    if (!application) return;
    setSaving(true);
    try {
      if (activeTab === "history" && historyTabRef.current) {
        const { historyForm } = historyTabRef.current.getData();
        const res = await updateHistoryForm(application.applicationId, historyForm);
        setApplication((prev) => ({ ...prev, historyForm: res.historyForm ?? historyForm }));
      } else {
        await updateApplication(application.applicationId, {
          appointmentStatus: application.appointmentStatus,
        });
      }
      toast.success(t("save_success"));
    } catch {
      toast.error(t("save_error"));
    } finally {
      setSaving(false);
    }
  };

  /* Real-time socket: update historyForm when another session saves */
  useEffect(() => {
    const handler = ({ applicationId, historyForm }) => {
      if (applicationId === id) {
        setApplication((prev) => ({ ...prev, historyForm }));
      }
    };
    socket.on("application:history-updated", handler);
    return () => socket.off("application:history-updated", handler);
  }, [id]);

  if (loading) return <LoadingComponent message={t("loading")} />;
  if (!application) return <div className="adp-error">{t("appointment_not_found")}</div>;

  const patientDisplayName = patient
    ? [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ").trim() ||
    patient.email ||
    t("unknown_patient")
    : application.patientName || t("unknown_patient");

  const createdAt = formatDate(application.createdAt);
  const dob = formatDOB(patient?.dateOfBirth, i18n.language);
  const age = calculateAge(patient?.dateOfBirth);

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return (
          <GeneralInformationTab
            application={application}
            patient={patient}
            history={history}
            onSave={handleSave}
            saving={saving}
            onSaved={(p) => setPatient(p?.patient || p)}
          />
        );
      case "history":
        return <HistoryTab ref={historyTabRef} application={application} patient={patient} onSaved={(hf) => setApplication((prev) => ({ ...prev, historyForm: hf }))} />;
      case "medical":
        return <MedicalHistoryTab history={history} patient={patient} currentApplicationId={application.applicationId} />;
      case "documents":
        return <DocumentsTab application={application} />;
      case "followups":
        return (
          <FollowUpsTab
            application={application}
            onApplicationUpdate={(updated) => updated && setApplication(updated)}
          />
        );
      case "telemedicine":
        return <TelemedicineTab application={application} />;
      case "report":
        return <AppointmentReport booking={application} />;
      case "service":
        return <Service applicationId={application.applicationId} />;
      default:
        return null;
    }
  };

  return (
    <div className="adp-page">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover />
      <div className="adp-top-header">
        <button className="adp-back-btn" onClick={() => navigate("/appointments")}>
          <FiArrowLeft size={14} />
          <span>{t("back_to_schedule")}</span>
        </button>

        <div className="adp-header-divider" />

        <div className="adp-header-center">
          <div className="adp-header-name-row">
            <h1 className="adp-patient-title">
              {t("patient_label")} <strong>{patientDisplayName}</strong>
            </h1>
          </div>
          <span className="adp-added-date">
            No.{application?.applicationId} &nbsp;·&nbsp; {t("added_to_system")} {createdAt}
          </span>
        </div>

        <div className="adp-header-right">
          <div className="adp-patient-details-strip">
            <div className="adp-patient-detail-item">
              <span className="adp-detail-value">{dob || "—"}</span>
              <span className="adp-detail-label">{t("date_of_birth")}</span>
            </div>
            {age !== null && age !== undefined && (
              <div className="adp-patient-detail-item adp-patient-detail-item--badge">
                <span className="adp-age-badge">{age} y.o.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Left vertical iconic tabs (replace top tab bar visually) */}
      <nav className="apd-vertical-tabs" aria-label="Appointment sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`apd-vert-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            title={tab.label}
            aria-pressed={activeTab === tab.key}
          >
            <span className="apd-vert-icon">{tab.icon}</span>
          </button>
        ))}
      </nav>

      <div className="adp-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`adp-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon && <span className="adp-tab-icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile appointments toggle button */}
      <div className="adp-sidebar-toggle-bar">
        <button
          className="adp-sidebar-toggle-btn"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          {sidebarOpen ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
          {t("sidebar_title")}
        </button>
      </div>

      <div className="adp-body">
        {/* ── Patient Appointments Sidebar ── */}
        <aside className={`adp-app-sidebar${sidebarOpen ? " adp-app-sidebar--open" : ""}`}>
          <div className="adp-app-sidebar-title">
            {t("sidebar_title")}
            <button
              className="adp-sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
            >
              <FiChevronUp size={13} />
            </button>
          </div>
          <div className="adp-app-sidebar-list">
            {patientApps.length === 0 && (
              <div className="adp-app-sidebar-empty">{t("sidebar_empty")}</div>
            )}
            {patientApps.map((app) => {
              const isCurrent = app.applicationId === application?.applicationId || app._id === id;
              const appDate = app.date
                ? new Date(app.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                : "—";
              const status = app.appointmentStatus || app.status || "";
              const statusClass =
                status.toLowerCase().includes("confirm") ? "confirmed" :
                  status.toLowerCase().includes("upcoming") ? "upcoming" :
                    status.toLowerCase().includes("unconfirm") || status.toLowerCase().includes("pending") ? "unconfirmed" :
                      status.toLowerCase().includes("cancel") ? "cancelled" : "default";
              const statusLabel = i18n.t(`application.status.${status.toLowerCase()}`, { ns: "translation", defaultValue: status });
              const lang = i18n.language;
              const doctorName = buildDocName(app.doctorDetails, lang)
                || app.doctors?.[0]?.doctorName
                || app.doctorEmail?.split("@")[0] || "";
              return (
                <button
                  key={app._id || app.applicationId}
                  className={`adp-app-card${isCurrent ? " adp-app-card--active" : ""}`}
                  onClick={() => !isCurrent && navigate(`/appointments/${encodeURIComponent(app.applicationId || app._id)}?tab=general`)}
                >
                  <div className="adp-app-card-top">
                    <span className="adp-app-card-id">#{app.applicationId || app._id?.slice(-6)}</span>
                    <span className={`adp-app-card-status adp-app-card-status--${statusClass}`}>{statusLabel || "—"}</span>
                  </div>
                  <div className="adp-app-card-date">{appDate}</div>
                  {doctorName && <div className="adp-app-card-doctor">{doctorName}</div>}
                  {isCurrent && <div className="adp-app-card-current-label">{t("sidebar_current")}</div>}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="adp-content-scroll" style={{ position: "relative" }}>
          {contentLoading && (
            <div className="adp-content-loading-overlay">
              <div className="adp-content-spinner" />
            </div>
          )}
          <div className="adp-content">{renderTab()}</div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailsPage;
