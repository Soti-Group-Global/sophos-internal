import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getPatientByPatientId, getAllDoctorsProfiles } from '../utils/api';
import PatientDetailsTab from './PatientDetailsTab';
import MedicalHistoryTab from './MedicalHistoryTab';
import EarlyDetectionTab from './EarlyDetectionTab';
import PatientStatisticsTab from './PatientStatisticsTab';
import LoadingComponent from '../components/Loading/LoadingComponent';
import { FiArrowLeft, FiEdit2, FiUser, FiCalendar, FiActivity, FiBarChart2 } from 'react-icons/fi';
import '../styles/PatientDetails.css';

function PatientDetails() {
  const { t } = useTranslation('patient_details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [doctorsMap, setDoctorsMap] = useState({});

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const response = await getPatientByPatientId(id);
        setPatient(response.patient || response);
        setLoading(false);
      } catch (err) {
        setError(t('error_fetch'));
        setLoading(false);
        toast.error(t('error_fetch'));
      }
    };
    const fetchDoctors = async () => {
      try {
        const profiles = await getAllDoctorsProfiles({ limit: 500 });
        const profileList = profiles?.data || profiles || [];
        const map = {};
        profileList.forEach(p => { if (p.email) map[p.email] = p; });
        setDoctorsMap(map);
      } catch { /* non-critical */ }
    };
    fetchPatient();
    fetchDoctors();
  }, [id, t]);

  const calculateAge = (dob) => {
    if (!dob) return null;
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const getInitials = () => {
    if (!patient) return '';
    return `${(patient.lastName?.[0] || '').toUpperCase()}${(patient.firstName?.[0] || '').toUpperCase()}`;
  };

  const getProfileImage = () => {
    return patient?.profilePicture
      ? `data:image/jpeg;base64,${patient.profilePicture}`
      : null;
  };

  const tabs = [
    { key: 'general', label: t('general_details'), icon: <FiUser size={15} /> },
    { key: 'appointments', label: t('appointment_history'), icon: <FiCalendar size={15} /> },
    { key: 'early-detection', label: t('early_detection'), icon: <FiActivity size={15} /> },
    { key: 'statistics', label: t('statistics'), icon: <FiBarChart2 size={15} /> },
  ];

  const renderContent = () => {
    if (!patient) return null;
    switch (activeTab) {
      case 'general':
        return <PatientDetailsTab patient={patient} />;
      case 'appointments':
        return <MedicalHistoryTab email={patient.email} doctorsMap={doctorsMap} />;
      case 'early-detection':
        return <EarlyDetectionTab email={patient.email} />;
      case 'statistics':
        return <PatientStatisticsTab email={patient.email} />;
      default:
        return null;
    }
  };

  if (loading) return <LoadingComponent message={t('loading')} />;
  if (error) return <div className="pd-error">{error}</div>;

  const age = calculateAge(patient?.dateOfBirth);
  const profileImg = getProfileImage();

  return (
    <div className="pd-container">
      <div className="pd-header">
        <button className="pd-back" onClick={() => navigate('/patients')}>
          <FiArrowLeft size={18} />
        </button>
        <div className="pd-patient-info">
          <div className="pd-avatar">
            {profileImg ? (
              <img src={profileImg} alt="" />
            ) : (
              <span>{getInitials()}</span>
            )}
          </div>
          <div className="pd-identity">
            <h1 className="pd-name">
              {patient.lastName} {patient.firstName} {patient.middleName || ''}
            </h1>
            <div className="pd-badges">
              {patient.gender && (
                <span className="pd-badge pd-badge-gender">{t(`gender_${patient.gender.toLowerCase()}`, patient.gender)}</span>
              )}
              {age !== null && (
                <span className="pd-badge pd-badge-age">{age} {t('years')}</span>
              )}
              {patient.phoneNumber && (
                <span className="pd-badge pd-badge-phone">{patient.phoneNumber}</span>
              )}
              {patient.email && (
                <span className="pd-badge pd-badge-email">{patient.email}</span>
              )}
            </div>
          </div>
        </div>
        <button className="pd-edit-btn" onClick={() => navigate(`/patients/edit/${patient._id}`)}>
          <FiEdit2 size={15} />
          <span>{t('edit')}</span>
        </button>
      </div>

      <div className="pd-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`pd-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="pd-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default PatientDetails;