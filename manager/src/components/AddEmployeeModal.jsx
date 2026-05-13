import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { X, User, Camera, Upload, FileText } from "lucide-react";
import Select from "react-select";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  addDoctor,
  addAssistant,
  addHeadDoctor,
  addHeadAssistant,
  addSpecialistDoctor,
  addManager,
  createContentManager,
  getProfile,
} from "../utils/api";
import "../styles/AddEmployeeModal.css";
import { socket } from "../utils/socket";
// import { toast } from "react-toastify";

function AddEmployeeModal({ isOpen, onClose, onAdd, defaultEmployeeType, onDoctorSelect }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [employeeType, setEmployeeType] = useState(defaultEmployeeType || "");
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    age: "",
    email: "",
    phoneNumber: "",
    profileImage: null,
    specialty: "",
    placeOfWork: "",
    regalia: "",
    services: [],
    feesAmount: "",
    currency: "RUB",
    additionalPhone: "",
    comments: "",
    branches: [],
    cityOfResidence: "",
    canManage: [],
    notificationLanguage: "en",
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [errors, setErrors] = useState({});

  const employeeTypeOptions = [
    { value: "manager", label: t("add_employee.types.manager"), icon: "👔" },
    { value: "doctor", label: t("add_employee.types.doctor"), icon: "🩺" },
    {
      value: "speciality",
      label: t("add_employee.types.speciality"),
      icon: "🎯",
    },
    {
      value: "assistant",
      label: t("add_employee.types.assistant"),
      icon: "👔",
    },
    {
      value: "head_assistant",
      label: t("add_employee.types.head_assistant"),
      icon: "👩‍💼",
    },
    {
      value: "content_manager",
      label: t("add_employee.types.content_manager"),
      icon: "📝",
    },
  ];

  const genderOptions = [
    { value: "Male", label: t("add_employee.gender.male") },
    { value: "Female", label: t("add_employee.gender.female") },
    { value: "Other", label: t("add_employee.gender.other") },
  ];

  const serviceOptions = [
    { value: "Online", label: t("add_employee.services.online") },
    { value: "Offline", label: t("add_employee.services.offline") },
  ];

  const currencyOptions = [
    { value: "RUB", label: t("add_employee.currency.rub") },
    { value: "USD", label: t("add_employee.currency.usd") },
    { value: "EUR", label: t("add_employee.currency.eur") },
  ];

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "ru", label: "Русский" },
  ];

  const canManageOptions = [
    // Feed group items
    { value: "messenger", label: t("sidebar.messenger") || "Messenger" },
   // { value: "whatsapp", label: t("sidebar.whatsapp") || "WhatsApp" },
    { value: "telegram", label: t("sidebar.telegram") || "Telegram" },
    { value: "max", label: t("sidebar.max") || "Max" },
    { value: "notifications", label: t("sidebar.notifications") || "Notifications" },
    { value: "profile", label: t("sidebar.profile") || "Profile" },
    // Content group items
    { value: "doctors", label: t("sidebar.doctors") || "Doctors" },
    { value: "blogs", label: t("sidebar.blogs") || "Blogs" },
    { value: "services", label: t("sidebar.services") || "Services" },
    { value: "vacancies", label: t("sidebar.vacancies") || "Vacancies" },
    { value: "reviews", label: t("sidebar.reviews") || "Reviews" },
    { value: "promos", label: t("sidebar.promos") || "Promos" },
    // Forms group items
    { value: "contactUsForms", label: t("sidebar.contactUsForms") || "Contact Us Forms" },
    { value: "patientCoordinationForms", label: t("sidebar.patientCoordinationForms") || "Patient Coordination" },
    { value: "contactViaPhone", label: t("sidebar.contactViaPhone") || "Contact Via Phone" },
    { value: "complicatedCasesForms", label: t("sidebar.complicatedCasesForms") || "Complicated Cases" },
    { value: "earlyDetectionBookings", label: t("sidebar.earlyDetectionBookings") || "Early Detection Bookings" },
  ];

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchProfileBranches = async () => {
      try {
        setLoadingBranches(true);
        const res = await getProfile();

        const branches = res.data.user?.branches || [];

        const formatted = branches.map((b) => ({
          value: b,
          label: b,
        }));

        setAvailableBranches(formatted);
      } catch (err) {
      } finally {
        setLoadingBranches(false);
      }
    };

    if (isOpen) fetchProfileBranches();
  }, [isOpen]);

  useEffect(() => {
    if (formData.dateOfBirth) {
      const age = calculateAge(formData.dateOfBirth);
      setFormData((prev) => ({ ...prev, age }));
    }
  }, [formData.dateOfBirth]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const calculateAge = (dob) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age.toString();
  };

  const resetForm = () => {
    setEmployeeType("");
    setFormData({
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      age: "",
      email: "",
      phoneNumber: "",
      profileImage: null,
      specialty: "",
      placeOfWork: "",
      regalia: "",
      services: [],
      feesAmount: "",
      currency: "RUB",
      additionalPhone: "",
      comments: "",
      branches: [],
      cityOfResidence: "",
      canManage: [],
    });
    setPreviewImage(null);
    setErrors({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          profileImage: t("add_employee.errors.image_size"),
        }));
        return;
      }
      setFormData((prev) => ({ ...prev, profileImage: file }));
      setPreviewImage(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, profileImage: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim())
      newErrors.firstName = t("add_employee.errors.first_name_required");
    if (!formData.lastName.trim())
      newErrors.lastName = t("add_employee.errors.last_name_required");
    if (!formData.dateOfBirth)
      newErrors.dateOfBirth = t("add_employee.errors.date_of_birth_required");
    if (!formData.gender)
      newErrors.gender = t("add_employee.errors.gender_required");
    if (!formData.email.trim())
      newErrors.email = t("add_employee.errors.email_required");
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = t("add_employee.errors.email_invalid");
    if (!formData.phoneNumber.trim())
      newErrors.phoneNumber = t("add_employee.errors.phone_required");
    
    // Branches validation
    if (!formData.branches || formData.branches.length === 0) {
      newErrors.branches = t("add_employee.errors.branches_required");
    }

    // Doctor, Head Doctor, and Speciality validation
    if (["doctor", "head_doctor", "speciality"].includes(employeeType)) {
      if (!formData.specialty)
        newErrors.specialty = t("add_employee.errors.specialty_required");
      if (!formData.placeOfWork.trim())
        newErrors.placeOfWork = t("add_employee.errors.place_of_work_required");
      if (formData.services.length === 0)
        newErrors.services = t("add_employee.errors.services_required");
      if (!formData.feesAmount || parseFloat(formData.feesAmount) <= 0)
        newErrors.feesAmount = t("add_employee.errors.fees_amount_required");
    }

    // Assistant and Head Assistant validation
    if (
      ["assistant", "head_assistant"].includes(employeeType) &&
      !formData.specialty.trim()
    ) {
      newErrors.specialty = t("add_employee.errors.specialty_required");
    }

    // Content Manager validation
    if (employeeType === "content_manager") {
      if (!formData.cityOfResidence.trim())
        newErrors.cityOfResidence = t("add_employee.errors.city_required");
      if (formData.canManage.length === 0)
        newErrors.canManage = t("add_employee.errors.can_manage_required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employeeType) {
      setErrors({
        employeeType: t("add_employee.errors.employee_type_required"),
      });
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();

      formDataToSend.append("firstName", formData.firstName);
      formDataToSend.append("middleName", formData.middleName);
      formDataToSend.append("lastName", formData.lastName);
      formDataToSend.append("dateOfBirth", formData.dateOfBirth);
      formDataToSend.append("gender", formData.gender);
      formDataToSend.append("age", parseInt(formData.age));
      formDataToSend.append("email", formData.email);
      formDataToSend.append("phoneNumber", formData.phoneNumber);
      formDataToSend.append("notificationLanguage", formData.notificationLanguage || "en");
      
      formData.branches.forEach((b) => formDataToSend.append("branches", b));

      if (formData.profileImage) {
        formDataToSend.append("profileImage", formData.profileImage);
      }

      // Handle different employee types
      if (employeeType === "manager") {
        // Add manager-specific fields
        formDataToSend.append("cityOfResidence", formData.cityOfResidence || "");
        formDataToSend.append("comments", formData.comments || "");
        
        const newManager = await addManager(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'manager',
          employeeData: newManager
        });
        onAdd(newManager, "manager");
      } else if (employeeType === "doctor") {
        formDataToSend.append("specialty", formData.specialty);
        formDataToSend.append("placeOfWork", formData.placeOfWork);
        formDataToSend.append("regalia", formData.regalia);
        formDataToSend.append("services", JSON.stringify(formData.services));
        formDataToSend.append("feesAmount", parseFloat(formData.feesAmount));
        formDataToSend.append("currency", formData.currency);

        const newDoctor = await addDoctor(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'doctor',
          employeeData: newDoctor
        });
        onAdd(newDoctor, "doctor");
      } else if (employeeType === "head_doctor") {
        formDataToSend.append("specialty", formData.specialty);
        formDataToSend.append("placeOfWork", formData.placeOfWork);
        formDataToSend.append("regalia", formData.regalia);
        formDataToSend.append("services", JSON.stringify(formData.services));
        formDataToSend.append("feesAmount", parseFloat(formData.feesAmount));
        formDataToSend.append("currency", formData.currency);

        const newHeadDoctor = await addHeadDoctor(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'head_doctor',
          employeeData: newHeadDoctor
        });
        onAdd(newHeadDoctor, "head_doctor");
      } else if (employeeType === "speciality") {
        formDataToSend.append("specialty", formData.specialty);
        formDataToSend.append("placeOfWork", formData.placeOfWork);
        formDataToSend.append("regalia", formData.regalia);
        formDataToSend.append("services", JSON.stringify(formData.services));
        formDataToSend.append("feesAmount", parseFloat(formData.feesAmount));
        formDataToSend.append("currency", formData.currency);

        const newSpeciality = await addSpecialistDoctor(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'specialist',
          employeeData: newSpeciality
        });
        onAdd(newSpeciality, "speciality");
      } else if (employeeType === "assistant") {
        formDataToSend.append("specialty", formData.specialty);

        const newAssistant = await addAssistant(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'assistant',
          employeeData: newAssistant
        });
        onAdd(newAssistant, "assistant");
      } else if (employeeType === "head_assistant") {
        formDataToSend.append("specialty", formData.specialty);

        const newHeadAssistant = await addHeadAssistant(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'head_assistant',
          employeeData: newHeadAssistant
        });
        onAdd(newHeadAssistant, "head_assistant");
      } else if (employeeType === "content_manager") {
        formDataToSend.append("cityOfResidence", formData.cityOfResidence);
        formData.canManage.forEach((item) => 
          formDataToSend.append("canManage", item)
        );

        const newContentManager = await createContentManager(formDataToSend);
        socket.emit('employee-created', {
          employeeType: 'content_manager',
          employeeData: newContentManager
        });
        onAdd(newContentManager, "content_manager");
      }

      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || t("add_employee.errors.submit_failed");
      setErrors({
        submit: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "12px",
      borderColor: state.isFocused ? "#60a5fa" : "#e2e8f0",
      borderWidth: "2px",
      padding: "4px",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(96, 165, 250, 0.1)" : "none",
      "&:hover": {
        borderColor: "#60a5fa",
      },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#60a5fa"
        : state.isFocused
        ? "rgba(96, 165, 250, 0.1)"
        : "white",
      color: state.isSelected ? "white" : "#1e293b",
      padding: "12px 16px",
      cursor: "pointer",
    }),
  };

  // Check if employee type should show doctor fields
  const showDoctorFields = ["doctor", "head_doctor", "speciality"].includes(
    employeeType
  );

  // Check if employee type should show assistant fields
  const showAssistantFields = ["assistant", "head_assistant"].includes(
    employeeType
  );

  // Check if employee type should show content manager fields
  const showContentManagerFields = employeeType === "content_manager";

  // Check if employee type should show branches field
  const showBranchesField = !!employeeType;

  return createPortal(
    <div className="add-modal-overlay-modern" onClick={onClose}>
      <div
        className="add-modal-content-modern"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-modal-header-modern">
          <div className="employee-header-title-section">
            <h2>{t("add_employee.title")}</h2>
            <p>{t("add_employee.subtitle")}</p>
          </div>
          <button className="close-btn-modern" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="add-modal-body-modern">
          {loadingBranches ? (
            <div className="loading-text">
              Loading your access permissions...
            </div>
          ) : availableBranches.length === 0 ? (
            <div className="no-access-wrapper">
              <div className="no-access-content">
                <div className="no-access-icon">🚫</div>
                <h3 className="no-access-title">No Branch Access</h3>
                <p className="no-access-message">
                  You don't have permission to add employees for any branches.
                  <br />
                  Please contact your{" "}
                  <strong className="admin-text">Super Admin</strong> to gain
                  access.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-section-modern">
                <label className="form-label-modern required">
                  {t("add_employee.fields.employee_type")}
                </label>
                <Select
                  options={employeeTypeOptions}
                  value={employeeTypeOptions.find(
                    (opt) => opt.value === employeeType
                  )}
                  onChange={(selected) => {
                    const val = selected?.value || "";
                    if (val === "doctor" && onDoctorSelect) {
                      onDoctorSelect();
                      return;
                    }
                    setEmployeeType(val);
                  }}
                  styles={customSelectStyles}
                  placeholder={t(
                    "add_employee.placeholders.select_employee_type"
                  )}
                  isClearable
                />
                {errors.employeeType && (
                  <span className="error-text-modern">
                    {errors.employeeType}
                  </span>
                )}
              </div>

              {employeeType && ["speciality"].includes(employeeType) ? (
                <div className="doctor-redirect-message">
                  <div className="redirect-icon">🩺</div>
                  <h3 className="redirect-title">
                    {t("add_employee.redirect.title", "Create Doctor Profile")}
                  </h3>
                  <p className="redirect-description">
                    {t(
                      "add_employee.redirect.description",
                      "To add a doctor, head doctor, or specialist, please use the Doctor Profile Management page where you can create comprehensive profiles with all necessary medical information."
                    )}
                  </p>
                  <div className="form-actions-modern" style={{ marginTop: '2rem' }}>
                    <button
                      type="button"
                      className="cancel-btn-modern"
                      onClick={onClose}
                    >
                      {t("add_employee.buttons.cancel")}
                    </button>
                    <button
                      type="button"
                      className="submit-btn-modern"
                      onClick={() => {
                        onClose();
                        navigate("/doctors-profile");
                      }}
                    >
                      <User size={18} />
                      {t("add_employee.redirect.go_to_doctor_profile", "Go to Doctor Profile Page")}
                    </button>
                  </div>
                </div>
              ) : employeeType ? (
                <>
                  <div className="photo-upload-section-modern">
                    <div className="photo-upload-container">
                      <label className="photo-upload-label-modern">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{ display: "none" }}
                        />
                        <div className="photo-upload-area-modern">
                          {previewImage ? (
                            <>
                              <img
                                src={previewImage}
                                alt="Preview"
                                className="photo-preview-modern"
                              />
                              <div className="photo-overlay">
                                <Upload size={24} />
                                <span>
                                  {t("add_employee.buttons.change_photo")}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="photo-placeholder-modern">
                              <div className="camera-icon-wrapper">
                                <Camera size={40} />
                              </div>
                              <span className="upload-text">
                                {t("add_employee.buttons.upload_photo")}
                              </span>
                              <span className="upload-subtext">
                                {t("add_employee.labels.photo_requirements")}
                              </span>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="form-grid-modern">
                    <div className="form-section-modern">
                      <label className="form-label-modern required">
                        {t("add_employee.fields.last_name")}
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className={`form-input-modern ${
                          errors.lastName ? "error" : ""
                        }`}
                        placeholder={t("add_employee.placeholders.last_name")}
                        required
                      />
                      {errors.lastName && (
                        <span className="error-text-modern">
                          {errors.lastName}
                        </span>
                      )}
                    </div>

                    <div className="form-section-modern">
                      <label className="form-label-modern required">
                        {t("add_employee.fields.first_name")}
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className={`form-input-modern ${
                          errors.firstName ? "error" : ""
                        }`}
                        placeholder={t("add_employee.placeholders.first_name")}
                        required
                      />
                      {errors.firstName && (
                        <span className="error-text-modern">
                          {errors.firstName}
                        </span>
                      )}
                    </div>

                    <div className="form-section-modern full-width">
                      <label className="form-label-modern">
                        {t("add_employee.fields.middle_name")}
                      </label>
                      <input
                        type="text"
                        name="middleName"
                        value={formData.middleName}
                        onChange={handleChange}
                        className="form-input-modern"
                        placeholder={t("add_employee.placeholders.middle_name")}
                      />
                    </div>

                    <div className="form-section-modern">
                      <label className="form-label-modern required">
                        {t("add_employee.fields.date_of_birth")}
                      </label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        className={`form-input-modern ${
                          errors.dateOfBirth ? "error" : ""
                        }`}
                        max={new Date().toISOString().split("T")[0]}
                        required
                      />
                      {errors.dateOfBirth && (
                        <span className="error-text-modern">
                          {errors.dateOfBirth}
                        </span>
                      )}
                    </div>

                    <div className="form-section-modern">
                      <label className="form-label-modern">
                        {t("add_employee.fields.age")}
                      </label>
                      <input
                        type="text"
                        name="age"
                        value={formData.age}
                        readOnly
                        className="form-input-modern read-only"
                        placeholder={t("add_employee.placeholders.age")}
                      />
                    </div>

                    <div className="form-section-modern full-width">
                      <label className="form-label-modern required">
                        {t("add_employee.fields.gender")}
                      </label>
                      <Select
                        options={genderOptions}
                        value={genderOptions.find(
                          (opt) => opt.value === formData.gender
                        )}
                        onChange={(selected) => {
                          setFormData((prev) => ({
                            ...prev,
                            gender: selected?.value || "",
                          }));
                          if (errors.gender)
                            setErrors((prev) => ({ ...prev, gender: "" }));
                        }}
                        styles={customSelectStyles}
                        placeholder={t(
                          "add_employee.placeholders.select_gender"
                        )}
                        isClearable
                      />
                      {errors.gender && (
                        <span className="error-text-modern">
                          {errors.gender}
                        </span>
                      )}
                    </div>

                    <div className="form-section-modern full-width">
                      <label className="form-label-modern required">
                        {t("add_employee.fields.email")}
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`form-input-modern ${
                          errors.email ? "error" : ""
                        }`}
                        placeholder={t("add_employee.placeholders.email")}
                        required
                      />
                      {errors.email && (
                        <span className="error-text-modern">
                          {errors.email}
                        </span>
                      )}
                    </div>

                    <div className="form-section-modern full-width">
                      <label className="form-label-modern required">
                        {t("add_employee.fields.phone")}
                      </label>
                      <PhoneInput
                        country={"ru"}
                        value={formData.phoneNumber}
                        onChange={(phone) => {
                          setFormData((prev) => ({
                            ...prev,
                            phoneNumber: phone,
                          }));
                          if (errors.phoneNumber)
                            setErrors((prev) => ({ ...prev, phoneNumber: "" }));
                        }}
                        containerClass="phone-input-container"
                        inputClass={`phone-input-modern ${
                          errors.phoneNumber ? "error" : ""
                        }`}
                        buttonClass="phone-input-button"
                        dropdownClass="phone-input-dropdown"
                        enableSearch
                        searchPlaceholder={t(
                          "add_employee.placeholders.search_country"
                        )}
                      />
                      {errors.phoneNumber && (
                        <span className="error-text-modern">
                          {errors.phoneNumber}
                        </span>
                      )}
                    </div>

                    {/* Branches field - only show for non-content managers */}
                    {showBranchesField && (
                      <div className="form-section-modern full-width">
                        <label className="form-label-modern required">
                          {t("add_employee.fields.branches")}
                        </label>
                        {loadingBranches ? (
                          <div className="loading-text">
                            Loading available branches...
                          </div>
                        ) : (
                          <select
                            className="form-input-modern"
                            value={formData.branches?.[0] || ""}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                branches: e.target.value ? [e.target.value] : [],
                              }));
                              if (errors.branches)
                                setErrors((prev) => ({ ...prev, branches: "" }));
                            }}
                          >
                            <option value="">{t("add_employee.placeholders.select_branch")}</option>
                            {availableBranches.map((branch) => {
                              const branchValue = branch.value || branch;
                              const branchLabel = branch.label || branch;
                              const key = branchLabel.toLowerCase().replace(/\s+/g, "_");
                              return (
                                <option key={branchValue} value={branchValue}>
                                  {t(`branches.${key}`, { defaultValue: branchLabel })}
                                </option>
                              );
                            })}
                          </select>
                        )}
                        {errors.branches && (
                          <span className="error-text-modern">
                            {errors.branches}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Notification Language - for all employee types */}
                  <div className="form-section-modern full-width" style={{ marginTop: '20px', marginBottom: '20px' }}>
                    <label className="form-label-modern required">
                      {t("add_employee.fields.notification_language") || "Notification Language"}
                    </label>
                    <Select
                      options={languageOptions}
                      value={languageOptions.find(opt => opt.value === formData.notificationLanguage)}
                      onChange={(selectedOption) =>
                        setFormData({
                          ...formData,
                          notificationLanguage: selectedOption?.value || "en",
                        })
                      }
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder={t("add_employee.placeholders.select_notification_language") || "Select notification language"}
                      isClearable={false}
                    />
                  </div>

                  {showDoctorFields && (
                    <div className="doctor-fields-section">
                      <div className="section-divider">
                        <span>
                          {employeeType === "head_doctor"
                            ? t("add_employee.sections.head_doctor_info")
                            : employeeType === "speciality"
                            ? t("add_employee.sections.speciality_info")
                            : t("add_employee.sections.doctor_info")}
                        </span>
                      </div>

                      <div className="form-grid-modern">
                        <div className="form-section-modern">
                          <label className="form-label-modern required">
                            {t("add_employee.fields.specialty")}
                          </label>
                          <input
                            type="text"
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                            className={`form-input-modern ${
                              errors.specialty ? "error" : ""
                            }`}
                            placeholder={t(
                              "add_employee.placeholders.specialty"
                            )}
                            required
                          />
                          {errors.specialty && (
                            <span className="error-text-modern">
                              {errors.specialty}
                            </span>
                          )}
                        </div>

                        <div className="form-section-modern">
                          <label className="form-label-modern required">
                            {t("add_employee.fields.place_of_work")}
                          </label>
                          <input
                            type="text"
                            name="placeOfWork"
                            value={formData.placeOfWork}
                            onChange={handleChange}
                            className={`form-input-modern ${
                              errors.placeOfWork ? "error" : ""
                            }`}
                            placeholder={t(
                              "add_employee.placeholders.place_of_work"
                            )}
                            required
                          />
                          {errors.placeOfWork && (
                            <span className="error-text-modern">
                              {errors.placeOfWork}
                            </span>
                          )}
                        </div>

                        <div className="form-section-modern full-width">
                          <label className="form-label-modern">
                            {t("add_employee.fields.regalia")}
                          </label>
                          <input
                            type="text"
                            name="regalia"
                            value={formData.regalia}
                            onChange={handleChange}
                            className="form-input-modern"
                            placeholder={t("add_employee.placeholders.regalia")}
                          />
                        </div>

                        <div className="form-section-modern full-width">
                          <label className="form-label-modern required">
                            {t("add_employee.fields.services")}
                          </label>
                          <Select
                            isMulti
                            options={serviceOptions}
                            value={serviceOptions.filter((opt) =>
                              formData.services.includes(opt.value)
                            )}
                            onChange={(selected) => {
                              setFormData((prev) => ({
                                ...prev,
                                services: selected.map((opt) => opt.value),
                              }));
                              if (errors.services)
                                setErrors((prev) => ({
                                  ...prev,
                                  services: "",
                                }));
                            }}
                            styles={customSelectStyles}
                            placeholder={t(
                              "add_employee.placeholders.select_services"
                            )}
                          />
                          {errors.services && (
                            <span className="error-text-modern">
                              {errors.services}
                            </span>
                          )}
                        </div>

                        <div className="form-section-modern">
                          <label className="form-label-modern required">
                            {t("add_employee.fields.consultation_fee")}
                          </label>
                          <input
                            type="number"
                            name="feesAmount"
                            value={formData.feesAmount}
                            onChange={handleChange}
                            className={`form-input-modern ${
                              errors.feesAmount ? "error" : ""
                            }`}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                          />
                          {errors.feesAmount && (
                            <span className="error-text-modern">
                              {errors.feesAmount}
                            </span>
                          )}
                        </div>

                        <div className="form-section-modern">
                          <label className="form-label-modern">
                            {t("add_employee.fields.currency")}
                          </label>
                        <Select
                          options={currencyOptions}
                          value={currencyOptions.find(
                            (opt) => opt.value === formData.currency
                          )}
                            onChange={(selected) =>
                              setFormData((prev) => ({
                                ...prev,
                                currency: selected?.value || "RUB",
                              }))
                            }
                          styles={customSelectStyles}
                          placeholder={t(
                            "add_employee.placeholders.select_currency"
                          )}
                        />
                      </div>

                    </div>
                  </div>
                )}

                  {showAssistantFields && (
                    <div className="assistant-fields-section">
                      <div className="section-divider">
                        <span>
                          {employeeType === "head_assistant"
                            ? t("add_employee.sections.head_assistant_info")
                            : t("add_employee.sections.assistant_info")}
                        </span>
                      </div>

                      <div className="form-grid-modern">
                        <div className="form-section-modern full-width">
                          <label className="form-label-modern required">
                            {t("add_employee.fields.specialty_department")}
                          </label>
                          <input
                            type="text"
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                            className={`form-input-modern ${
                              errors.specialty ? "error" : ""
                            }`}
                            placeholder={t(
                              "add_employee.placeholders.specialty_department"
                            )}
                            required
                          />
                          {errors.specialty && (
                            <span className="error-text-modern">
                              {errors.specialty}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {showContentManagerFields && (
                    <div className="content-manager-fields-section">
                      <div className="section-divider">
                        <span>Content Manager Information</span>
                      </div>

                      <div className="form-grid-modern">
                        <div className="form-section-modern full-width">
                          <label className="form-label-modern required">
                            City of Residence
                          </label>
                          <input
                            type="text"
                            name="cityOfResidence"
                            value={formData.cityOfResidence}
                            onChange={handleChange}
                            className={`form-input-modern ${
                              errors.cityOfResidence ? "error" : ""
                            }`}
                            placeholder="Enter city of residence"
                            required
                          />
                          {errors.cityOfResidence && (
                            <span className="error-text-modern">
                              {errors.cityOfResidence}
                            </span>
                          )}
                        </div>

                        <div className="form-section-modern full-width">
                          <label className="form-label-modern required">
                            Can Manage
                          </label>
                          <Select
                            isMulti
                            options={canManageOptions}
                            value={canManageOptions.filter((opt) =>
                              formData.canManage.includes(opt.value)
                            )}
                            onChange={(selected) => {
                              setFormData((prev) => ({
                                ...prev,
                                canManage: selected.map((opt) => opt.value),
                              }));
                              if (errors.canManage)
                                setErrors((prev) => ({
                                  ...prev,
                                  canManage: "",
                                }));
                            }}
                            styles={customSelectStyles}
                            placeholder="Select what this content manager can manage"
                          />
                          {errors.canManage && (
                            <span className="error-text-modern">
                              {errors.canManage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {employeeType === "patient" && (
                    <div className="patient-fields-section">
                      <div className="section-divider">
                        <span>{t("add_employee.sections.patient_info")}</span>
                      </div>

                      <div className="form-grid-modern">
                        <div className="form-section-modern full-width">
                          <label className="form-label-modern">
                            {t("add_employee.fields.additional_phone")}
                          </label>
                          <PhoneInput
                            country={"us"}
                            value={formData.additionalPhone}
                            onChange={(phone) =>
                              setFormData((prev) => ({
                                ...prev,
                                additionalPhone: phone,
                              }))
                            }
                            containerClass="phone-input-container"
                            inputClass="phone-input-modern"
                            buttonClass="phone-input-button"
                            dropdownClass="phone-input-dropdown"
                            enableSearch
                            searchPlaceholder={t(
                              "add_employee.placeholders.search_country"
                            )}
                          />
                        </div>

                        <div className="form-section-modern full-width">
                          <label className="form-label-modern">
                            {t("add_employee.fields.comments")}
                          </label>
                          <textarea
                            name="comments"
                            value={formData.comments}
                            onChange={handleChange}
                            className="form-textarea-modern"
                            placeholder={t(
                              "add_employee.placeholders.comments"
                            )}
                            rows="4"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {errors.submit && (
                    <div className="submit-error">{errors.submit}</div>
                  )}

                  <div className="form-actions-modern">
                    <button
                      type="button"
                      className="cancel-btn-modern"
                      onClick={onClose}
                      disabled={isSubmitting}
                    >
                      {t("add_employee.buttons.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="submit-btn-modern"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="spinner-modern"></div>
                          {t("add_employee.buttons.adding_employee")}
                        </>
                      ) : (
                        <>
                          <User size={18} />
                          {t("add_employee.buttons.add_employee")}
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default AddEmployeeModal;
