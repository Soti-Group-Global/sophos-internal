// ResetPassword.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import InputField from "../components/InputField";
import background from "../assets/background.jpg";
import '../styles/AssitantLogin.css';
import { resetPassword, verifyResetToken } from "../utils/api";

function ResetPassword() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        toast.error(t("resetPassword.errors.invalidToken"));
        setIsLoading(false);
        return;
      }

      try {
        const response = await verifyResetToken(token);
        setTokenValid(true);
        setEmail(response.data.email);
      } catch (err) {
        toast.error(t("resetPassword.errors.invalidToken"));
        setTokenValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token, t]);

  const validatePassword = (pwd) => {
    const minLength = pwd.length >= 8;
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);

    if (!minLength) return t("signup.errors.passwordLength");
    if (!hasSymbol) return t("signup.errors.passwordSymbol");
    if (!hasNumber) return t("signup.errors.passwordNumber");
    if (!hasUppercase) return t("signup.errors.passwordUppercase");
    if (!hasLowercase) return t("signup.errors.passwordLowercase");
    return "";
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    const error = validatePassword(value);
    setPasswordError(error);

    if (confirmPassword) {
      setConfirmPasswordError(
        value !== confirmPassword ? t("signup.errors.passwordMismatch") : ""
      );
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setConfirmPasswordError(
      value !== newPassword ? t("signup.errors.passwordMismatch") : ""
    );
  };

  const toggleShowNewPassword = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!tokenValid) {
      toast.error(t("resetPassword.errors.invalidToken"));
      return;
    }

    if (
      passwordError ||
      confirmPasswordError ||
      !newPassword ||
      !confirmPassword
    ) {
      toast.error(t("resetPassword.errors.form"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("resetPassword.errors.passwordMismatch"));
      return;
    }

    setIsResetting(true);
    try {
      await resetPassword({ token, password: newPassword });
      toast.success(t("resetPassword.success"));
      setTimeout(() => {
        navigate("/signin");
      }, 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error(
        err.response?.data?.message || t("resetPassword.errors.general")
      );
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="auth-container"
        style={{ backgroundImage: `url(${background})` }}
      >
        <div className="auth-box">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div
        className="auth-container"
        style={{ backgroundImage: `url(${background})` }}
      >
        <div className="auth-box">
          <img src={i18n.language === "ru" ? "/logo_ru.png" : "/logo_en.png"} alt="Health Direct Logo" className="auth-logo" />
          <h2>{t("resetPassword.invalidTokenTitle")}</h2>
          <p className="error-message">
            {t("resetPassword.errors.invalidToken")}
          </p>
          <button className="auth-button" onClick={() => navigate("/signin")}>
            {t("resetPassword.backToLogin")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="auth-container"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="auth-box">
        <img src={i18n.language === "ru" ? "/logo_ru.png" : "/logo_en.png"} alt="Health Direct Logo" className="auth-logo" />
        <h2>{t("resetPassword.title")}</h2>
        <p className="reset-instructions" style={{ marginBottom: "20px" }}>
          {t("resetPassword.instructions")} <strong>{email}</strong>
        </p>

        <form>
          <div className="input-group">
            <InputField
              type={showNewPassword ? "text" : "password"}
              placeholder={t("resetPassword.newPasswordPlaceholder")}
              label={t("resetPassword.newPasswordLabel")}
              value={newPassword}
              onChange={handleNewPasswordChange}
              togglePassword={toggleShowNewPassword}
              showPassword={showNewPassword}
            />
            {passwordError && (
              <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>
                {passwordError}
              </p>
            )}
            <InputField
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              label={t("resetPassword.confirmPasswordLabel")}
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              togglePassword={toggleShowConfirmPassword}
              showPassword={showConfirmPassword}
            />
            {confirmPasswordError && (
              <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>
                {confirmPasswordError}
              </p>
            )}
          </div>

          <button
            type="button"
            className="auth-button"
            onClick={handleResetPassword}
            disabled={isResetting}
          >
            {isResetting
              ? t("resetPassword.resetting")
              : t("resetPassword.button")}
          </button>
        </form>

        <p>
          <button
            type="button"
            className="link-button"
            onClick={() => navigate("/signin")}
          >
            {t("resetPassword.backToLogin")}
          </button>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
