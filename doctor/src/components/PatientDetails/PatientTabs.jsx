import React from 'react';
import { useTab } from '../../context/TabContext';
import { useTranslation } from 'react-i18next';

const PatientTabs = () => {
  const { activeTab, setActiveTab } = useTab();
  const { t } = useTranslation();

  return (
    <div className="tabs">
      <button
        onClick={() => setActiveTab('appointment')}
        className={activeTab === 'appointment' ? 'tab active' : 'tab'}
      >
        {t('tabs.appointment')}
      </button>
      <button
        onClick={() => setActiveTab('details')}
        className={activeTab === 'details' ? 'tab active' : 'tab'}
      >
        {t('tabs.patientDetails')}
      </button>
      <button
        onClick={() => setActiveTab('medical')}
        className={activeTab === 'medical' ? 'tab active' : 'tab'}
      >
        {t('tabs.medicalHistory')}
      </button>
    </div>
  );
};

export default PatientTabs;
