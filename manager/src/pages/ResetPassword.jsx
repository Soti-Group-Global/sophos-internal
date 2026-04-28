import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  RiTranslate,
  RiArrowLeftLine,
  RiLockPasswordLine,
  RiEyeLine,
  RiEyeOffLine,
  RiShieldCheckLine,
  RiCheckLine,
} from 'react-icons/ri';
import background from '../assets/background.jpg';
import { resetPassword } from '../utils/api';
import '../styles/ManagerSignIn.css';
import '../styles/ResetPassword.css';

function ResetPassword() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [done, setDone] = useState(false);

  const isRu = i18n.language?.startsWith('ru');
  const logo = isRu ? '/logo_ru.png' : '/logo_en.png';

  /* ── password strength (0–5) ── */
  const getStrength = (pwd) => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length >= 6)           s++;
    if (pwd.length >= 10)          s++;
    if (/[A-Z]/.test(pwd))         s++;
    if (/[0-9]/.test(pwd))         s++;
    if (/[^A-Za-z0-9]/.test(pwd))  s++;
    return s;
  };

  const strength = getStrength(password);
  const strengthLabels = [
    '',
    isRu ? 'Слабый'  : 'Weak',
    isRu ? 'Слабый'  : 'Weak',
    isRu ? 'Средний' : 'Fair',
    isRu ? 'Хороший' : 'Good',
    isRu ? 'Сильный' : 'Strong',
  ];

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!token) {
      toast.error(t('resetPassword.invalidToken'));
      return;
    }
    if (password.length < 6) {
      toast.error(t('resetPassword.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('resetPassword.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password, language: i18n.language });
      setDone(true);
      toast.success(t('resetPassword.successMessage'));
      setTimeout(() => navigate('/manager-signin'), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || t('resetPassword.errorMessage');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-page">
    <div className="auth-container" style={{ backgroundImage: `url(${background})` }}>

      {/* Language switcher */}
      <div className="auth-language-switcher">
        <button
          className="auth-lang-trigger"
          onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
          aria-label="Change Language"
        >
          <RiTranslate size={20} />
          <span className="auth-lang-text">{isRu ? 'RU' : 'EN'}</span>
        </button>
        {isLangDropdownOpen && (
          <div className="auth-lang-dropdown">
            <button
              className={`auth-lang-option ${!isRu ? 'active' : ''}`}
              onClick={() => { i18n.changeLanguage('en'); setIsLangDropdownOpen(false); }}
            >
              🇺🇸 English
            </button>
            <button
              className={`auth-lang-option ${isRu ? 'active' : ''}`}
              onClick={() => { i18n.changeLanguage('ru'); setIsLangDropdownOpen(false); }}
            >
              🇷🇺 Русский
            </button>
          </div>
        )}
      </div>

      {/* Card */}
      <div className="rp-card">

        {/* Back link */}
        <Link to="/manager-signin" className="rp-back">
          <RiArrowLeftLine size={15} />
          {t('forgotPassword.backToLogin')}
        </Link>

        {/* Language-aware logo */}
        <img src={logo} alt="Logo" className="rp-logo" />

        {done ? (
          /* ── Success ── */
          <div className="rp-success">
            <div className="rp-success-circle">
              <RiCheckLine size={34} />
            </div>
            <h2 className="rp-success-title">{t('resetPassword.doneTitle')}</h2>
            <p className="rp-success-msg">{t('resetPassword.doneMessage')}</p>
            <span className="rp-success-redirect">
              <span className="rp-redirect-dot" />
              {isRu ? 'Перенаправление на вход…' : 'Redirecting to sign in…'}
            </span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="rp-header">
              <h1 className="rp-title">{t('resetPassword.title')}</h1>
              <p className="rp-subtitle">{t('resetPassword.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="rp-form">

              {/* New password field */}
              <div className="rp-field">
                <label className="rp-label">{t('resetPassword.newPassword')}</label>
                <div className="rp-input-wrap">
                  <RiLockPasswordLine size={17} className="rp-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="rp-input"
                    placeholder={t('resetPassword.newPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <RiEyeOffLine size={17} /> : <RiEyeLine size={17} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="rp-strength-row">
                    <div className="rp-strength-bars">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`rp-strength-bar${i <= strength ? ` rp-s${strength}` : ''}`}
                        />
                      ))}
                    </div>
                    <span className={`rp-strength-label${strength ? ` rp-s${strength}` : ''}`}>
                      {strengthLabels[strength]}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password field */}
              <div className="rp-field">
                <label className="rp-label">{t('resetPassword.confirmPassword')}</label>
                <div className="rp-input-wrap">
                  <RiLockPasswordLine size={17} className="rp-input-icon" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={`rp-input${
                      confirmPassword
                        ? confirmPassword === password
                          ? ' rp-input--match'
                          : ' rp-input--mismatch'
                        : ''
                    }`}
                    placeholder={t('resetPassword.confirmPassword')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <RiEyeOffLine size={17} /> : <RiEyeLine size={17} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword === password && (
                  <span className="rp-match-hint">
                    <RiCheckLine size={13} />
                    {isRu ? 'Пароли совпадают' : 'Passwords match'}
                  </span>
                )}
              </div>

              <button type="submit" className="rp-submit" disabled={loading}>
                {loading ? (
                  <span className="rp-dots">
                    <span /><span /><span />
                  </span>
                ) : (
                  t('resetPassword.submit')
                )}
              </button>

            </form>
          </>
        )}
      </div>
    </div>
    </div>
  );
}

export default ResetPassword;
