import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, X, Trash2 } from "lucide-react";
import CustomCalendar from "../CustomCalendar/CustomCalendar";
import CustomTimePicker from "../CustomTimePicker/CustomTimePicker";
import {
  getPatients,
  getDoctors,
  getDoctorByEmail,
  addApplication,
  addPayment,
  getApplications,
  getAllServices,
  getAllSpecialties,
  getPositionsBySpeciality,
} from "../../utils/api";
import "./CreateAppointmentModal.css";
import CreateNewPatientModal from "./CreateNewPatientModal";

const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};

const toTimeString = (val) => {
  if (!val) return '';
  // Already HH:mm format
  if (/^\d{2}:\d{2}$/.test(val)) return val;
  // ISO string or date string — parse and extract HH:mm
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toTimeString().slice(0, 5);
    }
  } catch {}
  return '';
};

function CreateAppointmentModal({ isOpen, onClose, doctorEmail, date, startTime, endTime, onSuccess }) {
  const { t, i18n } = useTranslation();

  const initialDoctorFetched = useRef(false);
  const patientDropdownRef = useRef(null);
  const doctorDropdownRef = useRef(null);
  
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [createPatientModalOpen, setCreatePatientModalOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedDoctors, setSelectedDoctors] = useState([{
    doctorEmail: doctorEmail || "",
    doctorName: "",
    doctorSpecialtyIds: [],
    specialization: "",
    specialtyId: "",
    serviceId: "",
    serviceName: "",
    doctorServices: [],
    specialtyServices: [],
    doctorDropdownOpen: false,
    doctorSearch: "",
    specialtyDropdownOpen: false,
    specialtySearch: "",
    serviceDropdownOpen: false,
    serviceSearch: "",
  }]);
  
  const [formData, setFormData] = useState({
    patientId: "",
    serviceType: "Physical consultation",
    appointmentStatus: "Unconfirmed",
    branch: "",
    date: date || "",
    startTime: toTimeString(startTime),
    endTime: toTimeString(endTime),
    paymentStatus: "new",
    comments: "",
    serviceOrders: [
      {
        email: "",
        serviceName: "",
        entranceDiagnosis: "",
        briefHistory: "",
        promoCode: "",
      },
    ],
  });
  
  const [createPayment, setCreatePayment] = useState(false);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("tbank");
  const [paymentItems, setPaymentItems] = useState([
    {
      serviceName: "",
      quantity: 1,
      amount: "",
      currency: "RUB",
    },
  ]);
  
  const [errors, setErrors] = useState({});
  const [currentUser] = useState({
    email: localStorage.getItem("userEmail") || "",
    role: localStorage.getItem("userRole") || "manager",
  });

  useEffect(() => {
    if (isOpen) {
      fetchPatients();
      fetchDoctors();
      getAllSpecialties()
        .then((data) => {
          const list = Array.isArray(data) ? data : (data?.specialties || data?.data || []);
          setSpecialties(list);
        })
        .catch(() => {});
      initialDoctorFetched.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (doctorEmail && isOpen && !initialDoctorFetched.current) {
      fetchInitialDoctor(doctorEmail);
      initialDoctorFetched.current = true;
    }
  }, [doctorEmail, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target)) {
        setPatientDropdownOpen(false);
      }
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(e.target)) {
        setSelectedDoctors(prev => prev.map(d => ({ ...d, doctorDropdownOpen: false, specialtyDropdownOpen: false, serviceDropdownOpen: false })));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialDoctor = async (email) => {
    try {
      const doctorData = await getDoctorByEmail(email);
      if (doctorData) {
        const fullName = `${getFieldValue(doctorData.firstName, i18n.language) || ""} ${getFieldValue(doctorData.middleName, i18n.language) || ""} ${getFieldValue(doctorData.lastName, i18n.language) || ""}`.trim();
        setSelectedDoctors(prev => {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            doctorEmail: email,
            doctorName: fullName,
          };
          return updated;
        });
      }
      await fetchDoctorServices(email, 0);
    } catch (error) {
    }
  };

  useEffect(() => {
    if (date && startTime && endTime) {
      setFormData(prev => ({
        ...prev,
        date,
        startTime: toTimeString(startTime),
        endTime: toTimeString(endTime),
      }));
    }
  }, [date, startTime, endTime]);

  useEffect(() => {
    if (createPayment) {
      updatePaymentItemsFromDoctors();
    }
  }, [createPayment, selectedDoctors]);

  const fetchPatients = async () => {
    try {
      const data = await getPatients();
      setPatients(Array.isArray(data) ? data : (data?.patients || []));
    } catch (error) {
      toast.error(t("add_application.error_patients"));
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await getDoctors();
      setDoctors(response.data || []);
    } catch (error) {
      toast.error(t("add_application.error_doctors"));
    }
  };

  const fetchDoctorServices = async (email, index) => {
    try {
      const response = await getAllServices();
      const allServices = Array.isArray(response) ? response : (response.services || []);
      const doctorServices = allServices.filter(service => 
        service.doctorEmails && service.doctorEmails.includes(email)
      );
      
      setSelectedDoctors(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          doctorServices,
        };
        return updated;
      });
    } catch (error) {
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("serviceOrders.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        serviceOrders: [
          {
            ...prev.serviceOrders[0],
            [field]: value,
          },
        ],
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePatientSelect = async (patient) => {
    const fullName = `${patient.firstName || ""} ${patient.middleName || ""} ${patient.lastName || ""}`.trim();
    setFormData((prev) => ({
      ...prev,
      patientId: patient.patientId || "",
    }));
    setPatientSearch(fullName || patient.patientId || "");
    setPatientDropdownOpen(false);

    if (errors.patientId) {
      setErrors((prev) => ({ ...prev, patientId: "" }));
    }
  };

  const filteredPatients = Array.isArray(patients) ? patients.filter((patient) => {
    const firstName = patient.firstName || "";
    const middleName = patient.middleName || "";
    const lastName = patient.lastName || "";
    const fullName = `${firstName} ${middleName} ${lastName}`.trim();
    const email = patient.email || "";
    const search = (patientSearch || "").toLowerCase();
    return (
      fullName.toLowerCase().includes(search) ||
      email.toLowerCase().includes(search)
    );
  }) : [];

  const handleAddDoctor = () => {
    setSelectedDoctors(prev => [...prev, {
      doctorEmail: "",
      doctorName: "",
      doctorSpecialtyIds: [],
      specialization: "",
      specialtyId: "",
      serviceId: "",
      serviceName: "",
      doctorServices: [],
      specialtyServices: [],
      doctorDropdownOpen: false,
      doctorSearch: "",
      specialtyDropdownOpen: false,
      specialtySearch: "",
      serviceDropdownOpen: false,
      serviceSearch: "",
    }]);
  };

  const handleRemoveDoctor = (index) => {
    setSelectedDoctors(prev => prev.filter((_, i) => i !== index));
  };

  const handleDoctorSelect = async (doctor, index) => {
    const fullName = `${getFieldValue(doctor.firstName, i18n.language) || ""} ${getFieldValue(doctor.middleName, i18n.language) || ""} ${getFieldValue(doctor.lastName, i18n.language) || ""}`.trim();
    const doctorSpecialtyIds = (doctor.specialtyIds || []).map(s =>
      typeof s === "object" ? String(s._id) : String(s)
    );

  
    setSelectedDoctors(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        doctorEmail: doctor.email,
        doctorName: fullName,
        doctorSpecialtyIds,
        specialization: "",
        specialtyId: "",
        serviceId: "",
        serviceName: "",
        specialtyServices: [],
        doctorDropdownOpen: false,
        doctorSearch: "",
        serviceDropdownOpen: false,
        serviceSearch: "",
      };
      return updated;
    });

    await fetchDoctorServices(doctor.email, index);
  };

  const handleSpecialtySelect = async (specialty, index) => {
    const name = i18n.language.startsWith("ru") ? specialty.name_ru : specialty.name_en;
    setSelectedDoctors(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        specialization: name,
        specialtyId: specialty._id,
        serviceId: "",
        serviceName: "",
        specialtyServices: [],
        specialtyDropdownOpen: false,
        specialtySearch: "",
        serviceDropdownOpen: false,
        serviceSearch: "",
      };
      return updated;
    });
    try {
      const positions = await getPositionsBySpeciality(specialty._id);
      setSelectedDoctors(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], specialtyServices: positions };
        return updated;
      });
    } catch { /* ignore */ }
  };

  const handleServiceSelect = (service, index) => {
    const serviceName = getFieldValue(service.name, i18n.language);
    
    setSelectedDoctors(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        serviceId: service._id,
        serviceName,
      };
      return updated;
    });

    // Update payment items with selected services
    if (createPayment) {
      updatePaymentItemsFromDoctors();
    }
  };

  const updatePaymentItemsFromDoctors = () => {
    const services = selectedDoctors
      .filter(d => d.serviceName)
      .map(d => ({
        serviceName: d.serviceName,
        quantity: 1,
        amount: "",
        currency: "RUB",
      }));
    
    if (services.length > 0) {
      setPaymentItems(services);
    }
  };

  const toggleDoctorDropdown = (index) => {
    setSelectedDoctors(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        doctorDropdownOpen: !updated[index].doctorDropdownOpen,
        doctorSearch: updated[index].doctorDropdownOpen ? updated[index].doctorSearch : "",
      };
      return updated;
    });
  };

  const updateDoctorSearch = (search, index) => {
    setSelectedDoctors(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        doctorSearch: search,
      };
      return updated;
    });
  };

  const getFilteredDoctorsForIndex = (index) => {
    const search = selectedDoctors[index]?.doctorSearch?.toLowerCase() || "";
    return Array.isArray(doctors) ? doctors.filter((doctor) => {
      const firstName = getFieldValue(doctor.firstName, i18n.language) || "";
      const middleName = getFieldValue(doctor.middleName, i18n.language) || "";
      const lastName = getFieldValue(doctor.lastName, i18n.language) || "";
      const fullName = `${firstName} ${middleName} ${lastName}`.trim();
      const email = doctor.email || "";
      return (
        fullName.toLowerCase().includes(search) ||
        email.toLowerCase().includes(search)
      );
    }) : [];
  };

  const handlePaymentItemChange = (index, field, value) => {
    setPaymentItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddPaymentItem = () => {
    setPaymentItems(prev => [
      ...prev,
      {
        serviceName: "",
        quantity: 1,
        amount: "",
        currency: "RUB",
      },
    ]);
  };

  const handleRemovePaymentItem = (index) => {
    if (paymentItems.length > 1) {
      setPaymentItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const calculateTotalAmount = () => {
    return paymentItems.reduce((total, item) => {
      const amount = parseFloat(item.amount) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return total + (amount * quantity);
    }, 0).toFixed(2);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.patientId) newErrors.patientId = t("add_application.patient_required");
    if (selectedDoctors.length === 0 || !selectedDoctors[0].doctorEmail) {
      newErrors.doctors = t("add_application.doctor_required");
    }
    if (!formData.serviceType) newErrors.serviceType = t("add_application.service_type_required");
    if (!formData.appointmentStatus) newErrors.appointmentStatus = t("add_application.appointment_status_required");
    if (!formData.date) newErrors.date = t("add_application.date_required");
    if (!formData.startTime) newErrors.startTime = t("add_application.start_time_required");
    if (!formData.endTime) newErrors.endTime = t("add_application.end_time_required");

    if (formData.startTime && formData.endTime) {
      if (formData.endTime <= formData.startTime) {
        newErrors.endTime = t("add_application.end_time_after_start");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkAppointmentConflict = async () => {
    const doctorEmail = selectedDoctors[0]?.doctorEmail;
    const { date, startTime, endTime } = formData;
    if (!doctorEmail || !date || !startTime || !endTime) return false;

    try {
      const response = await getApplications({ doctorEmail, date });
      const appointments = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);

      const newStart = new Date(`${date}T${startTime}:00`);
      const newEnd = new Date(`${date}T${endTime}:00`);

      for (const app of appointments) {
        const appStart = new Date(app.startTime);
        const appEnd = new Date(app.endTime);

        if (
          (newStart >= appStart && newStart < appEnd) ||
          (newEnd > appStart && newEnd <= appEnd) ||
          (newStart <= appStart && newEnd >= appEnd)
        ) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t("add_application.validation_error"));
      return;
    }

    const hasConflict = await checkAppointmentConflict();
    if (hasConflict) {
      toast.error(t("add_application.time_conflict"));
      return;
    }

    // Prepare doctors array with their services
    const doctorsData = selectedDoctors
      .filter(d => d.doctorEmail) // Only include doctors that have been selected
      .map(d => ({
        doctorEmail: d.doctorEmail,
        doctorName: d.doctorName,
        specialization: d.specialization || "",
        serviceId: d.serviceId || null,
        serviceName: d.serviceName || "",
      }));



    const payload = {
      patientId: formData.patientId,
      doctors: doctorsData,
      serviceType: formData.serviceType,
      appointmentStatus: formData.appointmentStatus,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      branch: formData.branch || "",
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
      serviceOrders: formData.serviceOrders && formData.serviceOrders.length > 0 ? [formData.serviceOrders[0]] : [],
    };


    setLoading(true);
    try {
      const response = await addApplication(payload);
      const applicationId = response.data?._id || response.data?.application?._id;

      // If payment is enabled, create payment via addPayment endpoint
      if (createPayment && applicationId) {
        const totalAmount = calculateTotalAmount();
        const paymentData = {
          items: paymentItems.map(item => ({
            name: item.serviceName,
            amount: parseFloat(item.amount) || 0,
            currency: item.currency || "RUB",
            quantity: parseInt(item.quantity) || 1,
          })),
          amount: parseFloat(totalAmount),
          finalAmount: parseFloat(totalAmount),
          currency: paymentItems[0]?.currency || "RUB",
          paymentMethod: markAsPaid ? "cash" : paymentMethod,
          paymentType: "card",
          status: markAsPaid ? "paid" : "pending",
        };

        try {
          const paymentResponse = await addPayment(applicationId, paymentData);

          if (!markAsPaid && paymentResponse?.paymentLink) {
            toast.success(t("add_application.payment_link_created") || "Payment link created successfully!");
          } else if (markAsPaid) {
            toast.success(t("add_application.marked_as_paid") || "Payment marked as paid");
          }
        } catch (paymentError) {
          toast.warning(t("add_application.payment_error") || "Application created but payment creation failed");
        }
      }

      toast.success(t("add_application.success"));
      if (onSuccess) {
        onSuccess(response.data);
      }
      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create application. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientCreated = (newPatient) => {
    setPatients((prev) => [newPatient, ...prev]);
    const fullName = `${newPatient.firstName || ""} ${newPatient.middleName || ""} ${newPatient.lastName || ""}`.trim();
    handlePatientSelect(newPatient);
    setSelectedPatientName(fullName || newPatient.patientId || newPatient.email || newPatient.phone);
    setCreatePatientModalOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
    {createPatientModalOpen && (
      <CreateNewPatientModal
        onClose={() => setCreatePatientModalOpen(false)}
        onCreated={handlePatientCreated}
      />
    )}
    {createPortal(
    <div className="create-appointment-modal-overlay" onClick={onClose}>
      <div className="create-appointment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-section">
          <h2>{t("calendar.create_appointment")}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-field">
              <label>
                {t("add_application.patient")} <span className="required">*</span>
              </label>
              <div ref={patientDropdownRef} className={`patient-select ${errors.patientId ? "error" : ""}`}>
                <div
                  className="patient-select-trigger"
                  onClick={() => {
                    setPatientDropdownOpen(!patientDropdownOpen);
                    if (!patientDropdownOpen) {
                      setPatientSearch("");
                    }
                  }}
                >
                  <span className="patient-select-value">
                    {selectedPatientName || t("add_application.select_patient")}
                  </span>
                  {patientDropdownOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {patientDropdownOpen && (
                  <div className="patient-options">
                    <div
                      className="patient-option patient-option-create"
                      onClick={() => {
                        setPatientDropdownOpen(false);
                        setCreatePatientModalOpen(true);
                      }}
                    >
                      <div className="patient-name" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: "20px", height: "20px", borderRadius: "50%",
                          background: "#fff", color: "#0a2e5d",
                          fontSize: "14px", fontWeight: "700",
                          lineHeight: "20px", textAlign: "center",
                          paddingBottom: "1px", flexShrink: 0,
                        }}>+</span>
                        {t("add_application.create_new_patient") || "Create new patient"}
                      </div>
                    </div>
                    <div className="patient-search-wrapper">
                      <input
                        type="text"
                        className="patient-search-input"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder={t("add_application.search_patient")}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <div
                          key={patient.email}
                          className="patient-option"
                          onClick={() => {
                            const fullName = `${patient.firstName || ""} ${patient.middleName || ""} ${patient.lastName || ""}`.trim();
                            handlePatientSelect(patient);
                            setSelectedPatientName(fullName || patient.email);
                          }}
                        >
                          <div className="patient-name">
                            {`${patient.firstName || ""} ${patient.middleName || ""} ${patient.lastName || ""}`.trim() || patient.email}
                          </div>
                          {patient.email && (
                            <div className="patient-email">
                              {patient.email}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="no-patients">{t("add_application.no_patients") || "No patients available"}</div>
                    )}
                  </div>
                )}
              </div>
              {errors.patientId && <span className="error-text">{errors.patientId}</span>}
            </div>

            <div className="form-field">
              <label>
                {t("add_application.service_type")} <span className="required">*</span>
              </label>
              <select
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className={errors.serviceType ? "error" : ""}
              >
                <option value="Physical consultation">
                  {t("add_application.service_physical") || "Physical consultation"}
                </option>
                <option value="Telemedicine">
                  {t("add_application.service_telemedicine") || "Telemedicine"}
                </option>
              </select>
              {errors.serviceType && <span className="error-text">{errors.serviceType}</span>}
            </div>
          </div>

          <div className="form-row form-row-3">
            <div className="form-field">
              <label>
                {t("add_application.date")} <span className="required">*</span>
              </label>
              <CustomCalendar
                value={formData.date}
                onChange={(date) => {
                  const d = new Date(date);
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setFormData(prev => ({ ...prev, date: dateStr }));
                }}
                placeholder={t("add_application.select_date")}
                dateFormat="dd-MM-yyyy"
                className={errors.date ? "error" : ""}
              />
              {errors.date && <span className="error-text">{errors.date}</span>}
            </div>

            <div className="form-field">
              <label>
                {t("add_application.start_time")} <span className="required">*</span>
              </label>
              <CustomTimePicker
                value={formData.startTime}
                onChange={(timeStr) => {
                  setFormData(prev => ({ ...prev, startTime: timeStr, endTime: "" }));
                }}
                placeholder={t("add_application.select_time") || "Select time"}
                className={errors.startTime ? "error" : ""}
              />
              {errors.startTime && <span className="error-text">{errors.startTime}</span>}
            </div>

            <div className="form-field">
              <label>
                {t("add_application.end_time")} <span className="required">*</span>
              </label>
              <CustomTimePicker
                value={formData.endTime}
                onChange={(timeStr) => {
                  setFormData(prev => ({ ...prev, endTime: timeStr }));
                }}
                placeholder={t("add_application.select_time") || "Select time"}
                className={errors.endTime ? "error" : ""}
                minTime={formData.startTime || null}
                disabled={!formData.startTime}
              />
              {errors.endTime && <span className="error-text">{errors.endTime}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-field full-width">
              <label>
                {t("add_application.doctor")} <span className="required">*</span>
              </label>
              {errors.doctors && <span className="error-text">{errors.doctors}</span>}
              
              <div ref={doctorDropdownRef} className="doctors-list">
                {selectedDoctors.map((doctorEntry, index) => (
                  <div key={index}>
                  <div className="doctor-service-row">
                    <div className="form-field-inline">
                      <div className={`doctor-select`}>
                        <div
                          className="doctor-select-trigger"
                          onClick={() => toggleDoctorDropdown(index)}
                        >
                          <span className="doctor-select-value">
                            {doctorEntry.doctorName || t("add_application.select_doctor")}
                          </span>
                          {doctorEntry.doctorDropdownOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {doctorEntry.doctorDropdownOpen && (
                          <div className="doctor-options">
                            <div className="doctor-search-wrapper">
                              <input
                                type="text"
                                className="doctor-search-input"
                                value={doctorEntry.doctorSearch}
                                onChange={(e) => updateDoctorSearch(e.target.value, index)}
                                placeholder={t("add_application.search_doctor") || "Search doctor..."}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {getFilteredDoctorsForIndex(index).length > 0 ? (
                              getFilteredDoctorsForIndex(index).map((doctor) => {
                                const firstName = getFieldValue(doctor.firstName, i18n.language) || "";
                                const middleName = getFieldValue(doctor.middleName, i18n.language) || "";
                                const lastName = getFieldValue(doctor.lastName, i18n.language) || "";
                                const fullName = `${firstName} ${middleName} ${lastName}`.trim();
                                
                                return (
                                  <div
                                    key={doctor.email}
                                    className="doctor-option"
                                    onClick={() => handleDoctorSelect(doctor, index)}
                                  >
                                    <div className="doctor-name">{fullName}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="no-doctors">{t("add_application.no_doctors") || "No doctors available"}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Specialty dropdown */}
                    {doctorEntry.doctorEmail && (
                      <div className="form-field-inline">
                        <div className="doctor-select">
                        <div
                          className="doctor-select-trigger"
                          onClick={() => setSelectedDoctors(prev => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], specialtyDropdownOpen: !updated[index].specialtyDropdownOpen };
                            return updated;
                          })}
                        >
                          <span className="doctor-select-value">
                            {doctorEntry.specialization || t("add_application.select_specialty") || "Select specialty"}
                          </span>
                          {doctorEntry.specialtyDropdownOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {doctorEntry.specialtyDropdownOpen && (
                          <div className="doctor-options">
                            <div className="doctor-search-wrapper">
                              <input
                                type="text"
                                className="doctor-search-input"
                                value={doctorEntry.specialtySearch}
                                onChange={(e) => setSelectedDoctors(prev => {
                                  const updated = [...prev];
                                  updated[index] = { ...updated[index], specialtySearch: e.target.value };
                                  return updated;
                                })}
                                placeholder={t("common.search") || "Search..."}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {(() => {
                              const q = (doctorEntry.specialtySearch || "").toLowerCase();
                                const filtered = specialties.filter(s => {
                                // filter by doctor's linked specialtyIds
                                if (doctorEntry.doctorSpecialtyIds.length > 0 &&
                                    !doctorEntry.doctorSpecialtyIds.includes(String(s._id))) return false;
                                // filter by search
                                if (q) {
                                  const en = (s.name_en || "").toLowerCase();
                                  const ru = (s.name_ru || "").toLowerCase();
                                  return en.includes(q) || ru.includes(q);
                                }
                                return true;
                              });
                              if (filtered.length === 0) {
                                return <div className="no-doctors">{t("common.noResults") || "No specialties"}</div>;
                              }
                              return filtered.map(s => (
                                <div
                                  key={s._id}
                                  className="doctor-option"
                                  onClick={() => handleSpecialtySelect(s, index)}
                                >
                                  <div className="doctor-name">
                                    {i18n.language.startsWith("ru") ? s.name_ru : s.name_en}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                        </div>
                      </div>
                    )}

                    {selectedDoctors.length > 1 && (
                      <button
                        type="button"
                        className="remove-doctor-btn"
                        onClick={() => handleRemoveDoctor(index)}
                        title={t("common.remove")}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  {/* Service dropdown — full-width row below doctor + specialty */}
                  {doctorEntry.specialtyId && (
                    <div className="doctor-service-second-row">
                      <div className="doctor-select">
                        <div
                          className="doctor-select-trigger"
                          onClick={() => setSelectedDoctors(prev => {
                            const updated = [...prev];
                            updated[index] = {
                              ...updated[index],
                              serviceDropdownOpen: !updated[index].serviceDropdownOpen,
                              serviceSearch: updated[index].serviceDropdownOpen ? updated[index].serviceSearch : "",
                            };
                            return updated;
                          })}
                        >
                          <span className="doctor-select-value">
                            {doctorEntry.serviceName || t("add_application.select_service")}
                          </span>
                          {doctorEntry.serviceDropdownOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {doctorEntry.serviceDropdownOpen && (
                          <div className="doctor-options">
                            <div className="doctor-search-wrapper">
                              <input
                                type="text"
                                className="doctor-search-input"
                                value={doctorEntry.serviceSearch}
                                onChange={(e) => setSelectedDoctors(prev => {
                                  const updated = [...prev];
                                  updated[index] = { ...updated[index], serviceSearch: e.target.value };
                                  return updated;
                                })}
                                placeholder={t("common.search")}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {(() => {
                              const q = (doctorEntry.serviceSearch || "").toLowerCase();
                              const filtered = doctorEntry.specialtyServices.filter(p =>
                                (p.name || "").toLowerCase().includes(q)
                              );
                              if (filtered.length === 0) {
                                return <div className="no-doctors">{t("common.noResults")}</div>;
                              }
                              return filtered.map(pos => (
                                <div
                                  key={pos._id}
                                  className={`doctor-option${doctorEntry.serviceId === pos._id ? " selected" : ""}`}
                                  onClick={() => setSelectedDoctors(prev => {
                                    const updated = [...prev];
                                    updated[index] = {
                                      ...updated[index],
                                      serviceId: pos._id,
                                      serviceName: pos.name,
                                      serviceDropdownOpen: false,
                                      serviceSearch: "",
                                    };
                                    return updated;
                                  })}
                                >
                                  <div className="doctor-name">{pos.name}</div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                ))}
                <button
                  type="button"
                  className="add-doctor-btn-inline"
                  onClick={handleAddDoctor}
                  title={t("add_application.add_another_doctor")}
                >
                  + {t("add_application.add_another_doctor") || "Add Doctor"}
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field full-width">
              <label>
                {t("add_application.appointment_status")} <span className="required">*</span>
              </label>
              <select
                name="appointmentStatus"
                value={formData.appointmentStatus}
                onChange={handleChange}
                className={errors.appointmentStatus ? "error" : ""}
              >
                <option value="Unconfirmed">{t("add_application.status_unconfirmed")}</option>
                <option value="Confirmed">{t("add_application.status_confirmed")}</option>
              </select>
              {errors.appointmentStatus && <span className="error-text">{errors.appointmentStatus}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-field full-width">
              <label>{t("add_application.entrance_diagnosis")}</label>
              <textarea
                name="serviceOrders.entranceDiagnosis"
                value={formData.serviceOrders[0]?.entranceDiagnosis || ""}
                onChange={handleChange}
                placeholder={t("add_application.entrance_diagnosis_placeholder")}
                rows="3"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field full-width">
              <label>{t("add_application.brief_history")}</label>
              <textarea
                name="serviceOrders.briefHistory"
                value={formData.serviceOrders[0]?.briefHistory || ""}
                onChange={handleChange}
                placeholder={t("add_application.brief_history_placeholder")}
                rows="3"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field full-width">
              <label>{t("add_application.comments")}</label>
              <textarea
                name="comments"
                value={formData.comments}
                onChange={handleChange}
                placeholder={t("add_application.comments_placeholder")}
              />
            </div>
          </div>

          <div className="payment-section">
            <div className="payment-header">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={createPayment}
                  onChange={(e) => {
                    setCreatePayment(e.target.checked);
                    if (!e.target.checked) {
                      setMarkAsPaid(false);
                    }
                  }}
                />
                <span>{t("add_application.create_payment") || "Create Payment / Invoice"}</span>
              </label>
            </div>

            {createPayment && (
              <>
                <div className="mark-paid-section">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={markAsPaid}
                      onChange={(e) => setMarkAsPaid(e.target.checked)}
                    />
                    <span>{t("add_application.mark_as_paid") || "Mark as Paid (Cash Payment)"}</span>
                  </label>
                  {!markAsPaid && (
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="payment-method-select"
                    >
                      <option value="tbank">T-Bank</option>
                      <option value="vtb">VTB</option>
                      <option value="yandex">Yandex</option>
                      <option value="bank_transfer">{t("add_application.bank_transfer") || "Bank Transfer"}</option>
                      <option value="cash">{t("add_application.cash") || "Cash"}</option>
                      <option value="payment_terminal">{t("add_application.payment_terminal") || "Payment Terminal"}</option>
                    </select>
                  )}
                </div>

                <div className="payment-items-section">
                  <h3>{t("add_application.payment_items") || "Payment Items"}</h3>
                  <div className="payment-items-table">
                    <div className="payment-items-header">
                      <div className="payment-col-service">{t("add_application.service_name") || "SERVICE NAME"}</div>
                      <div className="payment-col-quantity">{t("add_application.quantity") || "QUANTITY"}</div>
                      <div className="payment-col-amount">{t("add_application.amount") || "AMOUNT"}</div>
                      <div className="payment-col-currency">{t("add_application.currency") || "CURRENCY"}</div>
                      <div className="payment-col-actions">{t("add_application.actions") || "ACTIONS"}</div>
                    </div>
                    {paymentItems.map((item, index) => (
                      <div key={index} className="payment-item-row">
                        <div className="payment-col-service">
                          <input
                            type="text"
                            value={item.serviceName}
                            onChange={(e) => handlePaymentItemChange(index, "serviceName", e.target.value)}
                            placeholder={t("add_application.service_name_placeholder") || "In-face and remote consultations"}
                          />
                        </div>
                        <div className="payment-col-quantity">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handlePaymentItemChange(index, "quantity", e.target.value)}
                          />
                        </div>
                        <div className="payment-col-amount">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => handlePaymentItemChange(index, "amount", e.target.value)}
                            placeholder={t("add_application.amount") || "Amount"}
                          />
                        </div>
                        <div className="payment-col-currency">
                          <select
                            value={item.currency}
                            onChange={(e) => handlePaymentItemChange(index, "currency", e.target.value)}
                          >
                            <option value="RUB">RUB</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>
                        <div className="payment-col-actions">
                          <button
                            type="button"
                            className="remove-payment-item-btn"
                            onClick={() => handleRemovePaymentItem(index)}
                            disabled={paymentItems.length === 1}
                            title={t("common.remove")}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="add-item-btn"
                    onClick={handleAddPaymentItem}
                  >
                    + {t("add_application.add_item") || "Add Item"}
                  </button>

                  <div className="payment-total">
                    <span className="total-label">{t("add_application.total_amount") || "Total Amount:"}:</span>
                    <span className="total-value">{calculateTotalAmount()} {paymentItems[0]?.currency || "RUB"}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t("common.cancel") || "Cancel"}
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? t("common.creating") || "Creating..." : t("common.create") || "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
    )}
    </>
  );
}

export default CreateAppointmentModal;
