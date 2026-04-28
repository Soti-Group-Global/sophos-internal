import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMedicalHistoryByEmail, getUserEarlyDetectionBookings } from '../utils/api';
import { FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiTrendingUp, FiPackage } from 'react-icons/fi';
import LoadingComponent from '../components/Loading/LoadingComponent';
import '../styles/PatientStatisticsTab.css';

function PatientStatisticsTab({ email }) {
  const { t, i18n } = useTranslation('patient_statistics');
  const [appointments, setAppointments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!email) { setLoading(false); return; }
      try {
        const [apptData, edRes] = await Promise.all([
          getMedicalHistoryByEmail(email).catch(() => []),
          getUserEarlyDetectionBookings(email).catch(() => ({ success: false })),
        ]);
        setAppointments(apptData || []);
        setBookings(edRes?.success ? (edRes.data?.allBookings || []) : []);
      } catch { }
      setLoading(false);
    };
    fetchData();
  }, [email]);

  if (loading) return <LoadingComponent message={t('loading')} />;

  // Appointment stats
  const total = appointments.length;
  const upcoming = appointments.filter(a => new Date(a.date) > new Date()).length;
  const completed = appointments.filter(a => new Date(a.date) <= new Date() && a.appointmentStatus !== 'Cancelled').length;
  const cancelled = appointments.filter(a => a.appointmentStatus === 'Cancelled').length;

  // Service type breakdown
  const serviceMap = {};
  appointments.forEach(a => {
    const key = a.serviceType || t('other');
    serviceMap[key] = (serviceMap[key] || 0) + 1;
  });

  // Status breakdown
  const statusMap = {};
  appointments.forEach(a => {
    const key = a.appointmentStatus || t('unknown');
    statusMap[key] = (statusMap[key] || 0) + 1;
  });

  // Monthly visit frequency (last 12 months)
  const monthMap = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = 0;
  }
  appointments.forEach(a => {
    const d = new Date(a.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap[key] !== undefined) monthMap[key]++;
  });
  const maxVisits = Math.max(...Object.values(monthMap), 1);

  // Early detection stats
  const edTotal = bookings.length;
  const edPaid = bookings.filter(b => b.payment?.status === 'paid').length;
  const edPending = bookings.filter(b => b.payment?.status === 'pending').length;

  const formatMonth = (key) => {
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1);
    const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
    return d.toLocaleDateString(locale, { month: 'short' });
  };

  return (
    <div className="pst-container">
      {/* Summary cards */}
      <div className="pst-summary">
        <div className="pst-card pst-card-total">
          <div className="pst-card-icon"><FiCalendar size={18} /></div>
          <div className="pst-card-data">
            <span className="pst-card-num">{total}</span>
            <span className="pst-card-lbl">{t('total_appointments')}</span>
          </div>
        </div>
        <div className="pst-card pst-card-upcoming">
          <div className="pst-card-icon"><FiClock size={18} /></div>
          <div className="pst-card-data">
            <span className="pst-card-num">{upcoming}</span>
            <span className="pst-card-lbl">{t('upcoming')}</span>
          </div>
        </div>
        <div className="pst-card pst-card-completed">
          <div className="pst-card-icon"><FiCheckCircle size={18} /></div>
          <div className="pst-card-data">
            <span className="pst-card-num">{completed}</span>
            <span className="pst-card-lbl">{t('completed')}</span>
          </div>
        </div>
        <div className="pst-card pst-card-cancelled">
          <div className="pst-card-icon"><FiXCircle size={18} /></div>
          <div className="pst-card-data">
            <span className="pst-card-num">{cancelled}</span>
            <span className="pst-card-lbl">{t('cancelled')}</span>
          </div>
        </div>
      </div>

      {/* Visit frequency chart */}
      <div className="pst-section">
        <div className="pst-section-hdr">
          <FiTrendingUp size={16} />
          <span>{t('visit_frequency')}</span>
        </div>
        <div className="pst-chart">
          {Object.entries(monthMap).map(([key, count]) => (
            <div key={key} className="pst-bar-col">
              <div className="pst-bar-wrap">
                <div
                  className="pst-bar"
                  style={{ height: `${(count / maxVisits) * 100}%` }}
                />
              </div>
              {count > 0 && <span className="pst-bar-val">{count}</span>}
              <span className="pst-bar-lbl">{formatMonth(key)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pst-row">
        {/* Service type breakdown */}
        {Object.keys(serviceMap).length > 0 && (
          <div className="pst-section pst-section-half">
            <div className="pst-section-hdr">
              <FiCalendar size={16} />
              <span>{t('by_service_type')}</span>
            </div>
            <div className="pst-breakdown">
              {Object.entries(serviceMap).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                <div key={key} className="pst-bk-row">
                  <span className="pst-bk-label">{t(`service_types.${key}`, key)}</span>
                  <div className="pst-bk-bar-wrap">
                    <div className="pst-bk-bar" style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                  <span className="pst-bk-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status breakdown */}
        {Object.keys(statusMap).length > 0 && (
          <div className="pst-section pst-section-half">
            <div className="pst-section-hdr">
              <FiCheckCircle size={16} />
              <span>{t('by_status')}</span>
            </div>
            <div className="pst-breakdown">
              {Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                <div key={key} className="pst-bk-row">
                  <span className="pst-bk-label">{t(`statuses.${key}`, key)}</span>
                  <div className="pst-bk-bar-wrap">
                    <div className="pst-bk-bar pst-bk-bar-status" style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                  <span className="pst-bk-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Early detection summary */}
      {edTotal > 0 && (
        <div className="pst-section">
          <div className="pst-section-hdr">
            <FiPackage size={16} />
            <span>{t('early_detection')}</span>
          </div>
          <div className="pst-ed-stats">
            <div className="pst-ed-item">
              <span className="pst-ed-num">{edTotal}</span>
              <span className="pst-ed-lbl">{t('total_bookings')}</span>
            </div>
            <div className="pst-ed-item pst-ed-paid">
              <span className="pst-ed-num">{edPaid}</span>
              <span className="pst-ed-lbl">{t('paid')}</span>
            </div>
            <div className="pst-ed-item pst-ed-pending">
              <span className="pst-ed-num">{edPending}</span>
              <span className="pst-ed-lbl">{t('pending')}</span>
            </div>
          </div>
        </div>
      )}

      {total === 0 && edTotal === 0 && (
        <div className="pst-empty">
          <FiTrendingUp size={36} />
          <p>{t('no_data')}</p>
        </div>
      )}
    </div>
  );
}

export default PatientStatisticsTab;
