import { useState, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import InputField from "../components/InputField";
import logo from "../assets/logo.png";
import logo_en from "../assets/logo_en.png";
import logo_ru from "../assets/logo_ru.png";
import background from "../assets/background.jpg";
import "../styles/DoctorLogin.css";
import { AuthContext } from "../context/AuthContext";
import { doctorSignin, sendPasswordResetEmail } from "../utils/api";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

function DoctorLogin() {
  const navigate = useNavigate();
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

  const { login } = useContext(AuthContext);

  const currentLogo = i18n.language === "ru" ? logo_ru : logo_en;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    // Test localStorage
    localStorage.setItem("testKey", "testValue");

    const savedEmail = localStorage.getItem("doctorEmail");
    const savedPassword = localStorage.getItem("doctorPassword");
    const savedRememberMe = localStorage.getItem("rememberMe") === "true";

    if (savedRememberMe && savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (!emailRegex.test(value)) {
      setEmailError(t("doctorLogin.emailError"));
    } else {
      setEmailError("");
    }
  };

  const handleResetEmailChange = (e) => {
    const value = e.target.value;
    setResetEmail(value);
    if (!emailRegex.test(value)) {
      setResetEmailError(t("doctorLogin.emailError"));
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
    setResetEmail(email); // Pre-fill with the email from login form if available
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
      await sendPasswordResetEmail({ email: resetEmail });
      setResetEmailSent(true);
      toast.success(t("forgotPassword.success.emailSent"));
    } catch (err) {
      console.error("Forgot password error:", err);
      toast.error(
        err.response?.data?.message || t("forgotPassword.errors.general"),
      );
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();

    if (emailError || !email || !password) {
      toast.error(t("doctorLogin.validationError"));
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await doctorSignin({ email, password });
      const { accessToken, refreshToken, user } = data;

      if (!accessToken || !refreshToken || !user) {
        toast.error(t("doctorLogin.errorMessage"));
        return;
      }

      if (rememberMe) {
        localStorage.setItem("doctorEmail", email);
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("doctorEmail");
        localStorage.removeItem("rememberMe");
      }

      await login(accessToken, refreshToken, user);
      toast.success(t("doctorLogin.successMessage"));

      // navigate once the context login has completed
      navigate("/appointments");
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      console.error("DoctorSignIn error:", { status, message });

      if (status === 401) {
        toast.error(
          t("doctorLogin.invalidCredentials") || "Invalid email or password",
        );
      } else if (status === 500) {
        toast.error(
          t("doctorLogin.serverError") ||
            "Server error, please try again later",
        );
      } else {
        toast.error(message || t("doctorLogin.errorMessage"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const languageOptions = [
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
  ];

  const currentLanguage =
    languageOptions.find((lang) => lang.code === i18n.language) ||
    languageOptions[0];

  return (
    <div className="doctor-login-container">
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
        <Navbar />

        <div className="auth-box">
          <img
            src={currentLogo}
            alt="Health Direct Logo"
            className="auth-logo"
          />

          {!showForgotPassword ? (
            // Login Form
            <>
              <h2 className="auth-title">{t("doctorLogin.title")}</h2>

              <form className="auth-form">
                <div className="input-group">
                  <InputField
                    type="email"
                    placeholder={t("doctorLogin.emailPlaceholder")}
                    label={t("doctorLogin.emailLabel")}
                    value={email}
                    onChange={handleEmailChange}
                    error={emailError}
                  />

                  <InputField
                    type={showPassword ? "text" : "password"}
                    placeholder={t("doctorLogin.passwordPlaceholder")}
                    label={t("doctorLogin.passwordLabel")}
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
                      {t("doctorLogin.rememberMe")}
                    </span>
                  </label>

                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={openForgotPassword}
                  >
                    {t("doctorLogin.forgotPassword")}
                  </button>
                </div>

                <button
                  type="button"
                  className="auth-button"
                  onClick={handleSignIn}
                  disabled={isLoading}
                >
                  {isLoading
                    ? t("doctorLogin.loggingIn")
                    : t("doctorLogin.loginButton")}
                </button>
              </form>
            </>
          ) : (
            // Forgot Password Form
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
                        placeholder={t("doctorLogin.emailPlaceholder")}
                        label={t("doctorLogin.emailLabel")}
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
                // Success Message
                <>
                  <h2 className="auth-title">
                    {t("forgotPassword.success.title")}
                  </h2>
                  <div className="forgot-password-success">
                    <div className="success-icon">✓</div>
                    <p className="success-message">
                      {t("forgotPassword.success.message").replace(
                        /\{\{\s*email\s*\}\}|\{\s*email\s*\}/g,
                        resetEmail,
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

export default DoctorLogin;
