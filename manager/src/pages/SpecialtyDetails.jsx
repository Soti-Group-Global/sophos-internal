import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getSpecialtyById } from '../utils/api';
import SpecialtyDetailsTab from './SpecialtyDetailsTab';
import '../styles/PatientDetails.css';

function SpecialtyDetails() {
  const { t } = useTranslation('specialty_details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSpecialty = async () => {
      try {
        const response = await getSpecialtyById(id);
        setSpecialty(response.specialty);
        setLoading(false);
      } catch (err) {
        setError(t('error_fetch'));
        setLoading(false);
        toast.error(t('error_fetch'));
      }
    };
    fetchSpecialty();
  }, [id, t]);

  const handleCancel = () => {
    navigate('/analysis');
  };

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (error) return <div className="error">{error}</div>;

  return (
          <div className="patient-details-container">
            <div className="breadcrumb">
              <span className="breadcrumb-back" onClick={handleCancel}>
                {t('specialties')}
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {specialty ? specialty.name : t('specialty')}
              </span>
            </div>
            <div className="tab-content">
              <SpecialtyDetailsTab specialty={specialty} />
            </div>
          </div>
  );
}

export default SpecialtyDetails;