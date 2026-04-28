import { useState, useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactCountryFlag from "react-country-flag";
import InputField from "../components/InputField";
import background from "../assets/background.jpg";
import "../styles/AssitantLogin.css";
import { AuthContext } from "../context/AuthContext";
import { assistantSignin, sendPasswordResetEmail } from "../utils/api";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";

function AssistantLogin() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { code: "en", name: "English", countryCode: "US" },
    { code: "ru", name: "Русский", countryCode: "RU" },
  ];
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const { login } = useContext(AuthContext);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const savedEmail = localStorage.getItem("assistantEmail");
    const savedRememberMe = localStorage.getItem("rememberMe") === "true";

    if (savedRememberMe && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (!emailRegex.test(value)) {
      setEmailError(t("assistantLogin.emailError"));
    } else {
      setEmailError("");
    }
  };

  const handleResetEmailChange = (e) => {
    const value = e.target.value;
    setResetEmail(value);
    if (!emailRegex.test(value)) {
      setResetEmailError(t("assistantLogin.emailError"));
    } else {
      setResetEmailError("");
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleRememberMeChange = (e) => {
    setRememberMe(e.target.checked);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setShowLanguageDropdown(false);
  };

  const toggleLanguageDropdown = () => {
    setShowLanguageDropdown(!showLanguageDropdown);
  };

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetEmailError("");
    setShowForgotPassword(true);
    setResetEmailSent(false);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
  };

  const handleForgotPassword = async () => {
    if (!resetEmail || resetEmailError) {
      setResetEmailError(t("forgotPassword.errors.emailRequired"));
      return;
    }

    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail({ email: resetEmail, lang: i18n.language });
      setResetEmailSent(true);
      toast.success(t("forgotPassword.success.emailSent"));
    } catch (err) {
      console.error("Forgot password error:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      toast.error(
        err.response?.data?.message || t("forgotPassword.errors.general")
      );
    } finally {
      setIsSendingResetEmail(false);
    }
  };

const handleSignIn = async (e) => {
  e.preventDefault();

  if (emailError || !email || !password) {
    toast.error(t("assistantLogin.validationError"));
    return;
  }

  setIsLoading(true);
  try {

    //  get data directly
    const { accessToken, refreshToken, user } = await assistantSignin({ email, password });

    if (!accessToken || !refreshToken || !user) {
      throw new Error("Invalid login response: missing accessToken, refreshToken, or user");
    }

 
    if (rememberMe) {
      localStorage.setItem("assistantEmail", email);
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("assistantEmail");
      localStorage.removeItem("rememberMe");
    }

    await login(accessToken, refreshToken, user);
    toast.success(t("assistantLogin.successMessage"));
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message;


    if (status === 401) {
      toast.error(t("assistantLogin.invalidCredentials") || "Invalid email or password");
    } else if (status === 500) {
      toast.error(t("assistantLogin.serverError") || "Server error, please try again later");
    } else {
      toast.error(message || t("assistantLogin.errorMessage"));
    }
  } finally {
    setIsLoading(false);
  }
};



  return (
    <div className="assistant-login-container">
      <div className="login-lang-bar">
        <div className="language-dropdown" ref={dropdownRef}>
          <button
            className="dropdown-toggle"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            aria-expanded={showLanguageDropdown}
            aria-haspopup="true"
          >
            <ReactCountryFlag
              countryCode={currentLanguage.countryCode}
              svg
              style={{ width: "1.5em", height: "1.5em", marginRight: "8px" }}
            />
            <span className="current-language">{currentLanguage.name}</span>
            <svg
              className={`dropdown-arrow ${showLanguageDropdown ? "open" : ""}`}
              width="12" height="7" viewBox="0 0 12 7" fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showLanguageDropdown && (
            <div className="dropdown-menu">
              {languages.map((language) => (
                <button
                  key={language.code}
                  className={`dropdown-item ${i18n.language === language.code ? "active" : ""}`}
                  onClick={() => { i18n.changeLanguage(language.code); setShowLanguageDropdown(false); }}
                >
                  <ReactCountryFlag
                    countryCode={language.countryCode}
                    svg
                    style={{ width: "1.5em", height: "1.5em", marginRight: "10px" }}
                  />
                  {language.name}
                  {i18n.language === language.code && (
                    <svg className="checkmark" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.3334 4L6.00008 11.3333L2.66675 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        className="auth-container"
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        <div className="auth-box">
          <img src={i18n.language === "ru" ? "/logo_ru.png" : "/logo_en.png"} alt="Health Direct Logo" className="auth-logo" />
          {!showForgotPassword ? (
            <>
              <h2 className="auth-title">{t("assistantLogin.title")}</h2>
              <form className="auth-form">
                <div className="input-group">
                  <InputField
                    type="email"
                    placeholder={t("assistantLogin.emailPlaceholder")}
                    label={t("assistantLogin.emailLabel")}
                    value={email}
                    onChange={handleEmailChange}
                    error={emailError}
                  />
                  <InputField
                    type={showPassword ? "text" : "password"}
                    placeholder={t("assistantLogin.passwordPlaceholder")}
                    label={t("assistantLogin.passwordLabel")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    togglePassword={toggleShowPassword}
                    showPassword={showPassword}
                  />
                </div>
                <div className="auth-options">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={rememberMe}
                      onChange={handleRememberMeChange}
                    />
                    <span className="checkmark"></span>
                    <span className="checkbox-label">
                      {t("assistantLogin.rememberMe")}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={openForgotPassword}
                  >
                    {t("assistantLogin.forgotPassword")}
                  </button>
                </div>
                <button
                  type="submit"
                  className="auth-button"
                  onClick={handleSignIn}
                  disabled={isLoading}
                >
                  {isLoading
                    ? t("assistantLogin.loggingIn")
                    : t("assistantLogin.loginButton")}
                </button>
              </form>
            </>
          ) : (
            <>
              {!resetEmailSent ? (
                <>
                  <h2 className="auth-title">{t("forgotPassword.title")}</h2>
                  <p className="auth-subtitle">
                    {t("forgotPassword.instructions")}
                  </p>
                  <form className="auth-form">
                    <div className="input-group">
                      <InputField
                        type="email"
                        placeholder={t("assistantLogin.emailPlaceholder")}
                        label={t("assistantLogin.emailLabel")}
                        value={resetEmail}
                        onChange={handleResetEmailChange}
                        error={resetEmailError}
                      />
                    </div>
                    <div className="forgot-password-buttons">
                      <button
                        type="button"
                        className="auth-button secondary"
                        onClick={closeForgotPassword}
                      >
                        {t("forgotPassword.back")}
                      </button>
                      <button
                        type="button"
                        className="auth-button primary"
                        onClick={handleForgotPassword}
                        disabled={isSendingResetEmail || !!resetEmailError}
                      >
                        {isSendingResetEmail
                          ? t("forgotPassword.sending")
                          : t("forgotPassword.send")}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="auth-title">
                    {t("forgotPassword.success.title")}
                  </h2>
                  <div className="forgot-password-success">
                    <div className="success-icon">✓</div>
                    <p className="success-message">
                      {t("forgotPassword.success.message").replace(
                        /\{\{\s*email\s*\}\}|\{\s*email\s*\}/g,
                        resetEmail
                      )}
                    </p>
                    <p className="success-note">
                      {t("forgotPassword.success.note")}
                    </p>
                    <button
                      type="button"
                      className="auth-button primary"
                      onClick={closeForgotPassword}
                    >
                      {t("forgotPassword.backToLogin")}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssistantLogin;