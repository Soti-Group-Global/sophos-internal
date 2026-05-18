import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import defaultUser from '../assets/default-user.png';
import '../styles/Profile.css';
import { getDoctor, getImage, updateDoctor } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import CustomCalendar from '../components/CustomeCalendar';

const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

const EMPTY_ML = { en: '', ru: '' };

const Profile = () => {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const lang = i18n.language || 'en';

  const [image, setImage] = useState(defaultUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: { ...EMPTY_ML },
    middleName: { ...EMPTY_ML },
    lastName: { ...EMPTY_ML },
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
  });
  const [editData, setEditData] = useState({ ...formData });

  const ml = (field) => {
    const v = formData[field];
    const raw = typeof v === 'object' && v !== null ? (v[lang] || '') : (v || '');
    return stripHtml(raw);
  };

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await getDoctor();
        const d = response.data.doctor;
        const data = {
          firstName: d.firstName || { ...EMPTY_ML },
          middleName: d.middleName || { ...EMPTY_ML },
          lastName: d.lastName || { ...EMPTY_ML },
          dateOfBirth: d.dateOfBirth?.substring(0, 10) || '',
          email: d.email || '',
          phoneNumber: d.phoneNumber || '',
        };
        setFormData(data);
        setEditData(data);

        if (d.profileFileId) {
          try {
            const blob = await getImage(d.profileFileId);
            setImage(URL.createObjectURL(blob));
          } catch {
            // keep default
          }
        }
      } catch (err) {
        toast.error(t('profile.messages.fetchError'));
      }
    };
    fetchDoctor();
  }, []);

  const handleEdit = () => {
    setEditData({ ...formData });
    setIsEditing(true);
  };

  const handleCancel = () => setIsEditing(false);

  const handleChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoctor({
        phoneNumber: editData.phoneNumber,
        dateOfBirth: editData.dateOfBirth,
      });
      setFormData((prev) => ({
        ...prev,
        phoneNumber: editData.phoneNumber,
        dateOfBirth: editData.dateOfBirth,
      }));
      setIsEditing(false);
      toast.success(t('profile.messages.updateSuccess', 'Profile updated'));
    } catch {
      toast.error(t('profile.messages.updateError', 'Failed to update profile'));
    } finally {
      setIsSaving(false);
    }
  };

  const fullName = [ml('firstName'), ml('middleName'), ml('lastName')].filter(Boolean).join(' ');
  const initials = [`${ml('firstName')}`, `${ml('lastName')}`]
    .map((s) => s[0] || '')
    .join('')
    .toUpperCase();

  return (
    <>
      <div className="dp-page">
        <div className="dp-card">
          {/* Banner */}
          <div className="dp-banner" />

          {/* Avatar */}
          <div className="dp-avatar-wrap">
            {image === defaultUser ? (
              <div className="dp-avatar-initials">{initials || '?'}</div>
            ) : (
              <img
                src={image}
                onError={() => setImage(defaultUser)}
                alt="Profile"
                className="dp-avatar-img"
              />
            )}
          </div>

          {/* Header row */}
          <div className="dp-header-row">
            <div>
              <h2 className="dp-name">{fullName || '—'}</h2>
              <p className="dp-email-subtle">{formData.email || '—'}</p>
            </div>
            {!isEditing && (
              <button className="dp-edit-btn" onClick={handleEdit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('common.edit', 'Edit')}
              </button>
            )}
          </div>

          <div className="dp-divider" />

          {/* Fields */}
          <div className="dp-fields">
            <div className="dp-field">
              <span className="dp-field-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.87 2 2 0 0 1 3.58 2.68h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {t('profile.form.phoneNumber')}
              </span>
              {isEditing ? (
                <div className="dp-phone-wrap">
                  <PhoneInput
                    country="ru"
                    value={editData.phoneNumber}
                    onChange={(val) => handleChange('phoneNumber', '+' + val)}
                    inputClass="dp-phone-input"
                    buttonClass="dp-phone-flag-btn"
                    containerClass="dp-phone-container"
                    enableSearch
                  />
                </div>
              ) : (
                <span className="dp-field-value">{formData.phoneNumber || '—'}</span>
              )}
            </div>

            <div className="dp-field">
              <span className="dp-field-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {t('profile.form.dateOfBirth')}
              </span>
              {isEditing ? (
                <div className="dp-calendar-wrap">
                  <CustomCalendar
                    value={editData.dateOfBirth ? (() => {
                      const [y, m, d] = editData.dateOfBirth.split('-').map(Number);
                      return new Date(y, m - 1, d);
                    })() : null}
                    onChange={(date) => {
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        handleChange('dateOfBirth', `${y}-${m}-${d}`);
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    showYearDropdown
                    showMonthDropdown
                  />
                </div>
              ) : (
                <span className="dp-field-value">
                  {formData.dateOfBirth
                    ? formData.dateOfBirth.split('-').reverse().join('-')
                    : '—'}
                </span>
              )}
            </div>

            <div className="dp-field">
              <span className="dp-field-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                {t('profile.form.email')}
              </span>
              <span className="dp-field-value">{formData.email || '—'}</span>
            </div>
          </div>

          {/* Action buttons */}
          {isEditing && (
            <div className="dp-actions">
              <button className="dp-cancel-btn" onClick={handleCancel} disabled={isSaving}>
                {t('common.cancel')}
              </button>
              <button className="dp-save-btn" onClick={handleSave} disabled={isSaving}>
                {isSaving ? t('common.loading', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>
          )}
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

export default Profile;
