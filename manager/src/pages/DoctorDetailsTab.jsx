import React from 'react';
import { useTranslation } from 'react-i18next';
import defaultUser from '../assets/default-user.png';
import '../styles/DoctorDetailsTab.css';

const DoctorDetailsTab = ({ doctor }) => {
  const { t } = useTranslation('doctor_details');

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return t('na');
    const today = new Date('2025-07-03');
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatFullName = () => {
    const { firstName, middleName, lastName } = doctor;
    return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('na');
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatPhone = (phone) => {
    if (!phone) return t('na');
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const formatServices = (services) => {
    if (!services || !Array.isArray(services)) return t('na');
    return services.join(', ');
  };

  return (
    <div className="doctor-details-container">
      <div className="doctor-profile-pic-wrapper">
        <img
          src={doctor.profilePicture ? `data:image/jpeg;base64,${doctor.profilePicture}` : defaultUser}
          alt={t('profile_image_alt')}
          className="doctor-profile-image"
        />
      </div>
      <div className="doctor-header-modern">
        <h1 className="doctor-name-modern">{formatFullName()}</h1>
        <div className="doctor-meta-modern">
          {doctor.specialty && <span>{doctor.specialty}</span>}
          {doctor.dateOfBirth && (
            <span>{t('age', { count: calculateAge(doctor.dateOfBirth) })}</span>
          )}
          {doctor._id && <span>{t('id', { id: doctor._id })}</span>}
        </div>
      </div>

      <div className="detail-list-modern">
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('date_of_birth')}</span>
          <span className="detail-value-modern">{formatDate(doctor.dateOfBirth)}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('age_label')}</span>
          <span className="detail-value-modern highlight">
            {doctor.dateOfBirth ? t('age', { count: calculateAge(doctor.dateOfBirth) }) : t('na')}
          </span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('gender')}</span>
          <span className="detail-value-modern">{doctor.gender || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('phone_number')}</span>
          <span className="detail-value-modern highlight">{formatPhone(doctor.phoneNumber)}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('email')}</span>
          <span className="detail-value-modern highlight">{doctor.email || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('specialty')}</span>
          <span className="detail-value-modern">{doctor.specialty || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('place_of_work')}</span>
          <span className="detail-value-modern">{doctor.placeOfWork || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('regalia')}</span>
          <span className="detail-value-modern">{doctor.regalia || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('services')}</span>
          <span className="detail-value-modern">{formatServices(doctor.services)}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('fees')}</span>
          <span className="detail-value-modern highlight">
            {doctor.feesAmount && doctor.currency
              ? t('fees_format', { currency: doctor.currency, amount: doctor.feesAmount })
              : t('na')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DoctorDetailsTab;