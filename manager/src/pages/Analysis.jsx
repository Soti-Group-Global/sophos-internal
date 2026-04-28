import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useNavigate, Link } from 'react-router-dom';
import { getSpecialties, deleteSpecialty, getVendors, deleteVendor } from '../utils/api';
import defaultUser from '../assets/default-user.png';
import '../styles/Analysis.css';

function Analysis() {
  const { t } = useTranslation('analysis');
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [specialtyPage, setSpecialtyPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);
  const [specialtyTotalPages, setSpecialtyTotalPages] = useState(1);
  const [vendorTotalPages, setVendorTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const limit = 10;

  useEffect(() => {
    fetchData();
  }, [specialtyPage, vendorPage, t]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [specialtyResponse, vendorResponse] = await Promise.all([
        getSpecialties(specialtyPage, limit),
        getVendors(vendorPage, limit),
      ]);
      setSpecialties(specialtyResponse.specialties || []);
      setVendors(vendorResponse.vendors || []);
      setSpecialtyTotalPages(specialtyResponse.pages || 1);
      setVendorTotalPages(vendorResponse.pages || 1);
      setLoading(false);
    } catch (err) {
      setError(t('error_fetch'));
      setLoading(false);
      toast.error(t('error_fetch'));
    }
  };

  const handleDeleteSpecialty = async (id) => {
    try {
      await deleteSpecialty(id);
      toast.success(t('specialty_deleted'));
      fetchData();
    } catch (error) {
      toast.error(error.message || t('delete_specialty_failed'));
    }
  };

  const handleDeleteVendor = async (id) => {
    try {
      await deleteVendor(id);
      toast.success(t('vendor_deleted'));
      fetchData();
    } catch (error) {
      toast.error(error.message || t('delete_vendor_failed'));
    }
  };

  const handleEditSpecialty = (id) => {
    navigate(`/specialties/edit/${id}`);
  };

  const handleEditVendor = (id) => {
    navigate(`/vendors/edit/${id}`);
  };

  const handleVendorClick = (id) => {
    navigate(`/vendors/${id}`);
  };

  const getProfileImageSrc = (vendor) => {
    if (vendor.profilePicture) {
      return `data:image/jpeg;base64,${vendor.profilePicture}`;
    }
    return defaultUser;
  };

  if (error) {
    return <div className="app">{error}</div>;
  }

  return (

          <div className="analysis-container">
            <div className="analysis-header">
              <div className="analysis-title">
                <h2 className="analysis-page-title">{t('title')}</h2>
                <p className="analysis-page-subtitle">{t('subtitle')}</p>
              </div>
            </div>

            {/* Specialties Section */}
            <div className="specialty-section">
              <div className="specialty-header">
                <h3 className="specialty-title">{t('Specialties')}</h3>
                <button
                  className="specialty-add-button"
                  onClick={() => navigate('/specialties/add')}
                >
                  {t('add_specialty')}
                </button>
              </div>
              {loading ? (
                <div className="analysis-loading-container">
                  <div className="analysis-spinner"></div>
                  <p className="analysis-loading-text">{t('loading')}</p>
                </div>
              ) : specialties.length > 0 ? (
                <>
                  <div className="specialty-list">
                    {specialties.map((specialty) => (
                      <div key={specialty._id} className="specialty-item">
                        <span className="specialty-name">
                          <Link to={`/specialties/${specialty._id}`}>
                            {specialty.name}
                          </Link>
                        </span>
                        <span className="specialty-tests">
                          {t('tests')}: {specialty.tests.length}
                        </span>
                        <div className="specialty-actions">
                          <button
                            className="specialty-action-btn specialty-edit-btn"
                            onClick={() => handleEditSpecialty(specialty._id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            className="specialty-action-btn specialty-delete-btn"
                            onClick={() => handleDeleteSpecialty(specialty._id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="specialty-pagination">
                    <button
                      className="specialty-page-button specialty-page-prev"
                      disabled={specialtyPage === 1}
                      onClick={() => handlePageChange('specialty', specialtyPage - 1)}
                      aria-label={t('previous')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <span className="specialty-page-info">
                      {t('page')} {specialtyPage} {t('of')} {specialtyTotalPages}
                    </span>
                    <button
                      className="specialty-page-button specialty-page-next"
                      disabled={specialtyPage === specialtyTotalPages}
                      onClick={() => handlePageChange('specialty', specialtyPage + 1)}
                      aria-label={t('next')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <p className="specialty-no-items">{t('no_specialties')}</p>
              )}
            </div>

            {/* Vendors Section */}
            <div className="vendor-section">
              <div className="vendor-header">
                <h3 className="vendor-title">{t('Vendors')}</h3>
                <button
                  className="vendor-add-button"
                  onClick={() => navigate('/vendors/add')}
                >
                  {t('add_vendor')}
                </button>
              </div>
              {loading ? (
                <div className="analysis-loading-container">
                  <div className="analysis-spinner"></div>
                  <p className="analysis-loading-text">{t('loading')}</p>
                </div>
              ) : vendors.length > 0 ? (
                <>
                  <div className="vendor-list">
                    {vendors.map((vendor) => (
                      <div
                        key={vendor._id}
                        className="vendor-item"
                        onClick={() => handleVendorClick(vendor._id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="vendor-name-container">
                          <img
                            src={getProfileImageSrc(vendor)}
                            alt={t('profile_image_alt', { name: vendor.name || 'Vendor' })}
                            className="vendor-profile-pic"
                            onError={(e) => { e.target.src = defaultUser; }}
                          />
                          <span className="vendor-name">
                            <Link to={`/vendors/${vendor._id}`}>
                              {vendor.name}
                            </Link>
                          </span>
                        </div>
                        <div
                          className="vendor-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="vendor-action-btn vendor-edit-btn"
                            onClick={() => handleEditVendor(vendor._id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            className="vendor-action-btn vendor-delete-btn"
                            onClick={() => handleDeleteVendor(vendor._id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="vendor-pagination">
                    <button
                      className="vendor-page-button vendor-page-prev"
                      disabled={vendorPage === 1}
                      onClick={() => handlePageChange('vendor', vendorPage - 1)}
                      aria-label={t('previous')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <span className="vendor-page-info">
                      {t('page')} {vendorPage} {t('of')} {vendorTotalPages}
                    </span>
                    <button
                      className="vendor-page-button vendor-page-next"
                      disabled={vendorPage === vendorTotalPages}
                      onClick={() => handlePageChange('vendor', vendorPage + 1)}
                      aria-label={t('next')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <p className="vendor-no-items">{t('no_vendors')}</p>
              )}
            </div>
          </div>
  );
}

export default Analysis;