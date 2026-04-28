import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { getDoctorById, updateDoctor } from '../utils/api';
import '../styles/DoctorsForm.css';

function EditDoctorForm() {
  const { t } = useTranslation('edit_doctor');
  const { id } = useParams();
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    age: '',
    email: '',
    phoneNumber: '',
    specialty: '',
    placeOfWork: '',
    regalia: '',
    services: [],
    feesAmount: '',
    currency: 'RUB',
    profileImage: null,
    imageUrl: '',
    branches: [],
    notificationLanguage: 'en',
    comments: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  const navigate = useNavigate();

  const serviceTypeOptions = [
    { value: 'Online', label: t('service_online') },
    { value: 'Offline', label: t('service_offline') }
  ];

  const genderOptions = [
    { value: 'Male', label: t('gender_male') },
    { value: 'Female', label: t('gender_female') },
    { value: 'Other', label: t('gender_other') }
  ];

  const currencyOptions = [
    { value: 'RUB', label: 'RUB' },
    { value: 'INR', label: 'INR' },
  ];

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "ru", label: "Русский" },
  ];

  const specialtyOptions = [
    { value: 'Neurology', label: t('specialty_neurology', { defaultValue: 'Neurology' }) },
    { value: 'Cardiology', label: t('specialty_cardiology', { defaultValue: 'Cardiology' }) },
    { value: 'Dermatology', label: t('specialty_dermatology', { defaultValue: 'Dermatology' }) }
  ];

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date('2025-09-14'); // Updated to match current date
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await getDoctorById(id);
        const doctor = response.data.doctor;
        const calculatedAge = calculateAge(doctor.dateOfBirth);
        setFormData({
          firstName: doctor.firstName || '',
          middleName: doctor.middleName || '',
          lastName: doctor.lastName || '',
          dateOfBirth: doctor.dateOfBirth ? new Date(doctor.dateOfBirth).toISOString().split('T')[0] : '',
          gender: doctor.gender || '',
          age: calculatedAge,
          email: doctor.email || '',
          phoneNumber: doctor.phoneNumber || '',
          specialty: doctor.specialty || '',
          placeOfWork: doctor.placeOfWork || '',
          regalia: doctor.regalia || '',
          services: Array.isArray(doctor.services) ? doctor.services : [],
          feesAmount: doctor.feesAmount ? doctor.feesAmount.toString() : '',
          currency: doctor.currency || 'RUB',
          profileImage: null,
          imageUrl: doctor.profilePicture || '',
          branches: Array.isArray(doctor.branches) ? doctor.branches : [],
          notificationLanguage: doctor.notificationLanguage || 'en',
          comments: doctor.comments || '',
        });
        setPreviewImage(doctor.profilePicture ? `data:image/jpeg;base64,${doctor.profilePicture}` : null);
        setLoading(false);
      } catch (error) {
        toast.error(t('error_fetch'));
        navigate('/doctors');
      }
    };
    fetchDoctor();
  }, [id, navigate, t]);

  useEffect(() => {
    if (formData.dateOfBirth) {
      setFormData(prev => ({
        ...prev,
        age: calculateAge(formData.dateOfBirth)
      }));
    }
  }, [formData.dateOfBirth]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('image_size_error'));
        return;
      }
      const filetypes = /jpeg|jpg|png/;
      if (!filetypes.test(file.type)) {
        toast.error(t('image_type_error'));
        return;
      }
      setFormData(prev => ({
        ...prev,
        profileImage: file
      }));
      setPreviewImage(URL.createObjectURL(file));
      if (errors.profileImage) {
        setErrors(prev => ({
          ...prev,
          profileImage: ''
        }));
      }
    }
  };

  const handleServicesChange = (selectedOptions) => {
    const selectedValues = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setFormData(prev => ({
      ...prev,
      services: selectedValues
    }));

    if (errors.services) {
      setErrors(prev => ({
        ...prev,
        services: ''
      }));
    }
  };

  const handleGenderChange = (selectedOption) => {
    setFormData(prev => ({
      ...prev,
      gender: selectedOption ? selectedOption.value : ''
    }));

    if (errors.gender) {
      setErrors(prev => ({
        ...prev,
        gender: ''
      }));
    }
  };

  const handleCurrencyChange = (selectedOption) => {
    setFormData(prev => ({
      ...prev,
      currency: selectedOption ? selectedOption.value : 'RUB'
    }));

    if (errors.currency) {
      setErrors(prev => ({
        ...prev,
        currency: ''
      }));
    }
  };

  const handleSpecialtyChange = (selectedOption) => {
    setFormData(prev => ({
      ...prev,
      specialty: selectedOption ? selectedOption.value : ''
    }));

    if (errors.specialty) {
      setErrors(prev => ({
        ...prev,
        specialty: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t('first_name_required');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t('last_name_required');
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = t('date_of_birth_required');
    } else {
      const age = calculateAge(formData.dateOfBirth);
      if (!age || parseInt(age) < 18) {
        newErrors.dateOfBirth = t('age_minimum');
      }
    }

    if (!formData.gender) {
      newErrors.gender = t('gender_required');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('email_required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('email_invalid');
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = t('phone_number_required');
    }

    if (!formData.specialty) {
      newErrors.specialty = t('specialty_required');
    }

    if (!formData.placeOfWork.trim()) {
      newErrors.placeOfWork = t('place_of_work_required');
    }

    if (!Array.isArray(formData.services) || formData.services.length === 0) {
      newErrors.services = t('services_required');
    }

    if (!formData.feesAmount || isNaN(formData.feesAmount) || parseFloat(formData.feesAmount) <= 0) {
      newErrors.feesAmount = t('fees_amount_invalid');
    }

    if (!formData.currency) {
      newErrors.currency = t('currency_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('firstName', formData.firstName);
        formDataToSend.append('middleName', formData.middleName);
        formDataToSend.append('lastName', formData.lastName);
        formDataToSend.append('dateOfBirth', formData.dateOfBirth);
        formDataToSend.append('gender', formData.gender);
        formDataToSend.append('age', parseInt(formData.age));
        formDataToSend.append('email', formData.email);
        formDataToSend.append('phoneNumber', formData.phoneNumber);
        formDataToSend.append('specialty', formData.specialty);
        formDataToSend.append('placeOfWork', formData.placeOfWork);
        formDataToSend.append('regalia', formData.regalia);
        formDataToSend.append('services', JSON.stringify(formData.services));
        formDataToSend.append('feesAmount', parseFloat(formData.feesAmount));
        formDataToSend.append('currency', formData.currency);
        formDataToSend.append('notificationLanguage', formData.notificationLanguage || 'en');
        formDataToSend.append('comments', formData.comments || '');
        formData.branches.forEach((branch) => formDataToSend.append('branches', branch));        if (formData.profileImage) {
          formDataToSend.append('profileImage', formData.profileImage);
        }

        await updateDoctor(id, formDataToSend);
        toast.success(t('success'));
        navigate('/doctors');
      } catch (error) {
        toast.error(error.response?.data?.message || t('failed'));
      }
    }
  };

  const handleCancel = () => {
    navigate('/doctors');
  };

  if (loading) {
    return <div>{t('loading')}</div>;
  }

  return (
    <div className="modern-form-container">
      <div className="modern-form-card">
        <button className="cancel-btn" onClick={handleCancel} title={t('cancel')}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="form-section">
          <h2 className="form-title">{t('title')}</h2>

          <div className="photo-section">
            <div className="photo-circle">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt={t('profile_image_alt')}
                  className="profile-image-select"
                />
              ) : (
                <div className="photo-placeholder">
                  <svg className="camera-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="photo-text">{t('upload_photo')}</span>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                className="photo-input"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="modern-form">
            <div className="form-row">
              <div className="form-field">
                <label>{t('first_name')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t('first_name_placeholder')}
                  className={errors.firstName ? 'error' : ''}
                />
                {errors.firstName && <span className="field-error">{errors.firstName}</span>}
              </div>

              <div className="form-field">
                <label>{t('last_name')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t('last_name_placeholder')}
                  className={errors.lastName ? 'error' : ''}
                />
                {errors.lastName && <span className="field-error">{errors.lastName}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{t('middle_name')}</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  placeholder={t('middle_name_placeholder')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('date_of_birth')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={errors.dateOfBirth ? 'error' : ''}
                />
                {errors.dateOfBirth && <span className="field-error">{errors.dateOfBirth}</span>}
              </div>

              <div className="form-field">
                <label>{t('age')}</label>
                <input
                  type="text"
                  name="age"
                  value={formData.age}
                  readOnly
                  placeholder={t('age')}
                  className="read-only"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('gender')} <span className="required-asterisk">{t('required')}</span></label>
                <Select
                  options={genderOptions}
                  value={genderOptions.find(option => option.value === formData.gender)}
                  onChange={handleGenderChange}
                  className={errors.gender ? 'error' : ''}
                  classNamePrefix="react-select"
                  placeholder={t('select_gender')}
                />
                {errors.gender && <span className="field-error">{errors.gender}</span>}
              </div>

              <div className="form-field">
                <label>{t('phone_number')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder={t('phone_number_placeholder')}
                  className={errors.phoneNumber ? 'error' : ''}
                />
                {errors.phoneNumber && <span className="field-error">{errors.phoneNumber}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('email')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={t('email_placeholder')}
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="form-field">
                <label>{t('specialty')} <span className="required-asterisk">{t('required')}</span></label>
                <Select
                  options={specialtyOptions}
                  value={specialtyOptions.find(option => option.value === formData.specialty)}
                  onChange={handleSpecialtyChange}
                  className={errors.specialty ? 'error' : ''}
                  classNamePrefix="react-select"
                  placeholder={t('select_specialty', { defaultValue: 'Select specialty' })}
                />
                {errors.specialty && <span className="field-error">{errors.specialty}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{t('place_of_work')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="text"
                  name="placeOfWork"
                  value={formData.placeOfWork}
                  onChange={handleChange}
                  placeholder={t('place_of_work_placeholder')}
                  className={errors.placeOfWork ? 'error' : ''}
                />
                {errors.placeOfWork && <span className="field-error">{errors.placeOfWork}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{t('regalia')}</label>
                <input
                  type="text"
                  name="regalia"
                  value={formData.regalia}
                  onChange={handleChange}
                  placeholder={t('regalia_placeholder')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('service_type')} <span className="required-asterisk">{t('required')}</span></label>
                <Select
                  isMulti
                  options={serviceTypeOptions}
                  value={serviceTypeOptions.filter(option => formData.services.includes(option.value))}
                  onChange={handleServicesChange}
                  className={errors.services ? 'error' : ''}
                  classNamePrefix="react-select"
                  placeholder={t('select_service_types')}
                />
                {errors.services && <span className="field-error">{errors.services}</span>}
              </div>

              <div className="form-field">
                <label>{t('fees_amount')} <span className="required-asterisk">{t('required')}</span></label>
                <input
                  type="number"
                  name="feesAmount"
                  value={formData.feesAmount}
                  onChange={handleChange}
                  placeholder={t('fees_amount_placeholder')}
                  min="0"
                  step="0.01"
                  className={errors.feesAmount ? 'error' : ''}
                />
                {errors.feesAmount && <span className="field-error">{errors.feesAmount}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('currency')} <span className="required-asterisk">{t('required')}</span></label>
                <Select
                  options={currencyOptions}
                  value={currencyOptions.find(option => option.value === formData.currency)}
                  onChange={handleCurrencyChange}
                  className={errors.currency ? 'error' : ''}
                  classNamePrefix="react-select"
                  placeholder={t('select_currency')}
                />
                {errors.currency && <span className="field-error">{errors.currency}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('notification_language', { defaultValue: 'Notification Language' })}</label>
                <Select
                  options={languageOptions}
                  value={languageOptions.find(option => option.value === formData.notificationLanguage)}
                  onChange={handleLanguageChange}
                  classNamePrefix="react-select"
                  placeholder="Select notification language"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>{t('comments', { defaultValue: 'Comments' })}</label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  className="form-textarea"
                  placeholder={t('comments_placeholder', { defaultValue: 'Enter any additional comments' })}
                  rows={3}
                />
              </div>
            </div>

            <button type="submit" className="save-changes-btn">
              {t('save_changes')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditDoctorForm;