import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getDoctorById } from '../utils/api';
import DoctorDetailsTab from './DoctorDetailsTab';
import '../styles/PatientDetails.css';

// Helper function to extract multilingual field values
const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};

function DoctorDetails() {
  const { t } = useTranslation('doctor_details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await getDoctorById(id);
        setDoctor(response.data.doctor);
        setLoading(false);
      } catch (err) {
        setError(t('error_fetch'));
        setLoading(false);
        toast.error(t('error_fetch'));
      }
    };
    fetchDoctor();
  }, [id, t]);

  const handleCancel = () => {
    navigate('/doctors');
  };

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (error) return <div className="error">{error}</div>;

  return (

          <div className="patient-details-container">
            <div className="breadcrumb">
              <span className="breadcrumb-back" onClick={handleCancel}>
                {t('doctors')}
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {doctor ? `${getFieldValue(doctor.firstName)} ${getFieldValue(doctor.lastName)}` : t('doctor')}
              </span>
            </div>
            <div className="tab-content">
              <DoctorDetailsTab doctor={doctor} />
            </div>
          </div>

  );
}

export default DoctorDetails;