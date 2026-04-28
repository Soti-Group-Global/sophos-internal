import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { getUserEarlyDetectionBookings } from '../utils/api';
import { FiPackage, FiDollarSign, FiUser, FiCalendar } from 'react-icons/fi';
import LoadingComponent from '../components/Loading/LoadingComponent';
import { getApptStatusClass } from '../utils/appointmentStatus';
import '../styles/EarlyDetectionTab.css';

function EarlyDetectionTab({ email }) {
  const { t } = useTranslation('patient_details');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!email) { setLoading(false); return; }
      try {
        setLoading(true);
        const response = await getUserEarlyDetectionBookings(email);
        if (response.success) setBookings(response.data.allBookings || []);
        setLoading(false);
      } catch (err) {
        setError(t('error_fetching_bookings'));
        setLoading(false);
      }
    };
    fetchBookings();
  }, [email, t]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusClass = (status) => getApptStatusClass(status);

  const getPaymentClass = (status) => getApptStatusClass(status);

  if (loading) return <LoadingComponent message={t('loading_bookings')} />;

  if (error) return (
    <div className="edt-empty">
      <FiCalendar size={36} />
      <p>{error}</p>
    </div>
  );

  if (bookings.length === 0) return (
    <div className="edt-empty">
      <FiPackage size={36} />
      <p>{t('no_early_detection_bookings')}</p>
    </div>
  );

  return (
    <div className="edt-container">
      <div className="edt-header">
        <span className="edt-count">{bookings.length} {t('total_bookings')}</span>
      </div>

      <div className="edt-list">
        {bookings.map((booking) => (
          <div key={booking._id} className="edt-card">
            <div className="edt-card-top">
              <div className="edt-card-title">
                <h4>{booking.invoiceNumber || booking.bookingNumber}</h4>
                <span className="edt-date">{formatDate(booking.createdAt)}</span>
              </div>
              <div className="edt-badges">
                <span className={`appt-status-badge ${getStatusClass(booking.status)}`}>
                  {booking.status}
                </span>
                <span className={`appt-status-badge ${getPaymentClass(booking.payment.status)}`}>
                  {booking.payment.status}
                </span>
              </div>
            </div>

            <div className="edt-card-body">
              <div className="edt-info-row">
                <FiPackage size={14} />
                <span className="edt-info-label">{t('package')}</span>
                <span className="edt-info-value">{booking.package.name}</span>
              </div>
              <div className="edt-info-row">
                <FiDollarSign size={14} />
                <span className="edt-info-label">{t('price')}</span>
                <span className="edt-info-value">{(booking.totalAmount || booking.package?.price || 0)?.toLocaleString('ru-RU')} {booking.package?.currency || 'RUB'}</span>
              </div>
              {booking.addOns && booking.addOns.length > 0 && (
                <div className="edt-info-row">
                  <FiPackage size={14} />
                  <span className="edt-info-label">{t('add_ons') || 'Доп. опции'}</span>
                  <span className="edt-info-value">{booking.addOns.map(a => a.name).join(', ')}</span>
                </div>
              )}
              <div className="edt-info-row">
                <FiUser size={14} />
                <span className="edt-info-label">{t('customer')}</span>
                <span className="edt-info-value">
                  {booking.customer.firstName} {booking.customer.middleName || ''} {booking.customer.lastName}
                </span>
              </div>
              <div className="edt-info-row">
                <FiCalendar size={14} />
                <span className="edt-info-label">{t('date_of_birth')}</span>
                <span className="edt-info-value">{formatDate(booking.customer.dateOfBirth)}</span>
              </div>
              {booking.payment.status === 'paid' && booking.payment.paidAt && (
                <div className="edt-info-row">
                  <FiDollarSign size={14} />
                  <span className="edt-info-label">{t('paid_at')}</span>
                  <span className="edt-info-value">{formatDate(booking.payment.paidAt)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EarlyDetectionTab;
