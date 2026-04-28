import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import AssistantsList from './AssistantsList';
import AssistantsGrid from './AssistantsGrid';
import { getAssistants } from '../utils/api';
import '../styles/Shared.css';

function Assistants() {
  const { t } = useTranslation('assistants');
  const [currentView, setCurrentView] = useState('list');
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const fetchAssistants = async () => {
    try {
      setLoading(true);
      const response = await getAssistants();
      setAssistants(Array.isArray(response.assistants) ? response.assistants : []);
      setLoading(false);
    } catch (err) {
      setError(t('error_fetch'));
      toast.error(t('error_fetch'));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, [t]);

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  if (error) {
    return <div className="app">{error}</div>;
  }

  return (
    <div>
 
          {currentView === 'list' ? (
            <AssistantsList
              assistants={assistants}
              onViewChange={handleViewChange}
              currentView={currentView}
              refetchAssistants={fetchAssistants}
            />
          ) : (
            <AssistantsGrid
              assistants={assistants}
              onViewChange={handleViewChange}
              currentView={currentView}
              refetchAssistants={fetchAssistants}
            />
          )}
  
    </div>
  );
}

export default Assistants;