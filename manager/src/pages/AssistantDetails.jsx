import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getAssistantById } from '../utils/api';
import AssistantDetailsTab from './AssistantDetailsTab';
import '../styles/AssistantDetails.css';

function AssistantDetails() {
  const { t } = useTranslation('assistant_details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [assistant, setAssistant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssistant = async () => {
      try {
        const response = await getAssistantById(id);
        setAssistant(response.data.assistant);
        setLoading(false);
      } catch (err) {
        setError(t('error_fetch'));
        setLoading(false);
        toast.error(t('error_fetch'));
      }
    };
    fetchAssistant();
  }, [id, t]);

  const handleCancel = () => {
    navigate('/assistants');
  };

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (error) return <div className="error">{error}</div>;

  return (
          <div className="assistant-details-container">
            <div className="breadcrumb">
              <span className="breadcrumb-back" onClick={handleCancel}>
                {t('assistants')}
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {assistant ? `${assistant.firstName} ${assistant.lastName}` : t('assistant')}
              </span>
            </div>
            <div className="tab-content">
              <AssistantDetailsTab assistant={assistant} />
            </div>
          </div>
  );
}

export default AssistantDetails;