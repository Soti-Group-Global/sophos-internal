/**
 * ForgotPassword Component
 * 
 * Features:
 * - Email validation with regex
 * - Multi-language support (EN/RU)
 * - Loading states and error handling
 * - Email sent confirmation screen
 * - Mobile responsive design with glass morphism UI
 * - Back to login navigation
 * - Consistent styling with ManagerSignIn
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { RiTranslate, RiArrowLeftLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import InputField from '../components/InputField';
import logo from '../assets/logo.png';
import background from '../assets/background.jpg';
import '../styles/ForgotPassword.css';
import { forgotPassword } from '../utils/api';

function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const isRu = i18n.language?.startsWith('ru');
  const logoSrc = isRu ? '/logo_ru.png' : '/logo_en.png';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (!emailRegex.test(value)) {
      setEmailError(t('forgotPassword.emailError'));
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (emailError || !email) {
      toast.error(t('forgotPassword.validationError'));
      return;
    }

    try {
      setLoading(true);
      const response = await forgotPassword({ email, language: i18n.language });
      
      setIsEmailSent(true);
      toast.success(t('forgotPassword.successMessage'));
    } catch (err) {
      
      const errorMessage = err.response?.data?.message || t('forgotPassword.errorMessage');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${background})` }}>
      {/* Language Switcher - Top Right */}
      <div className="auth-language-switcher">
        <button
          className="auth-lang-trigger"
          onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
          aria-label="Change Language"
        >
          <RiTranslate size={20} />
          <span className="auth-lang-text">{i18n.language === 'en' ? 'EN' : 'RU'}</span>
        </button>
        {isLangDropdownOpen && (
          <div className="auth-lang-dropdown">
            <button
              className={`auth-lang-option ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => {
                i18n.changeLanguage('en');
                setIsLangDropdownOpen(false);
              }}
            >
              English
            </button>
            <button
              className={`auth-lang-option ${i18n.language === 'ru' ? 'active' : ''}`}
              onClick={() => {
                i18n.changeLanguage('ru');
                setIsLangDropdownOpen(false);
              }}
            >
              Русский
            </button>
          </div>
        )}
      </div>

      <div className="auth-box">
        {/* Back to Login Link */}
        <Link to="/manager-signin" className="back-to-login">
          <RiArrowLeftLine size={16} />
          {t('forgotPassword.backToLogin')}
        </Link>

        <img src={logoSrc} alt={t('forgotPassword.logoAlt')} className="auth-logo" />
        
        {!isEmailSent ? (
          <>
            <h2>{t('forgotPassword.title')}</h2>
            <p className="forgot-description">{t('forgotPassword.description')}</p>
            
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <InputField
                  type="email"
                  placeholder={t('forgotPassword.emailPlaceholder')}
                  label={t('forgotPassword.email')}
                  value={email}
                  onChange={handleEmailChange}
                />
                {emailError && <p style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{emailError}</p>}
              </div>
              
              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading ? t('forgotPassword.sending') : t('forgotPassword.sendButton')}
              </button>
            </form>
          </>
        ) : (
          <div className="email-sent-container">
            <div className="success-icon">✉️</div>
            <h2>{t('forgotPassword.emailSentTitle')}</h2>
            <p className="email-sent-description">{t('forgotPassword.emailSentDescription')}</p>
            <button
              type="button"
              className="auth-button secondary"
              onClick={() => {
                setIsEmailSent(false);
                setEmail('');
                setEmailError('');
              }}
            >
              {t('forgotPassword.sendAnotherEmail')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;