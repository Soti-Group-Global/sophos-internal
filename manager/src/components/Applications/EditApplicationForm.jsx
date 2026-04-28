import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom"; // Add useLocation
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  getPatients,
  getDoctors,
  getDoctorByEmail,
  getApplication,
  updateApplication,
  getApplications,
  addDocument,
  deleteDocument,
  getMedia,
  getUserIdByEmail,
} from "../../utils/api";

const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};
import { FaFilePdf, FaTimes, FaEye } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import "./AddApplicationForm.css";

function EditApplicationForm() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [formData, setFormData] = useState({
    patientEmail: "",
    serviceType: "In-face and remote consultations",
    doctorEmail: "",
    specialty: "",
    appointmentMode: "Online",
    appointmentStatus: "Pending payment",
    date: "",
    startTime: "",
    endTime: "",
    paymentStatus: "new",
    comments: "",
    previousComments: [],
    documents: [],
    serviceOrders: [
      {
        userId: "",
        serviceName: "",
        entranceDiagnosis: "",
        briefHistory: "",
        promoCode: "",
      },
    ],
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showDocumentPopup, setShowDocumentPopup] = useState(false);
  const [documentInput, setDocumentInput] = useState({
    type: "file",
    file: null,
    url: "",
    filename: "",
  });
  const [currentUser, setCurrentUser] = useState({
    email: localStorage.getItem("userEmail") || "",
    role: localStorage.getItem("userRole") || "manager",
  });
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [selectedEndTime, setSelectedEndTime] = useState(null);

  useEffect(() => {
    if (formData.startTime) {
      setSelectedDateTime(utcToPickerDate_MSK(formData.startTime));
    } else {
      setSelectedDateTime(null);
    }

    if (formData.endTime) {
      setSelectedEndTime(utcToPickerDate_MSK(formData.endTime));
    } else {
      setSelectedEndTime(null);
    }
  }, [formData.startTime, formData.endTime]);

  useEffect(() => {
    fetchApplication();
    fetchPatients();
    fetchDoctors();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const container = document.querySelector(".patient-select-container");
      if (container && !container.contains(e.target)) {
        setPatientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const MSK_OFFSET_HOURS = 3;

  const utcToPickerDate_MSK = (utcString) => {
    if (!utcString) return null;

    const utc = new Date(utcString);

    // Read the Moscow calendar fields
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(utc).map((p) => [p.type, p.value])
    );

    // Build a *local* Date with the same digits (so the picker shows those digits)
    return new Date(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      0,
      0
    );
  };


  const pickerDate_MSK_toUTCISO = (pickerDate) => {
    if (!pickerDate) return "";
    const y = pickerDate.getFullYear();
    const m = pickerDate.getMonth();
    const d = pickerDate.getDate();
    const hh = pickerDate.getHours();
    const mm = pickerDate.getMinutes();

    // Re-interpret hh:mm as Moscow time and convert to UTC
    return new Date(
      Date.UTC(y, m, d, hh - MSK_OFFSET_HOURS, mm, 0, 0)
    ).toISOString();
  };

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const response = await getApplication(id);
      const app = response.data;
      const userIdResponse = await getUserIdByEmail(app.patientEmail);
      setFormData({
        patientEmail: app.patientEmail || "",
        serviceType: app.serviceType || "In-face and remote consultations",
        doctorEmail: app.doctorEmail || "",
        specialty: app.specialty || "",
        appointmentMode: app.appointmentMode || "Online",
        appointmentStatus: app.appointmentStatus || "Pending payment",
        date: app.date || "",
        startTime: app.startTime || "",
        endTime: app.endTime || "",
        paymentStatus:
          app.payments?.length > 0 ? app.payments[0].status : "new",
        comments: "",
        previousComments: app.comments || [],
        documents: app.documents || [],
        serviceOrders:
          app.serviceOrders?.length > 0
            ? [
              {
                userId: userIdResponse.data.userId || "",
                serviceName:
                  app.serviceOrders[0].serviceName || app.serviceType,
                entranceDiagnosis:
                  app.serviceOrders[0].entranceDiagnosis || "",
                briefHistory: app.serviceOrders[0].briefHistory || "",
                promoCode: app.serviceOrders[0].promoCode || "",
              },
            ]
            : [
              {
                userId: userIdResponse.data.userId || "",
                serviceName: app.serviceType || "",
                entranceDiagnosis: "",
                briefHistory: "",
                promoCode: "",
              },
            ],
      });
    } catch (error) {
      const message =
        error.response?.data?.message || t("edit_application.error_fetch");
      setFetchError(message);
      toast.error(message);
      if (error.response?.status === 404) {
        navigate("/applications", { state: location.state }); // Pass state
      } else if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await getPatients();
      const patientsData = Array.isArray(response) ? response : [];
      setPatients(patientsData);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.error_fetch_patients")
      );
      setPatients([]);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await getDoctors();
      const doctorsData = Array.isArray(response.doctors)
        ? response.doctors
        : [];
      setDoctors(doctorsData);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.error_fetch_doctors")
      );
      setDoctors([]);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    }
  };

  const fetchDoctorSpecialty = async (doctorEmail) => {
    if (!doctorEmail) return;
    try {
      const response = await getDoctorByEmail(doctorEmail);
      setFormData((prev) => ({
        ...prev,
        specialty:
          response.data.doctor?.specialty || response.data.specialty || "",
      }));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.error_fetch_specialty")
      );
    }
  };

  const fetchUserId = async (email) => {
    if (!email) return;
    try {
      const response = await getUserIdByEmail(email);
      setFormData((prev) => ({
        ...prev,
        serviceOrders: [
          {
            ...prev.serviceOrders[0],
            userId: response.data.userId || "",
            serviceName: prev.serviceType,
          },
        ],
      }));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.error_fetch_user_id")
      );
      setErrors((prev) => ({
        ...prev,
        "serviceOrders.userId": t("edit_application.error_fetch_user_id"),
      }));
    }
  };

  const filteredPatients = patients.filter((p) => {
    const term = patientSearch.toLowerCase();
    if (!term) return true;
    const name = `${p.firstName || ""} ${p.middleName || ""} ${p.lastName || ""}`
      .trim()
      .toLowerCase();
    return (
      name.includes(term) ||
      (p.email || "").toLowerCase().includes(term) ||
      (p.phone || "").toLowerCase().includes(term) ||
      (p.phoneNumber || "").toLowerCase().includes(term)
    );
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("serviceOrders.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        serviceOrders: [{ ...prev.serviceOrders[0], [field]: value }],
      }));
    } else if (name === "patientEmail") {
      setFormData((prev) => ({ ...prev, patientEmail: value }));
      fetchUserId(value);
    } else if (name === "serviceType") {
      setFormData((prev) => ({
        ...prev,
        serviceType: value,
        serviceOrders: [{ ...prev.serviceOrders[0], serviceName: value }],
        appointmentMode:
          value === "Individual early diagnosis of diseases"
            ? ""
            : prev.appointmentMode,
        specialty:
          value === "Individual early diagnosis of diseases"
            ? ""
            : prev.specialty,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (name === "doctorEmail") {
        fetchDoctorSpecialty(value);
      }
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.patientEmail)
      newErrors.patientEmail = t("edit_application.patient_required");
    if (!formData.serviceType)
      newErrors.serviceType = t("edit_application.service_type_required");
    if (!formData.doctorEmail)
      newErrors.doctorEmail = t("edit_application.doctor_required");
    if (
      formData.serviceType === "In-face and remote consultations" &&
      !formData.specialty
    ) {
      newErrors.specialty = t("edit_application.specialty_required");
    }
    if (
      formData.serviceType === "In-face and remote consultations" &&
      !formData.appointmentMode
    ) {
      newErrors.appointmentMode = t(
        "edit_application.appointment_mode_required"
      );
    }
    if (!formData.appointmentStatus)
      newErrors.appointmentStatus = t(
        "edit_application.appointment_status_required"
      );
    if (!formData.startTime)
      newErrors.startTime = t("edit_application.start_time_required");
    if (!formData.endTime)
      newErrors.endTime = t("edit_application.end_time_required");
    if (!formData.serviceOrders[0].userId)
      newErrors["serviceOrders.userId"] = t(
        "edit_application.user_id_required"
      );
    if (!formData.serviceOrders[0].serviceName)
      newErrors["serviceOrders.serviceName"] = t(
        "edit_application.service_name_required"
      );
    if (!formData.paymentStatus)
      newErrors.paymentStatus = t("edit_application.payment_status_required");

    if (formData.startTime) {
      const start = new Date(formData.startTime).getTime();
      const now = Date.now();
      if (start <= now) {
        newErrors.startTime = t("edit_application.date_past");
      }
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (end <= start) {
        newErrors.endTime = t("edit_application.end_time_after_start");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDocumentSubmit = async () => {
    if (documentInput.type === "file" && !documentInput.file) {
      toast.error(t("edit_application.document_file_required"));
      return;
    }
    if (documentInput.type === "url" && !documentInput.url) {
      toast.error(t("edit_application.document_url_required"));
      return;
    }
    try {
      const response = await addDocument(id, documentInput);
      setFormData((prev) => ({
        ...prev,
        documents: response.data.documents || [],
      }));
      setShowDocumentPopup(false);
      setDocumentInput({ type: "file", file: null, url: "", filename: "" });
      toast.success(t("edit_application.document_added"));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.document_add_failed")
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    }
  };

  const handleDeleteDocument = async (filename) => {
    if (!window.confirm(t("edit_application.confirm_delete_document"))) return;
    try {
      const response = await deleteDocument(id, filename);
      setFormData((prev) => ({
        ...prev,
        documents: response.data.documents || [],
      }));
      toast.success(t("edit_application.document_deleted"));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.document_delete_failed")
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    }
  };

  const previewDocument = async (doc) => {
    if (doc.url) {
      window.open(doc.url, "_blank");
      return;
    }
    try {
      const fileId = doc.fileId?._id
        ? doc.fileId._id.toString()
        : doc.fileId.toString();
      const response = await getMedia(fileId);
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.document_preview_failed")
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    }
  };

  const checkAppointmentConflict = async () => {
    const { doctorEmail, date, startTime, endTime, applicationId } = formData;
    if (!doctorEmail || !date || !startTime || !endTime) return false;

    try {
      const response = await getApplications({ doctorEmail, date });
      const existingApps = response.data.applications || [];

      const newStartUTC = new Date(startTime);
      const newEndUTC = new Date(endTime);

      return existingApps.some((app) => {
        // Skip current one by applicationId
        if (app.applicationId?.toString() === id?.toString()) {
          return false;
        }

        const appStartUTC = new Date(app.startTime);
        const appEndUTC = new Date(app.endTime);

        const conflict = newStartUTC < appEndUTC && newEndUTC > appStartUTC;

        return conflict;
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("edit_application.conflict_check_failed")
      );

      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t("edit_application.form_errors"));
      return;
    }

    const hasConflict = await checkAppointmentConflict();
    if (hasConflict) {
      toast.error(t("edit_application.conflict"));
      return;
    }

    const newComment = formData.comments
      ? [
        {
          text: formData.comments.trim(),
          email: currentUser.email,
          role: currentUser.role,
          createdAt: new Date(),
        },
      ]
      : [];

    const payload = {
      patientEmail: formData.patientEmail,
      doctorEmail: formData.doctorEmail,
      serviceType: formData.serviceType,
      specialty: formData.specialty,
      appointmentMode: formData.appointmentMode,
      appointmentStatus: formData.appointmentStatus,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      payments:
        formData.paymentStatus !== "free"
          ? [
            {
              status: formData.paymentStatus,
              paymentMethod: "yookassa",
            },
          ]
          : [],
      comments: newComment,
      serviceOrders: [formData.serviceOrders[0]],
      pathologica: null,
      expertReview: null,
      documents: formData.documents,
    };

    try {
      const response = await updateApplication(id, payload);

      setFormData((prev) => ({
        ...prev,
        comments: "",
        previousComments: response.data.comments || prev.previousComments,
      }));
      toast.success(t("edit_application.success"));
      navigate("/applications", { state: location.state }); // Pass state back
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("edit_application.failed")
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        setCurrentUser({ email: "", role: "manager" });
        navigate("/");
      }
    }
  };

  const handleCancel = () => {
    navigate("/applications", { state: location.state }); // Pass state back
  };

  const handleDateChange = (date) => {
    if (!date) {
      setSelectedDateTime(null);
      setSelectedEndTime(null);
      setFormData((prev) => ({ ...prev, startTime: "", endTime: "" }));
      return;
    }

    // keep picker UI (MSK digits)
    setSelectedDateTime(date);

    // default end = +1h (still in picker/local space)
    const endLocal = new Date(date);
    endLocal.setHours(endLocal.getHours() + 1);
    setSelectedEndTime(endLocal);

    // persist to DB as UTC
    setFormData((prev) => ({
      ...prev,
      startTime: pickerDate_MSK_toUTCISO(date),
      endTime: pickerDate_MSK_toUTCISO(endLocal),
    }));
  };

  const handleEndTimeChange = (time) => {
    if (!time || !selectedDateTime) {
      setSelectedEndTime(null);
      setFormData((prev) => ({ ...prev, endTime: "" }));
      return;
    }

    // same date as start, but with user-selected HH:mm (MSK digits)
    const endLocal = new Date(selectedDateTime);
    endLocal.setHours(time.getHours(), time.getMinutes(), 0, 0);

    setSelectedEndTime(endLocal); // UI
    setFormData((prev) => ({
      ...prev,
      endTime: pickerDate_MSK_toUTCISO(endLocal), // DB (UTC)
    }));
  };

  if (fetchError) {
    return (
      <div className="app-form-container">
        <div className="app-form-card">
          <div className="app-form-section">
            <h2 className="app-form-title">{t("edit_application.error")}</h2>
            <p>{fetchError}</p>
            <button
              className="app-form-submit-btn"
              onClick={() =>
                navigate("/applications", { state: location.state })
              }
            >
              {t("edit_application.back_to_applications")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-form-container">
        <div className="app-form-card">
          <div className="app-form-section">
            <h2 className="app-form-title">{t("edit_application.loading")}</h2>
          </div>
        </div>
      </div>
    );
  }

  const selectedPatientLabel = (() => {
    const match = patients.find((p) => p.email === formData.patientEmail);
    if (!match) return formData.patientEmail;
    return `${match.firstName || ""} ${match.middleName || ""} ${match.lastName || ""
      }`.trim() || match.email;
  })();

  return (
    <div className="app-form-container">
      <div className="app-form-card">
        <button
          className="app-form-cancel-btn"
          onClick={handleCancel}
          title={t("edit_application.cancel")}
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
        <div className="app-form-section">
          <h2 className="app-form-title">{t("edit_application.title")}</h2>
          <form onSubmit={handleSubmit} className="app-form">
            <div className="app-form-row">
              <div className="app-form-field">
                <label>
                  {t("edit_application.patient")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <div
                  className={`patient-select-container ${errors.patientEmail ? "error" : ""
                    }`}
                >
                  <div
                    className="patient-select-input"
                    onClick={() => setPatientDropdownOpen((o) => !o)}
                  >
                    <input
                      type="text"
                      value={patientSearch || selectedPatientLabel || ""}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setPatientDropdownOpen(true);
                      }}
                      placeholder={
                        t("edit_application.search_patient") ||
                        t("add_application.search_patient") ||
                        "Search patient by name, email, phone"
                      }
                    />
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`chevron ${patientDropdownOpen ? "open" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  {patientDropdownOpen && (
                    <div className="patient-options">
                      {Array.isArray(filteredPatients) &&
                        filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => {
                          const label = `${patient.firstName || ""} ${patient.middleName || ""
                            } ${patient.lastName || ""}`.trim();
                          return (
                            <div
                              key={patient.email}
                              className="patient-option"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  patientEmail: patient.email,
                                }));
                                setPatientSearch(label);
                                fetchUserId(patient.email);
                                setPatientDropdownOpen(false);
                              }}
                            >
                              <div className="patient-name">
                                {label || patient.email}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="patient-option empty">
                          {t("edit_application.no_patients") ||
                            t("add_application.no_patients") ||
                            "No matching patients"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {errors.patientEmail && (
                  <span className="app-form-field-error">
                    {errors.patientEmail}
                  </span>
                )}
                {errors["serviceOrders.userId"] && (
                  <span className="app-form-field-error">
                    {errors["serviceOrders.userId"]}
                  </span>
                )}
              </div>
              <div className="app-form-field">
                <label>
                  {t("edit_application.service_type")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <select
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleChange}
                  className={errors.serviceType ? "error" : ""}
                >
                  <option value="In-face and remote consultations">
                    {t("edit_application.service_consultations")}
                  </option>
                  <option value="Individual early diagnosis of diseases">
                    {t("edit_application.service_diagnosis")}
                  </option>
                </select>
                {errors.serviceType && (
                  <span className="app-form-field-error">
                    {errors.serviceType}
                  </span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field">
                <label>
                  {t("edit_application.doctor")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <select
                  name="doctorEmail"
                  value={formData.doctorEmail}
                  onChange={handleChange}
                  className={errors.doctorEmail ? "error" : ""}
                >
                  <option value="">
                    {t("edit_application.select_doctor")}
                  </option>
                  {Array.isArray(doctors) && doctors.length > 0 ? (
                    doctors.map((doctor) => (
                      <option key={doctor.email} value={doctor.email}>
                        {`${getFieldValue(doctor.firstName, i18n.language) || ""} ${getFieldValue(doctor.middleName, i18n.language) || ""
                          } ${getFieldValue(doctor.lastName, i18n.language) || ""}`.trim()}
                      </option>
                    ))
                  ) : (
                    <option disabled>{t("edit_application.no_doctors")}</option>
                  )}
                </select>
                {errors.doctorEmail && (
                  <span className="app-form-field-error">
                    {errors.doctorEmail}
                  </span>
                )}
              </div>
              <div className="app-form-field">
                <label>
                  {formData.serviceType === "In-face and remote consultations"
                    ? t("edit_application.specialty")
                    : t("edit_application.specialty_optional")}{" "}
                  <span className="app-form-required-asterisk">
                    {formData.serviceType === "In-face and remote consultations"
                      ? "*"
                      : ""}
                  </span>
                </label>
                <input
                  type="text"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  placeholder={t("edit_application.specialty_placeholder")}
                  className={errors.specialty ? "error" : ""}
                  disabled={
                    formData.serviceType ===
                    "Individual early diagnosis of diseases"
                  }
                />
                {errors.specialty && (
                  <span className="app-form-field-error">
                    {errors.specialty}
                  </span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field">
                <label>
                  {formData.serviceType === "In-face and remote consultations"
                    ? t("edit_application.appointment_mode")
                    : t("edit_application.appointment_mode_optional")}{" "}
                  <span className="app-form-required-asterisk">
                    {formData.serviceType === "In-face and remote consultations"
                      ? "*"
                      : ""}
                  </span>
                </label>
                <select
                  name="appointmentMode"
                  value={formData.appointmentMode}
                  onChange={handleChange}
                  className={errors.appointmentMode ? "error" : ""}
                  disabled={
                    formData.serviceType ===
                    "Individual early diagnosis of diseases"
                  }
                >
                  <option value="">{t("edit_application.select_mode")}</option>
                  <option value="Online">
                    {t("edit_application.mode_online")}
                  </option>
                  <option value="Offline">
                    {t("edit_application.mode_offline")}
                  </option>
                </select>
                {errors.appointmentMode && (
                  <span className="app-form-field-error">
                    {errors.appointmentMode}
                  </span>
                )}
              </div>
              <div className="app-form-field">
                <label>
                  {t("edit_application.appointment_status")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <select
                  name="appointmentStatus"
                  value={formData.appointmentStatus}
                  onChange={handleChange}
                  className={errors.appointmentStatus ? "error" : ""}
                >
                  <option value="Cancelled">
                    {t("edit_application.status_cancelled")}
                  </option>
                  <option value="Unconfirmed">
                    {t("edit_application.status_unconfirmed")}
                  </option>
                  <option value="Confirmed">
                    {t("edit_application.status_confirmed")}
                  </option>
                </select>
                {errors.appointmentStatus && (
                  <span className="app-form-field-error">
                    {errors.appointmentStatus}
                  </span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field">
                <label>
                  {t("edit_application.date_and_start_time")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <DatePicker
                  selected={selectedDateTime}
                  onChange={handleDateChange}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={30}
                  dateFormat="yyyy-MM-dd HH:mm"
                  placeholderText="Select date & time (MSK)"
                />
                {(errors.date || errors.startTime) && (
                  <span className="app-form-field-error">
                    {errors.date || errors.startTime}
                  </span>
                )}
              </div>
              <div className="app-form-field">
                <label>
                  {t("edit_application.end_time")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <DatePicker
                  selected={selectedEndTime}
                  onChange={handleEndTimeChange}
                  showTimeSelect
                  showTimeSelectOnly
                  timeFormat="HH:mm"
                  timeIntervals={30}
                  dateFormat="HH:mm"
                  placeholderText="Select end time (MSK)"
                />
                {errors.endTime && (
                  <span className="app-form-field-error">{errors.endTime}</span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>
                  {t("edit_application.entrance_diagnosis")}
                </label>
                <textarea
                  name="serviceOrders.entranceDiagnosis"
                  value={formData.serviceOrders[0].entranceDiagnosis}
                  onChange={handleChange}
                  placeholder={t(
                    "edit_application.entrance_diagnosis_placeholder"
                  )}
                  className={
                    errors["serviceOrders.entranceDiagnosis"] ? "error" : ""
                  }
                />
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>
                  {t("edit_application.brief_history")}
                </label>
                <textarea
                  name="serviceOrders.briefHistory"
                  value={formData.serviceOrders[0].briefHistory}
                  onChange={handleChange}
                  placeholder={t("edit_application.brief_history_placeholder")}
                  className={
                    errors["serviceOrders.briefHistory"] ? "error" : ""
                  }
                />
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>{t("edit_application.promo_code")}</label>
                <input
                  type="text"
                  name="serviceOrders.promoCode"
                  value={formData.serviceOrders[0].promoCode}
                  onChange={handleChange}
                  placeholder={t("edit_application.promo_code_placeholder")}
                />
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>{t("edit_application.comments")}</label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  placeholder={t("edit_application.comments_placeholder")}
                  className="app-form-textarea"
                />
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>{t("edit_application.previous_comments")}</label>
                <div className="app-form-comments-bubbles">
                  {formData.previousComments.length === 0 ? (
                    <span className="app-form-no-comments">
                      {t("edit_application.no_comments")}
                    </span>
                  ) : (
                    formData.previousComments.map((comment, index) => (
                      <div
                        key={comment._id || index}
                        className="app-form-comment-bubble"
                      >
                        <span>{comment.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label className="app-form-label">
                  {t("edit_application.documents")}
                </label>
                <div className="app-form-document-bubbles">
                  {formData.documents.length === 0 ? (
                    <span className="app-form-no-comments">
                      {t("edit_application.no_documents")}
                    </span>
                  ) : (
                    formData.documents.map((doc) => (
                      <div key={doc._id} className="app-form-document-item">
                        <div className="document-name-card document-name">
                          <FaFilePdf
                            className="app-form-document-icon"
                            onClick={() => previewDocument(doc)}
                          />
                          <span className="app-form-document-name">
                            {doc.filename ||
                              t("edit_application.unnamed_document")}
                          </span>
                        </div>
                        <div className="docment-button-actions">
                          <span
                            className="app-form-document-action"
                            onClick={() => previewDocument(doc)}
                          ><FaEye />
                            {doc.url
                              ? t("edit_application.link")
                              : t("edit_application.view")}
                          </span>
                          <span className="app-form-document-dlt-btn"
                            onClick={() => handleDeleteDocument(doc.filename)}>
                            <MdDelete />Delete
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="app-form-add-doc-btn"
                  onClick={() => setShowDocumentPopup(true)}
                >
                  {t("edit_application.add_document")}
                </button>
              </div>
            </div>
            <div className="app-form-actions">
              <button type="submit" className="app-form-submit-btn primary-button">
                {t("edit_application.save_changes")}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showDocumentPopup && (
        <div className={`popup-overlay ${showDocumentPopup ? "visible" : ""}`}>
          <div className="popup-content">
            <div className="popup-header">
              <h2>{t("edit_application.add_document")}</h2>
              <button
                type="button"
                onClick={() => setShowDocumentPopup(false)}
                className="popup-close"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <div className="popup-body">
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="file"
                    checked={documentInput.type === "file"}
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        type: "file",
                        url: "",
                        filename: "",
                      })
                    }
                    className="radio-input"
                  />
                  <span>{t("edit_application.upload_file")}</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="url"
                    checked={documentInput.type === "url"}
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        type: "url",
                        file: null,
                      })
                    }
                    className="radio-input"
                  />
                  <span>{t("edit_application.cloud_link")}</span>
                </label>
              </div>
              {documentInput.type === "file" ? (
                <div className="file-input-wrapper">
                  <label htmlFor="file-upload" className="file-input-label">
                    {t("edit_application.choose_file")}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        file: e.target.files[0],
                      })
                    }
                    className="document-file-input"
                  />
                </div>
              ) : (
                <div className="input-group">
                  <input
                    type="text"
                    value={documentInput.url}
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        url: e.target.value,
                      })
                    }
                    placeholder={t("edit_application.document_url_placeholder")}
                    className="text-input"
                  />
                  <input
                    type="text"
                    value={documentInput.filename}
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        filename: e.target.value,
                      })
                    }
                    placeholder={t(
                      "edit_application.document_name_placeholder"
                    )}
                    className="text-input"
                  />
                </div>
              )}
              <button
                type="button"
                className="submit-button primary-button"
                onClick={handleDocumentSubmit}
              >
                {t("edit_application.upload")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditApplicationForm;
