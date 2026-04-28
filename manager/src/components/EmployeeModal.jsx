import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  User,
  Calendar,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Award,
  DollarSign,
  Save,
  Trash2,
  Upload,
  Crown,
  Star,
  Edit2,
  FileText,
} from "lucide-react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import Select from "react-select";
import {
  updateDoctor,
  updateHeadDoctor,
  updatePatient,
  updateAssistant,
  updateHeadAssistant,
  updateSpecialistDoctor,
  updateManager,
  updateContentManager,
  deleteDoctor,
  deleteHeadDoctor,
  deletePatient,
  deleteAssistant,
  deleteHeadAssistant,
  deleteSpecialistDoctor,
  deleteManager,
  deleteContentManager,
  getProfile,
} from "../utils/api";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import "../styles/EmployeeModal.css";

function EmployeeModal({
  isOpen,
  onClose,
  employee,
  type,
  onUpdate,
  onDelete,
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Helper function to get text from multilingual field or plain string
  const getMultilingualText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      const lang = localStorage.getItem('i18nextLng') || 'en';
      return field[lang] || field.en || field.ru || '';
    }
    return '';
  };

  const serviceOptions = [
    { value: "Online", label: t("employee_modal.services.online") },
    { value: "Offline", label: t("employee_modal.services.offline") },
  ];

  const genderOptions = [
    { value: "Male", label: t("employee_modal.gender.male") },
    { value: "Female", label: t("employee_modal.gender.female") },
    { value: "Other", label: t("employee_modal.gender.other") },
  ];

  const currencyOptions = [
    { value: "RUB", label: t("employee_modal.currency.rub") },
    { value: "USD", label: t("employee_modal.currency.usd") },
    { value: "EUR", label: t("employee_modal.currency.eur") },
  ];

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "ru", label: "Русский" },
  ];

  // const branchOptions = [
  //   { value: "Moscow", label: "Moscow Clinic" },
  //   { value: "Makhachkala", label: "Makhachkala Clinic" },
  //   { value: "Saint Petersburg", label: "Saint Petersburg Clinic" },
  // ];

  // Content management options - all sidebar items from feed, content, and forms groups
  const canManageOptions = [
    // Feed group items
    { value: "messenger", label: t("sidebar.messenger") || "Messenger" },
    //{ value: "whatsapp", label: t("sidebar.whatsapp") || "WhatsApp" },
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
    if (employee) {
      const normalized = {
        ...employee,
        profileImage: employee.profilePicture || employee.profileImage || null,
        services: employee.services || [],
        comments: employee.comments || "",
        specialty: employee.specialty || "",
        branches: employee.branches || [],
        dateOfBirth: formatDateForInput(employee.dateOfBirth),
        canManage: employee.canManage || employee.contentSpecialties || [],
        notificationLanguage: employee.notificationLanguage || "en",
      };
      setFormData(normalized);
      setPreviewImage(normalized.profileImage);
    }
  }, [employee]);

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

  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
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

  // WebSocket listeners
  useEffect(() => {
    if (!employee) return;

    const updateHandler = (updated) => {
      if (updated._id === employee._id) {
        setFormData(updated);
        setPreviewImage(updated.profilePicture || null);
        onUpdate(updated);
        toast.info(
          t("employee_modal.realtime.updated", {
            type: t(`employee_modal.types.${type}`),
          })
        );
      }
    };

    const deleteHandler = ({ _id }) => {
      if (_id === employee._id) {
        onDelete(_id, type);
        handleClose();
        toast.warn(
          t("employee_modal.realtime.deleted", {
            type: t(`employee_modal.types.${type}`),
          })
        );
      }
    };

    socket.on(`${type}Updated`, updateHandler);
    socket.on(`${type}Deleted`, deleteHandler);

    return () => {
      socket.off(`${type}Updated`, updateHandler);
      socket.off(`${type}Deleted`, deleteHandler);
    };
  }, [employee, type, onUpdate, onDelete, t]);

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("employee_modal.errors.image_size"));
        return;
      }
      setFormData((prev) => ({ ...prev, profileImage: file }));
      setPreviewImage(URL.createObjectURL(file));
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (Array.isArray(formData[key])) {
          if (key === "branches") {
            formData[key].forEach((b) => formDataToSend.append("branches", b));
          } else if (key === "canManage" || key === "contentSpecialties") {
            // Handle both old and new field names for backward compatibility
            formData[key].forEach((s) =>
              formDataToSend.append("canManage", s)
            );
          } else {
            formDataToSend.append(key, JSON.stringify(formData[key]));
          }
        } else if (key === "profileImage" && formData[key] instanceof File) {
          formDataToSend.append(key, formData[key]);
        } else if (formData[key] !== null && formData[key] !== undefined) {
          formDataToSend.append(key, formData[key]);
        }
      });

      let updatedEmployee;
      switch (type) {
        case "manager":
          updatedEmployee = await updateManager(employee._id, formDataToSend);
          break;
        case "doctor":
          updatedEmployee = await updateDoctor(employee._id, formDataToSend);
          break;
        case "head_doctor":
          updatedEmployee = await updateHeadDoctor(
            employee._id,
            formDataToSend
          );
          break;
        case "assistant":
          updatedEmployee = await updateAssistant(employee._id, formDataToSend);
          break;
        case "head_assistant":
          updatedEmployee = await updateHeadAssistant(
            employee._id,
            formDataToSend
          );
          break;
        case "patient":
          updatedEmployee = await updatePatient(employee._id, formDataToSend);
          break;
        case "specialist":
          updatedEmployee = await updateSpecialistDoctor(
            employee._id,
            formDataToSend
          );
          break;
        case "content_manager":
          updatedEmployee = await updateContentManager(
            employee._id,
            formDataToSend
          );
          break;
        default:
          break;
      }

      const normalizedUpdated = {
        ...updatedEmployee,
        dateOfBirth: formatDateForInput(updatedEmployee.dateOfBirth),
        services: updatedEmployee.services || [],
        profileImage:
          updatedEmployee.profilePicture ||
          updatedEmployee.profileImage ||
          null,
        canManage: updatedEmployee.canManage || updatedEmployee.contentSpecialties || [],
      };

      onUpdate(normalizedUpdated);
      setFormData(normalizedUpdated);
      setPreviewImage(normalizedUpdated.profileImage);
      setIsEditing(false);
      toast.success(
        t("employee_modal.success.updated", {
          type: t(`employee_modal.types.${type}`),
        })
      );
      
      // Emit socket event for real-time updates
      socket.emit('employee-updated', {
        employeeId: employee._id,
        employeeType: type,
        updatedData: normalizedUpdated
      });
      
      onClose();
    } catch {
      toast.error(t("employee_modal.errors.update_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("employee_modal.confirm.delete"))) return;
    setIsSubmitting(true);
    try {
      switch (type) {
        case "manager":
          await deleteManager(employee._id);
          break;
        case "doctor":
          await deleteDoctor(employee._id);
          break;
        case "head_doctor":
          await deleteHeadDoctor(employee._id);
          break;
        case "assistant":
          await deleteAssistant(employee._id);
          break;
        case "head_assistant":
          await deleteHeadAssistant(employee._id);
          break;
        case "patient":
          await deletePatient(employee._id);
          break;
        case "specialist":
          await deleteSpecialistDoctor(employee._id);
          break;
        case "content_manager":
          await deleteContentManager(employee._id);
          break;
        default:
          break;
      }
      onDelete(employee._id, type);
      handleClose();
      toast.success(
        t("employee_modal.success.deleted", {
          type: t(`employee_modal.types.${type}`),
        })
      );
      
      // Emit socket event for real-time updates
      socket.emit('employee-deleted', {
        employeeId: employee._id,
        employeeType: type
      });
      
    } catch {
      toast.error(t("employee_modal.errors.delete_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  const getTypeColor = () => {
    switch (type) {
      case "manager":
        return "#3b82f6";
      case "doctor":
        return "#10b981";
      case "head_doctor":
        return "#0ea5e9";
      case "patient":
        return "#f59e0b";
      case "assistant":
        return "#8b5cf6";
      case "head_assistant":
        return "#ec4899";
      case "specialist":
        return "#f43f5e";
      case "content_manager":
        return "#8b5cf6";
      default:
        return "#60a5fa";
    }
  };

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "12px",
      borderColor: state.isFocused ? "#60a5fa" : "#e2e8f0",
      borderWidth: "2px",
      padding: "4px",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(96, 165, 250, 0.1)" : "none",
      "&:hover": { borderColor: "#60a5fa" },
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

  // Check if branches should be shown
  const showBranchesSection = true;

  const getProfileImageSrc = () => {
    const candidate =
      previewImage ||
      employee?.profilePictureUrl ||
      employee?.profilePicture ||
      employee?.profileImage ||
      employee?.imageUrl ||
      null;

    if (!candidate) return null;
    if (typeof candidate !== "string") return null;

    const value = candidate.trim();
    if (!value) return null;

    if (
      value.startsWith("data:") ||
      value.startsWith("http") ||
      value.startsWith("blob:")
    ) {
      return value;
    }

    // GridFS/ObjectId reference (not directly renderable in <img src>)
    if (/^[a-f0-9]{24}$/i.test(value)) return null;

    // Raw base64: convert to data URL
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 80) {
      return `data:image/jpeg;base64,${value}`;
    }

    return value;
  };

  return createPortal(
    <div className="employee-modal-overlay-modern" onClick={handleClose}>
      <div
        className="employee-modal-content-modern"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="employee-modal-header-modern">
          <div className="header-left-section">
            <h2>
              {isEditing
                ? t("employee_modal.title.edit")
                : t("employee_modal.title.view")}
            </h2>
            <p>
              {isEditing
                ? t("employee_modal.subtitle.edit")
                : t("employee_modal.subtitle.view")}
            </p>
          </div>
          <div className="header-actions-modern">
            {!isEditing && (
              <>
                {/* EDIT BUTTON */}
                <div className="btn-wrapper">
                  <button
                    className="action-btn-modern edit-action"
                    onClick={() => setIsEditing(true)}
                    disabled={
                      !availableBranches.length
                    }
                  >
                    <Edit2 size={18} />
                  </button>
                  {!availableBranches.length && (
                    <div className="tooltip-bubble">
                      You don't have permission to manage employees for any
                      branches.
                    </div>
                  )}
                </div>

                {/* DELETE BUTTON */}
                <div className="btn-wrapper">
                  <button
                    className="action-btn-modern delete-action"
                    onClick={handleDelete}
                    disabled={
                      (!availableBranches.length &&
                        type !== "content_manager") ||
                      isSubmitting
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                  {!availableBranches.length && type !== "content_manager" && (
                    <div className="tooltip-bubble">
                      You don't have permission to manage employees for any
                      branches.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* CLOSE BUTTON */}
            <button
              className="action-btn-modern close-action"
              onClick={handleClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="employee-modal-body-modern">
          <div className="profile-section-modern">
            <div className="profile-image-wrapper-modern">
              {isEditing && (
                <label className="photo-edit-overlay">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <div className="overlay-content">
                    <Upload size={24} />
                    <span>{t("employee_modal.buttons.change_photo")}</span>
                  </div>
                </label>
              )}
              {getProfileImageSrc() ? (
                <img
                  src={getProfileImageSrc()}
                  alt={`${getMultilingualText(employee.lastName)} ${getMultilingualText(employee.firstName)} ${getMultilingualText(employee.middleName)}`.trim()}
                  className="profile-image-modern"
                />
              ) : (
                <div className="profile-placeholder-modern">
                  <User size={48} />
                </div>
              )}
            </div>

            <div className="profile-details-modern">
              <h3 className="profile-name-modern">
                {[getMultilingualText(employee.lastName), getMultilingualText(employee.firstName), getMultilingualText(employee.middleName)].filter(Boolean).join(' ')}
              </h3>
              <div
                className="type-badge-display"
                style={{ backgroundColor: getTypeColor() }}
              >
                {t(`employee_modal.types.${type}`)}
              </div>
              {employee.email && (
                <p className="profile-email-modern">
                  <Mail size={16} />
                  {employee.email}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="details-section-modern">
              <div className="section-title-modern">
                <span>{t("employee_modal.sections.personal_info")}</span>
              </div>

              <div className="details-grid-modern">
                <div className="detail-field-modern">
                  <label className="detail-label-modern required">
                    <User size={16} />
                    <span>{t("employee_modal.fields.last_name")}</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName || ""}
                      onChange={handleChange}
                      className="detail-input-modern"
                      placeholder={t("employee_modal.placeholders.last_name")}
                      required
                    />
                  ) : (
                    <p className="detail-value-modern">{getMultilingualText(employee.lastName)}</p>
                  )}
                </div>

                <div className="detail-field-modern">
                  <label className="detail-label-modern required">
                    <User size={16} />
                    <span>{t("employee_modal.fields.first_name")}</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName || ""}
                      onChange={handleChange}
                      className="detail-input-modern"
                      placeholder={t("employee_modal.placeholders.first_name")}
                      required
                    />
                  ) : (
                    <p className="detail-value-modern">{getMultilingualText(employee.firstName)}</p>
                  )}
                </div>

                <div className="detail-field-modern full-width">
                  <label className="detail-label-modern">
                    <User size={16} />
                    <span>{t("employee_modal.fields.middle_name")}</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName || ""}
                      onChange={handleChange}
                      className="detail-input-modern"
                      placeholder={t(
                        "employee_modal.placeholders.middle_name"
                      )}
                    />
                  ) : (
                    <p className="detail-value-modern">
                      {getMultilingualText(employee.middleName) || "-"}
                    </p>
                  )}
                </div>

                <div className="detail-field-modern">
                  <label className="detail-label-modern required">
                    <Calendar size={16} />
                    <span>{t("employee_modal.fields.date_of_birth")}</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth || ""}
                      onChange={handleChange}
                      className="detail-input-modern"
                      max={new Date().toISOString().split("T")[0]}
                      required
                    />
                  ) : (
                    <p className="detail-value-modern">
                      {employee.dateOfBirth
                        ? new Date(employee.dateOfBirth).toLocaleDateString()
                        : t("employee_modal.values.not_available")}
                    </p>
                  )}
                </div>

                <div className="detail-field-modern">
                  <label className="detail-label-modern required">
                    <User size={16} />
                    <span>{t("employee_modal.fields.gender")}</span>
                  </label>
                  {isEditing ? (
                    <Select
                      options={genderOptions}
                      value={genderOptions.find(
                        (opt) => opt.value === formData.gender
                      )}
                      onChange={(selected) =>
                        setFormData((prev) => ({
                          ...prev,
                          gender: selected?.value || "",
                        }))
                      }
                      styles={customSelectStyles}
                      placeholder={t(
                        "employee_modal.placeholders.select_gender"
                      )}
                      isClearable
                    />
                  ) : (
                    <p className="detail-value-modern">
                      {employee.gender ||
                        t("employee_modal.values.not_available")}
                    </p>
                  )}
                </div>
              </div>

              <div className="section-title-modern">
                <span>{t("employee_modal.sections.contact_info")}</span>
              </div>

              <div className="details-grid-modern">
                <div className="detail-field-modern full-width">
                  <label className="detail-label-modern required">
                    <Mail size={16} />
                    <span>{t("employee_modal.fields.email")}</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleChange}
                      className="detail-input-modern"
                      placeholder={t("employee_modal.placeholders.email")}
                      required
                    />
                  ) : (
                    <p className="detail-value-modern">{employee.email}</p>
                  )}
                </div>

                <div className="detail-field-modern full-width">
                  <label className="detail-label-modern required">
                    <Phone size={16} />
                    <span>{t("employee_modal.fields.phone")}</span>
                  </label>
                  {isEditing ? (
                    <PhoneInput
                      country={"ru"}
                      value={formData.phoneNumber || ""}
                      onChange={(phone) =>
                        setFormData((prev) => ({ ...prev, phoneNumber: phone }))
                      }
                      containerClass="phone-input-container"
                      inputClass="phone-input-modern-view"
                      buttonClass="phone-input-button"
                      dropdownClass="phone-input-dropdown"
                      enableSearch
                      searchPlaceholder={t(
                        "employee_modal.placeholders.search_country"
                      )}
                    />
                  ) : (
                    <p className="detail-value-modern">
                      {employee.phoneNumber}
                    </p>
                  )}
                </div>

                {/* Notification Language - for all employee types */}
                <div className="detail-field-modern full-width">
                  <label className="detail-label-modern">
                    <FileText size={16} />
                    <span>{t("employee_modal.fields.notification_language") || "Notification Language"}</span>
                  </label>
                  {isEditing ? (
                    <Select
                      options={languageOptions}
                      value={languageOptions.find(option => option.value === formData.notificationLanguage)}
                      onChange={(selectedOption) =>
                        setFormData((prev) => ({
                          ...prev,
                          notificationLanguage: selectedOption ? selectedOption.value : "en"
                        }))
                      }
                      className="react-select-container-modern"
                      classNamePrefix="react-select"
                      placeholder={t("employee_modal.placeholders.select_notification_language") || "Select notification language"}
                      isClearable={false}
                    />
                  ) : (
                    <p className="detail-value-modern">
                      {formData.notificationLanguage === "ru" ? "Русский" : "English"}
                    </p>
                  )}
                </div>

                {/* Branches section - only show for non-content managers */}
                {showBranchesSection && (
                  <>
                    <div className="section-title-modern">
                      <span>
                        {t("employee_modal.sections.branches") ||
                          "Branches / Clinics"}
                      </span>
                    </div>

                    <div className="details-grid-modern">
                      <div className="detail-field-modern full-width">
                        <label className="detail-label-modern required">
                          <MapPin size={16} />
                          <span>
                            {t("employee_modal.fields.branch") || "Branch"}
                          </span>
                        </label>

                        {isEditing ? (
                          <select
                            className="detail-input-modern"
                            value={
                              Array.isArray(formData.branches) && formData.branches.length > 0
                                ? formData.branches[0] 
                                : ""
                            }
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                branches: e.target.value ? [e.target.value] : [], // keep array structure for backend
                              }))
                            }
                          >
                            <option value="">{t("employee_modal.placeholders.select_branch")}</option>
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
                        ) : (
                          <div className="branches-display-modern">
                            {employee.branches &&
                            employee.branches.length > 0 ? (
                              <span className="branch-badge-modern">
                                {(() => {
                                  const branchName = employee.branches[0];
                                  const key = branchName.toLowerCase().replace(/\s+/g, "_");
                                  return t(`branches.${key}`, { defaultValue: branchName });
                                })()}
                              </span>
                            ) : (
                              <p className="detail-value-modern">
                                {t("employee_modal.values.not_available")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {type === "patient" && employee.additionalPhone && (
                  <div className="detail-field-modern full-width">
                    <label className="detail-label-modern">
                      <Phone size={16} />
                      <span>{t("employee_modal.fields.additional_phone")}</span>
                    </label>
                    {isEditing ? (
                      <PhoneInput
                        country={"ru"}
                        value={formData.additionalPhone || ""}
                        onChange={(phone) =>
                          setFormData((prev) => ({
                            ...prev,
                            additionalPhone: phone,
                          }))
                        }
                        containerClass="phone-input-container"
                        inputClass="phone-input-modern-view"
                        buttonClass="phone-input-button"
                        dropdownClass="phone-input-dropdown"
                        enableSearch
                        searchPlaceholder={t(
                          "employee_modal.placeholders.search_country"
                        )}
                      />
                    ) : (
                      <p className="detail-value-modern">
                        {employee.additionalPhone}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Content Manager Specific Fields */}
              {type === "content_manager" && (
                <>
                  <div className="section-title-modern">
                    <span>Content Management Info</span>
                  </div>

                  <div className="details-grid-modern">
                    <div className="detail-field-modern full-width">
                      <label className="detail-label-modern required">
                        <MapPin size={16} />
                        <span>City of Residence</span>
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="cityOfResidence"
                          value={formData.cityOfResidence || ""}
                          onChange={handleChange}
                          className="detail-input-modern"
                          placeholder="Enter city of residence"
                        />
                      ) : (
                        <p className="detail-value-modern">
                          {employee.cityOfResidence ||
                            t("employee_modal.values.not_available")}
                        </p>
                      )}
                    </div>

                    <div className="detail-field-modern full-width">
                      <label className="detail-label-modern required">
                        <FileText size={16} />
                        <span>Can Manage</span>
                      </label>
                      {isEditing ? (
                        <Select
                          isMulti
                          options={canManageOptions}
                          value={canManageOptions.filter((opt) =>
                            (formData.canManage || []).includes(
                              opt.value
                            )
                          )}
                          onChange={(selected) =>
                            setFormData((prev) => ({
                              ...prev,
                              canManage: selected.map(
                                (opt) => opt.value
                              ),
                            }))
                          }
                          styles={customSelectStyles}
                          placeholder="Select what this content manager can manage"
                        />
                      ) : (
                        <div className="services-display-modern">
                          {(employee.canManage || employee.contentSpecialties) &&
                          (employee.canManage || employee.contentSpecialties).length > 0
                            ? (employee.canManage || employee.contentSpecialties).map(
                                (item, idx) => (
                                  <span
                                    key={idx}
                                    className="service-badge-modern"
                                  >
                                    {canManageOptions.find(
                                      (opt) => opt.value === item
                                    )?.label || item}
                                  </span>
                                )
                              )
                            : t("employee_modal.values.not_available")}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(type === "doctor" ||
                type === "head_doctor" ||
                type === "specialist") && (
                <>
                  <div className="section-title-modern">
                    <span>
                      {t("employee_modal.sections.professional_info")}
                    </span>
                  </div>

                  <div className="details-grid-modern">
                    <div className="detail-field-modern">
                      <label className="detail-label-modern required">
                        <Briefcase size={16} />
                        <span>{t("employee_modal.fields.specialty")}</span>
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="specialty"
                          value={formData.specialty || ""}
                          onChange={handleChange}
                          className="detail-input-modern"
                          placeholder={t(
                            "employee_modal.placeholders.specialty"
                          )}
                        />
                      ) : (
                        <p className="detail-value-modern">
                          {getMultilingualText(employee.specialty) ||
                            t("employee_modal.values.not_available")}
                        </p>
                      )}
                    </div>

                    <div className="detail-field-modern">
                      <label className="detail-label-modern required">
                        <MapPin size={16} />
                        <span>{t("employee_modal.fields.place_of_work")}</span>
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="placeOfWork"
                          value={formData.placeOfWork || ""}
                          onChange={handleChange}
                          className="detail-input-modern"
                          placeholder={t(
                            "employee_modal.placeholders.place_of_work"
                          )}
                        />
                      ) : (
                        <p className="detail-value-modern">
                          {employee.placeOfWork ||
                            t("employee_modal.values.not_available")}
                        </p>
                      )}
                    </div>

                    <div className="detail-field-modern full-width">
                      <label className="detail-label-modern">
                        <Award size={16} />
                        <span>{t("employee_modal.fields.regalia")}</span>
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="regalia"
                          value={formData.regalia || ""}
                          onChange={handleChange}
                          className="detail-input-modern"
                          placeholder={t("employee_modal.placeholders.regalia")}
                        />
                      ) : (
                        <p className="detail-value-modern">
                          {getMultilingualText(employee.regalia) ||
                            t("employee_modal.values.not_available")}
                        </p>
                      )}
                    </div>

                    <div className="detail-field-modern full-width">
                      <label className="detail-label-modern required">
                        <Briefcase size={16} />
                        <span>{t("employee_modal.fields.services")}</span>
                      </label>
                      {isEditing ? (
                        <Select
                          isMulti
                          options={serviceOptions}
                          value={serviceOptions.filter((opt) =>
                            (formData.services || []).includes(opt.value)
                          )}
                          onChange={(selected) =>
                            setFormData((prev) => ({
                              ...prev,
                              services: selected.map((opt) => opt.value),
                            }))
                          }
                          styles={customSelectStyles}
                          placeholder={t(
                            "employee_modal.placeholders.select_services"
                          )}
                        />
                      ) : (
                        <div className="services-display-modern">
                          {employee.services && employee.services.length > 0
                            ? employee.services.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="service-badge-modern"
                                >
                                  {service === "Online"
                                    ? t("employee_modal.services.online")
                                    : t("employee_modal.services.offline")}
                                </span>
                              ))
                            : t("employee_modal.values.not_available")}
                        </div>
                      )}
                    </div>

                    <div className="detail-field-modern">
                      <label className="detail-label-modern required">
                        <DollarSign size={16} />
                        <span>
                          {t("employee_modal.fields.consultation_fee")}
                        </span>
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          name="feesAmount"
                          value={formData.feesAmount || ""}
                          onChange={handleChange}
                          className="detail-input-modern"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                      ) : (
                        <p className="detail-value-modern fee-display">
                          {employee.feesAmount
                            ? `${employee.feesAmount} ${
                                employee.currency || "USD"
                              }`
                            : t("employee_modal.values.not_available")}
                        </p>
                      )}
                    </div>

                    {isEditing && (
                      <>
                        <div className="detail-field-modern">
                          <label className="detail-label-modern">
                            <DollarSign size={16} />
                            <span>{t("employee_modal.fields.currency")}</span>
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
                              "employee_modal.placeholders.select_currency"
                            )}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {type === "assistant" && employee.specialty && (
                <>
                  <div className="section-title-modern">
                    <span>
                      {t("employee_modal.sections.professional_info")}
                    </span>
                  </div>

                  <div className="details-grid-modern">
                    <div className="detail-field-modern full-width">
                      <label className="detail-label-modern">
                        <Briefcase size={16} />
                        <span>
                          {t("employee_modal.fields.specialty_department")}
                        </span>
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="specialty"
                          value={formData.specialty || ""}
                          onChange={handleChange}
                          className="detail-input-modern"
                          placeholder={t(
                            "employee_modal.placeholders.specialty_department"
                          )}
                        />
                      ) : (
                        <p className="detail-value-modern">
                          {getMultilingualText(employee.specialty)}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {type === "patient" && employee.comments && (
                <>
                  <div className="section-title-modern">
                    <span>{t("employee_modal.sections.additional_info")}</span>
                  </div>

                  <div className="details-grid-modern">
                    <div className="detail-field-modern full-width">
                      <label className="detail-label-modern">
                        <User size={16} />
                        <span>{t("employee_modal.fields.comments")}</span>
                      </label>
                      {isEditing ? (
                        <textarea
                          name="comments"
                          value={formData.comments || ""}
                          onChange={handleChange}
                          className="detail-textarea-modern"
                          placeholder={t(
                            "employee_modal.placeholders.comments"
                          )}
                          rows="4"
                        />
                      ) : (
                        <p className="detail-value-modern">
                          {employee.comments}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {isEditing && (
              <div className="employee-modal-footer-modern">
                <button
                  type="button"
                  className="cancel-btn-view"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      ...employee,
                      services: employee.services || [],
                      dateOfBirth: employee.dateOfBirth
                        ? new Date(employee.dateOfBirth)
                            .toISOString()
                            .split("T")[0]
                        : "",
                      canManage: employee.canManage || employee.contentSpecialties || [],
                    });
                    setPreviewImage(employee.profileImage || null);
                  }}
                  disabled={isSubmitting}
                >
                  {t("employee_modal.buttons.cancel")}
                </button>
                <button
                  type="submit"
                  className="save-btn-view"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-view"></div>
                      {t("employee_modal.buttons.saving")}
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {t("employee_modal.buttons.save_changes")}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EmployeeModal;
