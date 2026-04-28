import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaPlus, FaTrash, FaCopy, FaEnvelope, FaCheckCircle, FaWhatsapp } from "react-icons/fa";
import {
  getPatients,
  getDoctors,
  getDoctorByEmail,
  addApplication,
  getApplications,
  getUserIdByEmail,
  addPayment,
  sendEmail,
  sendWhatsAppMessage,
} from "../../utils/api";

const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};
import "./AddApplicationForm.css";

function AddApplicationForm() {
  const { t, i18n } = useTranslation();
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
    appointmentStatus: "Unconfirmed",
    date: "",
    startTime: "",
    endTime: "",
    paymentStatus: "new",
    comments: "",
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
  const [currentUser, setCurrentUser] = useState({
    email: localStorage.getItem("userEmail") || "",
    role: localStorage.getItem("userRole") || "manager",
  });

  // Payment creation states
  const [createPayment, setCreatePayment] = useState(false);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentItems, setPaymentItems] = useState([
    { id: Date.now(), name: "In-face and remote consultations", amount: "", currency: "RUB", quantity: 1 },
  ]);
  const [paymentGateway, setPaymentGateway] = useState("yookassa");
  const [paymentType, setPaymentType] = useState("card");

  // Success and loading states
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdApplication, setCreatedApplication] = useState(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  // Prefill date/time from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const startParam = params.get("start");
    const endParam = params.get("end");

    if (startParam && endParam) {
      const start = new Date(startParam);
      const end = new Date(endParam);

      if (!isNaN(start) && !isNaN(end)) {
        setFormData((prev) => ({
          ...prev,
          date: start.toISOString().split("T")[0],
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }));
      }
    }
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await getPatients();
      const patientsData = Array.isArray(response) ? response : [];
      setPatients(patientsData);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("add_application.error_fetch_patients")
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
      const doctorsData = Array.isArray(response.data)
        ? response.data
        : [];
      setDoctors(doctorsData);
      if (doctorsData.length > 0) {
        const firstDoctor = doctorsData[0];
        const firstSpecialty = firstDoctor.specialtyIds?.[0]?.name_en || firstDoctor.specialtyIds?.[0]?.name_ru || "";
        setFormData((prev) => ({
          ...prev,
          doctorEmail: firstDoctor.email,
          specialty: firstSpecialty,
        }));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("add_application.error_fetch_doctors")
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
      const doctor = response.data.doctor || response.data;
      
      // Get first specialty if available
      const firstSpecialty = doctor.specialtyIds?.[0]?.name_en || doctor.specialtyIds?.[0]?.name_ru || "";
      
      setFormData((prev) => ({
        ...prev,
        specialty: firstSpecialty,
      }));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("add_application.error_fetch_specialty")
      );
    }
  };

  const fetchUserId = async (email) => {
    if (!email) return;
    try {
      const response = await getUserIdByEmail(email);
      setFormData((prev) => ({
        ...prev,
        patientEmail: email,
        serviceOrders: [
          {
            ...prev.serviceOrders[0],
            userId: response.data.userId || "",
            serviceName: prev.serviceType,
          },
        ],
      }));
      setErrors((prev) => ({ ...prev, "serviceOrders.userId": "" }));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("add_application.error_fetch_user_id")
      );
      setErrors((prev) => ({
        ...prev,
        "serviceOrders.userId": t("add_application.error_fetch_user_id"),
      }));
    }
  };

  const filteredPatients = patients.filter((p) => {
    const term = patientSearch.toLowerCase();
    if (!term) return true;
    const name = `${p.firstName || ""} ${p.middleName || ""} ${p.lastName || ""}`.trim().toLowerCase();
    return (
      name.includes(term) ||
      (p.email || "").toLowerCase().includes(term) ||
      (p.phone || "").toLowerCase().includes(term) ||
      (p.phoneNumber || "").toLowerCase().includes(term)
    );
  });

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
      // Update payment items with the new service type
      setPaymentItems((prevItems) =>
        prevItems.map((item, index) =>
          index === 0 ? { ...item, name: value } : item
        )
      );
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

  // Payment item management functions
  const handlePaymentItemChange = (id, field, value) => {
    setPaymentItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddPaymentItem = () => {
    setPaymentItems([
      ...paymentItems,
      { id: Date.now(), name: formData.serviceType, amount: "", currency: "RUB", quantity: 1 },
    ]);
  };

  const handleDeletePaymentItem = (id) => {
    if (paymentItems.length > 1) {
      setPaymentItems((prevItems) => prevItems.filter((item) => item.id !== id));
    }
  };

  const totalPaymentAmount = paymentItems.reduce(
    (sum, item) =>
      sum + (Number(item.amount) || 0) * (parseInt(item.quantity) || 1),
    0
  );

  const handleDateChange = (date) => {
    if (!date) {
      setFormData((prev) => ({
        ...prev,
        date: "",
        startTime: "",
        endTime: "",
      }));
      return;
    }
    const newEndTime = new Date(date.getTime() + 60 * 60 * 1000); // Add 1 hour
    const dateStr = date.toISOString().split("T")[0]; // e.g., "2025-07-04"
    const startTimeStr = date.toISOString(); // e.g., "2025-07-04T03:30:00.000Z"
    const endTimeStr = newEndTime.toISOString(); // e.g., "2025-07-04T04:30:00.000Z"
    setFormData((prev) => ({
      ...prev,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
    }));
    if (errors.date || errors.startTime || errors.endTime) {
      setErrors((prev) => ({ ...prev, date: "", startTime: "", endTime: "" }));
    }
  };

  const handleEndTimeChange = (time) => {
    if (!time || !formData.date) {
      setFormData((prev) => ({ ...prev, endTime: "" }));
      return;
    }
    const endTimeStr = new Date(
      `${formData.date}T${time.toTimeString().split(" ")[0]}Z`
    ).toISOString();
    setFormData((prev) => ({ ...prev, endTime: endTimeStr }));
    if (errors.endTime) {
      setErrors((prev) => ({ ...prev, endTime: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const now = new Date();

    if (!formData.patientEmail)
      newErrors.patientEmail = t("add_application.patient_required");
    if (!formData.serviceType)
      newErrors.serviceType = t("add_application.service_type_required");
    if (!formData.doctorEmail)
      newErrors.doctorEmail = t("add_application.doctor_required");
    if (
      formData.serviceType === "In-face and remote consultations" &&
      !formData.specialty
    ) {
      newErrors.specialty = t("add_application.specialty_required");
    }
    if (
      formData.serviceType === "In-face and remote consultations" &&
      !formData.appointmentMode
    ) {
      newErrors.appointmentMode = t(
        "add_application.appointment_mode_required"
      );
    }
    if (!formData.appointmentStatus)
      newErrors.appointmentStatus = t(
        "add_application.appointment_status_required"
      );
    if (!formData.date) newErrors.date = t("add_application.date_required");
    if (!formData.startTime)
      newErrors.startTime = t("add_application.start_time_required");
    if (!formData.endTime)
      newErrors.endTime = t("add_application.end_time_required");
    if (!formData.serviceOrders[0].userId)
      newErrors["serviceOrders.userId"] = t("add_application.user_id_required");
    if (!formData.serviceOrders[0].serviceName)
      newErrors["serviceOrders.serviceName"] = t(
        "add_application.service_name_required"
      );
    // entranceDiagnosis and briefHistory no longer required
    if (!formData.paymentStatus)
      newErrors.paymentStatus = t("add_application.payment_status_required");

    const selectedDate = new Date(formData.date);
    if (formData.date && selectedDate < now.setHours(0, 0, 0, 0)) {
      newErrors.date = t("add_application.date_past");
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (end <= start) {
        newErrors.endTime = t("add_application.end_time_after_start");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkAppointmentConflict = async () => {
    const { doctorEmail, date, startTime, endTime } = formData;
    if (!doctorEmail || !date || !startTime || !endTime) return false;

    try {
      const response = await getApplications({ doctorEmail, date });
      const existingApps = response.data.applications || [];
      return existingApps.some((app) => {
        const appStart = new Date(app.startTime);
        const appEnd = new Date(app.endTime);
        const newStart = new Date(startTime);
        const newEnd = new Date(endTime);
        return newStart < appEnd && newEnd > appStart;
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("add_application.conflict_check_failed")
      );
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t("add_application.form_errors"));
      return;
    }

    // Validate payment items if payment creation is enabled
    if (createPayment && !markAsPaid) {
      const hasInvalidItems = paymentItems.some(
        (item) => !item.name || !item.amount || !item.currency || !item.quantity
      );
      if (hasInvalidItems) {
        toast.error("Please fill in all payment item details");
        return;
      }
    }

    const hasConflict = await checkAppointmentConflict();
    if (hasConflict) {
      toast.error(t("add_application.time_conflict"));
      return;
    }

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
      payments: [],
      comments: formData.comments
        ? [
          {
            text: formData.comments.trim(),
            email: currentUser.email,
            role: currentUser.role,
            createdAt: new Date(),
          },
        ]
        : [],
      serviceOrders: [formData.serviceOrders[0]],
      pathologica: null,
      expertReview: null,
    };

    setLoading(true);
    try {
      const appResponse = await addApplication(payload);
      const createdApp = appResponse.data.application || appResponse.data;
      const applicationId = createdApp._id || createdApp.applicationId;

      let generatedPaymentLink = "";

      // Handle payment creation if enabled
      if (createPayment && applicationId) {
        if (markAsPaid) {
          // Create a paid payment record for cash payment
          const paidPaymentData = {
            paymentMethod: "cash",
            paymentType: "cash",
            amount: totalPaymentAmount,
            finalAmount: totalPaymentAmount,
            items: paymentItems.map((item) => ({
              name: item.name,
              amount: Number(item.amount),
              currency: item.currency,
              quantity: parseInt(item.quantity) || 1,
            })),
            status: "paid",
            paidAt: new Date().toISOString(),
            attendanceMode: formData.appointmentMode.toLowerCase(),
          };
          await addPayment(applicationId, paidPaymentData);
          toast.success(t("add_application.success") + " (Payment marked as paid)");
        } else {
          // Create payment link
          const paymentData = {
            paymentMethod: paymentGateway,
            paymentType,
            amount: totalPaymentAmount,
            finalAmount: totalPaymentAmount,
            items: paymentItems.map((item) => ({
              name: item.name,
              amount: Number(item.amount),
              currency: item.currency,
              quantity: parseInt(item.quantity) || 1,
            })),
            status: "pending",
            attendanceMode: formData.appointmentMode.toLowerCase(),
          };
          const paymentResponse = await addPayment(applicationId, paymentData);

          if (paymentResponse.paymentLink) {
            generatedPaymentLink = paymentResponse.paymentLink;
            toast.success(t("add_application.success") + " (Payment link created)");
          } else {
            toast.success(t("add_application.success") + " (Payment created)");
          }
        }
      } else {
        toast.success(t("add_application.success"));
      }

      // Set success state instead of navigating
      setCreatedApplication(createdApp);
      setPaymentLink(generatedPaymentLink);
      setShowSuccess(true);
    } catch (error) {
      toast.error(error.response?.data?.message || t("add_application.failed"));
      // Only logout if it's an authentication error from our application APIs
      // Not from external services like WhatsApp or email
      if (error.response?.status === 401 && error.config?.url?.includes('/applications')) {
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

  const handleCancel = () => {
    navigate("/applications");
  };

  const handleCopyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLink).then(() => {
      toast.success(t("add_application.payment_link_copied"));
    });
  };

  const buildRussianMessage = (link) => {
    return `Добрый день! 🏥

Ваш прием успешно забронирован в Health Direct.

💳 Для оплаты перейдите по ссылке:
${link}

📋 Детали приема:
• Дата: ${new Date(formData.date).toLocaleDateString("ru-RU")}
• Время: ${formData.startTime ? new Date(formData.startTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""}
• Услуга: ${formData.serviceType}
• Способ приема: ${formData.appointmentMode}

По всем вопросам обращайтесь по телефону или через WhatsApp.

С уважением,
Команда Health Direct`;
  };

  const handleSendPaymentEmail = async () => {
    if (!formData.patientEmail || !paymentLink || !createdApplication) {
      toast.error(t("add_application.email_or_link_missing"));
      return;
    }

    setIsSendingEmail(true);
    try {
      const message = buildRussianMessage(paymentLink);
      const applicationId = createdApplication._id || createdApplication.applicationId;
      await sendEmail(applicationId, {
        to: formData.patientEmail,
        subject: "Health Direct - Payment Link / Ссылка на оплату",
        body: message,
      });
      toast.success(t("add_application.payment_link_sent_email"));
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.detail || t("add_application.failed");
      toast.error(errorMsg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const extractPhoneNumber = (email) => {
    const patient = patients.find((p) => p.email === email);
    return patient?.phoneNumber || "";
  };

  const handleSendPaymentWhatsApp = async () => {
    const phoneNumber = extractPhoneNumber(formData.patientEmail);
    if (!phoneNumber || !paymentLink) {
      toast.error(t("add_application.phone_or_link_missing"));
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      const message = buildRussianMessage(paymentLink);
      await sendWhatsAppMessage(phoneNumber, message);
      toast.success(t("add_application.payment_link_sent_whatsapp"));
    } catch (error) {
      // Handle WhatsApp API errors gracefully without logging out
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || t("add_application.failed");
      toast.error(errorMsg);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const selectedDateTime =
    formData.date && formData.startTime ? new Date(formData.startTime) : null;

  return (
    <div className="app-form-container">
      <div className="app-form-card">
        <div className="app-form-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <button
              className="primary-button"
              onClick={handleCancel}
              title={t("add_application.back") || "Back"}
              style={{ padding: '8px 12px', minWidth: 'auto' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: '20px', height: '20px' }}
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <div style={{ flex: 1 }}>
              <h2 className="app-form-title" style={{ margin: 0 }}>{t("add_application.title")}</h2>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-secondary-text)' }}>
                {t("add_application.subtitle") || "Fill in the details below to create a new application"}
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="app-form">
            <div className="app-form-row">
              <div className="app-form-field">
                <label>
                  {t("add_application.patient")}{" "}
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
                      value={
                        patientSearch ||
                        formData.patientEmail ||
                        ""
                      }
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setPatientDropdownOpen(true);
                      }}
                      placeholder={
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
                              <div className="patient-name">{label || patient.email}</div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="patient-option empty">
                          {t("add_application.no_patients") ||
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
                  {t("add_application.service_type")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <select
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleChange}
                  className={errors.serviceType ? "error" : ""}
                >
                  <option value="In-face and remote consultations">
                    {t("add_application.service_consultations")}
                  </option>
                  <option value="Individual early diagnosis of diseases">
                    {t("add_application.service_diagnosis")}
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
                  {t("add_application.doctor")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <select
                  name="doctorEmail"
                  value={formData.doctorEmail}
                  onChange={handleChange}
                  className={errors.doctorEmail ? "error" : ""}
                >
                  <option value="">{t("add_application.select_doctor")}</option>
                  {Array.isArray(doctors) && doctors.length > 0 ? (
                    doctors.map((doctor) => (
                      <option key={doctor.email} value={doctor.email}>
                        {`${getFieldValue(doctor.firstName, i18n.language) || ""} ${getFieldValue(doctor.middleName, i18n.language) || ""
                          } ${getFieldValue(doctor.lastName, i18n.language) || ""}`.trim()}
                      </option>
                    ))
                  ) : (
                    <option disabled>{t("add_application.no_doctors")}</option>
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
                    ? t("add_application.specialty")
                    : t("add_application.specialty_optional")}{" "}
                  <span className="app-form-required-asterisk">
                    {formData.serviceType === "In-face and remote consultations"
                      ? "*"
                      : ""}
                  </span>
                </label>
                <select
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  className={errors.specialty ? "error" : ""}
                  disabled={
                    formData.serviceType ===
                    "Individual early diagnosis of diseases"
                  }
                >
                  <option value="">
                    {t("add_application.select_specialty")}
                  </option>
                  {formData.doctorEmail &&
                    doctors
                      .find((doc) => doc.email === formData.doctorEmail)
                      ?.specialtyIds?.map((specialty, index) => (
                        <option
                          key={specialty._id || index}
                          value={specialty.name_en || specialty.name_ru}
                        >
                          {getFieldValue(specialty.name_en || specialty.name_ru, i18n.language) || 
                           specialty[`name_${i18n.language}`] || 
                           specialty.name_en || 
                           specialty.name_ru}
                        </option>
                      ))}
                </select>
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
                    ? t("add_application.appointment_mode")
                    : t("add_application.appointment_mode_optional")}{" "}
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
                  <option value="">{t("add_application.select_mode")}</option>
                  <option value="Online">
                    {t("add_application.mode_online")}
                  </option>
                  <option value="Offline">
                    {t("add_application.mode_offline")}
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
                  {t("add_application.appointment_status")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <select
                  name="appointmentStatus"
                  value={formData.appointmentStatus}
                  onChange={handleChange}
                  className={errors.appointmentStatus ? "error" : ""}
                >
                  <option value="">{t("add_application.select_status")}</option>
                  <option value="Cancelled">
                    {t("applications.status_cancelled")}
                  </option>
                  <option value="Unconfirmed">
                    {t("applications.status_unconfirmed")}
                  </option>
                  <option value="Confirmed">
                    {t("applications.status_confirmed")}
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
                  {t("add_application.date_and_start_time")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <DatePicker
                  selected={selectedDateTime}
                  onChange={handleDateChange}
                  dateFormat="yyyy-MM-dd HH:mm"
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  minDate={new Date()}
                  className={errors.date || errors.startTime ? "error" : ""}
                  placeholderText={t("add_application.date_time_placeholder")}
                />
                {(errors.date || errors.startTime) && (
                  <span className="app-form-field-error">
                    {errors.date || errors.startTime}
                  </span>
                )}
              </div>
              <div className="app-form-field">
                <label>
                  {t("add_application.end_time")}{" "}
                  <span className="app-form-required-asterisk">*</span>
                </label>
                <DatePicker
                  selected={
                    formData.endTime ? new Date(formData.endTime) : null
                  }
                  onChange={handleEndTimeChange}
                  showTimeSelect
                  showTimeSelectOnly
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="HH:mm"
                  className={errors.endTime ? "error" : ""}
                  placeholderText={t("add_application.end_time_placeholder")}
                />
                {errors.endTime && (
                  <span className="app-form-field-error">{errors.endTime}</span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>
                  {t("add_application.entrance_diagnosis")}{" "}
                </label>
                <textarea
                  name="serviceOrders.entranceDiagnosis"
                  value={formData.serviceOrders[0].entranceDiagnosis}
                  onChange={handleChange}
                  placeholder={t(
                    "add_application.entrance_diagnosis_placeholder"
                  )}
                  className={
                    errors["serviceOrders.entranceDiagnosis"] ? "error" : ""
                  }
                />
                {errors["serviceOrders.entranceDiagnosis"] && (
                  <span className="app-form-field-error">
                    {errors["serviceOrders.entranceDiagnosis"]}
                  </span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>
                  {t("add_application.brief_history")}{" "}
                </label>
                <textarea
                  name="serviceOrders.briefHistory"
                  value={formData.serviceOrders[0].briefHistory}
                  onChange={handleChange}
                  placeholder={t("add_application.brief_history_placeholder")}
                  className={
                    errors["serviceOrders.briefHistory"] ? "error" : ""
                  }
                />
                {errors["serviceOrders.briefHistory"] && (
                  <span className="app-form-field-error">
                    {errors["serviceOrders.briefHistory"]}
                  </span>
                )}
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>{t("add_application.promo_code")}</label>
                <input
                  type="text"
                  name="serviceOrders.promoCode"
                  value={formData.serviceOrders[0].promoCode}
                  onChange={handleChange}
                  placeholder={t("add_application.promo_code_placeholder")}
                />
              </div>
            </div>
            <div className="app-form-row">
              <div className="app-form-field full-width">
                <label>{t("add_application.comments")}</label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  placeholder={t("add_application.comments_placeholder")}
                />
              </div>
            </div>

            {/* Payment Creation Section */}
            <div className="app-form-payment-section">
              <div className="payment-section-header">
                <label className="payment-checkbox-label">
                  <input
                    type="checkbox"
                    checked={createPayment}
                    onChange={(e) => {
                      setCreatePayment(e.target.checked);
                      if (!e.target.checked) {
                        setMarkAsPaid(false);
                      }
                    }}
                    className="payment-checkbox"
                  />
                  <span className="payment-checkbox-text">
                    {t("add_application.create_payment") || "Create Payment / Invoice"}
                  </span>
                </label>
              </div>

              {createPayment && (
                <div className="payment-creation-form">
                  <div className="payment-options-row">
                    <label className="payment-option-label">
                      <input
                        type="checkbox"
                        checked={markAsPaid}
                        onChange={(e) => setMarkAsPaid(e.target.checked)}
                        className="payment-checkbox"
                      />
                      <span className="payment-checkbox-text">
                        {t("add_application.mark_as_paid") || "Mark as Paid (Cash Payment)"}
                      </span>
                    </label>

                    {!markAsPaid && (
                      <>
                        <select
                          value={paymentGateway}
                          onChange={(e) => setPaymentGateway(e.target.value)}
                          className="payment-gateway-select"
                        >
                          <option value="yookassa">YooMoney</option>
                          <option value="bank">Bank Gateway</option>
                        </select>

                        {paymentGateway === "bank" && (
                          <select
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value)}
                            className="payment-type-select"
                          >
                            <option value="card">Card</option>
                            <option value="qr">QR / SBP</option>
                          </select>
                        )}
                      </>
                    )}
                  </div>

                  <div className="payment-items-section">
                    <h4 className="payment-items-title">{t("add_application.payment_items") || "Payment Items"}</h4>
                    <table className="payment-items-table">
                      <thead>
                        <tr>
                          <th>{t("add_application.service_name") || "Service Name"}</th>
                          <th>{t("add_application.quantity") || "Quantity"}</th>
                          <th>{t("add_application.amount") || "Amount"}</th>
                          <th>{t("add_application.currency") || "Currency"}</th>
                          <th>{t("add_application.actions") || "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handlePaymentItemChange(item.id, "name", e.target.value)
                                }
                                placeholder={t("add_application.service_name_placeholder") || "Service name"}
                                className="payment-item-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  handlePaymentItemChange(item.id, "quantity", e.target.value)
                                }
                                min="1"
                                className="payment-item-input payment-quantity-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={item.amount}
                                onChange={(e) =>
                                  handlePaymentItemChange(item.id, "amount", e.target.value)
                                }
                                placeholder={t("add_application.amount_placeholder") || "Amount"}
                                min="0"
                                step="0.01"
                                className="payment-item-input payment-amount-input"
                              />
                            </td>
                            <td>
                              <select
                                value={item.currency}
                                onChange={(e) =>
                                  handlePaymentItemChange(item.id, "currency", e.target.value)
                                }
                                className="payment-currency-select"
                              >
                                <option value="RUB">RUB</option>
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="payment-delete-btn primary-button"
                                onClick={() => handleDeletePaymentItem(item.id)}
                                disabled={paymentItems.length === 1}
                                title="Delete item"
                                style={{ padding: '5px 10px', minWidth: 'auto', borderRadius: '5px' }}
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleAddPaymentItem}
                      style={{ gap: '8px' }}
                    >
                      <FaPlus /> {t("add_application.add_item") || "Add Item"}
                    </button>
                  </div>

                  <div className="payment-total-section">
                    <div className="payment-total-row">
                      <span>{t("add_application.total_amount") || "Total Amount:"}:</span>
                      <span className="payment-total-amount">
                        {totalPaymentAmount.toFixed(2)} RUB
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="app-form-actions">
              <button
                type="submit"
                className="app-form-submit-btn primary-button"
                disabled={loading}
              >
                {loading ? t("add_application.creating") || "Creating..." : t("add_application.submit")}
              </button>
            </div>
          </form>

          {/* Success Component */}
          {showSuccess && createdApplication && (
            <div className="app-form-success-overlay">
              <div className="app-form-success-card">
                <div className="app-form-success-header">
                  <FaCheckCircle className="app-form-success-icon" />
                  <h2>{t("add_application.success_title") || "Application Created Successfully!"}</h2>
                </div>

                <div className="app-form-success-details">
                  <p><strong>{t("add_application.application_id") || "Application ID"}:</strong> {createdApplication._id || createdApplication.applicationId}</p>
                  <p><strong>{t("add_application.patient") || "Patient"}:</strong> {
                    patients.find(p => p.email === formData.patientEmail)?.fullName || 
                    patients.find(p => p.email === formData.patientEmail)?.name || 
                    formData.patientEmail
                  }</p>
                  <p><strong>{t("add_application.doctor") || "Doctor"}:</strong> {
                    (() => {
                      const doctor = doctors.find(d => d.email === formData.doctorEmail);
                      if (doctor) {
                        const firstName = getFieldValue(doctor.firstName, i18n.language);
                        const middleName = getFieldValue(doctor.middleName, i18n.language);
                        const lastName = getFieldValue(doctor.lastName, i18n.language);
                        return [firstName, middleName, lastName].filter(Boolean).join(' ') || formData.doctorEmail;
                      }
                      return formData.doctorEmail;
                    })()
                  }</p>
                  <p><strong>{t("add_application.service") || "Service"}:</strong> {formData.serviceType}</p>
                  <p><strong>{t("add_application.date") || "Date"}:</strong> {new Date(formData.date).toLocaleDateString()}</p>
                </div>

                {paymentLink && (
                  <div className="app-form-payment-link-section">
                    <h3>{t("add_application.payment_link") || "Payment Link"}</h3>
                    <div className="app-form-payment-link-display">
                      <input
                        type="text"
                        value={paymentLink}
                        readOnly
                        className="app-form-payment-link-input"
                      />
                      <button
                        onClick={handleCopyPaymentLink}
                        className="app-form-payment-link-btn primary-button"
                        title={t("add_application.copy") || "Copy"}
                        style={{ padding: '8px 12px', minWidth: 'auto', borderRadius: '5px' }}
                      >
                        <FaCopy />
                      </button>
                    </div>

                    <div className="app-form-payment-link-actions">
                      <button
                        onClick={handleSendPaymentEmail}
                        disabled={isSendingEmail}
                        className="primary-button"
                        style={{ gap: '8px' }}
                      >
                        <FaEnvelope />
                        {isSendingEmail ? (t("add_application.sending") || "Sending...") : (t("add_application.send_email") || "Send Email")}
                      </button>

                      <button
                        onClick={handleSendPaymentWhatsApp}
                        disabled={isSendingWhatsApp}
                        className="app-form-payment-action-btn app-form-whatsapp-btn primary-button"
                        style={{ gap: '8px' }}
                      >
                        <FaWhatsapp />
                        {isSendingWhatsApp ? (t("add_application.sending") || "Sending...") : (t("add_application.send_whatsapp") || "Send WhatsApp")}
                      </button>
                    </div>
                  </div>
                )}

                <div className="app-form-success-actions">
                  <button
                    onClick={() => {
                      setShowSuccess(false);
                      setCreatedApplication(null);
                      setPaymentLink("");
                      // Reset form
                      setFormData({
                        patientEmail: "",
                        doctorEmail: "",
                        serviceType: "",
                        specialty: "",
                        appointmentMode: "Online",
                        appointmentStatus: "Scheduled",
                        date: "",
                        startTime: "",
                        endTime: "",
                        comments: "",
                        serviceOrders: [{ pathologica: "", expertReview: "" }],
                      });
                      setCreatePayment(false);
                      setMarkAsPaid(false);
                      setPaymentItems([{ name: "", amount: "", currency: "RUB", quantity: 1 }]);
                    }}
                    className="app-form-success-btn app-form-create-another-btn primary-button"
                  >
                    {t("add_application.create_another") || "Create Another"}
                  </button>

                  <button
                    onClick={() => navigate("/applications")}
                    className="app-form-success-btn app-form-go-to-list-btn primary-button"
                  >
                    {t("add_application.go_to_applications") || "Go to Applications"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddApplicationForm;
