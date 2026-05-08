import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import defaultUser from "../assets/default-user.png";
import "../styles/Profile.css";
import {
  getAssistant,
  getAssitantImage,
  updateAssistant,
  uploadAssistantProfileImage,
} from "../utils/api";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Profile = () => {
  const { t } = useTranslation();
  const [image, setImage] = useState(defaultUser);
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    age: "",
    specialty: "",
    email: "",
  });

  const fetchAssistant = async () => {
    try {
      const response = await getAssistant();
      const data = response.data.assistant;

      setFormData({
        firstName: data.firstName || "",
        middleName: data.middleName || "",
        lastName: data.lastName || "",
        gender: data.gender || "",
        dateOfBirth: data.dateOfBirth?.substring(0, 10) || "",
        age: data.age || "",
        specialty: data.specialty || "",
        email: data.email || "",
      });

      if (data.profileFileId) {
        const blob = await getAssitantImage(data.profileFileId);
        setImage(URL.createObjectURL(blob));
      } else {
        setImage(defaultUser);
      }
    } catch (err) {
      toast.error(t("profile.messages.fetchError"));
      setImage(defaultUser);
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssistant();
  }, [t]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.type === "assistantUpdated") {
        fetchAssistant();
      }
    };
    window.addEventListener("ws-message", handler);
    return () => window.removeEventListener("ws-message", handler);
  }, []);

  const handleImageChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(URL.createObjectURL(file));

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await uploadAssistantProfileImage(formData);
        const profileFileId = res.data?.data?.fileId || res.data?.fileId;

        if (!profileFileId) {
          toast.error(t("profile.messages.imageUpdateError"));
          return;
        }

        await updateAssistant({ profileFileId });

        const blob = await getAssitantImage(profileFileId);
        setImage(URL.createObjectURL(blob));

        toast.success(t("profile.messages.imageUpdateSuccess"));
      } catch (err) {
        toast.error(t("profile.messages.imageUpdateError"));
        setImage(defaultUser);
        console.error(err);
      }
    }
  };

  const handleImageError = () => {
    setImage(defaultUser);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "dateOfBirth") updated.age = calculateAge(value);
      return updated;
    });
  };

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const requiredFields = ["firstName", "lastName", "gender", "dateOfBirth"];
    const emptyField = requiredFields.find(
      (field) => !formData[field] || formData[field].toString().trim() === "",
    );

    if (emptyField) {
      toast.error(`Please fill out the ${emptyField} field.`);
      return;
    }

    try {
      await updateAssistant(formData);
      toast.success(t("profile.messages.updateSuccess"));

      //  Force update in memory by re-fetching the user (will return profileCompleted: true)
      const response = await getAssistant();
      const updatedProfile = response.data.assistant;

      if (updatedProfile?.profileCompleted) {
        // Dispatch custom event so ProtectedRoute can listen
        const event = new CustomEvent("assistant-profile-completed");
        window.dispatchEvent(event);
      }

      fetchAssistant(); // still refresh UI
    } catch (err) {
      toast.error(t("profile.messages.updateError"));
      console.error(err);
    }
  };

  const getInitials = (first, last) => {
    return (
      `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "?"
    );
  };

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="prf-page">
        {/* ── Left nav sidebar ── */}
        <aside className="prf-sidenav">
          <div className="prf-sidenav-header">
            <div className="prf-sidenav-title">{t("profile.title")}</div>
            <div className="prf-sidenav-sub">{t("profile.sidenavSub")}</div>
          </div>
          <nav className="prf-sidenav-nav">
            <div className="prf-sidenav-item prf-sidenav-item--active">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {t("profile.personalDetails")}
            </div>
          </nav>
        </aside>

        {/* ── Right content ── */}
        <form className="prf-content" onSubmit={handleSubmit}>
          {/* Content header */}
          <div className="prf-content-header">
            <div>
              <h2 className="prf-content-title">
                {t("profile.personalDetails")}
              </h2>
              <p className="prf-content-sub">
                {t("profile.personalDetailsSub")}
              </p>
            </div>
          </div>

          {/* Identity row */}
          <div className="prf-identity-row">
            <div className="prf-avatar-wrap">
              {image && image !== defaultUser ? (
                <img
                  src={image}
                  onError={handleImageError}
                  alt="Profile"
                  className="prf-avatar"
                />
              ) : (
                <div className="prf-avatar-initials">
                  {getInitials(formData.firstName, formData.lastName)}
                </div>
              )}
              <label
                htmlFor="upload"
                className="prf-avatar-edit"
                title="Change photo"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </label>
              <input
                type="file"
                id="upload"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
            </div>
            <div className="prf-identity-info">
              <div className="prf-identity-name">
                {[formData.firstName, formData.lastName]
                  .filter(Boolean)
                  .join(" ") || t("general.assistant")}
              </div>
              <div className="prf-identity-email">{formData.email}</div>
              <span className="prf-verified-badge">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t("profile.verified")}
              </span>
            </div>
          </div>

          {/* Basic Information */}
          <div className="prf-section">
            <div className="prf-section-heading">
              {t("profile.sections.basicInfo")}
            </div>
            <div className="prf-grid">
              <div className="prf-field">
                <label className="prf-label">
                  {t("profile.form.lastName")}{" "}
                  <span className="prf-required">*</span>
                </label>
                <input
                  className="prf-input"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t("profile.form.lastName")}
                />
              </div>

              <div className="prf-field">
                <label className="prf-label">
                  {t("profile.form.firstName")}{" "}
                  <span className="prf-required">*</span>
                </label>
                <input
                  className="prf-input"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t("profile.form.firstName")}
                />
              </div>

              <div className="prf-field">
                <label className="prf-label">
                  {t("profile.form.middleName")}
                </label>
                <input
                  className="prf-input"
                  name="middleName"
                  type="text"
                  value={formData.middleName}
                  onChange={handleChange}
                  placeholder={t("profile.form.middleName")}
                />
              </div>

              <div className="prf-field">
                <label className="prf-label">
                  {t("profile.form.email") || "Email"}{" "}
                  <span className="prf-required">*</span>
                </label>
                <div className="prf-input-badge-wrap">
                  <input
                    className="prf-input prf-input--disabled"
                    type="text"
                    value={formData.email}
                    disabled
                    readOnly
                  />
                  <span className="prf-input-verified">
                    {t("profile.verified")}
                  </span>
                </div>
              </div>

              <div className="prf-field">
                <label className="prf-label">
                  {t("profile.form.dateOfBirth")}
                  {formData.age ? (
                    <span className="prf-label-age">
                      {" "}
                      — {t("profile.ageLabel")}: {formData.age}
                    </span>
                  ) : null}
                </label>
                <input
                  className="prf-input"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
              </div>

              <div className="prf-field">
                <label className="prf-label">
                  {t("profile.form.gender")}{" "}
                  <span className="prf-required">*</span>
                </label>
                <select
                  className="prf-input"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">
                    {t("profile.form.genderOptions.select")}
                  </option>
                  <option value="Male">
                    {t("profile.form.genderOptions.male")}
                  </option>
                  <option value="Female">
                    {t("profile.form.genderOptions.female")}
                  </option>
                  <option value="Other">
                    {t("profile.form.genderOptions.other")}
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="prf-footer">
            <button type="submit" className="prf-save-btn">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {t("profile.form.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default Profile;
