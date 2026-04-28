import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getPatient, updatePatient } from "../utils/api";
import "../styles/EditPatient.css";
import { FaTimes } from "react-icons/fa";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

function EditPatientForm() {
  const { t } = useTranslation("edit_patient");
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
    notificationLanguage: "en",
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  const genderOptions = [
    { value: "Male", label: t("gender_male") },
    { value: "Female", label: t("gender_female") },
    { value: "Other", label: t("gender_other") },
  ];

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "ru", label: "Русский" },
  ];

  // Fetch & normalize patient data
useEffect(() => {
  const fetchPatient = async () => {
    try {
      const response = await getPatient(id);
      const patient = response.data.patient;

      // Normalize Date of Birth safely (handles ISO & plain formats)
      let formattedDOB = "";
      if (patient.dateOfBirth) {
        let dateString = patient.dateOfBirth;

        // Ensure it's a string before processing
        if (typeof dateString === "string") {
          // Match first 10 chars like "2025-10-01" from "2025-10-01T00:00:00.000Z"
          const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) {
            const [_, y, m, d] = isoMatch;
            formattedDOB = `${d}-${m}-${y}`; // Convert to DD-MM-YYYY
          }
        }
      }

      // Update state safely with normalized DOB
      setFormData({
        firstName: patient.firstName || "",
        middleName: patient.middleName || "",
        lastName: patient.lastName || "",
        gender: patient.gender || "",
        dateOfBirth: formattedDOB,
        phoneNumber: patient.phoneNumber || "",
        additionalPhone: patient.additionalPhone || "",
        email: patient.email || "",
        comments: patient.comments || "",
        profileImage: null,
        notificationLanguage: patient.notificationLanguage || "en",
      });

      // Handle profile picture if available
      if (patient.profilePicture) {
        setPreviewImage(`data:image/jpeg;base64,${patient.profilePicture}`);
      }
    } catch (error) {
      toast.error(t("error_fetch"));
    }
  };

  fetchPatient();
}, [id, t]);


  // ---------------------------- HANDLERS ---------------------------- //

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleLanguageChange = (selectedOption) => {
    setFormData(prev => ({
      ...prev,
      notificationLanguage: selectedOption ? selectedOption.value : 'en'
    }));
  };

  const handlePhoneChange = (value, country, name) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("image_size_error"));
        return;
      }
      if (!/image\/(jpeg|jpg|png)/.test(file.type)) {
        toast.error(t("image_type_error"));
        return;
      }
      setFormData((prev) => ({ ...prev, profileImage: file }));
      setPreviewImage(URL.createObjectURL(file));
      if (errors.profileImage)
        setErrors((prev) => ({ ...prev, profileImage: "" }));
    }
  };

  // DD-MM-YYYY formatting
  const handleDateChange = (date) => {
    if (!date) {
      setFormData((prev) => ({ ...prev, dateOfBirth: "" }));
      return;
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    setFormData((prev) => ({ ...prev, dateOfBirth: `${day}-${month}-${year}` }));
    if (errors.dateOfBirth)
      setErrors((prev) => ({ ...prev, dateOfBirth: "" }));
  };

  const handleGenderChange = (selectedOption) => {
    setFormData((prev) => ({
      ...prev,
      gender: selectedOption ? selectedOption.value : "",
    }));
    if (errors.gender) setErrors((prev) => ({ ...prev, gender: "" }));
  };

  // Validation for DD-MM-YYYY
  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim())
      newErrors.firstName = t("first_name_required");
    if (!formData.lastName.trim())
      newErrors.lastName = t("last_name_required");
    if (!formData.gender) newErrors.gender = t("gender_required");

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = t("date_of_birth_required");
    } else if (!/^\d{2}-\d{2}-\d{4}$/.test(formData.dateOfBirth)) {
      newErrors.dateOfBirth = t("date_of_birth_invalid");
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = t("phone_number_required");
    } else if (formData.phoneNumber.replace(/\D/g, "").length < 7) {
      newErrors.phoneNumber = t("phone_number_invalid");
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

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("firstName", formData.firstName);
      formDataToSend.append("middleName", formData.middleName);
      formDataToSend.append("lastName", formData.lastName);
      formDataToSend.append("gender", formData.gender);

      // Convert DD-MM-YYYY → YYYY-MM-DD for backend
      if (formData.dateOfBirth) {
        const [d, m, y] = formData.dateOfBirth.split("-");
        formDataToSend.append("dateOfBirth", `${y}-${m}-${d}`);
      }

      formDataToSend.append("phoneNumber", formData.phoneNumber);
      formDataToSend.append("additionalPhone", formData.additionalPhone);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("comments", formData.comments);
      formDataToSend.append("notificationLanguage", formData.notificationLanguage || "en");
      if (formData.profileImage)
        formDataToSend.append("profileImage", formData.profileImage);

      await updatePatient(id, formDataToSend);
      toast.success(t("success"));
      navigate("/patients");
    } catch (error) {
      toast.error(error.response?.data?.message || t("failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => navigate("/patients");

  // ---------------------------- RENDER ---------------------------- //

  return (
    <div className="modern-form-container">
      <div className="modern-form-card">
        <div className="header-patient-form">
          <h2 className="form-title">{t("title")}</h2>
          <button
            className="patient-form-cancel-btn"
            onClick={handleCancel}
            title={t("cancel")}
            disabled={isSubmitting}
          >
            <FaTimes className="cancel-btn-icon" />
          </button>
        </div>

        <div className="form-section">
          {/* PHOTO */}
          <div className="photo-upload-container">
            <div className="photo-upload-circle">
              {previewImage ? (
                <>
                  <img
                    src={previewImage}
                    alt={t("profile_image_alt")}
                    className="profile-image-preview"
                  />
                  {isSubmitting && (
                    <div className="photo-upload-loading">
                      <div className="photo-upload-spinner"></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="photo-upload-placeholder">
                  <svg
                    className="camera-icon-svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="photo-upload-text">
                    {t("add_profile_picture")}
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="photo-upload-input"
                onChange={handleImageChange}
                disabled={isSubmitting}
              />
            </div>
            {errors.profileImage && (
              <span className="photo-upload-error">{errors.profileImage}</span>
            )}
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="modern-form">
            {/* Names */}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
                {errors.lastName && (
                  <span className="field-error">{errors.lastName}</span>
                )}
              </div>
            </div>

            {/* Middle Name */}
            <div className="form-row">
              <div className="form-field full-width">
                <label>{t("middle_name")}</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  placeholder={t("middle_name_placeholder")}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Gender + DOB */}
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
                  isDisabled={isSubmitting}
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
                <DatePicker
                  selected={(() => {
                    const dob = formData.dateOfBirth;
                    if (!dob || typeof dob !== "string" || dob.trim() === "")
                      return null;

                    const parts = dob.split("-");
                    if (parts.length !== 3) return null;

                    const [d, m, y] = parts.map((p) => parseInt(p, 10));
                    if (
                      !Number.isInteger(d) ||
                      !Number.isInteger(m) ||
                      !Number.isInteger(y) ||
                      d < 1 ||
                      m < 1 ||
                      m > 12 ||
                      y < 1900
                    )
                      return null;

                    const date = new Date(y, m - 1, d);
                    return isNaN(date.getTime()) ? null : date;
                  })()}
                  onChange={handleDateChange}
                  dateFormat="dd-MM-yyyy"
                  placeholderText={t("select_date")}
                  className={errors.dateOfBirth ? "error" : ""}
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={100}
                  maxDate={new Date()}
                  disabled={isSubmitting}
                />
                {errors.dateOfBirth && (
                  <span className="field-error">{errors.dateOfBirth}</span>
                )}
              </div>
            </div>

            {/* Phones */}
            <div className="form-row">
              <div className="form-field">
                <label>
                  {t("phone_number")}{" "}
                  <span className="required-asterisk">{t("required")}</span>
                </label>
                <PhoneInput
                  country={"ru"}
                  value={formData.phoneNumber}
                  onChange={(value, country) =>
                    handlePhoneChange(value, country, "phoneNumber")
                  }
                  inputClass={errors.phoneNumber ? "phone-input-error" : ""}
                  buttonClass={errors.phoneNumber ? "phone-button-error" : ""}
                  containerClass="phone-input-container"
                  placeholder={t("phone_number_placeholder")}
                  disabled={isSubmitting}
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
                  onChange={(value, country) =>
                    handlePhoneChange(value, country, "additionalPhone")
                  }
                  containerClass="phone-input-container"
                  placeholder={t("additional_phone_placeholder")}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Email + Comments */}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full-width">
                <label>{t("notification_language", { defaultValue: "Notification Language" })}</label>
                <Select
                  options={languageOptions}
                  value={languageOptions.find(option => option.value === formData.notificationLanguage)}
                  onChange={handleLanguageChange}
                  classNamePrefix="react-select"
                  placeholder="Select notification language"
                  isDisabled={isSubmitting}
                />
              </div>
            </div>

            <button type="submit" className="save-changes-btn" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("save_changes")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditPatientForm;
