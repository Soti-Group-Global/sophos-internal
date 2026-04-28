import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/VendorDetailsTab.css';

const VendorDetailsTab = ({ vendor }) => {
  const { t } = useTranslation('vendor_details');

  const formatServices = (services) => {
    if (!services || !Array.isArray(services) || services.length === 0) return t('na');
    return services.map((service) => {
      const specialtyName = service.specialtyId?.name || t('na');
      const tests = service.selectedTests?.length > 0
        ? service.selectedTests.map((test) => test.name).join(', ')
        : t('na');
      return `${specialtyName}: ${tests}`;
    }).join('; ');
  };

  return (
    <div className="vendor-details-container">
      <div className="vendor-header-modern">
        <h1 className="vendor-name-modern">{vendor.name || t('na')}</h1>
        <div className="vendor-meta-modern">
          {vendor._id && <span>{t('id', { id: vendor._id })}</span>}
          {vendor.createdAt && (
            <span>{t('created_at', { date: new Date(vendor.createdAt).toLocaleDateString() })}</span>
          )}
        </div>
      </div>

      <div className="detail-list-modern">
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('name')}</span>
          <span className="detail-value-modern highlight">{vendor.name || t('na')}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('services')}</span>
          <span className="detail-value-modern">{formatServices(vendor.services)}</span>
        </div>
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t('created_at')}</span>
          <span className="detail-value-modern">
            {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : t('na')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailsTab;