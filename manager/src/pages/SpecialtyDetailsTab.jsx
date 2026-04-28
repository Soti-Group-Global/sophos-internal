import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SpecialtyDetailsTab.css';

const SpecialtyDetailsTab = ({ specialty }) => {
  const { t } = useTranslation('specialty_details');

  const formatTests = (tests) => {
    if (!tests || !Array.isArray(tests) || tests.length === 0) return t('na');
    return tests.map((test) => test.name).join(', ');
  };

  return (
    <div className="specialty-details-container">
      <div className="specialty-header-modern">
        <h1 className="specialty-name-modern">{specialty.name || t('na')}</h1>
        <div className="specialty-meta-modern">
          {specialty._id && <span>{t('id', { id: specialty._id })}</span>}
          {specialty.createdAt && (
            <span>{t('created_at', { date: new Date(specialty.createdAt).toLocaleDateString() })}</span>
          )}
        </div>
      </div>

      <div className="detail-list-modern">
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('name')}</span>
          <span className="detail-value-modern highlight">{specialty.name || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('tests')}</span>
          <span className="detail-value-modern">{formatTests(specialty.tests)}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('created_at')}</span>
          <span className="detail-value-modern">
            {specialty.createdAt ? new Date(specialty.createdAt).toLocaleDateString() : t('na')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpecialtyDetailsTab;