import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api, { addSpecialty } from '../utils/api';
import '../styles/AnalysisForms.css';

function AddSpecialtyForm() {
  const { t } = useTranslation('add_specialty');
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    tests: [''],
  });
  const [errors, setErrors] = useState({});

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

  const handleTestChange = (index, value) => {
    const newTests = [...formData.tests];
    newTests[index] = value;
    setFormData((prev) => ({
      ...prev,
      tests: newTests,
    }));
    if (errors.tests) {
      setErrors((prev) => ({
        ...prev,
        tests: '',
      }));
    }
  };

  const addTestField = () => {
    setFormData((prev) => ({
      ...prev,
      tests: [...prev.tests, ''],
    }));
  };

  const removeTestField = (index) => {
    if (formData.tests.length > 1) {
      const newTests = formData.tests.filter((_, i) => i !== index);
      setFormData((prev) => ({
        ...prev,
        tests: newTests,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = t('field_required');
    }
    if (formData.tests.some((test) => !test.trim())) {
      newErrors.tests = t('field_required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        const formattedTests = formData.tests
          .filter((test) => test.trim())
          .map((test) => ({ name: test }));
        
        await addSpecialty({
          name: formData.name,
          tests: formattedTests,
        });
        toast.success(t('success'));
        navigate('/analysis');
      } catch (error) {
        toast.error(error.response?.data?.message || t('failed'));
        if (error.response?.status === 401) {
          delete api.defaults.headers.common["Authorization"];
          navigate('/manager-signin');
        }
      }
    }
  };

  const handleCancel = () => {
    navigate('/analysis');
  };

  return (

          <div className="specialty-form-container">
            <div className="specialty-form-card">
              <button className="specialty-cancel-btn" onClick={handleCancel} title={t('cancel')}>
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
                <h2 className="specialty-form-title">{t('title')}</h2>
                <form onSubmit={handleSubmit} className="specialty-form">
                  <div className="form-row">
                    <div className="form-field full-width">
                      <label>
                        {t('name')} <span className="required-asterisk">*</span>
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
                    <div className="form-field full-width">
                      <label>
                        {t('Tests')} <span className="required-asterisk">*</span>
                      </label>
                      {formData.tests.map((test, index) => (
                        <div key={index} className="specialty-test-field">
                          <div className="test-input-group">
                            <input
                              type="text"
                              value={test}
                              onChange={(e) => handleTestChange(index, e.target.value)}
                              placeholder={t('test_placeholder', { index: index + 1 })}
                              className={errors.tests ? 'error' : ''}
                            />
                            {formData.tests.length > 1 && (
                              <button
                                type="button"
                                className="specialty-remove-test-icon"
                                onClick={() => removeTestField(index)}
                                title={t('remove_test')}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {errors.tests && <span className="field-error">{errors.tests}</span>}
                      <button
                        type="button"
                        className="specialty-add-test-btn"
                        onClick={addTestField}
                      >
                        {t('add_test')}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="specialty-save-btn">
                    {t('save_changes')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        
  );
}

export default AddSpecialtyForm;