import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { addPatient } from "../utils/api";
import "../styles/AddPatient.css";

function AddPatientForm() {
  const { t } = useTranslation("add_patient");
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: "",
    additionalPhone: "",
    email: "",
    comments: "",
    profileImage: null,
  });

  const [previewImage, setPreviewImage] = useState(null);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

  const genderOptions = [
    { value: "Male", label: t("gender_male") },
    { value: "Female", label: t("gender_female") },
    { value: "Other", label: t("gender_other") },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        profileImage: file,
      }));
      setPreviewImage(URL.createObjectURL(file));

      if (errors.profileImage) {
        setErrors((prev) => ({
          ...prev,
          profileImage: "",
        }));
      }
    }
  };

  const handleDateChange = (e) => {
    const value = e.target.value;
    const formattedDate = value || "";
    setFormData((prev) => ({
      ...prev,
      dateOfBirth: formattedDate,
    }));

    if (errors.dateOfBirth) {
      setErrors((prev) => ({
        ...prev,
        dateOfBirth: "",
      }));
    }
  };

  const handleGenderChange = (selectedOption) => {
    setFormData((prev) => ({
      ...prev,
      gender: selectedOption ? selectedOption.value : "",
    }));

    if (errors.gender) {
      setErrors((prev) => ({
        ...prev,
        gender: "",
      }));
    }
  };

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({ ...prev, phoneNumber: value }));
    if (errors.phoneNumber) {
      setErrors((prev) => ({ ...prev, phoneNumber: "" }));
    }
  };

  const handleAdditionalPhoneChange = (value) => {
    setFormData((prev) => ({ ...prev, additionalPhone: value }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t("first_name_required");
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t("last_name_required");
    }

    if (!formData.gender) {
      newErrors.gender = t("gender_required");
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = t("date_of_birth_required");
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.dateOfBirth)) {
      newErrors.dateOfBirth = t("date_of_birth_invalid");
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = t("phone_number_required");
    }

    if (!formData.email.trim()) {
      newErrors.email = t("email_required");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("email_invalid");
    }

    if (
      formData.profileImage &&
      !/image\/(jpeg|jpg|png)/.test(formData.profileImage.type)
    ) {
      newErrors.profileImage = t("image_type_error");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append("firstName", formData.firstName);
        formDataToSend.append("middleName", formData.middleName);
        formDataToSend.append("lastName", formData.lastName);
        formDataToSend.append("gender", formData.gender);
        formDataToSend.append("dateOfBirth", formData.dateOfBirth);
        formDataToSend.append("phoneNumber", formData.phoneNumber);
        formDataToSend.append("additionalPhone", formData.additionalPhone);
        formDataToSend.append("email", formData.email);
        formDataToSend.append("comments", formData.comments);
        if (formData.profileImage) {
          formDataToSend.append("profileImage", formData.profileImage);
        }

        await addPatient(formDataToSend);
        toast.success(t("success"));
        navigate("/patients");
      } catch (error) {
        
        toast.error(error.response?.data?.message || t("failed"));
      }
    }
  };

  const handleCancel = () => {
    navigate("/patients");
  };

  return (
    <div className="modern-form-container">
      <div className="modern-form-card">
        <button
          className="cancel-btn"
          onClick={handleCancel}
          title={t("cancel")}
        >
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
          <h2 className="form-title">{t("title")}</h2>

          <div className="photo-section">
            <div className="photo-circle">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt={t("profile_image_alt")}
                  className="profile-image-select"
                />
              ) : (
                <div className="photo-placeholder">
                  <svg
                    className="camera-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="photo-text">{t("add_profile_picture")}</span>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="photo-input"
                onChange={handleImageChange}
              />
            </div>
            {errors.profileImage && (
              <span className="field-error">{errors.profileImage}</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="modern-form">
            <div className="form-row">
              <div className="form-field">
                <label>
                  {t("first_name")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t("first_name_placeholder")}
                  className={errors.firstName ? "error" : ""}
                />
                {errors.firstName && (
                  <span className="field-error">{errors.firstName}</span>
                )}
              </div>

              <div className="form-field">
                <label>
                  {t("last_name")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t("last_name_placeholder")}
                  className={errors.lastName ? "error" : ""}
                />
                {errors.lastName && (
                  <span className="field-error">{errors.lastName}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{t("middle_name")}</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  placeholder={t("middle_name_placeholder")}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>
                  {t("gender")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <Select
                  options={genderOptions}
                  value={genderOptions.find(
                    (option) => option.value === formData.gender
                  )}
                  onChange={handleGenderChange}
                  className={errors.gender ? "error" : ""}
                  classNamePrefix="react-select"
                  placeholder={t("select_gender")}
                />
                {errors.gender && (
                  <span className="field-error">{errors.gender}</span>
                )}
              </div>

              <div className="form-field">
                <label>
                  {t("date_of_birth")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleDateChange}
                  className={errors.dateOfBirth ? "error" : ""}
                  max={new Date().toISOString().split("T")[0]}
                />
                {errors.dateOfBirth && (
                  <span className="field-error">{errors.dateOfBirth}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>
                  {t("phone_number")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <PhoneInput
                  country={"ru"}
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  inputProps={{ name: "phoneNumber", required: true }}
                  placeholder={t("phone_number_placeholder")}
                  containerClass="phone-input-container"
                  inputClass={errors.phoneNumber ? "error" : ""}
                />
                {errors.phoneNumber && (
                  <span className="field-error">{errors.phoneNumber}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t("additional_phone")}</label>
                <PhoneInput
                  country={"ru"}
                  value={formData.additionalPhone}
                  onChange={handleAdditionalPhoneChange}
                  inputProps={{ name: "additionalPhone" }}
                  placeholder={t("additional_phone_placeholder")}
                  containerClass="phone-input-container"
                  inputClass=""
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>
                  {t("email")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={t("email_placeholder")}
                  className={errors.email ? "error" : ""}
                />
                {errors.email && (
                  <span className="field-error">{errors.email}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{t("comments")}</label>
                <input
                  type="text"
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  placeholder={t("comments_placeholder")}
                />
              </div>
            </div>

            <button type="submit" className="save-changes-btn">
              {t("save_changes")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddPatientForm;
