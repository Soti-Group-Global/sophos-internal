import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import CustomCalendar from "../CustomCalendar/CustomCalendar";
import { addPatient } from "../../utils/api";
import "./CreateNewPatientModal.css";

export default function CreateNewPatientModal({ onClose, onCreated }) {
  const { t } = useTranslation();

  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    gender: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = t("add_application.required") || "Required";
    if (!form.lastName.trim()) e.lastName = t("add_application.required") || "Required";
    if (!form.phone || form.phone.length < 7) e.phone = t("add_application.required") || "Required";
    if (!form.email.trim()) e.email = t("add_application.required") || "Required";
    if (!form.dateOfBirth) e.dateOfBirth = t("add_application.required") || "Required";
    if (!form.gender) e.gender = t("add_application.required") || "Required";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: `+${form.phone}`,
        email: form.email.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender.charAt(0).toUpperCase() + form.gender.slice(1),
      };
      const res = await addPatient(payload);
      const created = res?.data?.patient || res?.data || res;
      toast.success(t("add_application.patient_created") || "Patient created successfully");
      onCreated(created);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to create patient";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="cnpm-overlay" onClick={onClose}>
      <div className="cnpm-modal" onClick={(e) => e.stopPropagation()}>

        <div className="cnpm-header">
          <h3 className="cnpm-title">{t("add_application.create_new_patient") || "Create new patient"}</h3>
          <button className="cnpm-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="cnpm-body" onSubmit={handleSubmit} noValidate>

          <div className="cnpm-row">
            <div className="cnpm-field">
              <label className="cnpm-label">
                {t("add_application.last_name") || "Last name"} <span className="cnpm-req">*</span>
              </label>
              <input
                className={`cnpm-input${errors.lastName ? " cnpm-input--error" : ""}`}
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder={t("add_application.last_name") || "Last name"}
              />
              {errors.lastName && <span className="cnpm-error">{errors.lastName}</span>}
            </div>

            <div className="cnpm-field">
              <label className="cnpm-label">
                {t("add_application.first_name") || "First name"} <span className="cnpm-req">*</span>
              </label>
              <input
                className={`cnpm-input${errors.firstName ? " cnpm-input--error" : ""}`}
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder={t("add_application.first_name") || "First name"}
              />
              {errors.firstName && <span className="cnpm-error">{errors.firstName}</span>}
            </div>
          </div>

          <div className="cnpm-field">
            <label className="cnpm-label">
              {t("add_application.middle_name") || "Middle name"}
            </label>
            <input
              className="cnpm-input"
              value={form.middleName}
              onChange={(e) => set("middleName", e.target.value)}
              placeholder={t("add_application.middle_name") || "Middle name"}
            />
          </div>

          <div className="cnpm-row">
            <div className="cnpm-field">
              <label className="cnpm-label">
                {t("add_application.phone") || "Phone"} <span className="cnpm-req">*</span>
              </label>
              <PhoneInput
                country="ru"
                value={form.phone}
                onChange={(value) => set("phone", value)}
                inputProps={{ name: "phone", required: true }}
                containerClass={`cnpm-phone-container${errors.phone ? " cnpm-phone--error" : ""}`}
                inputClass="cnpm-phone-input"
                buttonClass="cnpm-phone-btn"
              />
              {errors.phone && <span className="cnpm-error">{errors.phone}</span>}
            </div>

            <div className="cnpm-field">
              <label className="cnpm-label">
                {t("add_application.email") || "Email"} <span className="cnpm-req">*</span>
              </label>
              <input
                className={`cnpm-input${errors.email ? " cnpm-input--error" : ""}`}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@example.com"
              />
              {errors.email && <span className="cnpm-error">{errors.email}</span>}
            </div>
          </div>

          <div className="cnpm-row">
            <div className="cnpm-field">
              <label className="cnpm-label">
                {t("add_application.date_of_birth") || "Date of birth"} <span className="cnpm-req">*</span>
              </label>
              <CustomCalendar
                value={form.dateOfBirth}
                onChange={(date) => {
                  const str = date ? new Date(date).toISOString().split("T")[0] : "";
                  set("dateOfBirth", str);
                }}
                maxDate={new Date()}
                dateFormat="yyyy-MM-dd"
                className="cnpm-calendar"
                dropdownPosition="top"
              />
              {errors.dateOfBirth && <span className="cnpm-error">{errors.dateOfBirth}</span>}
            </div>

            <div className="cnpm-field">
              <label className="cnpm-label">
                {t("add_application.gender") || "Gender"} <span className="cnpm-req">*</span>
              </label>
              <select
                className={`cnpm-input${errors.gender ? " cnpm-input--error" : ""}`}
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">{t("add_application.select_gender") || "Select gender"}</option>
                <option value="male">{t("add_application.male") || "Male"}</option>
                <option value="female">{t("add_application.female") || "Female"}</option>
              </select>
              {errors.gender && <span className="cnpm-error">{errors.gender}</span>}
            </div>
          </div>

          <div className="cnpm-footer">
            <button type="button" className="cnpm-btn cnpm-btn--cancel" onClick={onClose} disabled={loading}>
              {t("add_application.cancel") || "Cancel"}
            </button>
            <button type="submit" className="cnpm-btn cnpm-btn--submit" disabled={loading}>
              {loading
                ? (t("add_application.creating") || "Creating...")
                : (t("add_application.create_patient") || "Create patient")}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
