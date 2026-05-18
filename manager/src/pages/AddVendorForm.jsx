import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import api, { addVendor, getSpecialties } from '../utils/api';
import defaultUser from '../assets/default-user.png';
import '../styles/AnalysisForms.css';

function AddVendorForm() {
  const { t } = useTranslation('add_vendor');
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    profileImage: null,
    services: [{ specialtyId: '', tests: [] }],
  });
  const [specialties, setSpecialties] = useState([]);
  const [errors, setErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(defaultUser);

  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const response = await getSpecialties(1, 100);
        setSpecialties(response.specialties || []);
      } catch (error) {
        toast.error(t('error_fetch_specialties'));
      }
    };
    fetchSpecialties();
  }, [t]);

  const specialtyOptions = specialties.map((specialty) => ({
    value: specialty._id,
    label: specialty.name,
  }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, profileImage: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFormData((prev) => ({ ...prev, profileImage: null }));
      setImagePreview(defaultUser);
    }
  };

  const handleServiceChange = (index, field, value) => {
    const newServices = [...formData.services];
    if (field === 'specialtyId') {
      newServices[index] = { ...newServices[index], specialtyId: value, tests: [] };
    } else if (field === 'tests') {
      newServices[index] = { ...newServices[index], tests: value };
    }
    setFormData((prev) => ({
      ...prev,
      services: newServices,
    }));
    if (errors.services) {
      setErrors((prev) => ({
        ...prev,
        services: '',
      }));
    }
  };

  const addServiceField = () => {
    setFormData((prev) => ({
      ...prev,
      services: [...prev.services, { specialtyId: '', tests: [] }],
    }));
  };

  const removeServiceField = (index) => {
    if (formData.services.length > 1) {
      const newServices = formData.services.filter((_, i) => i !== index);
      setFormData((prev) => ({
        ...prev,
        services: newServices,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = t('field_required');
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalid_email');
    }
    if (formData.phone && !/^\+?[\d\s-]{7,15}$/.test(formData.phone)) {
      newErrors.phone = t('invalid_phone');
    }
    if (
      formData.services.some(
        (service) => !service.specialtyId || service.tests.length === 0
      )
    ) {
      newErrors.services = t('field_required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('vendorName', formData.name);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('phone', formData.phone);
        formDataToSend.append('address', formData.address);
        if (formData.profileImage) {
          formDataToSend.append('profileImage', formData.profileImage);
        }
        formData.services.forEach((service, index) => {
          formDataToSend.append(`services[${index}][specialtyId]`, service.specialtyId);
          service.tests.forEach((test, testIndex) => {
            formDataToSend.append(`services[${index}][selectedTests][${testIndex}][testId]`, test.testId);
            formDataToSend.append(`services[${index}][selectedTests][${testIndex}][name]`, test.name);
          });
        });

        await addVendor(formDataToSend);
        toast.success(t('success'));
        navigate('/analysis');
      } catch (error) {
        toast.error(error.response?.data?.message || t('failed'));
        if (error.response?.status === 401) {
          delete api.defaults.headers.common["Authorization"];
          navigate('/');
        }
      }
    }
  };

  const handleCancel = () => {
    navigate('/analysis');
  };

  return (

          <div className="vendor-form-container">
            <div className="vendor-form-card">
              <button className="vendor-cancel-btn" onClick={handleCancel} title={t('cancel')}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="form-section">
                <h2 className="vendor-form-title">{t('title')}</h2>
                <div className="vendor-profile-pic-container">
                  <label htmlFor="profileImageInput" className="vendor-profile-pic-label">
                    <img
                      src={imagePreview}
                      alt={t('profile_image_alt', { name: formData.name || 'Vendor' })}
                      className="vendor-profile-pic"
                      onError={(e) => { e.target.src = defaultUser; }}
                    />
                    <input
                      type="file"
                      id="profileImageInput"
                      name="profileImage"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                <form onSubmit={handleSubmit} className="vendor-form">
                  <div className="form-row">
                    <div className="form-field full-width">
                      <label>
                        {t('vendorName')} <span className="required-asterisk">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={t('name_placeholder')}
                        className={errors.name ? 'error' : ''}
                      />
                      {errors.name && <span className="field-error">{errors.name}</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>{t('email')}</label>
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
                      <label>{t('phone')}</label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder={t('phone_placeholder')}
                        className={errors.phone ? 'error' : ''}
                      />
                      {errors.phone && <span className="field-error">{errors.phone}</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field full-width">
                      <label>{t('address')}</label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder={t('address_placeholder')}
                        className={errors.address ? 'error' : ''}
                      />
                      {errors.address && <span className="field-error">{errors.address}</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field full-width">
                      <label>
                        {t('services')} <span className="required-asterisk">*</span>
                      </label>
                      {formData.services.map((service, index) => {
                        const selectedSpecialty = specialties.find(
                          (s) => s._id === service.specialtyId
                        );
                        const testOptions = selectedSpecialty
                          ? selectedSpecialty.tests.map((test) => ({
                              value: { testId: test._id, name: test.name },
                              label: test.name,
                            }))
                          : [];
                        return (
                          <div key={index} className="vendor-service-field">
                            <div className="service-input-group">
                              <Select
                                options={specialtyOptions}
                                value={specialtyOptions.find(
                                  (option) => option.value === service.specialtyId
                                )}
                                onChange={(selected) =>
                                  handleServiceChange(index, 'specialtyId', selected ? selected.value : '')
                                }
                                placeholder={t('select_specialty')}
                                className={errors.services ? 'error' : ''}
                                classNamePrefix="react-select"
                              />
                              <Select
                                isMulti
                                options={testOptions}
                                value={testOptions.filter((option) =>
                                  service.tests.some((test) => test.name === option.value.name)
                                )}
                                onChange={(selected) =>
                                  handleServiceChange(
                                    index,
                                    'tests',
                                    selected ? selected.map((opt) => opt.value) : []
                                  )
                                }
                                placeholder={t('select_tests')}
                                className={errors.services ? 'error' : ''}
                                classNamePrefix="react-select"
                                isDisabled={!service.specialtyId}
                              />
                              {formData.services.length > 1 && (
                                <button
                                  type="button"
                                  className="vendor-remove-service-icon"
                                  onClick={() => removeServiceField(index)}
                                  title={t('remove_service')}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {errors.services && <span className="field-error">{errors.services}</span>}
                      <button
                        type="button"
                        className="vendor-add-service-btn"
                        onClick={addServiceField}
                      >
                        {t('add_service')}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="vendor-save-btn">
                    {t('save_changes')}
                  </button>
                </form>
              </div>
            </div>
          </div>
  );
}

export default AddVendorForm;