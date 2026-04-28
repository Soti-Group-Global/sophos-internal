import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { deleteDoctor } from '../utils/api';
import defaultUser from '../assets/default-user.png';
import '../styles/DoctorsList.css';
import '../styles/Shared.css';

// Helper function to extract multilingual field values
const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};

function DoctorsList({ doctors, onViewChange, currentView, refetchDoctors }) {
  const { t } = useTranslation('doctors');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState(null);

  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!doctorToDelete) return;
    try {
      await deleteDoctor(doctorToDelete._id);
      toast.success(t('delete_success'));
      setShowDeleteModal(false);
      setDoctorToDelete(null);
      await refetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.message || t('delete_failed'));
    }
  };

  const openDeleteModal = (doctor) => {
    setDoctorToDelete(doctor);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDoctorToDelete(null);
  };

  const handleDoctorClick = (id) => {
    navigate(`/doctors/${id}`);
  };

  return (
    <div className="applications-container">
      <div className="applications-header">
        <div className="applications-title">
          <h2>{t('title')}</h2>
          <p>{t('subtitle')}</p>
        </div>
        <div className="view-controls">
          <button 
            className={currentView === 'list' ? 'active' : ''}
            onClick={() => onViewChange('list')}
          >
            {t('view_compact')}
          </button>
          <button 
            className={currentView === 'grid' ? 'active' : ''}
            onClick={() => onViewChange('grid')}
          >
            {t('view_expanded')}
          </button>
          <button 
            className="add-doctor-btn"
            onClick={() => navigate('/doctors/add')}
          >
            {t('add_doctor')}
          </button>
        </div>
      </div>

      <div className="doctors-list">
        {doctors.length === 0 ? (
          <p>{t('no_doctors')}</p>
        ) : (
          doctors.map((doctor) => (
            <div
              key={doctor._id}
              className="doctor-item"
              onClick={() => handleDoctorClick(doctor._id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="doctor-info">
                <div className="doctor-name-container">
                  <img 
                    src={doctor.profilePicture ? `data:image/jpeg;base64,${doctor.profilePicture}` : defaultUser}
                    alt={t('profile_image_alt', { name: getFieldValue(doctor.firstName) })} 
                    className="doctor-profile-pic" 
                    style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                  />
                  <div className="doctor-name">
                    {getFieldValue(doctor.firstName)} {getFieldValue(doctor.middleName)} {getFieldValue(doctor.lastName)}
                  </div>
                </div>
                <div className="doctor-details">
                  <div className="doctor-fields">
                    <div className="doctor-field-row">
                      <div className="doctor-field">
                        <span className="field-label">{t('specialty')}</span>
                        <span className="field-value">{doctor.specialty || t('na')}</span>
                      </div>
                      <div className="doctor-field">
                        <span className="field-label">{t('service_type')}</span>
                        <div className="field-value">
                          {Array.isArray(doctor.services) && doctor.services.length > 0 ? (
                            doctor.services.map((type) => (
                              <span
                                key={type}
                                className={`service-type-badge ${type.toLowerCase()}`}
                                data-type={type.toLowerCase()}
                              >
                                {type}
                              </span>
                            ))
                          ) : (
                            <span className="service-type-badge">{t('none')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="doctor-field-row">
                      <div className="doctor-field">
                        <span className="field-label">{t('email')}</span>
                        <span className="field-value">{doctor.email || t('na')}</span>
                      </div>
                      <div className="doctor-field">
                        <span className="field-label">{t('phone')}</span>
                        <span className="field-value">{doctor.phoneNumber || t('na')}</span>
                      </div>
                      <div className="doctor-field">
                        <span className="field-label">{t('fees')}</span>
                        <span className="field-value fees">{doctor.currency || t('na')} {doctor.feesAmount || t('na')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="doctor-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className="action-btn edit-btn"
                  onClick={() => navigate(`/doctors/edit/${doctor._id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button 
                  className="action-btn schedule-btn"
                  onClick={() => navigate(`/doctors/${doctor.email}/schedule`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button 
                  className="action-btn delete-btn"
                  onClick={() => openDeleteModal(doctor)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="doctor-modal">
            <h3 className="delete-modal-title">{t('confirm_deletion')}</h3>
            <p className="delete-modal-message">
              {t('confirm_delete_message', { firstName: doctorToDelete?.firstName, lastName: doctorToDelete?.lastName })}
            </p>
            <div className="delete-modal-actions">
              <button className="delete-modal-cancel" onClick={closeDeleteModal}>
                {t('cancel')}
              </button>
              <button className="delete-modal-confirm" onClick={handleDelete}>
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorsList;