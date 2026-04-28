import React from 'react';
import { useTranslation } from 'react-i18next';
import defaultUser from '../assets/default-user.png';
import '../styles/AssistantDetailsTab.css';

const AssistantDetailsTab = ({ assistant }) => {
  const { t } = useTranslation('assistant_details');

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return t('na');
    const today = new Date('2025-09-03'); // Hardcoded for consistency with backend
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatFullName = () => {
    const { firstName, middleName, lastName } = assistant;
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

  const formatDateTime = (dateTime) => {
    if (!dateTime) return t('na');
    return new Date(dateTime).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const formatAssignments = () => {
    if (!assistant.doctors || !Array.isArray(assistant.doctors) || assistant.doctors.length === 0) {
      return t('no_assignments');
    }
    return assistant.doctors.map((assignment, index) => (
      <div key={index} className="assistant-assignment-item">
        <span>{assignment.doctorEmail}</span>
        <span>
          {formatDateTime(assignment.startDateTime)} - {formatDateTime(assignment.endDateTime)}
        </span>
      </div>
    ));
  };

  return (
    <div className="assistant-details-tab-container">
      <div className="assistant-profile-pic-wrapper">
        <img
          src={assistant.profilePicture ? `data:image/jpeg;base64,${assistant.profilePicture}` : defaultUser}
          alt={t('profile_image_alt')}
          className="assistant-profile-image"
        />
      </div>
      <div className="assistant-header-modern">
        <h1 className="assistant-name-modern">{formatFullName()}</h1>
        <div className="assistant-meta-modern">
          {assistant.specialty && <span>{assistant.specialty}</span>}
          {assistant.dateOfBirth && (
            <span>{t('age', { count: calculateAge(assistant.dateOfBirth) })}</span>
          )}
          {assistant._id && <span>{t('id', { id: assistant._id })}</span>}
        </div>
      </div>

      <div className="assistant-detail-list-modern">
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('date_of_birth')}</span>
          <span className="assistant-detail-value-modern">{formatDate(assistant.dateOfBirth)}</span>
        </div>
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('age_label')}</span>
          <span className="assistant-detail-value-modern highlight">
            {assistant.dateOfBirth ? t('age', { count: calculateAge(assistant.dateOfBirth) }) : t('na')}
          </span>
        </div>
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('gender')}</span>
          <span className="assistant-detail-value-modern">{assistant.gender || t('na')}</span>
        </div>
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('phone_number')}</span>
          <span className="assistant-detail-value-modern highlight">{formatPhone(assistant.phoneNumber)}</span>
        </div>
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('email')}</span>
          <span className="assistant-detail-value-modern highlight">{assistant.email || t('na')}</span>
        </div>
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('specialty')}</span>
          <span className="assistant-detail-value-modern">{assistant.specialty || t('na')}</span>
        </div>
        <div className="assistant-detail-row-modern">
          <span className="assistant-detail-label-modern">{t('assignments')}</span>
          <div className="assistant-detail-value-modern assistant-assignments">
            {formatAssignments()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantDetailsTab;