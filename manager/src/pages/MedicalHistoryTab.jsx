import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { getMedicalHistoryByEmail } from "../utils/api";
import { FiCalendar, FiUser, FiClock, FiChevronRight } from "react-icons/fi";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { getApptStatusClass } from "../utils/appointmentStatus";
import "../styles/MedicalHistoryTab.css";

const MedicalHistoryTab = ({ email, doctorsMap }) => {
  const { t, i18n } = useTranslation('medical_history');
  const lang = i18n.language?.slice(0, 2) || 'en';
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMedicalHistory = async () => {
      if (!email) {
        setError(t('no_email_error'));
        setLoading(false);
        return;
      }

      try {
        const data = await getMedicalHistoryByEmail(email);
        setMedicalHistory(data);
        setFilteredHistory(data);
      } catch (err) {
        setError(t('fetch_error'));
        toast.error(t('fetch_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalHistory();
  }, [email, t]);

  useEffect(() => {
    if (activeFilter === "all") {
      setFilteredHistory(medicalHistory);
    } else if (activeFilter === "upcoming") {
      const upcoming = medicalHistory.filter(
        (appt) => new Date(appt.date) > new Date()
      );
      setFilteredHistory(upcoming);
    } else if (activeFilter === "completed") {
      const completed = medicalHistory.filter(
        (appt) =>
          new Date(appt.date) <= new Date() &&
          appt.appointmentStatus !== "Cancelled"
      );
      setFilteredHistory(completed);
    } else if (activeFilter === "cancelled") {
      const cancelled = medicalHistory.filter(
        (appt) => appt.appointmentStatus === "Cancelled"
      );
      setFilteredHistory(cancelled);
    }
  }, [activeFilter, medicalHistory]);

  const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString(locale, {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return dateString; }
  };

  const formatTimeIST = (timeStr, dateStr) => {
    if (!timeStr || !dateStr) return t('not_specified');
    const [hours, minutes] = timeStr.split(':');
    const date = new Date(dateStr);
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }).format(date);
  };

  /* Resolve a multilingual field object or plain string */
  const getField = (f) => {
    if (!f) return '';
    if (typeof f === 'string') return f;
    if (typeof f === 'object') return f[lang] || f.en || f.ru || Object.values(f).find(v => typeof v === 'string') || '';
    return '';
  };

  const formatDoctorName = (doctor, appt) => {
    /* Try doctorsMap first for full profile data */
    const docEmail = doctor?.doctorEmail || appt?.doctorEmail || doctor?.email;
    const profile = docEmail && doctorsMap ? doctorsMap[docEmail] : null;
    if (profile) {
      const name = [profile.lastName, profile.firstName, profile.middleName]
        .map(f => getField(f)).filter(Boolean).join(' ');
      if (name) return name;
    }
    /* Fallback: embedded doctor object with language awareness */
    if (doctor) {
      const first = getField(doctor.firstName);
      const middle = getField(doctor.middleName);
      const last = getField(doctor.lastName);
      if (first || last) return [last, first, middle].filter(Boolean).join(' ');
    }
    return doctor?.doctorName || t('unknown_doctor');
  };

  const handleViewDetails = (appointment) => {
    const appId = appointment.applicationId || appointment._id;
    if (!appId) {
      toast.error(t('invalid_appointment_id'));
      return;
    }
    navigate(`/applications/appointment/${encodeURIComponent(appId)}`);
  };

  const getStatusClass = (status) => getApptStatusClass(status);

  if (loading) return <LoadingComponent message={t('loading')} />;

  if (error) return (
    <div className="mht-empty">
      <FiCalendar size={36} />
      <p>{error}</p>
    </div>
  );

  if (!medicalHistory.length) return (
    <div className="mht-empty">
      <FiCalendar size={36} />
      <h4>{t('no_appointments')}</h4>
      <p>{t('no_records')}</p>
    </div>
  );

  const upcomingCount = medicalHistory.filter((a) => new Date(a.date) > new Date()).length;

  return (
    <div className="mht-container">
      <div className="mht-toolbar">
        <div className="mht-stats">
          <div className="mht-stat">
            <span className="mht-stat-num">{medicalHistory.length}</span>
            <span className="mht-stat-lbl">{t('total')}</span>
          </div>
          <div className="mht-stat">
            <span className="mht-stat-num">{upcomingCount}</span>
            <span className="mht-stat-lbl">{t('upcoming')}</span>
          </div>
        </div>
        <div className="mht-filters">
          {['all', 'upcoming', 'completed', 'cancelled'].map((f) => (
            <button
              key={f}
              className={`mht-filter ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mht-list">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((appt) => (
            <div key={appt._id || appt.applicationId} className="mht-card" onClick={() => handleViewDetails(appt)}>
              <div className="mht-card-top">
                <div className="mht-card-left">
                  <span className="mht-app-id">{appt.applicationId}</span>
                  <div className="mht-badges">
                    <span className={`mht-badge mht-service-${appt.serviceType?.toLowerCase().replace(/\s/g, '-')}`}>
                      {t(`service_types.${appt.serviceType}`, appt.serviceType)}
                    </span>
                  </div>
                </div>
                <span className={`appt-status-badge ${getStatusClass(appt.appointmentStatus)}`}>
                  {t(`applications:status_${appt.appointmentStatus?.toLowerCase().replace(/\s+/g, "_")}`, appt.appointmentStatus)}
                </span>
              </div>

              <div className="mht-card-body">
                <div className="mht-info-row">
                  <FiCalendar size={14} />
                  <span>{formatDate(appt.date)}</span>
                </div>
                <div className="mht-info-row">
                  <FiClock size={14} />
                  <span>
                    {formatTimeIST(appt.startTime, appt.date)} — {appt.endTime ? formatTimeIST(appt.endTime, appt.date) : '—'}
                  </span>
                </div>
                <div className="mht-info-row">
                  <FiUser size={14} />
                  <span>{formatDoctorName(appt.doctor, appt)}</span>
                </div>
              </div>

              <div className="mht-card-action">
                <span>{t('view_details')}</span>
                <FiChevronRight size={14} />
              </div>
            </div>
          ))
        ) : (
          <div className="mht-empty">
            <FiCalendar size={36} />
            <p>{t('no_filter_results')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalHistoryTab;