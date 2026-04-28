import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { toast } from "react-toastify";
import { getCorporateByLink, submitCorporateForm } from "../utils/api";
import "../styles/CorporateForm.css";

const T = {
  en: {
    subtitle: "Corporate Employee Registration",
    lastName: "Last Name",
    firstName: "First Name",
    middleName: "Middle Name",
    email: "Email",
    phone: "Phone Number",
    submit: "Submit Registration",
    submitting: "Submitting...",
    successTitle: "Registration Successful!",
    successMsg: "Thank you for registering. Your personal coupon code is:",
    couponHint: (d) => `Use this coupon code to get ${d}% discount on your services.`,
    copy: "Copy Code",
    copied: "Copied!",
    bookBtn: "Book an Appointment",
    alreadyTitle: "Already Registered",
    alreadyMsg: "This email has already been registered for this form. Your coupon code is:",
    notFoundTitle: "Form not found",
    notFoundMsg: "This corporate registration link is invalid or has been removed.",
    networkTitle: "Connection error",
    networkMsg: "Unable to reach the server. Please try again later.",
    loading: "Loading...",
    error: "Submission failed. Please try again.",
    emailSent: "Confirmation email sent to your inbox.",
  },
  ru: {
    subtitle: "Регистрация сотрудника компании",
    lastName: "Фамилия",
    firstName: "Имя",
    middleName: "Отчество",
    email: "Email",
    phone: "Номер телефона",
    submit: "Отправить регистрацию",
    submitting: "Отправка...",
    successTitle: "Регистрация успешна!",
    successMsg: "Спасибо за регистрацию. Ваш личный код купона:",
    couponHint: (d) => `Используйте этот код, чтобы получить скидку ${d}% на услуги.`,
    copy: "Скопировать код",
    copied: "Скопировано!",
    bookBtn: "Записаться на приём",
    alreadyTitle: "Уже зарегистрированы",
    alreadyMsg: "Этот email уже зарегистрирован для данной формы. Ваш код купона:",
    notFoundTitle: "Форма не найдена",
    notFoundMsg: "Эта ссылка на корпоративную регистрацию недействительна или была удалена.",
    networkTitle: "Ошибка подключения",
    networkMsg: "Не удалось подключиться к серверу. Пожалуйста, попробуйте позже.",
    loading: "Загрузка...",
    error: "Ошибка отправки. Пожалуйста, попробуйте снова.",
    emailSent: "Письмо с подтверждением отправлено на вашу почту.",
  },
};

const EMPTY = { lastName: "", firstName: "", middleName: "", email: "", phone: "" };

// Success modal with copy + redirect
const SuccessModal = ({ couponCode, discount, t, isAlready }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="cf-modal-overlay">
      <div className="cf-modal">
        <div className="cf-modal-icon">{isAlready ? "ℹ" : "✓"}</div>
        <h2>{isAlready ? t.alreadyTitle : t.successTitle}</h2>
        <p>{isAlready ? t.alreadyMsg : t.successMsg}</p>

        <div className="cf-coupon-display">{couponCode}</div>

        {discount > 0 && (
          <p className="cf-coupon-hint">{t.couponHint(discount)}</p>
        )}

        <button className="cf-copy-btn" onClick={handleCopy}>
          {copied ? t.copied : t.copy}
        </button>

        <a
          href="https://ed.sophos-med.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="cf-submit-btn cf-book-btn"
        >
          {t.bookBtn}
        </a>
      </div>
    </div>
  );
};

const CorporateForm = ({ lang = "en" }) => {
  const { link } = useParams();
  const t = T[lang] || T.en;

  const [corporate, setCorporate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { couponCode, isAlready }

  useEffect(() => {
    const fetchCorporate = async () => {
      try {
        const res = await getCorporateByLink(link);
        if (res.data) {
          setCorporate(res.data);
        } else {
          setError("not_found");
        }
      } catch (err) {
        setError(err?.response?.status === 404 ? "not_found" : "network");
      } finally {
        setLoading(false);
      }
    };
    fetchCorporate();
  }, [link]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await submitCorporateForm(link, { ...form, lang });
      setSuccess({ couponCode: res.couponCode, isAlready: false });
      toast.success(t.emailSent);
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (msg === "already_registered") {
        setSuccess({ couponCode: err.response.data.couponCode, isAlready: true });
      } else {
        toast.error(msg || t.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="cf-page"><div className="cf-loading">{t.loading}</div></div>;
  }

  if (error === "not_found") {
    return (
      <div className="cf-page">
        <div className="cf-not-found"><h2>{t.notFoundTitle}</h2><p>{t.notFoundMsg}</p></div>
      </div>
    );
  }

  if (error === "network") {
    return (
      <div className="cf-page">
        <div className="cf-not-found"><h2>{t.networkTitle}</h2><p>{t.networkMsg}</p></div>
      </div>
    );
  }

  return (
    <div className="cf-page">
      {/* Success modal overlay */}
      {success && (
        <SuccessModal
          couponCode={success.couponCode}
          discount={corporate?.discountPercentage}
          t={t}
          isAlready={success.isAlready}
        />
      )}

      <div className="cf-card">
        <div className="cf-card-header">
          <h1 className="cf-company">{corporate.corporateName}</h1>
          <p className="cf-subtitle">
            {t.subtitle}
            {corporate.discountPercentage > 0 && (
              <span className="cf-discount-badge">{corporate.discountPercentage}% discount</span>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="cf-form">
          <div className="cf-field">
            <label>{t.lastName} <span className="cf-required">*</span></label>
            <input name="lastName" value={form.lastName} onChange={handleChange} required />
          </div>

          <div className="cf-field">
            <label>{t.firstName} <span className="cf-required">*</span></label>
            <input name="firstName" value={form.firstName} onChange={handleChange} required />
          </div>

          <div className="cf-field">
            <label>{t.middleName}</label>
            <input name="middleName" value={form.middleName} onChange={handleChange} />
          </div>

          <div className="cf-field">
            <label>{t.email} <span className="cf-required">*</span></label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>

          <div className="cf-field">
            <label>{t.phone}</label>
            <PhoneInput
              country={"ru"}
              value={form.phone}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
              inputProps={{ name: "phone" }}
              containerClass="cf-phone-container"
              inputClass="cf-phone-input"
            />
          </div>

          <button type="submit" className="cf-submit-btn" disabled={submitting}>
            {submitting ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CorporateForm;
