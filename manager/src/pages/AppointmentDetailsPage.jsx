import React, { useState, useEffect, useRef } from "react";
import { useLayoutEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import {
  getApplication,
  getApplications,
  getPatientByEmail,
  getMedicalHistoryByEmail,
  updateApplication,
  updateHistoryForm,
  getAllDoctorsProfiles,
} from "../utils/api";
import { getApptStatusClass } from "../utils/appointmentStatus";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { FiArrowLeft, FiClock, FiCreditCard, FiChevronDown, FiChevronUp, FiFolder, FiRepeat, FiVideo, FiSettings } from "react-icons/fi";
import { MdOutlinePerson } from "react-icons/md";
import { LuClipboardList } from "react-icons/lu";
import "./AppointmentDetailsPage.css";
import { useLayoutTopBar } from "../context/LayoutTopBarContext";
import GeneralInformationTab from "./AppointmentDetails/GeneralInformationTab";
import MedicalHistoryTab from "./AppointmentDetails/MedicalHistoryTab";
import HistoryTab from "./AppointmentDetails/HistoryTab";
import PaymentsTab from "./AppointmentDetails/PaymentsTab";
import DocumentsTab from "./AppointmentDetails/DocumentsTab";
import FollowUpsTab from "./AppointmentDetails/FollowUpsTab";
import TelemedicineTab from "./AppointmentDetails/TelemedicineTab";
import ComingSoonTab from "./AppointmentDetails/ComingSoonTab";
import AppointmentReport from "../pages/AppointmentReport";
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

const formatDOB = (dateStr, locale = "ru") => {
  if (!dateStr) return null;
  try {
    const localeMap = { en: "en-US", ru: "ru-RU" };
    const resolvedLocale = localeMap[locale?.slice(0, 2)] || locale || "ru-RU";
    return new Date(dateStr).toLocaleDateString(resolvedLocale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const AppointmentDetailsSystemHeader = ({
  t,
  navigate,
  loading,
  patientDisplayName,
  applicationId,
  createdAt,
  dob,
}) => (
  <div className="adp-top-header adp-top-header--system">
    <button className="adp-back-btn" onClick={() => navigate(-1)}>
      <FiArrowLeft size={14} />
      <span>{loading ? t("loading") : t("back_to_schedule")}</span>
    </button>

    <div className="adp-header-divider" />

    <div className="adp-header-center">
      <div className="adp-header-name-row">
        <h1 className="adp-patient-title">
          {loading ? (
            t("loading")
          ) : (
            <>
              {t("patient_label")} <strong>{patientDisplayName}</strong>
            </>
          )}
        </h1>
        {!loading && <span className="adp-status-badge-header">{t("status_active")}</span>}
      </div>
      {!loading && (
        <span className="adp-added-date">
          {t("app_id_prefix")}
          {applicationId} &nbsp;·&nbsp; {t("added_to_system")} {createdAt}
        </span>
      )}
    </div>

    {!loading && dob && (
      <div className="adp-header-right">
        <span className="adp-dob-value">{dob}</span>
        <span className="adp-dob-label">{t("date_of_birth")}</span>
      </div>
    )}
  </div>
);

const AppointmentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("appointment_details_page");
  const { setTopBarContent } = useLayoutTopBar();

  const TABS = [
    { key: "general",   label: t("tabs.general"),   icon: <MdOutlinePerson size={18} /> },
    { key: "history",   label: t("tabs.history"),   icon: <FiClock size={17} /> },
    { key: "medical",   label: t("tabs.medical"),   icon: <LuClipboardList size={17} /> },
    { key: "payments",  label: t("tabs.payments"),  icon: <FiCreditCard size={17} /> },
    { key: "documents", label: t("tabs.documents", "Documents"), icon: <FiFolder size={17} /> },
    // { key: "telemedicine", label: t("tabs.telemedicine", "Telemedicine"), icon: <FiVideo size={17} /> },
    { key: "followups", label: t("tabs.followups", "Follow-ups"), icon: <FiRepeat size={17} /> },
    { key:"service", label: t("tabs.service", "Service"), icon: <FiSettings size={17} /> }
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const [application, setApplication] = useState(null);
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeTab = searchParams.get("tab") || "general";
  const setActiveTab = (key) => setSearchParams({ tab: key }, { replace: true });
  const [saving, setSaving] = useState(false);
  const [pageSaving, setPageSaving] = useState(false);
  const historyTabRef = useRef(null);
  const generalTabRef = useRef(null);
  const [patientApps, setPatientApps] = useState([]);
  const [doctorsMap, setDoctorsMap] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const prevPatientEmailRef = useRef(null);

  useEffect(() => {
    // Hide global app sidebar to give room for the left iconic tabs
    document.body.classList.add("hide-global-sidebar");
    return () => document.body.classList.remove("hide-global-sidebar");
  }, []);

  const saveCurrentTabData = async () => {
    if (activeTab === "general") {
      await generalTabRef.current?.saveAll?.();
      return;
    }
    await handleSave();
  };

  useEffect(() => {
    const isInitialLoad = prevPatientEmailRef.current === null;

    const fetchData = async () => {
      // Only show full-page loading on the very first load
      if (isInitialLoad) setLoading(true);

      try {
        const appRes = await getApplication(id);
        const app = appRes.data;
        setApplication(app);

        const email = app?.patientEmail || app?.patient?.email;
        const samePatient = !isInitialLoad && email === prevPatientEmailRef.current;

        if (!samePatient) {
          // New patient (or first load) — fetch all patient-related data
          prevPatientEmailRef.current = email ?? null;

          // Fetch all appointments for this patient for the sidebar
          if (email) {
            try {
              const appsRes = await getApplications({ patientEmail: email, limit: 50 });
              const list = appsRes?.data?.applications || appsRes?.data || [];
              setPatientApps(Array.isArray(list) ? list : []);
            } catch { /* non-critical */ }

            try {
              const profiles = await getAllDoctorsProfiles({ limit: 500 });
              const profileList = profiles?.data || profiles || [];
              const map = {};
              profileList.forEach(p => { if (p.email) map[p.email] = p; });
              setDoctorsMap(map);
            } catch { /* non-critical */ }
          }

          if (app?.patient) {
            setPatient(app.patient);
          }

          if (email) {
            try {
              const patRes = await getPatientByEmail(email);
              const fullPatient = patRes?.patient || patRes;
              if (fullPatient && (fullPatient.firstName || fullPatient.lastName || fullPatient.email)) {
                setPatient(fullPatient);
              }
            } catch {
              /* keep basic patient from app.patient */
            }

            try {
              const histRes = await getMedicalHistoryByEmail(email);
              setHistory(Array.isArray(histRes) ? histRes : (histRes?.data || []));
            } catch {}
          }
        }
        // Same patient → only application data updated, no sidebar/patient/history re-fetch
      } catch (err) {
        toast.error(t("load_error"));
      } finally {
        if (isInitialLoad) setLoading(false);
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

  const patientDisplayName = patient
    ? [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ").trim() ||
      patient.email ||
      t("unknown_patient")
    : application?.patientName || t("unknown_patient");

  const createdAt = formatDate(application?.createdAt);
  const dob = formatDOB(patient?.dateOfBirth, i18n.language);

  useLayoutEffect(() => {
    setTopBarContent(
      <AppointmentDetailsSystemHeader
        t={t}
        navigate={navigate}
        loading={loading}
        patientDisplayName={patientDisplayName}
        applicationId={application?.applicationId}
        createdAt={createdAt}
        dob={dob}
      />,
    );
  }, [
    setTopBarContent,
    t,
    navigate,
    loading,
    patientDisplayName,
    application?.applicationId,
    createdAt,
    dob,
  ]);

  useEffect(() => () => setTopBarContent(null), [setTopBarContent]);

  if (loading) return <LoadingComponent message={t("loading")} />;
  if (!application) return <div className="adp-error">{t("appointment_not_found")}</div>;

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return (
          <GeneralInformationTab
            ref={generalTabRef}
            application={application}
            patient={patient}
            history={history}
            onSave={handleSave}
            saving={saving}
            showFooter={false}
          />
        );
      case "history":
        return <HistoryTab ref={historyTabRef} application={application} patient={patient} />;
      case "medical":
        return <MedicalHistoryTab history={history} patient={patient} currentApplicationId={application.applicationId} doctorsMap={doctorsMap} />;
      case "payments":
        return <PaymentsTab application={application} />;
      case "documents":
        return <DocumentsTab application={application} />;
      case "telemedicine":
        return <TelemedicineTab application={application} doctorsMap={doctorsMap} />;
      case "followups":
        return (
          <FollowUpsTab
            application={application}
            onApplicationUpdate={(updated) => setApplication(updated)}
          />
        );
      case "report":
      case "conclusion":
        return <AppointmentReport booking={application} />;
      case "service":
        return <Service applicationId={application?.applicationId} />;
      default: {
        const tabLabel = TABS.find((t) => t.key === activeTab)?.label || activeTab;
        return <ComingSoonTab tabLabel={tabLabel} />;
      }
    }
  };

  return (
    <div className="adp-page">
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

      <div className="adp-body">
        {/* ── Patient Appointments Sidebar ── */}
        <aside className={`adp-app-sidebar${sidebarOpen ? " adp-app-sidebar--open" : ""}`}>
          <div className="adp-app-sidebar-title">
            {t("sidebar_title")}
            <button
              className="adp-sidebar-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle appointments sidebar">
              {sidebarOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
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
              const statusKey = status.toLowerCase().replace(/\s+/g, "_");
              const translatedStatus = t(`statuses.${statusKey}`, status);
              const statusClass = getApptStatusClass(status);
              const lang = i18n.language?.slice(0, 2) || "ru";
              const getField = (f) => {
                if (!f) return "";
                if (typeof f === "string") return f;
                if (typeof f === "object") return f[lang] || f.ru || f.en || Object.values(f).find(v => typeof v === "string") || "";
                return "";
              };
              const docEmail = app.doctors?.[0]?.doctorEmail || app.doctorEmail;
              const profile = docEmail ? doctorsMap[docEmail] : null;
              const doctorName =
                (profile
                  ? [profile.lastName, profile.firstName, profile.middleName].map(getField).filter(Boolean).join(" ")
                  : null) ||
                (app.doctor
                  ? [app.doctor.lastName, app.doctor.firstName, app.doctor.middleName].map(getField).filter(Boolean).join(" ")
                  : null) ||
                app.doctors?.[0]?.doctorName ||
                app.doctorEmail?.split("@")[0] || "";
              return (
                <button
                  key={app._id || app.applicationId}
                  className={`adp-app-card${isCurrent ? " adp-app-card--active" : ""}`}
                  onClick={() => !isCurrent && navigate(`/applications/appointment/${encodeURIComponent(app.applicationId || app._id)}?tab=general`)}
                >
                  <div className="adp-app-card-top">
                    <span className="adp-app-card-id">#{app.applicationId || app._id?.slice(-6)}</span>
                    <span className={`appt-status-badge ${statusClass}`}>{translatedStatus || "—"}</span>
                  </div>
                  <div className="adp-app-card-date">{appDate}</div>
                  {doctorName && <div className="adp-app-card-doctor">{doctorName}</div>}
                  {isCurrent && <div className="adp-app-card-current-label">{t("sidebar_current")}</div>}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="adp-content-scroll">
          <div className={`adp-content${activeTab === "history" ? " adp-content--history" : ""}`}>{renderTab()}</div>
        </div>
      </div>

      {activeTab !== "history" && <div className="adp-sticky-footer">
        <button
          className="adp-footer-btn adp-footer-save-btn"
          onClick={async () => {
            try {
              setPageSaving(true);
              await saveCurrentTabData();
            } finally {
              setPageSaving(false);
            }
          }}
          disabled={saving || pageSaving}
        >
          {(saving || pageSaving) ? t("saving", "Saving...") : t("save", "Save")}
        </button>
        <button
          className="adp-footer-btn adp-footer-save-close-btn"
          onClick={async () => {
            try {
              setPageSaving(true);
              await saveCurrentTabData();

              const confirmed = window.confirm(
                t(
                  "confirm_mark_completed",
                  "Do you want to mark this application as completed?",
                ),
              );

              if (!confirmed) {
                return;
              }

              await updateApplication(application.applicationId, {
                appointmentStatus: "Completed",
              });

              setApplication((prev) => ({
                ...prev,
                appointmentStatus: "Completed",
              }));

              toast.success(
                t("mark_completed_success", "Application marked as completed"),
              );
            } finally {
              setPageSaving(false);
            }
          }}
          disabled={saving || pageSaving}
        >
          {(saving || pageSaving)
            ? t("saving", "Saving...")
            : t("save_and_completed", "Save and completed")}
        </button>
      </div>}
    </div>
  );
};

export default AppointmentDetailsPage;
