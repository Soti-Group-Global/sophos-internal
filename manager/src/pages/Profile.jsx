import React, { useState, useEffect, useContext } from "react";
import { ChevronDown, User, Lock, ChevronRight, Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../styles/Profile.css";
import { IoCamera } from "react-icons/io5";
import { FaSave } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import { getProfile, updateProfile, changePassword } from "../utils/api";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

const Profile = () => {
  const { t } = useTranslation("profile");
  const { user, token, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("profile");

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "Male",
    dateOfBirth: "",
    cityOfResidence: "",
    phoneNumber: "",
    notificationLanguage: "en",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [profileImage, setProfileImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await getProfile();
        const profileData = response.data.user;

        const dateOfBirth = profileData.dateOfBirth
          ? new Date(profileData.dateOfBirth).toISOString().split("T")[0]
          : "";

        setFormData({
          firstName: profileData.firstName || "",
          middleName: profileData.middleName || "",
          lastName: profileData.lastName || "",
          gender: profileData.gender || "Male",
          dateOfBirth,
          cityOfResidence: profileData.cityOfResidence || "",
          phoneNumber: profileData.phoneNumber || "",
          notificationLanguage: profileData.notificationLanguage || "en",
        });

        if (profileData.profilePicture) {
          setProfileImage(profileData.profilePicture);
        }

        setIsLoading(false);
      } catch (error) {
        
        toast.error(t("error_fetch"));
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [t]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({ ...prev, phoneNumber: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("image_size_error"));
        return;
      }
      const allowed = /jpeg|jpg|png/;
      if (!allowed.test(file.type)) {
        toast.error(t("image_type_error"));
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setProfileImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (isSaving) return; // Prevent multiple clicks
    
    const requiredFields = [
      "firstName",
      "lastName",
      "gender",
      "dateOfBirth",
      "cityOfResidence",
      "phoneNumber",
    ];

    for (const field of requiredFields) {
      if (!formData[field]) {
        toast.error(t(`${field}_required`));
        return;
      }
    }

    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth);
      if (birthDate > new Date()) {
        toast.error(t("date_of_birth_future"));
        return;
      }
    }

    setIsSaving(true);
    try {
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value || key === "notificationLanguage")
          formDataToSend.append(
            key,
            key === "dateOfBirth" ? new Date(value).toISOString() : value || ""
          );
      });
      if (selectedFile) formDataToSend.append("profilePicture", selectedFile);

      const response = await updateProfile(formDataToSend);
      const updatedUser = response.data.user;

      if (updatedUser) {
        login(token, updatedUser, null, false);
        if (updatedUser.profilePicture) {
          setProfileImage(updatedUser.profilePicture);
        }
        toast.success(t("success"));
      } else {
        throw new Error("No user data returned");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t("error_update"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (isUpdatingPassword) return; // Prevent multiple clicks
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error(t("password_fields_required"));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t("passwords_dont_match"));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error(t("password_too_short"));
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success(t("password_updated"));
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(error.response?.data?.message || t("password_update_error"));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const generatePassword = () => {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = "";
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setPasswordData({
      ...passwordData,
      newPassword: password,
      confirmPassword: password
    });
  };

  const getInitials = () => {
    const first = formData.firstName?.charAt(0) || "";
    const last = formData.lastName?.charAt(0) || "";
    return (first + last).toUpperCase();
  };

  return (
    <div className="settings-wrapper">
      <div className="settings-layout">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">{t("settings")}</h2>
            <p className="sidebar-subtitle">{t("settings_subtitle")}</p>
          </div>
          
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <User size={20} className="nav-icon" />
              <span>{t("profile_section")}</span>
              <ChevronRight size={18} className="nav-arrow" />
            </button>
            
            <button
              className={`nav-item ${activeSection === "password" ? "active" : ""}`}
              onClick={() => setActiveSection("password")}
            >
              <Lock size={20} className="nav-icon" />
              <span>{t("change_password")}</span>
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="settings-content">
          {activeSection === "profile" && (
            <>
              <div className="content-header">
                <div>
                  <h1 className="content-title">{t("personal_details")}</h1>
                  <p className="content-subtitle">{t("personal_details_subtitle")}</p>
                </div>
                <button 
                  onClick={handleSave} 
                  className="btn-save"
                  disabled={isSaving}
                  style={{ cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
                >
                  <FaSave size={16} />
                  {isSaving ? t("loading") : t("save_changes")}
                </button>
              </div>

              <div className="profile-content">
                <div className="profile-info-section">
                  <div className="profile-avatar-large">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {getInitials()}
                      </div>
                    )}
                    <label className="avatar-upload-btn">
                      <IoCamera size={20} />
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleImageUpload}
                        className="avatar-input"
                      />
                    </label>
                  </div>
                  
                  <div className="profile-name-section">
                    <h3 className="profile-display-name">
                      {formData.firstName} {formData.lastName}
                    </h3>
                    <p className="profile-email">{user?.email}</p>
                    <div className="profile-role-badge">{t(`roles.${user?.role}`, user?.role)}</div>
                  </div>
                </div>

                <div className="form-fields-grid">
                  {/* Last Name */}
                  <div className="form-field">
                    <label className="field-label">
                      {t("last_name")}<span className="field-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="field-input"
                      required
                    />
                  </div>

                  {/* First Name */}
                  <div className="form-field">
                    <label className="field-label">
                      {t("first_name")}<span className="field-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="field-input"
                      required
                    />
                  </div>

                  {/* Middle Name */}
                  <div className="form-field">
                    <label className="field-label">{t("middle_name")}</label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleInputChange}
                      className="field-input"
                    />
                  </div>

                  {/* Email */}
                  <div className="form-field">
                    <label className="field-label">{t("email", { ns: "applications" })}</label>
                    <input
                      type="email"
                      value={user?.email || ""}
                      className="field-input"
                      disabled
                    />
                  </div>

                  {/* Gender */}
                  <div className="form-field">
                    <label className="field-label">
                      {t("gender")}<span className="field-required">*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="field-input"
                    >
                      <option value="Male">{t("gender_male")}</option>
                      <option value="Female">{t("gender_female")}</option>
                      <option value="Other">{t("gender_other")}</option>
                    </select>
                  </div>

                  {/* Date of Birth */}
                  <div className="form-field">
                    <label className="field-label">
                      {t("date_of_birth")}<span className="field-required">*</span>
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className="field-input"
                      required
                    />
                  </div>

                  {/* City of Residence */}
                  <div className="form-field">
                    <label className="field-label">
                      {t("city_of_residence")}<span className="field-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="cityOfResidence"
                      value={formData.cityOfResidence}
                      onChange={handleInputChange}
                      className="field-input"
                      required
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="form-field">
                    <label className="field-label">
                      {t("phone_number")}<span className="field-required">*</span>
                    </label>
                    <PhoneInput
                      country={"ru"}
                      value={formData.phoneNumber}
                      onChange={handlePhoneChange}
                      inputStyle={{
                        width: "100%",
                        height: "42px",
                        borderRadius: "8px",
                        fontSize: "14px",
                      }}
                      buttonStyle={{
                        borderRadius: "8px 0 0 8px",
                      }}
                      containerStyle={{ width: "100%" }}
                      inputProps={{
                        name: "phoneNumber",
                        required: true,
                        autoFocus: false,
                      }}
                    />
                  </div>

                  {/* Notification Language */}
                  <div className="form-field">
                    <label className="field-label">{t("notification_language")}</label>
                    <select
                      name="notificationLanguage"
                      value={formData.notificationLanguage}
                      onChange={handleInputChange}
                      className="field-input"
                    >
                      <option value="en">English</option>
                      <option value="ru">Русский</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === "password" && (
            <>
              <div className="content-header">
                <div>
                  <h1 className="content-title">{t("change_password_title")}</h1>
                  <p className="content-subtitle">{t("change_password_subtitle")}</p>
                </div>
                <button 
                  onClick={handlePasswordChange} 
                  className="btn-save"
                  disabled={isUpdatingPassword}
                  style={{ cursor: isUpdatingPassword ? 'not-allowed' : 'pointer', opacity: isUpdatingPassword ? 0.6 : 1 }}
                >
                  <FaSave size={16} />
                  {isUpdatingPassword ? t("loading") : t("update_password")}
                </button>
              </div>

              <div className="password-content">
                <div className="form-fields-grid">
                  <div className="form-field form-field-full">
                    <label className="field-label">
                      {t("current_password")}<span className="field-required">*</span>
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      className="field-input"
                      placeholder={t("current_password_placeholder")}
                    />
                  </div>

                  <div className="form-field">
                    <div className="label-with-action">
                      <label className="field-label">
                        {t("new_password")}<span className="field-required">*</span>
                      </label>
                      <button 
                        type="button" 
                        className="generate-password-btn"
                        onClick={generatePassword}
                      >
                        {t("generate")}
                      </button>
                    </div>
                    <div className="password-input-wrapper">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, newPassword: e.target.value })
                        }
                        className="field-input"
                        placeholder={t("new_password_placeholder")}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-field">
                    <div className="label-with-action">
                      <label className="field-label">
                        {t("confirm_password")}<span className="field-required">*</span>
                      </label>
                    </div>
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                        }
                        className="field-input"
                        placeholder={t("confirm_password_placeholder")}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
