import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getVendorById } from '../utils/api';
import VendorDetailsTab from './VendorDetailsTab';
import '../styles/PatientDetails.css';

function VendorDetails() {
  const { t } = useTranslation('vendor_details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const response = await getVendorById(id);
        setVendor(response.vendor);
        setLoading(false);
      } catch (err) {
        setError(t('error_fetch'));
        setLoading(false);
        toast.error(t('error_fetch'));
      }
    };
    fetchVendor();
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
                {t('vendors')}
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {vendor ? vendor.name : t('vendor')}
              </span>
            </div>
            <div className="tab-content">
              <VendorDetailsTab vendor={vendor} />
            </div>
          </div>
  );
}

export default VendorDetails;