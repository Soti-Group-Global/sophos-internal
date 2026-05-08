import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/PatientDetailsTab.css';

const PatientDetailsTab = ({ patient }) => {
  const { t } = useTranslation();

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return t('common.notAvailable');
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatFullName = () => {
    const { firstName = '', middleName = '', lastName = '' } = patient;
    return [firstName, middleName, lastName].filter(Boolean).join(' ') || t('patient.unnamed');
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('common.notAvailable');
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatPhone = (phone) => {
    if (!phone) return t('common.notAvailable');
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length === 10
      ? digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
      : phone;
  };

  return (
    <div className="patient-details-modern">
      <div className="patient-header-modern">
        <h1 className="patient-name-modern">{formatFullName()}</h1>
        <div className="patient-meta-modern">
          {patient.gender && <span>{t(`common.gender.${patient.gender.toLowerCase()}`)}</span>}
          {patient.dateOfBirth && (
            <span>{t('patient.ageWithUnit', { age: calculateAge(patient.dateOfBirth) })}</span>
          )}
          {patient._id && <span>{t('patient.id')}: {patient._id}</span>}
        </div>
      </div>

      <div className="detail-list-modern">
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.dob')}</span>
          <span className="detail-value-modern">{formatDate(patient.dateOfBirth)}</span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.age')}</span>
          <span className="detail-value-modern highlight">
            {patient.dateOfBirth
              ? t('patient.ageWithUnit', { age: calculateAge(patient.dateOfBirth) })
              : t('common.notAvailable')}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.gender')}</span>
          <span className="detail-value-modern">
            {patient.gender ? t(`common.gender.${patient.gender.toLowerCase()}`) : t('common.notAvailable')}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.primaryPhone')}</span>
          <span className="detail-value-modern highlight">{formatPhone(patient.telephone)}</span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.secondaryPhone')}</span>
          <span className="detail-value-modern">{formatPhone(patient.additionalPhone)}</span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.email')}</span>
          <span className="detail-value-modern highlight">{patient.email || t('common.notAvailable')}</span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.address')}</span>
          <span className="detail-value-modern">{patient.address || t('common.notAvailable')}</span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('patient.comments')}</span>
          <span className="detail-value-modern">
            {patient.comments || <span style={{ color: '#999' }}>{t('common.noComments')}</span>}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailsTab;
