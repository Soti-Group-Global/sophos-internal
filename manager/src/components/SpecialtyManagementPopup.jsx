import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaPlus, FaEdit, FaTrash, FaCheck } from 'react-icons/fa';
import Swal from 'sweetalert2';
import {
  getAllSpecialties,
  createSpecialty,
  updateSpecialtyMaster,
  deleteSpecialtyMaster,
  getAllSubSpecialities,
  createSubSpeciality,
  updateSubSpeciality,
  deleteSubSpeciality
} from '../utils/api';
import '../styles/SpecialtyManagementPopup.css';

const SpecialtyManagementPopup = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('specialty');
  const [specialties, setSpecialties] = useState([]);
  const [subSpecialities, setSubSpecialities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [editingSpecialty, setEditingSpecialty] = useState(null);
  const [editingSubSpeciality, setEditingSubSpeciality] = useState(null);

  const [specialtyForm, setSpecialtyForm] = useState({ name_en: '', name_ru: '' });
  const [subSpecialityForm, setSubSpecialityForm] = useState({
    name_en: '',
    name_ru: '',
    specialtyId: ''
  });

  useEffect(() => {
    fetchSpecialties();
    fetchSubSpecialities();
  }, []);

  // ======================= FETCH DATA =======================
  const fetchSpecialties = async () => {
    try {
      setLoading(true);
      const response = await getAllSpecialties();
      setSpecialties(response);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('common.error') || 'Error',
        text: error.response?.data?.message || 'Failed to fetch specialties'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubSpecialities = async () => {
    try {
      setLoading(true);
      const response = await getAllSubSpecialities();
      setSubSpecialities(response);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('common.error') || 'Error',
        text: error.response?.data?.message || 'Failed to fetch sub-specialities'
      });
    } finally {
      setLoading(false);
    }
  };

  // ======================= SPECIALTY HANDLERS =======================
  const handleEditSpecialty = (specialty) => {
    setEditingSpecialty(specialty._id);
    setSpecialtyForm({ name_en: specialty.name_en, name_ru: specialty.name_ru });
  };

  const handleSaveSpecialty = async () => {
    if (!specialtyForm.name_en.trim() || !specialtyForm.name_ru.trim()) {
      Swal.fire({
        icon: 'warning',
        title: t('common.warning') || 'Warning',
        text: 'Both English and Russian names are required'
      });
      return;
    }

    try {
      setLoading(true);
      if (editingSpecialty) {
        await updateSpecialtyMaster(editingSpecialty, specialtyForm);
        Swal.fire({
          icon: 'success',
          title: t('common.success') || 'Success',
          text: 'Specialty updated successfully',
          timer: 2000
        });
      } else {
        await createSpecialty(specialtyForm);
        Swal.fire({
          icon: 'success',
          title: t('common.success') || 'Success',
          text: 'Specialty created successfully',
          timer: 2000
        });
      }

      setEditingSpecialty(null);
      setSpecialtyForm({ name_en: '', name_ru: '' });
      fetchSpecialties();
      fetchSubSpecialities(); // Refresh to update specialty names
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('common.error') || 'Error',
        text: error.response?.data?.message || 'Failed to save specialty'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpecialty = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('common.confirm') || 'Are you sure?',
      text: 'This will delete the specialty. Sub-specialities must be deleted first.',
      showCancelButton: true,
      confirmButtonText: t('common.delete') || 'Delete',
      cancelButtonText: t('common.cancel') || 'Cancel',
      confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await deleteSpecialtyMaster(id);
        Swal.fire({
          icon: 'success',
          title: t('common.success') || 'Success',
          text: 'Specialty deleted successfully',
          timer: 2000
        });
        fetchSpecialties();
        fetchSubSpecialities();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: t('common.error') || 'Error',
          text: error.response?.data?.message || 'Failed to delete specialty'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // ======================= SUB-SPECIALITY HANDLERS =======================
  const handleEditSubSpeciality = (subSpeciality) => {
    setEditingSubSpeciality(subSpeciality._id);
    setSubSpecialityForm({
      name_en: subSpeciality.name_en,
      name_ru: subSpeciality.name_ru,
      specialtyId: subSpeciality.specialtyId._id
    });
  };

  const handleSaveSubSpeciality = async () => {
    if (!subSpecialityForm.name_en.trim() || !subSpecialityForm.name_ru.trim() || !subSpecialityForm.specialtyId) {
      Swal.fire({
        icon: 'warning',
        title: t('common.warning') || 'Warning',
        text: 'All fields are required'
      });
      return;
    }

    try {
      setLoading(true);
      if (editingSubSpeciality) {
        await updateSubSpeciality(editingSubSpeciality, subSpecialityForm);
        Swal.fire({
          icon: 'success',
          title: t('common.success') || 'Success',
          text: 'Sub-speciality updated successfully',
          timer: 2000
        });
      } else {
        await createSubSpeciality(subSpecialityForm);
        Swal.fire({
          icon: 'success',
          title: t('common.success') || 'Success',
          text: 'Sub-speciality created successfully',
          timer: 2000
        });
      }

      setEditingSubSpeciality(null);
      setSubSpecialityForm({ name_en: '', name_ru: '', specialtyId: '' });
      fetchSubSpecialities();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('common.error') || 'Error',
        text: error.response?.data?.message || 'Failed to save sub-speciality'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubSpeciality = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('common.confirm') || 'Are you sure?',
      text: 'This will delete the sub-speciality.',
      showCancelButton: true,
      confirmButtonText: t('common.delete') || 'Delete',
      cancelButtonText: t('common.cancel') || 'Cancel',
      confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await deleteSubSpeciality(id);
        Swal.fire({
          icon: 'success',
          title: t('common.success') || 'Success',
          text: 'Sub-speciality deleted successfully',
          timer: 2000
        });
        fetchSubSpecialities();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: t('common.error') || 'Error',
          text: error.response?.data?.message || 'Failed to delete sub-speciality'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="specialty-management-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="specialty-management-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="specialty-management-header">
          <h2>{t('doctorProfile.specialtyManagement.title') || 'Manage Specialties'}</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="specialty-tabs">
          <button
            className={`specialty-tab ${activeTab === 'specialty' ? 'active' : ''}`}
            onClick={() => setActiveTab('specialty')}
          >
            {t('doctorProfile.specialtyManagement.specialties') || 'Specialties'}
          </button>
          <button
            className={`specialty-tab ${activeTab === 'subSpeciality' ? 'active' : ''}`}
            onClick={() => setActiveTab('subSpeciality')}
          >
            {t('doctorProfile.specialtyManagement.subSpecialities') || 'Sub-Specialities'}
          </button>
        </div>

        {/* Content */}
        <div className="specialty-management-content">
          {activeTab === 'specialty' && (
            <div className="specialty-section">
            
              {/* Add/Edit Form - Always Visible */}
              <div className="fixed-add-section">
                <div className="specialty-form">
                <div className="form-row-inline">
                  <div className="form-group">
                    <label>
                      {t('common.nameEnglish') || 'Name (English)'} <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={specialtyForm.name_en}
                      onChange={(e) => setSpecialtyForm({ ...specialtyForm, name_en: e.target.value })}
                      placeholder="Enter English name"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      {t('common.nameRussian') || 'Name (Russian)'} <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={specialtyForm.name_ru}
                      onChange={(e) => setSpecialtyForm({ ...specialtyForm, name_ru: e.target.value })}
                      placeholder="Введите русское название"
                    />
                  </div>
                  <div className="form-actions-inline">
                    <button
                      className="save-icon-btn"
                      onClick={handleSaveSpecialty}
                      disabled={loading}
                      title={editingSpecialty ? t('common.update') : t('common.save') || 'Save'}
                    >
                      <FaCheck />
                    </button>
                    <button
                      className="cancel-icon-btn"
                      onClick={() => {
                        setEditingSpecialty(null);
                        setSpecialtyForm({ name_en: '', name_ru: '' });
                      }}
                      disabled={loading}
                      title={t('common.cancel') || 'Cancel'}
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              </div>
              </div>

              {/* List */}
              <div className="specialty-list">
                {loading && <div className="loading">{t('common.loading') || 'Loading...'}</div>}
                {!loading && specialties.length === 0 && (
                  <div className="no-data">{t('common.noData') || 'No data available'}</div>
                )}
                {!loading && specialties.map(specialty => (
                  <div key={specialty._id} className="specialty-item">
                    {editingSpecialty === specialty._id ? (
                      <div className="specialty-form">
                        <div className="form-row-inline">
                          <div className="form-group">
                            <label>
                              {t('common.nameEnglish') || 'Name (English)'} <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              value={specialtyForm.name_en}
                              onChange={(e) => setSpecialtyForm({ ...specialtyForm, name_en: e.target.value })}
                              placeholder="Enter English name"
                            />
                          </div>
                          <div className="form-group">
                            <label>
                              {t('common.nameRussian') || 'Name (Russian)'} <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              value={specialtyForm.name_ru}
                              onChange={(e) => setSpecialtyForm({ ...specialtyForm, name_ru: e.target.value })}
                              placeholder="Введите русское название"
                            />
                          </div>
                          <div className="form-actions-inline">
                            <button
                              className="save-icon-btn"
                              onClick={handleSaveSpecialty}
                              disabled={loading}
                              title={t('common.update') || 'Update'}
                            >
                              <FaCheck />
                            </button>
                            <button
                              className="cancel-icon-btn"
                              onClick={() => {
                                setEditingSpecialty(null);
                                setSpecialtyForm({ name_en: '', name_ru: '' });
                              }}
                              disabled={loading}
                              title={t('common.cancel') || 'Cancel'}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="specialty-info">
                          <div className="specialty-name">
                            <strong>EN:</strong> {specialty.name_en}
                          </div>
                          <div className="specialty-name">
                            <strong>RU:</strong> {specialty.name_ru}
                          </div>
                        </div>
                        <div className="specialty-actions">
                          <button
                            className="edit-icon-btn"
                            onClick={() => handleEditSpecialty(specialty)}
                            disabled={loading}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="delete-icon-btn"
                            onClick={() => handleDeleteSpecialty(specialty._id)}
                            disabled={loading}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'subSpeciality' && (
            <div className="subspeciality-section">
              <div className="section-header">
                  <div className="fixed-add-section">
                <div className="specialty-item">
                <div className="specialty-form">
                  <div className="form-group full-width">
                    <label>
                      {t('doctorProfile.specialtyManagement.selectSpecialty') || 'Select Specialty'} <span className="required">*</span>
                    </label>
                    <select
                      value={subSpecialityForm.specialtyId}
                      onChange={(e) => setSubSpecialityForm({ ...subSpecialityForm, specialtyId: e.target.value })}
                    >
                      <option value="">{t('common.select') || 'Select...'}</option>
                      {specialties.map(specialty => (
                        <option key={specialty._id} value={specialty._id}>
                          {i18n.language === 'ru' ? specialty.name_ru : specialty.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row-inline">
                    <div className="form-group">
                      <label>
                        {t('common.nameEnglish') || 'Name (English)'} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        value={subSpecialityForm.name_en}
                        onChange={(e) => setSubSpecialityForm({ ...subSpecialityForm, name_en: e.target.value })}
                        placeholder="Enter English name"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        {t('common.nameRussian') || 'Name (Russian)'} <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        value={subSpecialityForm.name_ru}
                        onChange={(e) => setSubSpecialityForm({ ...subSpecialityForm, name_ru: e.target.value })}
                        placeholder="Введите русское название"
                      />
                    </div>
                    <div className="form-actions-inline">
                      <button
                        className="save-icon-btn"
                        onClick={handleSaveSubSpeciality}
                        disabled={loading}
                        title={editingSubSpeciality ? t('common.update') : t('common.save') || 'Save'}
                      >
                        <FaCheck />
                      </button>
                      <button
                        className="cancel-icon-btn"
                        onClick={() => {
                          setEditingSubSpeciality(null);
                          setSubSpecialityForm({ name_en: '', name_ru: '', specialtyId: '' });
                        }}
                        disabled={loading}
                        title={t('common.cancel') || 'Cancel'}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </div>

              {/* Add/Edit Form - Always Visible */}
            
              </div>

              {/* List */}
              <div className="specialty-list">
                {loading && <div className="loading">{t('common.loading') || 'Loading...'}</div>}
                {!loading && subSpecialities.map(subSpeciality => (
                  <div key={subSpeciality._id} className="specialty-item">
                    {editingSubSpeciality === subSpeciality._id ? (
                      <div className="specialty-form">
                        <div className="form-group full-width">
                          <label>
                            {t('doctorProfile.specialtyManagement.selectSpecialty') || 'Select Specialty'} <span className="required">*</span>
                          </label>
                          <select
                            value={subSpecialityForm.specialtyId}
                            onChange={(e) => setSubSpecialityForm({ ...subSpecialityForm, specialtyId: e.target.value })}
                          >
                            <option value="">{t('common.select') || 'Select...'}</option>
                            {specialties.map(specialty => (
                              <option key={specialty._id} value={specialty._id}>
                                {i18n.language === 'ru' ? specialty.name_ru : specialty.name_en}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-row-inline">
                          <div className="form-group">
                            <label>
                              {t('common.nameEnglish') || 'Name (English)'} <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              value={subSpecialityForm.name_en}
                              onChange={(e) => setSubSpecialityForm({ ...subSpecialityForm, name_en: e.target.value })}
                              placeholder="Enter English name"
                            />
                          </div>
                          <div className="form-group">
                            <label>
                              {t('common.nameRussian') || 'Name (Russian)'} <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              value={subSpecialityForm.name_ru}
                              onChange={(e) => setSubSpecialityForm({ ...subSpecialityForm, name_ru: e.target.value })}
                              placeholder="Введите русское название"
                            />
                          </div>
                          <div className="form-actions-inline">
                            <button
                              className="save-icon-btn"
                              onClick={handleSaveSubSpeciality}
                              disabled={loading}
                              title={editingSubSpeciality ? t('common.update') : t('common.save') || 'Save'}
                            >
                              <FaCheck />
                            </button>
                            <button
                              className="cancel-icon-btn"
                              onClick={() => {
                                setEditingSubSpeciality(null);
                                setSubSpecialityForm({ name_en: '', name_ru: '', specialtyId: '' });
                              }}
                              disabled={loading}
                              title={t('common.cancel') || 'Cancel'}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="specialty-info">
                          <div className="specialty-parent">
                            <strong>{t('doctorProfile.specialtyManagement.parentSpecialty') || 'Specialty'}:</strong> {
                              i18n.language === 'ru' ? subSpeciality.specialtyId.name_ru : subSpeciality.specialtyId.name_en
                            }
                          </div>
                          <div className="specialty-name">
                            <strong>EN:</strong> {subSpeciality.name_en}
                          </div>
                          <div className="specialty-name">
                            <strong>RU:</strong> {subSpeciality.name_ru}
                          </div>
                        </div>
                        <div className="specialty-actions">
                          <button
                            className="edit-icon-btn"
                            onClick={() => handleEditSubSpeciality(subSpeciality)}
                            disabled={loading}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="delete-icon-btn"
                            onClick={() => handleDeleteSubSpeciality(subSpeciality._id)}
                            disabled={loading}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpecialtyManagementPopup;
