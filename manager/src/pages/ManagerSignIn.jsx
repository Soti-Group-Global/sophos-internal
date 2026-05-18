import { useState, useContext } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { RiTranslate } from 'react-icons/ri';
import { Link, useNavigate } from 'react-router-dom';
import InputField from '../components/InputField';
import logo from '../assets/logo.png';
import background from '../assets/background.jpg';
import '../styles/ManagerSignIn.css';
import { AuthContext } from '../context/AuthContext';
import { managerSignin } from '../utils/api';

function ManagerSignIn() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (!emailRegex.test(value)) {
      setEmailError(t('login.emailError'));
    } else {
      setEmailError('');
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (emailError || !email || !password) {
      toast.error(t('login.validationError'));
      return;
    }

    try {
      setLoading(true);
      const response = await managerSignin({ email, password });
      const { token, user, refreshToken } = response.data;

      console.log("[SignIn] Login OK — request URL:", response.config?.baseURL, response.config?.url);
      console.log("[SignIn] Token received:", token ? "YES" : "NO");

      // Immediately call the backend to check if the cookie was stored
      try {
        const cookieCheck = await fetch(`${import.meta.env.VITE_BASE_URL || "http://localhost:3003"}/api/auth/cookie-check`, {
          method: "GET",
          credentials: "include",
        });
        const cookieData = await cookieCheck.json();
        console.log("[SignIn] Cookie check after login:", cookieData);
      } catch (e) {
        console.log("[SignIn] Cookie check failed:", e.message);
      }

      login(token, user, refreshToken);

      toast.success(t('login.successMessage'));

      navigate('/applications');
    } catch (err) {
      
      const errorMessage = err.response?.data?.message || t('login.errorMessage');
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
              🇺🇸 English
            </button>
            <button
              className={`auth-lang-option ${i18n.language === 'ru' ? 'active' : ''}`}
              onClick={() => {
                i18n.changeLanguage('ru');
                setIsLangDropdownOpen(false);
              }}
            >
              🇷🇺 Русский
            </button>
          </div>
        )}
      </div>

      <div className="auth-box">
        <img src="/logo_en.png" alt={t('login.logoAlt')} className="auth-logo" />
        <h2>{t('login.title')}</h2>
        <form>
          <div className="input-group">
            <InputField
              type="email"
              placeholder={t('login.emailPlaceholder')}
              label={t('login.email')}
              value={email}
              onChange={handleEmailChange}
            />
            {emailError && <p style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{emailError}</p>}
            <InputField
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder')}
              label={t('login.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              togglePassword={toggleShowPassword}
              showPassword={showPassword}
            />
          </div>
          <div className="options">
            <label className="checkbox-label">
              <input type="checkbox" className="checkbox-input" />
              <span className="custom-checkbox"></span>
              {t('login.rememberMe')}
            </label>
            <Link to="/forgot-password" className="forgot-password-link">
              {t('login.forgotPassword')}
            </Link>
          </div>
          <button
            type="button"
            className="auth-button"
            onClick={handleSignIn}
            disabled={loading}
          >
            {loading ? t('login.loggingIn') : t('login.loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ManagerSignIn;
