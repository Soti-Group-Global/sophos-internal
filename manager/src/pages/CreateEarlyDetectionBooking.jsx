import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Copy, Check, X, Search } from "lucide-react";
import { toast } from "react-toastify";
import { createManualEarlyDetectionBooking, getEarlyDetectionDoctors, getPatients } from "../utils/api";
import CustomCalendar from "../components/CustomCalendar/CustomCalendar";
import CustomTimePicker from "../components/CustomTimePicker/CustomTimePicker";
import "../styles/CreateEarlyDetectionBooking.css";

const DEFAULT_APPOINTMENT_STRUCTURE = [
  { id: "day-1-ultrasound", day: 1, title: "Ultrasound" },
  { id: "day-1-gynecologist", day: 1, title: "Gynecologist" },
  { id: "day-1-therapist", day: 1, title: "Therapist" },
  { id: "day-2-dermatologist", day: 2, title: "Dermatologist" },
  { id: "day-2-ophthalmologist", day: 2, title: "Ophthalmologist" },
  { id: "day-2-gynecologist", day: 2, title: "Gynecologist" },
  { id: "day-2-therapist", day: 2, title: "Therapist" },
  { id: "day-2-surgeon", day: 2, title: "Surgeon" },
  { id: "day-2-ent", day: 2, title: "ENT" },
];

const createInitialSchedule = () =>
  DEFAULT_APPOINTMENT_STRUCTURE.map((item) => ({
    ...item,
    date: "",
    startTime: "",
    endTime: "",
    doctor: "",
  }));

const getDoctorDisplayName = (doctor) => {
  const readField = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      return value.en || value.ru || Object.values(value)[0] || "";
    }
    return "";
  };

  const fullName = [
    readField(doctor?.firstName),
    readField(doctor?.middleName),
    readField(doctor?.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || doctor?.email || "Unassigned";
};

const toDateOnlyString = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const SPECIALTY_ALIASES = {
  ultrasound: ["ultrasound", "ultrasound diagnostics", "sonologist", "ultrasonography", "diagnostic", "узи", "ультразв", "ультразву"],
  gynecologist: ["gynecologist", "gynaecologist", "gynecology", "oncogynecology", "obstetric", "гинеколог", "гинекологи", "онкогинек"],
  therapist: ["therapist", "therapy", "internal medicine", "general practitioner", "general practice", "physician", "терапевт", "терапия"],
  dermatologist: ["dermatologist", "dermatology", "dermatovenerology", "дерматолог", "дерматологи", "дерматовенер"],
  ophthalmologist: ["ophthalmologist", "ophthalmology", "oculist", "офтальмолог", "офтальмологи"],
  surgeon: ["surgeon", "surgery", "surgical", "хирург", "хирурги", "хирургия"],
  ent: ["ent", "otolaryngologist", "otorhinolaryngologist", "otorhinolaryngology", "лор", "оториноларинголог", "отоларинголог"],
};

const normalizeMatchText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const getDoctorSpecialtyNames = (doctor) => {
  const specialties = Array.isArray(doctor?.specialtyIds) ? doctor.specialtyIds : [];
  const subSpecialties = Array.isArray(doctor?.subSpecialityIds) ? doctor.subSpecialityIds : [];

  return [...specialties, ...subSpecialties]
    .flatMap((specialty) => [specialty?.name_en, specialty?.name_ru])
    .filter(Boolean)
    .map(normalizeMatchText);
};

const doctorMatchesScheduleTitle = (doctor, title) => {
  const normalizedTitle = normalizeMatchText(title);
  const aliases = (SPECIALTY_ALIASES[normalizedTitle] || [String(title)]).map(normalizeMatchText);
  const specialtyNames = getDoctorSpecialtyNames(doctor);
  return aliases.some((alias) =>
    specialtyNames.some(
      (specialtyName) => specialtyName.includes(alias) || alias.includes(specialtyName)
    )
  );
};

const PAYMENT_METHOD_OPTIONS = [
  { value: "tbank", label: "Tbank" },
  { value: "vtb", label: "VTB" },
  { value: "yandex", label: "Yandex" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "payment_terminal", label: "Payment terminal" },
  { value: "create_without_payment", label: "Create without payment" },
];

const CreateEarlyDetectionBooking = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isCreating, setIsCreating] = useState(false);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [paymentLinkData, setPaymentLinkData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [isMainPackageSelected, setIsMainPackageSelected] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [scheduleItems, setScheduleItems] = useState(createInitialSchedule);
  
  // Patient selection state
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    selectedPackage: "predict",
    paymentMethod: "tbank",
    markAsPaid: false,
    paidDate: "",
    consents: {
      dataProcessing: false,
      marketing: false
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preferredDate = params.get("preferredDate");
    const preferredTime = params.get("preferredTime");

    if (!preferredDate && !preferredTime) return;

    setScheduleItems((prev) => {
      const next = [...prev];
      if (!next.length) return prev;
      next[0] = {
        ...next[0],
        date: preferredDate || next[0].date,
        startTime: preferredTime || next[0].startTime,
      };
      return next;
    });
  }, []);

  // Load patients on component mount
  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    loadDoctors();
  }, []);

  // Close patient dropdown on outside click
  useEffect(() => {
    if (!showPatientDropdown) return;
    const handleClick = (e) => {
      if (!e.target.closest(".patient-selector-wrapper")) {
        setShowPatientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPatientDropdown]);

  const loadPatients = async () => {
    setLoadingPatients(true);
    try {
      const patientsData = await getPatients();
      if (Array.isArray(patientsData)) {
        setPatients(patientsData);
      } else {
        console.error("Unexpected patients response format:", patientsData);
        toast.error("Invalid patients data format");
      }
    } catch (error) {
      console.error("Error loading patients:", error);
      const errorMsg = error.response?.data?.message || error.message || "Failed to load patients";
      toast.error(errorMsg);
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const response = await getEarlyDetectionDoctors();
      console.log("[EarlyDetection] doctors API response:", response);

      const doctorsData = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];

      console.log(
        "[EarlyDetection] parsed doctors:",
        doctorsData.map((doctor) => ({
          id: doctor._id,
          email: doctor.email,
          name: getDoctorDisplayName(doctor),
          earlyDetection: doctor.earlyDetection,
          specialtyIds: doctor.specialtyIds,
          subSpecialityIds: doctor.subSpecialityIds,
        }))
      );

      setDoctors(doctorsData);
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error(error.response?.data?.message || "Failed to load doctors");
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    const email = patient.email?.toLowerCase() || "";
    const phone = patient.phoneNumber || "";
    return fullName.includes(searchLower) || email.includes(searchLower) || phone.includes(searchTerm);
  });

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchTerm("");
    setShowPatientDropdown(false);
  };

  const handleScheduleItemChange = (itemId, field, value) => {
    setScheduleItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const getDoctorsForScheduleItem = (item) =>
    doctors.filter((doctor) => {
      const specialtyNames = getDoctorSpecialtyNames(doctor);
      const matches = doctorMatchesScheduleTitle(doctor, item.title);

      console.log("[EarlyDetection] doctor specialty match check:", {
        scheduleTitle: item.title,
        doctorId: doctor._id,
        doctorEmail: doctor.email,
        doctorName: getDoctorDisplayName(doctor),
        specialtyNames,
        matches,
      });

      return matches;
    });

  const packages = {
    predict: {
      id: "predict",
      name: "«ПРЕДИКТ»",
      price: 99500,
      originalPrice: 128500,
      discount: "22%",
      description: "Первичная проверка здоровья (2 визита)",
      additionalInfo: "Полная первичная проверка здоровья в рамках пакета за 1 или 2 дня",
      clinicPrice: 149000,
      standardPrice: 208000,
      features: [],
      popular: true,
    },
  };

  const addOns = [
    { id: "predict-plus", name: "Апгрейд «ПРЕДИКТ+5»", description: "Расширенная диагностика + онкопоиск", price: 98000, isUpgrade: true },
    { id: "ct", name: "НДКТ грудной клетки", price: 11700 },
    { id: "mri", name: "МРТ головного мозга", price: 12000 },
    { id: "endoscopy", name: "Гастроскопия + колоноскопия", price: 28500, oldPrice: 58000 },
    { id: "mammography", name: "Маммография с томосинтезом", price: 12000 },
    { id: "oncosearch", name: "Онкопоиск", price: 50000 },
    { id: "insurance", name: "Онкострахование", price: 35000 },
  ];

  const toggleAddOn = (id) => {
    setSelectedAddOns(prev => {
      const newSelection = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      // Any add-on selection requires main package to be ON
      if (newSelection.length > 0) {
        setIsMainPackageSelected(true);
      }
      return newSelection;
    });
  };

  const toggleMainPackage = () => {
    // Can't deselect main package if add-ons are selected (add-ons require main)
    if (isMainPackageSelected && selectedAddOns.length > 0) return;
    setIsMainPackageSelected(prev => {
      const newValue = !prev;
      // If turning OFF main — clear all add-ons
      if (!newValue) {
        setSelectedAddOns([]);
      }
      return newValue;
    });
  };

  const addOnsTotal = selectedAddOns.reduce((sum, id) => {
    const item = addOns.find(a => a.id === id);
    return sum + (item?.price || 0);
  }, 0);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedPatient) {
      toast.error(t('earlyDiagnosis.pleaseSelectPatient'));
      return;
    }
    if (!formData.consents.dataProcessing) {
      toast.error(t('earlyDiagnosis.dataProcessingConsentRequired'));
      return;
    }

    setIsCreating(true);
  let bookingData = null;
    try {
      // Prepare the booking data
      const selectedAddOnData = selectedAddOns.map(id => {
        const addon = addOns.find(a => a.id === id);
        return addon ? { id: addon.id, name: addon.name, price: addon.price } : null;
      }).filter(Boolean);

      const pkg = packages[formData.selectedPackage];

      // Main package is always required
      if (!isMainPackageSelected) {
        toast.error(t('earlyDiagnosis.mainPackageRequired'));
        setIsCreating(false);
        return;
      }

      const normalizedSchedule = scheduleItems.map((item) => ({
        title: item.title,
        date: item.date || null,
        startTime: item.startTime || "",
        endTime: item.endTime || "",
        doctor: item.doctor || null,
      }));

      const firstScheduledItem = normalizedSchedule.find(
        (item) => item.date || item.startTime || item.endTime || item.doctor
      );

      bookingData = {
        patient: {
          patientId: selectedPatient._id,
        },
        appointmentDate: firstScheduledItem?.date ? `${firstScheduledItem.date}T00:00:00` : undefined,
        appointmentTime: firstScheduledItem?.startTime || "",
        schedule: {
          specialistConsultations: normalizedSchedule,
        },
        package: {
          id: pkg.id,
          name: pkg.name,
          price: pkg.price,
          currency: "RUB"
        },
        addOns: selectedAddOnData,
        consents: {
          dataProcessing: formData.consents.dataProcessing,
          marketing: formData.consents.marketing
        },
        paymentMethod: formData.paymentMethod,
      };

      const isCreateWithoutPayment = formData.paymentMethod === "create_without_payment";
      const markAsPaid = !isCreateWithoutPayment && !!formData.markAsPaid;

      if (markAsPaid && !formData.paidDate) {
        toast.error(t('earlyDiagnosis.pleaseSelectPaidDate'));
        setIsCreating(false);
        return;
      }

      bookingData.markAsPaid = markAsPaid;
      bookingData.paidDate = markAsPaid ? formData.paidDate : null;
      bookingData.createPaymentLink = !markAsPaid && formData.paymentMethod === "tbank";

      // Create the booking
      const response = await createManualEarlyDetectionBooking(bookingData);
      
      if (response.success) {
        toast.success(t('earlyDiagnosis.bookingCreatedSuccessfully'));
        
        // Show payment link modal if payment link was created
        if (response.data?.payment?.paymentLink) {
          setPaymentLinkData({
            paymentLink: response.data.payment.paymentLink,
            bookingNumber: response.data.booking.bookingNumber,
            amount: response.data.payment.amount,
            currency: response.data.payment.currency
          });
          setShowPaymentLinkModal(true);
        } else {
          navigate("/early-detection-bookings");
        }
      } else {
        toast.error(response.message || "Failed to create booking");
      }
    } catch (error) {
      console.error("[EarlyDetection] create booking error:", {
        status: error.response?.status,
        data: error.response?.data,
        payload: bookingData,
        message: error.message,
      });
      toast.error(error.response?.data?.message || "Failed to create booking. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (paymentLinkData?.paymentLink) {
      navigator.clipboard.writeText(paymentLinkData.paymentLink);
      setCopied(true);
      toast.success(t('earlyDiagnosis.paymentLinkCopied'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentLinkModal(false);
    setPaymentLinkData(null);
    navigate("/early-detection-bookings");
  };

  const handleDiscardDraft = () => {
    if (window.confirm(t('earlyDiagnosis.confirmDiscardDraft'))) {
      navigate("/early-detection-bookings");
    }
  };

  const selectedPackageData = packages[formData.selectedPackage];
  const mainPackagePrice = isMainPackageSelected ? selectedPackageData.price : 0;
  const totalPrice = mainPackagePrice + addOnsTotal;
  const groupedSchedule = {
    1: scheduleItems.filter((item) => item.day === 1),
    2: scheduleItems.filter((item) => item.day === 2),
  };
  const firstScheduledItem = scheduleItems.find((item) => item.date || item.startTime || item.endTime);

  // Check if all required fields are filled
  const isFormValid = 
    selectedPatient !== null &&
    formData.consents.dataProcessing === true;

  return (
    <div className="create-booking-page">
      {/* Breadcrumb */}
      <div className="create-booking-breadcrumb">
        <span 
          className="breadcrumb-link" 
          onClick={() => navigate("/early-detection-bookings")}
        >
          {t('earlyDiagnosis.earlyDiagnosis')}
        </span>
        <ChevronRight size={16} className="breadcrumb-separator" />
        <span className="breadcrumb-current">{t('earlyDiagnosis.createNewBooking')}</span>
      </div>

      <h1 className="create-booking-title">{t('earlyDiagnosis.createNewBooking')}</h1>

      <div className="create-booking-layout">
        {/* Left Column - Form */}
        <div className="create-booking-form">
          {/* Section 1: Select Patient */}
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-number">1</span>
              <h2 className="form-section-title">{t('earlyDiagnosis.patientInformation')}</h2>
            </div>

            <div className="patient-selector-wrapper" style={{ position: "relative" }}>
              <label className="form-label" style={{ display: "block", marginBottom: "8px" }}>
                {t('earlyDiagnosis.selectPatient').toUpperCase()} <span className="required">*</span>
              </label>

              {selectedPatient ? (
                <div 
                  className="patient-selected-box"
                  style={{
                    padding: "12px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    marginBottom: "12px"
                  }}
                  onClick={() => setShowPatientDropdown(!showPatientDropdown)}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 500, color: "#111827" }}>
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                      {selectedPatient.email}
                    </p>
                  </div>
                  <X 
                    size={18} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPatient(null);
                      setShowPatientDropdown(false);
                    }}
                    style={{ cursor: "pointer", color: "#6b7280" }}
                  />
                </div>
              ) : (
                <div 
                  style={{
                    position: "relative",
                    marginBottom: "12px"
                  }}
                >
                  <Search size={18} style={{ position: "absolute", left: "12px", top: "12px", color: "#9ca3af" }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('earlyDiagnosis.searchPatientPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowPatientDropdown(true)}
                    style={{ paddingLeft: "40px" }}
                  />
                  
                  {showPatientDropdown && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderTop: "none",
                      borderRadius: "0 0 6px 6px",
                      maxHeight: "300px",
                      overflowY: "auto",
                      zIndex: 10,
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
                    }}>
                      {loadingPatients ? (
                        <div style={{ padding: "12px", color: "#6b7280", textAlign: "center" }}>
                          {t('earlyDiagnosis.loadingPatients')}
                        </div>
                      ) : filteredPatients.length > 0 ? (
                        filteredPatients.map(patient => (
                          <div
                            key={patient._id}
                            onClick={() => handleSelectPatient(patient)}
                            style={{
                              padding: "8px 12px",
                              borderBottom: "1px solid #f3f4f6",
                              cursor: "pointer",
                              transition: "background-color 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                          >
                            <p style={{ margin: 0, fontWeight: 500, color: "#111827", fontSize: "14px" }}>
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                              {patient.email}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "12px", color: "#6b7280", textAlign: "center" }}>
                          {searchTerm ? t('earlyDiagnosis.noPatientsFound') : t('earlyDiagnosis.startTypingToSearch')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Section 2: Appointment Structure */}
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-number">2</span>
              <h2 className="form-section-title">{t('earlyDiagnosis.appointmentStructure')}</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
              {[1, 2].map((day) => (
                <div
                  key={day}
                  style={{
                    border: "1px solid #dbe2ea",
                    borderRadius: "12px",
                    overflow: "visible",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid #e5e7eb",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {t('earlyDiagnosis.dayLabel')} {day}
                  </div>

                  <div style={{ padding: "8px 12px 12px" }}>
                    {groupedSchedule[day].map((item) => {
                      const matchingDoctors = getDoctorsForScheduleItem(item);

                      return (
                      <div
                        key={item.id}
                        style={{
                          padding: "12px 8px",
                          borderBottom: "1px solid #f3f4f6",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>{t(`earlyDiagnosis.specialist_${item.title}`, item.title)}</div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                          <div>
                            <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>{t('earlyDiagnosis.dateShort').toUpperCase()}</label>
                            <CustomCalendar
                              value={item.date}
                              onChange={(date) => handleScheduleItemChange(item.id, "date", toDateOnlyString(date))}
                              minDate={new Date()}
                              dateFormat="yyyy-MM-dd"
                              className="create-ed-calendar"
                            />
                          </div>

                          <div>
                            <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>{t('earlyDiagnosis.doctorShort').toUpperCase()}</label>
                            <select
                              className="form-input"
                              value={item.doctor}
                              onChange={(e) => handleScheduleItemChange(item.id, "doctor", e.target.value)}
                            >
                              <option value="">{loadingDoctors ? t('earlyDiagnosis.loadingDoctors') : matchingDoctors.length ? t('earlyDiagnosis.selectDoctor') : t('earlyDiagnosis.noMatchingDoctors')}</option>
                              {matchingDoctors.map((doctor) => (
                                <option key={doctor._id || doctor.email} value={doctor._id || ""}>
                                  {getDoctorDisplayName(doctor)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>{t('earlyDiagnosis.startTimeShort').toUpperCase()}</label>
                            <CustomTimePicker
                              value={item.startTime}
                              onChange={(timeStr) => handleScheduleItemChange(item.id, "startTime", timeStr)}
                              placeholder={t("earlyDiagnosis.selectTime")}
                              disabled={!item.date || !item.doctor}
                            />
                          </div>

                          <div>
                            <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>{t('earlyDiagnosis.endTimeShort').toUpperCase()}</label>
                            <CustomTimePicker
                              value={item.endTime}
                              onChange={(timeStr) => handleScheduleItemChange(item.id, "endTime", timeStr)}
                              placeholder={t("earlyDiagnosis.selectTime")}
                              disabled={!item.date || !item.doctor || !item.startTime}
                              minTime={item.startTime || undefined}
                            />
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Package & Service */}
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-number">3</span>
              <h2 className="form-section-title">{t('earlyDiagnosis.packageService')}</h2>
            </div>

            <div className="package-options">
              <div 
                className={`package-card ${isMainPackageSelected ? "selected" : ""}`}
                onClick={toggleMainPackage}
                style={{ cursor: selectedAddOns.length > 0 ? 'not-allowed' : 'pointer', opacity: 1 }}
              >
                <div className="package-header">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{
                      width: "20px", height: "20px", borderRadius: "4px", marginTop: "2px",
                      border: isMainPackageSelected ? "none" : "2px solid #d1d5db",
                      backgroundColor: isMainPackageSelected ? "#3b82f6" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      {isMainPackageSelected && <Check size={14} color="white" />}
                    </div>
                    <div>
                      <h3 className="package-name">«ПРЕДИКТ»</h3>
                      <p className="package-description">Первичная проверка здоровья (2 визита)</p>
                    </div>
                  </div>
                </div>
                <div className="package-price">99 500 ₽</div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  <span style={{ textDecoration: "line-through" }}>208 000 ₽</span> стандартная · 149 000 ₽ в клинике
                </div>
                {selectedAddOns.length > 0 && (
                  <div style={{ fontSize: "11px", color: "#3b82f6", marginTop: "4px", fontStyle: "italic" }}>
                    {t('earlyDiagnosis.requiredWithAddOns')}
                  </div>
                )}
              </div>
            </div>

            {/* Add-on Options */}
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>
                {t('earlyDiagnosis.additionalOptions')}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {addOns.map((item) => {
                  const isSelected = selectedAddOns.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleAddOn(item.id)}
                      className={`package-card ${isSelected ? "selected" : ""}`}
                      style={{ cursor: "pointer", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "20px", height: "20px", borderRadius: "4px", border: isSelected ? "none" : "2px solid #d1d5db",
                          backgroundColor: isSelected ? "#3b82f6" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                        }}>
                          {isSelected && <Check size={14} color="white" />}
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0 }}>{item.name}</p>
                          {item.description && (
                            <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0 0" }}>{item.description}</p>
                          )}
                          {item.oldPrice && (
                            <p style={{ fontSize: "12px", color: "#9ca3af", textDecoration: "line-through", margin: "2px 0 0 0" }}>
                              {item.oldPrice.toLocaleString()} ₽
                            </p>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                        {item.price.toLocaleString()} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Consents */}
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-number">4</span>
              <h2 className="form-section-title">{t('earlyDiagnosis.consents')}</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.consents.dataProcessing}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    consents: { ...prev.consents, dataProcessing: e.target.checked }
                  }))}
                  style={{ marginTop: "4px", cursor: "pointer" }}
                  required
                />
                <span style={{ fontSize: "14px", color: "#374151" }}>
                  {t('earlyDiagnosis.consentDataProcessing')} <span className="required">*</span>
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.consents.marketing}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    consents: { ...prev.consents, marketing: e.target.checked }
                  }))}
                  style={{ marginTop: "4px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "14px", color: "#374151" }}>
                  {t('earlyDiagnosis.consentMarketing')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="booking-summary-sidebar">
          <h3 className="summary-title">{t('earlyDiagnosis.bookingSummary')}</h3>

          {isMainPackageSelected && (
            <div className="summary-row">
              <span className="summary-label">{t('earlyDiagnosis.servicePackage')}</span>
              <span className="summary-value">{selectedPackageData.name} — {selectedPackageData.price.toLocaleString()} ₽</span>
            </div>
          )}

          {selectedAddOns.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <span className="summary-label" style={{ fontSize: "12px", color: "#6b7280" }}>{t('earlyDiagnosis.additionalOptionsShort')}</span>
              {selectedAddOns.map(id => {
                const addon = addOns.find(a => a.id === id);
                return addon ? (
                  <div key={id} className="summary-row" style={{ paddingLeft: "8px" }}>
                    <span className="summary-label" style={{ fontSize: "12px" }}>{addon.name}</span>
                    <span className="summary-value" style={{ fontSize: "12px" }}>{addon.price.toLocaleString()} ₽</span>
                  </div>
                ) : null;
              })}
            </div>
          )}

          <div className="summary-row">
            <span className="summary-label">{t('earlyDiagnosis.dateTime')}</span>
            <span className="summary-value">
              {firstScheduledItem?.date
                ? `${new Date(firstScheduledItem.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${firstScheduledItem.startTime ? `, ${firstScheduledItem.startTime}` : ""}`
                : "-"}
            </span>
          </div>

          <div className="summary-divider"></div>

          <div className="summary-total">
            <span className="total-label">{t('earlyDiagnosis.totalAmount')}</span>
            <span className="total-value">{totalPrice.toLocaleString()} ₽</span>
          </div>

          <div className="payment-method-section">
            <label className="payment-method-label">{t('earlyDiagnosis.paymentMethod').toUpperCase()}</label>
            <select
              className="form-input"
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData((prev) => {
                  const nextMethod = e.target.value;
                  const isWithoutPayment = nextMethod === "create_without_payment";
                  return {
                    ...prev,
                    paymentMethod: nextMethod,
                    markAsPaid: isWithoutPayment ? false : prev.markAsPaid,
                    paidDate: isWithoutPayment ? "" : prev.paidDate,
                  };
                })
              }
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`earlyDiagnosis.paymentMethods.${option.value}`, option.label)}
                </option>
              ))}
            </select>

            {formData.paymentMethod !== "create_without_payment" && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!formData.markAsPaid}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        markAsPaid: e.target.checked,
                        paidDate: e.target.checked ? prev.paidDate : "",
                      }))
                    }
                  />
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#374151" }}>{t('earlyDiagnosis.markAsPaid')}</span>
                </label>

                {formData.markAsPaid && (
                  <div>
                    <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>
                      {t('earlyDiagnosis.paidDate').toUpperCase()} <span className="required">*</span>
                    </label>
                    <CustomCalendar
                      value={formData.paidDate}
                      onChange={(date) => handleInputChange("paidDate", toDateOnlyString(date))}
                      dateFormat="yyyy-MM-dd"
                      className="create-ed-calendar"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            className="confirm-booking-btn" 
            onClick={handleSubmit}
            disabled={!isFormValid || isCreating}
          >
            {isCreating ? t('earlyDiagnosis.creating') : t('earlyDiagnosis.confirmCreateBooking')}
          </button>

          <button className="discard-draft-btn" onClick={handleDiscardDraft}>
            {t('earlyDiagnosis.discardDraft')}
          </button>
        </div>
      </div>

      {/* Payment Link Modal */}
      {showPaymentLinkModal && paymentLinkData && (
        <div className="payment-link-modal-overlay">
          <div className="payment-link-modal">
            <div className="payment-link-modal-header">
              <h2>{t('earlyDiagnosis.paymentLinkCreated')}</h2>
              <button onClick={handleClosePaymentModal} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>
            <div className="payment-link-modal-body">
              <div className="payment-link-info">
                <p className="info-label">{t('earlyDiagnosis.bookingNumber')}</p>
                <p className="info-value">{paymentLinkData.bookingNumber}</p>
              </div>
              <div className="payment-link-info">
                <p className="info-label">{t('earlyDiagnosis.amount')}</p>
                <p className="info-value">{paymentLinkData.amount?.toLocaleString()} {paymentLinkData.currency}</p>
              </div>
              <div className="payment-link-box">
                <p className="link-label">{t('earlyDiagnosis.paymentLink')}:</p>
                <div className="link-container">
                  <input 
                    type="text" 
                    value={paymentLinkData.paymentLink} 
                    readOnly 
                    className="link-input"
                  />
                  <button 
                    onClick={handleCopyPaymentLink} 
                    className="copy-btn"
                    title="Copy link"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              </div>
              <p className="payment-link-note">
                {t('earlyDiagnosis.sharePaymentLink')}
              </p>
            </div>
            <div className="payment-link-modal-footer">
              <button onClick={handleClosePaymentModal} className="close-modal-btn">
                {t('earlyDiagnosis.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateEarlyDetectionBooking;
