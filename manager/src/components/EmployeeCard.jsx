import {
  User,
  Mail,
  Phone,
  Stethoscope,
  Users as UsersIcon,
  UserCheck,
  CircleUser as UserCircle2,
  Award,
  Plus,
  X,
  Calendar,
  LayoutTemplate,
  Send,
  Info,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Select from "react-select";
import { getDoctors, assignDoctorToAssistant, sendDoctorCredentials, checkDoctorHasAccount } from "../utils/api";
import "../styles/EmployeeCard.css";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { IoMdMale, IoMdFemale } from "react-icons/io";

// Helper function to extract multilingual field values
const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};

function EmployeeCard({
  employee,
  type,
  onViewDetails,
  onViewAssistantDetails,
  refetchAssistants,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hasAccount, setHasAccount] = useState(null);

  const getAvatarSrc = () => {
    const candidate =
      employee?.profilePictureUrl ||
      employee?.profilePicture ||
      employee?.profileImage ||
      employee?.imageUrl ||
      null;

    if (!candidate) return null;
    if (typeof candidate !== "string") return null;

    const value = candidate.trim();
    if (!value) return null;

    if (value.startsWith("data:") || value.startsWith("http")) return value;

    // GridFS/ObjectId reference (not directly renderable in <img src>)
    if (/^[a-f0-9]{24}$/i.test(value)) return null;

    // If it's a raw base64 string from backend, convert to data URL
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 80) {
      return `data:image/jpeg;base64,${value}`;
    }

    return value;
  };

  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [assignFormData, setAssignFormData] = useState({
    doctorEmail: "",
    startDateTime: "",
    endDateTime: "",
  });
  const [assignErrors, setAssignErrors] = useState({});
  const [sendingCredentials, setSendingCredentials] = useState(false);

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

  // Get employee's full name handling multilingual fields
  const getEmployeeName = () => {
    const lastName = getMultilingualText(employee.lastName);
    const firstName = getMultilingualText(employee.firstName);
    const middleName = getMultilingualText(employee.middleName);
    return [lastName, firstName, middleName].filter(Boolean).join(' ').trim();
  };

  // Handler for sending doctor credentials
  const handleSendCredentials = async () => {
    if (!employee._id && !employee.id) {
      toast.error(t("employee_card.errors.no_id"));
      return;
    }

    const doctorId = employee._id || employee.id;
    
    if (window.confirm(t("employee_card.confirm_send_credentials") || `Send login credentials to ${employee.email}?`)) {
      setSendingCredentials(true);
      try {
        await sendDoctorCredentials(doctorId);
        setHasAccount(true); // Update the state - this will hide the button and remove card styling
        toast.success(t("employee_card.credentials_sent") || "Credentials sent successfully!");
      } catch (error) {
        toast.error(
          error.response?.data?.message || 
          t("employee_card.errors.send_credentials_failed") || 
          "Failed to send credentials"
        );
      } finally {
        setSendingCredentials(false);
      }
    }
  };

  // ICONS
  const getTypeIcon = () => {
    switch (type) {
      case "manager":
        return <UserCheck size={18} />;
      case "doctor":
        return <Stethoscope size={18} />;
      case "head_doctor":
        return <Stethoscope size={18} className="icon-highlight" />;
      case "specialist":
        return <Award size={18} />;
      case "assistant":
        return <UserCheck size={18} />;
      case "head_assistant":
        return <UserCheck size={18} className="icon-highlight" />;
      case "content_manager":
        return null;
      case "patient":
        return <UsersIcon size={18} />;
      default:
        return <User size={18} />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "manager":
        return t("employee_card.types.manager");
      case "doctor":
        return t("employee_card.types.doctor");
      case "head_doctor":
        return t("employee_card.types.head_doctor");
      case "specialist":
        return t("employee_card.types.specialist");
      case "assistant":
        return t("employee_card.types.assistant");
      case "head_assistant":
        return t("employee_card.types.head_assistant");
      case "content_manager":
        return t("employee_card.types.content_manager");
      case "patient":
        return t("employee_card.types.patient");
      default:
        return t("employee_card.types.employee");
    }
  };

  const getTypeBadgeClass = () => {
    switch (type) {
      case "manager":
        return "badge-manager";
      case "doctor":
        return "badge-doctor";
      case "head_doctor":
        return "badge-head-doctor";
      case "specialist":
        return "badge-specialist";
      case "assistant":
        return "badge-assistant";
      case "head_assistant":
        return "badge-head-assistant";
      case "content_manager":
        return "badge-content-manager";
      case "patient":
        return "badge-patient";
      default:
        return "";
    }
  };

  const getGenderIcon = () => {
    if (employee.gender === "Male") {
      return <IoMdMale className="icon-male" />;
    } else if (employee.gender === "Female") {
      return <IoMdFemale className="icon-female" />;
    }
    return <UserCircle2 size={16} className="gender-icon" />;
  };

  // Check if doctor has a user account
  useEffect(() => {
    if ((type === "doctor" || type === "head_doctor") && employee.email) {
      const checkAccount = async () => {
        try {
          const response = await checkDoctorHasAccount(employee.email);
          setHasAccount(response.hasAccount);
        } catch (error) {
          setHasAccount(false);
        }
      };
      checkAccount();
    }
  }, [type, employee.email]);

  // Fetch doctors when popup opens
  useEffect(() => {
    if (showAssignPopup) {
      const fetchDoctors = async () => {
        setLoadingDoctors(true);
        try {
          const response = await getDoctors(1, 100, true);
          const doctors = response.doctors || [];
          const options = doctors.map((doctor) => ({
            value: doctor.email,
            label: `${getFieldValue(doctor.firstName)} ${getFieldValue(doctor.lastName)} (${doctor.email})`,
          }));
          setDoctorOptions(options);
        } catch (error) {
          
          toast.error(t("employee_card.errors.failed_fetch_doctors"));
        } finally {
          setLoadingDoctors(false);
        }
      };
      fetchDoctors();
    }
  }, [showAssignPopup, t]);

  // Handle date/time and select changes
  const handleAssignChange = (e) => {
    const { name, value } = e.target;
    setAssignFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDoctorChange = (selected) => {
    setAssignFormData((prev) => ({
      ...prev,
      doctorEmail: selected?.value || "",
    }));
  };

  // Validate form before submit
  const validateAssignForm = () => {
    const newErrors = {};
    if (!assignFormData.doctorEmail)
      newErrors.doctorEmail = t("employee_card.errors.doctor_required");
    if (!assignFormData.startDateTime)
      newErrors.startDateTime = t(
        "employee_card.errors.start_date_time_required"
      );
    if (!assignFormData.endDateTime)
      newErrors.endDateTime = t("employee_card.errors.end_date_time_required");
    else if (
      assignFormData.startDateTime &&
      new Date(assignFormData.endDateTime) <=
        new Date(assignFormData.startDateTime)
    ) {
      newErrors.endDateTime = t("employee_card.errors.end_date_after_start");
    }
    setAssignErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (validateAssignForm()) {
      try {
        await assignDoctorToAssistant(employee.email, {
          doctorEmail: assignFormData.doctorEmail,
          startDateTime: new Date(assignFormData.startDateTime).toISOString(),
          endDateTime: new Date(assignFormData.endDateTime).toISOString(),
        });
        toast.success(t("employee_card.success.assign_success"));
        setShowAssignPopup(false);
        setAssignFormData({
          doctorEmail: "",
          startDateTime: "",
          endDateTime: "",
        });
        if (refetchAssistants) await refetchAssistants();
      } catch (error) {
        
        toast.error(
          error.response?.data?.message ||
            t("employee_card.errors.failed_assign")
        );
      }
    }
  };

  // Show specialty for relevant roles
  const showSpecialty = () => {
    return (
      type === "manager" ||
      type === "doctor" ||
      type === "head_doctor" ||
      type === "specialist" ||
      type === "assistant" ||
      type === "head_assistant"
    );
  };

  // Show can manage for content managers
  const showCanManage = () => {
    return type === "content_manager" && (employee.canManage || employee.contentSpecialties);
  };

  return (
    <div className={`employee-card ${(type === "doctor" || type === "head_doctor") && hasAccount === false ? "no-account" : ""}`}>
      {/* Card Header */}
      <div className="card-header-modern">
        <div className="avatar-container">
          <div className="avatar-wrapper">
            {getAvatarSrc() ? (
              <img
                src={getAvatarSrc()}
                alt={getEmployeeName()}
                className="avatar-image"
              />
            ) : (
              <div className="avatar-placeholder">
                <User size={28} />
              </div>
            )}
          </div>
          <div className="gender-badge">{getGenderIcon()}</div>
        </div>

        <div className="card-header-info">
          <h3 className="employee-name">{getEmployeeName()}</h3>
          <div className={`type-badge-modern ${getTypeBadgeClass()}`}>
            {getTypeIcon()}
            <span>{getTypeLabel()}</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body-modern">
        
        {/* Show info message for doctors without account */}
        {type === 'doctor' && hasAccount === false && (
          <div className="no-account-info">
            <Info size={16} />
            <span>{t("employee_card.tooltips.no_account_created") || "Account not created yet"}</span>
          </div>
        )}

        {/* Show specialties for doctors 
        {(type === 'doctor' || type === 'head_doctor') && employee.specialtyIds && employee.specialtyIds.length > 0 && (
          <div className="content-specialties">
            <p className="specialty-label">{t("employee_card.specialties") || "Specialties"}:</p>
            <div className="specialties-tags">
              {(() => {
                const items = employee.specialtyIds || [];
                const maxVisible = 3;
                const visibleItems = items.slice(0, maxVisible);
                const remainingCount = items.length - maxVisible;
                
                return (
                  <>
                    {visibleItems.map((specialty, index) => {
                      const lang = localStorage.getItem('i18nextLng') || 'en';
                      const specialtyName = typeof specialty === 'object' 
                        ? (lang === 'ru' ? specialty.name_ru : specialty.name_en) || specialty.name_en
                        : specialty;
                      
                      return (
                        <span key={index} className="specialty-tag">
                          {specialtyName}
                        </span>
                      );
                    })}
                    {remainingCount > 0 && (
                      <span className="specialty-tag specialty-tag-more">
                        +{remainingCount} {t("employee_card.more") || "more"}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
*/}

      </div>

      {/* Card Footer */}
      <div className="card-footer-modern">
        <div className="footer-btn-group">
          {/* Common View Details */}
          <button
            className="view-details-btn-modern"
            onClick={() => onViewDetails(employee, type)}
          >
            {t("employee_card.buttons.view_details")}
          </button>

          {/* Doctor-specific buttons */}
          {(type === "doctor" || type === "head_doctor") && (
            <>
              <button
                className="assign-btn-modern"
                title={t("employee_card.tooltips.view_schedule")}
                onClick={() => navigate(`/doctors/${employee.email}/appointments`)}
              >
                <Calendar size={14} />
              </button>

              <button
                className="assign-btn-modern"
                title={t("employee_card.tooltips.templates") || "Manage Templates"}
                onClick={() => navigate(`/doctors/${employee.email}/templates`)}
              >
                <LayoutTemplate size={14} />
              </button>
              
              {/* Only show send credentials button if doctor doesn't have an account */}
              {hasAccount === false && (
                <button
                  className="assign-btn-modern send-credentials-btn no-account"
                  title={t("employee_card.tooltips.send_credentials")}
                  onClick={handleSendCredentials}
                  disabled={sendingCredentials}
                >
                  {sendingCredentials ? (
                    <span className="spinner-small"></span>
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              )}
            </>
          )}

          {/* Assistant-only buttons */}
          {(type === "assistant" || type === "head_assistant") && (
            <>
              <button
                className="assign-btn-modern"
                title={t("employee_card.tooltips.view_assigned_doctors")}
                onClick={() => onViewAssistantDetails(employee)}
              >
                <UserCheck size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Assign Modal - Only for assistants */}
      {showAssignPopup &&
        ReactDOM.createPortal(
          <div className="assign-modal-overlay">
            <div className="assign-modal-container">
              <div className="assign-modal-card">
                <div className="assign-modal-header">
                  <h2 className="assign-modal-title">
                    {t("employee_card.assign_modal.title")}
                  </h2>
                  <button
                    className="assign-modal-close"
                    onClick={() => setShowAssignPopup(false)}
                    title={t("employee_card.buttons.cancel")}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="assign-modal-content">
                  <form onSubmit={handleAssignSubmit} className="assign-form">
                    {/* Doctor Selection */}
                    <div className="form-field-group">
                      <label className="form-label">
                        {t("employee_card.assign_modal.doctor")}{" "}
                        <span className="form-required">*</span>
                      </label>
                      <Select
                        options={doctorOptions}
                        value={doctorOptions.find(
                          (opt) => opt.value === assignFormData.doctorEmail
                        )}
                        onChange={handleDoctorChange}
                        classNamePrefix="custom-select"
                        placeholder={
                          loadingDoctors
                            ? t("employee_card.assign_modal.loading_doctors")
                            : t("employee_card.assign_modal.select_doctor")
                        }
                        isDisabled={loadingDoctors}
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: "48px",
                            borderColor: assignErrors.doctorEmail
                              ? "#ef4444"
                              : "#d1d5db",
                            "&:hover": {
                              borderColor: assignErrors.doctorEmail
                                ? "#ef4444"
                                : "#9ca3af",
                            },
                          }),
                        }}
                      />
                      {assignErrors.doctorEmail && (
                        <span className="form-error-message">
                          {assignErrors.doctorEmail}
                        </span>
                      )}
                    </div>

                    {/* Date and time pickers */}
                    <div className="form-datetime-grid">
                      <div className="form-field-group">
                        <label className="form-label">
                          {t("employee_card.assign_modal.start_date_time")}{" "}
                          <span className="form-required">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          name="startDateTime"
                          value={assignFormData.startDateTime}
                          onChange={handleAssignChange}
                          className={`form-datetime-input ${
                            assignErrors.startDateTime ? "form-input-error" : ""
                          }`}
                        />
                        {assignErrors.startDateTime && (
                          <span className="form-error-message">
                            {assignErrors.startDateTime}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <label className="form-label">
                          {t("employee_card.assign_modal.end_date_time")}{" "}
                          <span className="form-required">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          name="endDateTime"
                          value={assignFormData.endDateTime}
                          onChange={handleAssignChange}
                          className={`form-datetime-input ${
                            assignErrors.endDateTime ? "form-input-error" : ""
                          }`}
                        />
                        {assignErrors.endDateTime && (
                          <span className="form-error-message">
                            {assignErrors.endDateTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="assign-form-submit"
                      disabled={loadingDoctors}
                    >
                      {loadingDoctors
                        ? t("employee_card.assign_modal.assigning")
                        : t("employee_card.assign_modal.assign_doctor")}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default EmployeeCard;
