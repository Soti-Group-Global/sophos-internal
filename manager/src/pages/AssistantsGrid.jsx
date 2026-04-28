import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import DateTimePicker from './DateTimePicker';
import AssistantDetailsModal from './AssistantDetailsModal';
import { deleteAssistant, getDoctors, assignDoctorToAssistant, getAssistantProfileImage } from '../utils/api';
import defaultUser from '../assets/default-user.png';
import '../styles/AssistantsGrid.css';

const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};
import '../styles/Shared.css';
import '../styles/AssistantAssignPopup.css';

function AssistantsGrid({ assistants, onViewChange, currentView, refetchAssistants }) {
  const { t, i18n } = useTranslation('assistants');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assistantToDelete, setAssistantToDelete] = useState(null);
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [selectedAssistantId, setSelectedAssistantId] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [assignFormData, setAssignFormData] = useState({
    doctorEmail: '',
    startDateTime: '',
    endDateTime: ''
  });
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [assignErrors, setAssignErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (showAssignPopup) {
      const fetchDoctors = async () => {
        setLoadingDoctors(true);
        try {
          const response = await getDoctors(1, 100, true);
          const doctors = response.doctors || [];
          const options = doctors.map(doctor => ({
            value: doctor.email,
            label: `${getFieldValue(doctor.firstName, i18n.language)} ${getFieldValue(doctor.lastName, i18n.language)} (${doctor.email})`
          }));
          setDoctorOptions(options);
        } catch (error) {
          toast.error(t('failed_fetch_doctors'));
        } finally {
          setLoadingDoctors(false);
        }
      };
      fetchDoctors();
    }
  }, [showAssignPopup, t]);

  const handleDelete = async () => {
    if (!assistantToDelete) return;
    try {
      await deleteAssistant(assistantToDelete._id);
      toast.success(t('delete_success'));
      setShowDeleteModal(false);
      setAssistantToDelete(null);
      await refetchAssistants();
    } catch (error) {
      toast.error(error.response?.data?.message || t('delete_failed'));
    }
  };

  const openDeleteModal = (assistant) => {
    setAssistantToDelete(assistant);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setAssistantToDelete(null);
  };

  const handleAssignClick = (assistantId) => {
    setSelectedAssistantId(assistantId);
    setShowAssignPopup(true);
    setAssignFormData({ doctorEmail: '', startDateTime: '', endDateTime: '' });
    setAssignErrors({});
  };

  const handleDetailsClick = (assistant) => {
    setSelectedAssistant(assistant);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedAssistant(null);
  };

  const handleAssignChange = (name, value) => {
    setAssignFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'startDateTime' && value) {
        const startDateTime = new Date(value);
        if (!isNaN(startDateTime)) {
          const endDateTime = new Date(startDateTime);
          endDateTime.setHours(endDateTime.getHours() + 24);
          newData.endDateTime = endDateTime.toISOString();
        }
      }
      return newData;
    });
    if (assignErrors[name]) {
      setAssignErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDoctorChange = (selectedOption) => {
    setAssignFormData(prev => ({
      ...prev,
      doctorEmail: selectedOption ? selectedOption.value : ''
    }));
    if (assignErrors.doctorEmail) {
      setAssignErrors(prev => ({
        ...prev,
        doctorEmail: ''
      }));
    }
  };

  const validateAssignForm = () => {
    const newErrors = {};
    if (!assignFormData.doctorEmail) {
      newErrors.doctorEmail = t('doctor_required');
    }
    if (!assignFormData.startDateTime) {
      newErrors.startDateTime = t('start_date_time_required');
    }
    if (!assignFormData.endDateTime) {
      newErrors.endDateTime = t('end_date_time_required');
    } else if (
      assignFormData.startDateTime &&
      new Date(assignFormData.endDateTime) <= new Date(assignFormData.startDateTime)
    ) {
      newErrors.endDateTime = t('end_date_after_start');
    }
    setAssignErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (validateAssignForm()) {
      try {
        await assignDoctorToAssistant(selectedAssistantId, {
          doctorEmail: assignFormData.doctorEmail,
          startDateTime: new Date(assignFormData.startDateTime).toISOString(),
          endDateTime: new Date(assignFormData.endDateTime).toISOString()
        });
        toast.success(t('success_assign'));
        setShowAssignPopup(false);
        await refetchAssistants();
      } catch (error) {
        toast.error(error.response?.data?.message || t('failed_assign'));
      }
    }
  };

  const handleAssistantClick = (id) => {
    navigate(`/assistants/${id}`);
  };

  const getFullName = (assistant) => {
    return [assistant.firstName, assistant.middleName, assistant.lastName]
      .filter(Boolean)
      .join(' ');
  };

  const getProfileImageSrc = (assistant) => {
    if (assistant.profilePicture) {
      return `data:image/jpeg;base64,${assistant.profilePicture}`;
    }
    return defaultUser;
  };

  return (
    <div className="assistant-applications-container">
      <div className="assistant-applications-header">
        <div className="assistant-applications-title">
          <h2>{t('title')}</h2>
          <p>{t('subtitle')}</p>
        </div>
        <div className="assistant-view-controls">
          <button
            className={currentView === 'list' ? 'assistant-active' : ''}
            onClick={() => onViewChange('list')}
          >
            {t('view_compact')}
          </button>
          <button
            className={currentView === 'grid' ? 'assistant-active' : ''}
            onClick={() => onViewChange('grid')}
          >
            {t('view_expanded')}
          </button>
          <button
            className="assistant-add-btn"
            onClick={() => navigate('/assistants/add')}
          >
            {t('add_assistant')}
          </button>
        </div>
      </div>
      <div className="assistant-grid">
        {assistants.length === 0 ? (
          <p>{t('no_assistants')}</p>
        ) : (
          assistants.map((assistant) => (
            <div
              key={assistant._id}
              className="assistant-card"
              onClick={() => handleAssistantClick(assistant._id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="assistant-card-header">
                <div className="assistant-name-container">
                  <img
                    src={getProfileImageSrc(assistant)}
                    alt={t('profile_image_alt', { name: getFullName(assistant) })}
                    className="assistant-profile-pic"
                    style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                    onError={(e) => { e.target.src = defaultUser; }}
                  />
                  <div className="assistant-name">
                    {getFullName(assistant)}
                  </div>
                </div>
                <div
                  className="assistant-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="assistant-action-btn assistant-edit-btn"
                    onClick={() => navigate(`/assistants/edit/${assistant._id}`)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="assistant-action-btn assistant-assign-btn"
                    onClick={() => handleAssignClick(assistant._id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="assistant-action-btn assistant-details-btn"
                    onClick={() => handleDetailsClick(assistant)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8v8m0-4h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    className="assistant-action-btn assistant-delete-btn"
                    onClick={() => openDeleteModal(assistant)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="assistant-card-content">
                <div className="assistant-field">
                  <span className="assistant-field-label">{t('specialty')}</span>
                  <span className="assistant-field-value">{assistant.specialty || t('na')}</span>
                </div>
                <div className="assistant-field">
                  <span className="assistant-field-label">{t('email')}</span>
                  <span className="assistant-field-value">{assistant.email || t('na')}</span>
                </div>
                <div className="assistant-field">
                  <span className="assistant-field-label">{t('phone')}</span>
                  <span className="assistant-field-value">{assistant.phoneNumber || t('na')}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {showDeleteModal && (
        <div className="assistant-delete-modal-overlay">
          <div className="assistant-modal">
            <h3 className="assistant-delete-modal-title">{t('confirm_deletion')}</h3>
            <p className="assistant-delete-modal-message">
              {t('confirm_delete_message', { name: getFullName(assistantToDelete) })}
            </p>
            <div className="assistant-delete-modal-actions">
              <button className="assistant-delete-modal-cancel" onClick={closeDeleteModal}>
                {t('cancel')}
              </button>
              <button className="assistant-delete-modal-confirm" onClick={handleDelete}>
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAssignPopup && (
        <div className="assistant-assign-modal-overlay">
          <div className="assistant-assign-modal">
            <button
              className="assistant-assign-close-btn"
              onClick={() => setShowAssignPopup(false)}
              title={t('cancel')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="form-section">
              <h2 className="assistant-assign-modal-title">{t('title_assign')}</h2>
              <form onSubmit={handleAssignSubmit} className="assistant-assign-form">
                <div className="form-row">
                  <label className="form-label">{t('doctor')} <span className="required-asterisk">*</span></label>
                  <Select
                    options={doctorOptions}
                    value={doctorOptions.find(opt => opt.value === assignFormData.doctorEmail)}
                    onChange={handleDoctorChange}
                    className={assignErrors.doctorEmail ? 'error' : ''}
                    classNamePrefix="react-select"
                    placeholder={loadingDoctors ? t('loading_doctors') : t('select_doctor')}
                    isDisabled={loadingDoctors}
                    styles={{
                      control: (base) => ({
                        ...base,
                        minWidth: '300px',
                      }),
                    }}
                  />
                  {assignErrors.doctorEmail && <span className="field-error">{assignErrors.doctorEmail}</span>}
                </div>
                <div className="form-row">
                  <label className="form-label">{t('start_date_time')} <span className="required-asterisk">*</span></label>
                  <DateTimePicker
                    name="startDateTime"
                    value={assignFormData.startDateTime}
                    onChange={handleAssignChange}
                    error={assignErrors.startDateTime}
                    placeholder={t('select_start_date')}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">{t('end_date_time')} <span className="required-asterisk">*</span></label>
                  <DateTimePicker
                    name="endDateTime"
                    value={assignFormData.endDateTime}
                    onChange={handleAssignChange}
                    error={assignErrors.endDateTime}
                    placeholder={t('select_end_date')}
                  />
                </div>
                <button
                  type="submit"
                  className="assistant-assign-submit-btn"
                  disabled={loadingDoctors}
                >
                  {t('assign_doctor')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {showDetailsModal && (
        <AssistantDetailsModal
          assistant={selectedAssistant}
          isOpen={showDetailsModal}
          onClose={closeDetailsModal}
        />
      )}
    </div>
  );
}

export default AssistantsGrid;