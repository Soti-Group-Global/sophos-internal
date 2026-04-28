import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import defaultUser from '../assets/default-user.png';
import '../styles/Profile.css';
import { getDoctor, getImage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CustomCalendar from '../components/CustomeCalendar';

const EMPTY_ML = { en: '', ru: '' };

// Strip HTML tags and return plain text
const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

const INITIAL_FORM = {
  // Personal
  firstName: { ...EMPTY_ML },
  middleName: { ...EMPTY_ML },
  lastName: { ...EMPTY_ML },
  dateOfBirth: '',
  gender: '',
  age: '',
  email: '',
  phoneNumber: '',

  // Professional
  position: { ...EMPTY_ML },
  regalia: { ...EMPTY_ML },
  yearOfExperience: '',

  // Location & Services
  location: { ...EMPTY_ML },
  branches: [],
  languages: [],
  services: { online: false, offline: false },
  expert: false,
  specialist: false,
  feesAmount: '',
  currency: 'RUB',

  // Education & Experience
  education: { ...EMPTY_ML },
  workExperience: { ...EMPTY_ML },
  advancedTraining: { ...EMPTY_ML },
  professionalDevelopments: { ...EMPTY_ML },

  // Achievements
  awards: { ...EMPTY_ML },
  internationalMemberships: { ...EMPTY_ML },
  russianMemberships: { ...EMPTY_ML },
  scientificActivities: { ...EMPTY_ML },

  // About
  about: { ...EMPTY_ML },
};

const SectionHeader = ({ sectionKey, label, isExpanded, onToggle }) => (
  <div className="profile-section-header" onClick={() => onToggle(sectionKey)}>
    <h3>{label}</h3>
    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
  </div>
);

const MLInput = ({ label, value, type = 'text' }) => (
  <div className="form-group">
    <label>{label}</label>
    <input
      type={type}
      value={value || ''}
      readOnly
      disabled
      className="input-disabled"
    />
  </div>
);

const MLTextarea = ({ label, value, rows = 3 }) => (
  <div className="form-group full-width">
    <label>{label}</label>
    <textarea
      value={value || ''}
      readOnly
      disabled
      className="input-disabled"
      rows={rows}
    />
  </div>
);

const Profile = () => {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const lang = i18n.language || 'en';

  const [image, setImage] = useState(defaultUser);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    professional: true,
    locationServices: false,
    educationExperience: false,
    achievements: false,
    about: false,
  });

  // ─── Fetch doctor profile on mount ───
  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await getDoctor();
        const d = response.data.doctor;

        setFormData({
          firstName: d.firstName || { ...EMPTY_ML },
          middleName: d.middleName || { ...EMPTY_ML },
          lastName: d.lastName || { ...EMPTY_ML },
          dateOfBirth: d.dateOfBirth?.substring(0, 10) || '',
          gender: d.gender || '',
          age: d.age ?? '',
          email: d.email || '',
          phoneNumber: d.phoneNumber || '',

          position: d.position || { ...EMPTY_ML },
          regalia: d.regalia || { ...EMPTY_ML },
          yearOfExperience: d.yearOfExperience ?? '',

          location: d.location || { ...EMPTY_ML },
          branches: d.branches || [],
          languages: d.languages || [],
          services: d.services || { online: false, offline: false },
          expert: d.expert || false,
          specialist: d.specialist || false,
          feesAmount: d.feesAmount ?? '',
          currency: d.currency || 'RUB',

          education: d.education || { ...EMPTY_ML },
          workExperience: d.workExperience || { ...EMPTY_ML },
          advancedTraining: d.advancedTraining || { ...EMPTY_ML },
          professionalDevelopments: d.professionalDevelopments || { ...EMPTY_ML },

          awards: d.awards || { ...EMPTY_ML },
          internationalMemberships: d.internationalMemberships || { ...EMPTY_ML },
          russianMemberships: d.russianMemberships || { ...EMPTY_ML },
          scientificActivities: d.scientificActivities || { ...EMPTY_ML },

          about: d.about || { ...EMPTY_ML },
        });

        if (d.profileFileId) {
          try {
            const blob = await getImage(d.profileFileId);
            setImage(URL.createObjectURL(blob));
          } catch (imgError) {
            console.warn('Profile image load failed, using default', imgError);
            // leave default image in place
          }
        }
      } catch (err) {
        // display appropriate message to user
        const msg = err.response?.data?.message;
        if (err.response?.status === 404 && msg === 'Doctor profile not found') {
          toast.error(t('profile.messages.fetchError') + ': ' + t('profile.messages.noProfile'));
          // optionally redirect home
          // navigate('/');
        } else {
          toast.error(t('profile.messages.fetchError'));
        }
        console.error('Get Doctor Error', err.response?.data || err.message);
      }
    };

    fetchDoctor();
  }, [t]);

  // Listen for WS updates
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.type === 'doctorUpdated') {
        // Re-fetch would go here
      }
    };
    window.addEventListener('ws-message', handler);
    return () => window.removeEventListener('ws-message', handler);
  }, []);

  const toggleSection = (key) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ─── Render helpers ───
  const mlValue = (field) => {
    const v = formData[field];
    const raw = typeof v === 'object' && v !== null ? (v[lang] || '') : (v || '');
    return stripHtml(raw);
  };

  const ml = (field) => mlValue(field);

  return (
    <>
      <div className="profile-container">
        {/* Profile Image */}
        <div className="profile-image-section">
          <div className="image-wrapper">
            <img
              src={image}
              onError={() => setImage(defaultUser)}
              alt="Profile"
              className="profile-img"
            />

          </div>
        </div>

        <h2 className="profile-heading">{t('profile.title')}</h2>

        {/* ═══════ PERSONAL INFORMATION ═══════ */}
        <SectionHeader sectionKey="personal" label={t('profile.sections.personal')} isExpanded={expandedSections.personal} onToggle={toggleSection} />
        {expandedSections.personal && (
          <div className="profile-form two-columns">
            <MLInput label={t('profile.form.firstName')} value={ml('firstName')} />
            <MLInput label={t('profile.form.middleName')} value={ml('middleName')} />
            <MLInput label={t('profile.form.lastName')} value={ml('lastName')} />

            <div className="form-group">
              <label>{t('profile.form.email')}</label>
              <input name="email" type="email" value={formData.email} disabled className="input-disabled" />
            </div>

            <div className="form-group">
              <label>{t('profile.form.phoneNumber')}</label>
              <input name="phoneNumber" type="tel" value={formData.phoneNumber} disabled className="input-disabled" />
            </div>

            <div className="form-group">
              <label>{t('profile.form.gender')}</label>
              <input type="text" value={formData.gender} disabled className="input-disabled" />
            </div>

            <div className="form-group">
              <label>{t('profile.form.dateOfBirth')}</label>
              <CustomCalendar
                name="dateOfBirth"
                value={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                disabled
                className="input-disabled"
              />
            </div>

            <div className="form-group">
              <label>{t('profile.form.age')}</label>
              <input name="age" type="number" value={formData.age} disabled className="input-disabled" />
            </div>
          </div>
        )}

        {/* ═══════ PROFESSIONAL DETAILS ═══════ */}
        <SectionHeader sectionKey="professional" label={t('profile.sections.professional')} isExpanded={expandedSections.professional} onToggle={toggleSection} />
        {expandedSections.professional && (
          <div className="profile-form two-columns">
            <MLInput label={t('profile.form.position')} value={ml('position')} />
            <MLInput label={t('profile.form.regalia')} value={ml('regalia')} />

            <div className="form-group">
              <label>{t('profile.form.yearOfExperience')}</label>
              <input name="yearOfExperience" type="number" value={formData.yearOfExperience} disabled className="input-disabled" />
            </div>

            <div className="form-group checkbox-row">
              <label className="checkbox-label">
                <input type="checkbox" name="expert" checked={formData.expert} disabled />
                {t('profile.form.expert')}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="specialist" checked={formData.specialist} disabled />
                {t('profile.form.specialistLabel')}
              </label>
            </div>
          </div>
        )}

        {/* ═══════ LOCATION & SERVICES ═══════ */}
        <SectionHeader sectionKey="locationServices" label={t('profile.sections.locationServices')} isExpanded={expandedSections.locationServices} onToggle={toggleSection} />
        {expandedSections.locationServices && (
          <div className="profile-form two-columns">
            <MLInput label={t('profile.form.location')} value={ml('location')} />

            <div className="form-group">
              <label>{t('profile.form.feesAmount')}</label>
              <input name="feesAmount" type="number" value={formData.feesAmount} disabled className="input-disabled" />
            </div>

            <div className="form-group">
              <label>{t('profile.form.currency')}</label>
              <input type="text" value={formData.currency} disabled className="input-disabled" />
            </div>

            <div className="form-group checkbox-row">
              <label className="service-toggle-label">{t('profile.form.services')}</label>
              <label className="checkbox-label">
                <input type="checkbox" checked={formData.services.online} disabled />
                {t('profile.form.serviceOnline')}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={formData.services.offline} disabled />
                {t('profile.form.serviceOffline')}
              </label>
            </div>
          </div>
        )}

        {/* ═══════ EDUCATION & EXPERIENCE ═══════ */}
        <SectionHeader sectionKey="educationExperience" label={t('profile.sections.educationExperience')} isExpanded={expandedSections.educationExperience} onToggle={toggleSection} />
        {expandedSections.educationExperience && (
          <div className="profile-form">
            <MLTextarea label={t('profile.form.education')} value={ml('education')} rows={3} />
            <MLTextarea label={t('profile.form.workExperience')} value={ml('workExperience')} rows={3} />
            <MLTextarea label={t('profile.form.advancedTraining')} value={ml('advancedTraining')} rows={3} />
            <MLTextarea label={t('profile.form.professionalDevelopments')} value={ml('professionalDevelopments')} rows={3} />
          </div>
        )}

        {/* ═══════ ACHIEVEMENTS & MEMBERSHIPS ═══════ */}
        <SectionHeader sectionKey="achievements" label={t('profile.sections.achievements')} isExpanded={expandedSections.achievements} onToggle={toggleSection} />
        {expandedSections.achievements && (
          <div className="profile-form">
            <MLTextarea label={t('profile.form.awards')} value={ml('awards')} rows={2} />
            <MLTextarea label={t('profile.form.internationalMemberships')} value={ml('internationalMemberships')} rows={2} />
            <MLTextarea label={t('profile.form.russianMemberships')} value={ml('russianMemberships')} rows={2} />
            <MLTextarea label={t('profile.form.scientificActivities')} value={ml('scientificActivities')} rows={2} />
          </div>
        )}

        {/* ═══════ ABOUT ═══════ */}
        <SectionHeader sectionKey="about" label={t('profile.sections.about')} isExpanded={expandedSections.about} onToggle={toggleSection} />
        {expandedSections.about && (
          <div className="profile-form">
            <MLTextarea label={t('profile.form.aboutText')} value={ml('about')} rows={4} />
          </div>
        )}

      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

export default Profile;