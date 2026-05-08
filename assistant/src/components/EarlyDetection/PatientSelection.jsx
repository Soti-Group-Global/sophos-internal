import React, { useState, useEffect } from 'react';
import { getAllPatients, createPatient } from '../../utils/api';
import { useTranslation } from 'react-i18next';

const PatientSelection = ({ formData = {}, updateFormData, nextStep }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('select');
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    countryCode: '+7',
    gender: 'Male',
    dateOfBirth: ''
  });

  useEffect(() => {
    if (isModalOpen) {
      fetchPatients();
    }
  }, [isModalOpen]);

  const fetchPatients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const patientsData = await getAllPatients();
      setPatients(patientsData);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(t('patientSelection.errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.phone && patient.phone.includes(searchTerm))
  );

  const handleSelectPatient = (patient) => {
    updateFormData({ patient });
    nextStep();
  };

  const handleCreatePatient = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const patientData = {
        firstName: newPatient.firstName,
        middleName: newPatient.middleName,
        lastName: newPatient.lastName,
        email: newPatient.email,
        phoneNumber: `${newPatient.countryCode} ${newPatient.phoneNumber}`,
        gender: newPatient.gender,
        dateOfBirth: newPatient.dateOfBirth
      };
      
      const createdPatient = await createPatient(patientData);
      
      setSuccessMessage(t('patientSelection.success.created'));
      
      // Auto-select the newly created patient
      setTimeout(() => {
        updateFormData({ 
          patient: {
            id: createdPatient.id,
            name: createdPatient.name,
            email: createdPatient.email
          }
        });
        setIsModalOpen(false);
        nextStep();
      }, 1500);
      
    } catch (err) {
      console.error('Error creating patient:', err);
      setError(err.message || t('patientSelection.errors.failedToCreate'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPatient(prev => ({ ...prev, [name]: value }));
  };

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="step-container">
      <h2>{t('patientSelection.title')}</h2>
      
      {formData?.patient ? (
        <div className="selected-patient">
          <h3>{t('patientSelection.selectedPatient')}:</h3>
          <div className="patient-card">
            <div className="patient-name">{formData.patient.name}</div>
            <div className="patient-email">{formData.patient.email}</div>
            <button 
              className="change-patient-btn"
              onClick={() => setIsModalOpen(true)}
            >
              {t('patientSelection.buttons.changePatient')}
            </button>
          </div>
          <button className="next-btn" onClick={nextStep}>
            {t('patientSelection.buttons.continueToQuestions')}
          </button>
        </div>
      ) : (
        <div className="select-patient-initial">
          <button 
            className="select-patient-btn"
            onClick={() => setIsModalOpen(true)}
          >
            {t('patientSelection.buttons.selectPatient')}
          </button>
        </div>
      )}

    {isModalOpen && (
  <div className="patient-modal-overlay" onClick={() => !isLoading && setIsModalOpen(false)}>
    <div className="patient-modal-container" onClick={(e) => e.stopPropagation()}>
      
      {/* Modal Header */}
      <div className="patient-modal-header">
        <h2 className="patient-modal-title">{t('patientSelection.modal.title')}</h2>
        <button 
          className="patient-modal-close"
          onClick={() => {
            setIsModalOpen(false);
            clearMessages();
          }}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="patient-modal-tabs">
        <button 
          className={`patient-tab ${activeTab === 'select' ? 'patient-tab-active' : ''}`}
          onClick={() => {
            setActiveTab('select');
            clearMessages();
          }}
          disabled={isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {t('patientSelection.modal.tabs.select')}
        </button>
        <button 
          className={`patient-tab ${activeTab === 'create' ? 'patient-tab-active' : ''}`}
          onClick={() => {
            setActiveTab('create');
            clearMessages();
          }}
          disabled={isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M16 11h6m-3-3v6" />
          </svg>
          {t('patientSelection.modal.tabs.create')}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="patient-modal-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="patient-error-dismiss">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="patient-modal-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
          </svg>
          {successMessage}
        </div>
      )}

      {isLoading && (
        <div className="patient-modal-loading">
          <div className="patient-loading-spinner"></div>
          <p>{t('patientSelection.loading.processing')}</p>
        </div>
      )}

      {/* Tab Content */}
      <div className="patient-modal-content">
        {activeTab === 'select' ? (
          <div className="patient-select-tab">
            <div className="patient-search-container">
              <svg className="patient-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="patient-search-input"
                placeholder={t('patientSelection.search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="patient-list-container">
              {filteredPatients.length > 0 ? (
                <div className="patient-list">
                  {filteredPatients.map(patient => (
                    <div 
                      key={patient.id}
                      className="patient-list-item"
                      onClick={() => !isLoading && handleSelectPatient(patient)}
                    >
                      <div className="patient-avatar">
                        {patient.name ? patient.name.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div className="patient-info">
                        <div className="patient-name">{patient.name}</div>
                        <div className="patient-contact">
                          {patient.email && <span className="patient-email">{patient.email}</span>}
                          {patient.phone && <span className="patient-phone">{patient.phone}</span>}
                        </div>
                      </div>
                      <div className="patient-select-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  <p>{t('patientSelection.search.noPatientsFound')}</p>
                  <span>{t('patientSelection.search.tryAdjusting')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="patient-create-tab">
            <form className="patient-form" onSubmit={(e) => e.preventDefault()}>
              <div className="patient-form-row">
                <div className="patient-form-group">
                  <label htmlFor="firstName" className="patient-form-label">
                    {t('patientSelection.form.firstName')} *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    className="patient-form-input"
                    value={newPatient.firstName}
                    onChange={handleInputChange}
                    placeholder={t('patientSelection.form.placeholders.firstName')}
                    disabled={isLoading}
                  />
                </div>

                <div className="patient-form-group">
                  <label htmlFor="middleName" className="patient-form-label">
                    {t('patientSelection.form.middleName')}
                  </label>
                  <input
                    type="text"
                    id="middleName"
                    name="middleName"
                    className="patient-form-input"
                    value={newPatient.middleName}
                    onChange={handleInputChange}
                    placeholder={t('patientSelection.form.placeholders.middleName')}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="patient-form-group">
                <label htmlFor="lastName" className="patient-form-label">
                  {t('patientSelection.form.lastName')} *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className="patient-form-input"
                  value={newPatient.lastName}
                  onChange={handleInputChange}
                  placeholder={t('patientSelection.form.placeholders.lastName')}
                  disabled={isLoading}
                />
              </div>

              <div className="patient-form-group">
                <label htmlFor="email" className="patient-form-label">
                  {t('patientSelection.form.email')} *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="patient-form-input"
                  value={newPatient.email}
                  onChange={handleInputChange}
                  placeholder={t('patientSelection.form.placeholders.email')}
                  disabled={isLoading}
                />
              </div>

              <div className="patient-form-row">
                <div className="patient-form-group">
                  <label htmlFor="gender" className="patient-form-label">
                    {t('patientSelection.form.gender')} *
                  </label>
                  <select 
                    id="gender"
                    name="gender" 
                    className="patient-form-select"
                    value={newPatient.gender}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  >
                    <option value="">{t('patientSelection.form.placeholders.selectGender')}</option>
                    <option value="Male">{t('patientSelection.form.genderOptions.male')}</option>
                    <option value="Female">{t('patientSelection.form.genderOptions.female')}</option>
                    <option value="Other">{t('patientSelection.form.genderOptions.other')}</option>
                  </select>
                </div>

                <div className="patient-form-group">
                  <label htmlFor="dateOfBirth" className="patient-form-label">
                    {t('patientSelection.form.dateOfBirth')} *
                  </label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    className="patient-form-input"
                    value={newPatient.dateOfBirth}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="patient-form-group">
                <label htmlFor="phone" className="patient-form-label">
                  {t('patientSelection.form.phoneNumber')} *
                </label>
                <div className="patient-phone-input">
                  <select 
                    name="countryCode" 
                    className="patient-phone-code"
                    value={newPatient.countryCode}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  >
                    <option value="+7">+7 (RU)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+49">+49 (DE)</option>
                    <option value="+33">+33 (FR)</option>
                  </select>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    className="patient-phone-number"
                    value={newPatient.phoneNumber}
                    onChange={handleInputChange}
                    placeholder={t('patientSelection.form.placeholders.phoneNumber')}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="patient-form-actions">
                <button 
                  type="button"
                  className="patient-form-cancel"
                  onClick={() => {
                    setIsModalOpen(false);
                    clearMessages();
                  }}
                  disabled={isLoading}
                >
                  {t('patientSelection.buttons.cancel')}
                </button>
                <button 
                  type="button"
                  className="patient-form-submit"
                  disabled={!newPatient.firstName || !newPatient.lastName || 
                           !newPatient.email || !newPatient.phoneNumber ||
                           !newPatient.dateOfBirth || !newPatient.gender || isLoading}
                  onClick={handleCreatePatient}
                >
                  {isLoading ? (
                    <>
                      <div className="patient-button-spinner"></div>
                      {t('patientSelection.buttons.creating')}
                    </>
                  ) : (
                    t('patientSelection.buttons.createPatient')
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default PatientSelection;