import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { getApptStatusClass } from "../../utils/appointmentStatus";
import {
  Plus,
  Phone,
  MessageCircle,
  Mail,
  Send,
  Filter,
  Link,
  ArrowLeft,
  ArrowRight,
  X,
  FileText,
  File,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit3,
  ChevronLeft,
} from "lucide-react";

// Helper function to extract multilingual field values
const getFieldValue = (field, lang = "en") => {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") return field[lang] || field["en"] || "";
  return "";
};

import Papa from "papaparse";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import InvoiceModal from "../../pages/InvoiceModal";
import AddPaymentModal from "../../pages/AppointmentDetails/AddPaymentModal";
import ContractDocument from "../../pages/ContractDocument";
import AktDocument from "../../pages/AktDocument";
import WhatsAppChatBot from "../../pages/WhatsAppChatBot";
import TelegramChatBot from "../../pages/TelegramChatBot";
import Orders from "./Orders";
import CalendarView from "./CalendarView";
import CreateAppointmentModal from "./CreateAppointmentModal";
import ExportPDFModal from "./ExportPDFModal";
import "./ApplicationsList.css";

import {
  getApplications,
  addDocument,
  getMedia,
  sendEmail,
} from "../../utils/api";
import { useBranch } from "../../context/BranchContext";

import ApplicationDetail from "./ApplicationDetail";

const ApplicationsList = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDocumentPopup, setShowDocumentPopup] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filters, setFilters] = useState({
    appointmentStatus: "",
    paymentStatus: "",
    dateFrom: "",
    dateTo: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceApplication, setInvoiceApplication] = useState(null);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef();
  const loadingRef = useRef(false);
  const [documentInput, setDocumentInput] = useState({
    type: "file",
    file: null,
    url: "",
    filename: "",
  });
  const [currentUserEmail, setCurrentUserEmail] = useState(
    localStorage.getItem("userEmail") || "",
  );
  const [isAktOpen, setIsAktOpen] = useState(false);
  const [aktData, setAktData] = useState(null);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [contractData, setContractData] = useState(null);
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [showTelegramChat, setShowTelegramChat] = useState(false);
  const [chatPhoneNumber, setChatPhoneNumber] = useState("");
  const [chatApplicationId, setChatApplicationId] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [activeTab, setActiveTab] = useState("Applications");
  const { selectedBranch } = useBranch();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 1024 : false,
  );
  const [viewMode, setViewMode] = useState("calendar"); // "table" or "calendar"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExportPDFModal, setShowExportPDFModal] = useState(false);
  const [exportPDFApps, setExportPDFApps] = useState(null); // null = all, array = specific

  const itemsPerPage = 10;
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const isMobileDetail = isMobile && selectedApplication;

  // Restore page number and scroll position from location state
  useEffect(() => {
    const savedState = location.state;
    if (savedState?.currentPage) {
      setCurrentPage(savedState.currentPage);
    }
    if (savedState?.scrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, savedState.scrollPosition);
      }, 0);
    }
  }, [location.state]);

  useEffect(() => {
    if (activeTab === "Applications") {
      setCurrentPage(1);
      setApplications([]);
      setHasMore(true);
    }
  }, [searchTerm, filters, activeTab, selectedBranch]);

  useEffect(() => {
    if (activeTab === "Applications" && hasMore) {
      fetchApplications(currentPage === 1);
    }
  }, [currentPage, searchTerm, filters, activeTab, selectedBranch]);

  const lastElementRef = useCallback(
    (node) => {
      if (loading || loadMoreLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setCurrentPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, loadMoreLoading, hasMore],
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchApplications = async (isInitial = false) => {
    if (loadingRef.current) return;
    try {
      loadingRef.current = true;
      if (isInitial) setLoading(true);
      else setLoadMoreLoading(true);

      const response = await getApplications({
        page: isInitial ? 1 : currentPage,
        limit: itemsPerPage,
        search: searchTerm.trim() || undefined,
        appointmentStatus: filters.appointmentStatus || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        branch: selectedBranch !== "All" ? selectedBranch : undefined,
      });

      const apps = response.data.applications || [];
      const lang = i18n.language?.slice(0, 2) || "ru";
      const enrichedApps = apps
        .map((app) => ({
          ...app,
          patientName: app.patient
            ? `${app.patient.firstName || ""} ${app.patient.middleName || ""} ${
                app.patient.lastName || ""
              }`.trim()
            : t("applications.unknown_patient"),
          patientId: app.patient?._id || null,
          doctorName: app.doctor
            ? [
                getFieldValue(app.doctor.lastName, lang),
                getFieldValue(app.doctor.firstName, lang),
                getFieldValue(app.doctor.middleName, lang),
              ]
                .filter(Boolean)
                .join(" ")
            : app.doctors?.[0]?.doctorName || t("applications.unknown_doctor"),
          doctorId: app.doctor?._id || null,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setApplications((prev) => {
        const combined = isInitial ? enrichedApps : [...prev, ...enrichedApps];
        // Ensure uniqueness by ID
        const unique = Array.from(
          new Map(combined.map((item) => [item._id, item])).values(),
        );
        return unique.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
      });
      setTotalPages(response.data.totalPages);
      setHasMore(currentPage < response.data.totalPages);
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("applications.error_fetch"),
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        setCurrentUserEmail("");
        navigate("/");
      }
    } finally {
      if (isInitial) setLoading(false);
      else setLoadMoreLoading(false);
      loadingRef.current = false;
    }
  };

  // Re-compute doctor names when language changes
  useEffect(() => {
    const lang = i18n.language?.slice(0, 2) || "ru";
    setApplications((prev) =>
      prev.map((app) => ({
        ...app,
        doctorName: app.doctor
          ? [
              getFieldValue(app.doctor.lastName, lang),
              getFieldValue(app.doctor.firstName, lang),
              getFieldValue(app.doctor.middleName, lang),
            ]
              .filter(Boolean)
              .join(" ")
          : app.doctors?.[0]?.doctorName || t("applications.unknown_doctor"),
      })),
    );
  }, [i18n.language]);

  const handleRowClick = (app) => {
    const appId = app.applicationId || app._id;
    navigate(
      `/applications/appointment/${encodeURIComponent(appId)}?tab=general`,
    );
  };

  const handleCloseDetails = () => {
    setSelectedApplication(null);
  };

  const handleEditAppointment = (app, e) => {
    e?.stopPropagation();
    navigate(`/applications/edit/${encodeURIComponent(app.applicationId)}`, {
      state: { currentPage, scrollPosition: window.scrollY },
    });
  };

  const handlePatientNameClick = (patientId, e) => {
    e?.stopPropagation();
    if (patientId) {
      navigate(`/patients/${patientId}`, {
        state: { currentPage, scrollPosition: window.scrollY },
      });
    } else {
      toast.error(t("applications.patient_details_unavailable"));
    }
  };

  const handleDoctorNameClick = (doctorId, e) => {
    e?.stopPropagation();
    if (doctorId) {
      navigate(`/doctors/${doctorId}`, {
        state: { currentPage, scrollPosition: window.scrollY },
      });
    } else {
      toast.error(t("applications.doctor_details_unavailable"));
    }
  };

  const formatDateTime = (date, startTime, endTime) => {
    try {
      if (!date) return t("applications.na");

      const dateObj = new Date(date);
      if (isNaN(dateObj)) return t("applications.na");

      const dateOptions = { year: "numeric", month: "long", day: "numeric" };
      const formattedDate = dateObj.toLocaleDateString(i18n.language, {
        ...dateOptions,
        timeZone: "Europe/Moscow",
      });

      // startTime / endTime may be plain "HH:mm" strings or full ISO dates
      const toTimeStr = (val) => {
        if (!val) return null;
        // Already a plain "HH:mm" or "HH:mm:ss" string
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) return val.slice(0, 5);
        const d = new Date(val);
        if (isNaN(d)) return null;
        return d.toLocaleTimeString(i18n.language, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Europe/Moscow",
        });
      };

      const start = toTimeStr(startTime);
      const end = toTimeStr(endTime);

      if (start && end) return `${formattedDate}, ${start} - ${end}`;
      if (start) return `${formattedDate}, ${start}`;
      return formattedDate;
    } catch (error) {
      return t("applications.na");
    }
  };

  const formatPaymentDate = (paidAt) => {
    try {
      const dateObj = paidAt ? new Date(paidAt) : new Date();
      if (isNaN(dateObj)) {
        return t("applications.na");
      }
      const options = {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      };
      return dateObj.toLocaleString(i18n.language, options);
    } catch (error) {
      return t("applications.na");
    }
  };

  const getLatestPaymentStatus = (payments) => {
    if (!Array.isArray(payments) || payments.length === 0) return null;
    const validPayments = payments.filter(
      (p) => p.id && p.invoiceNumber && p.status,
    );
    if (validPayments.length === 0) return null;
    return validPayments[validPayments.length - 1].status.toLowerCase();
  };

  const getLatestPayment = (payments) => {
    if (!Array.isArray(payments) || payments.length === 0) return null;
    const validPayments = payments.filter(
      (p) => p.id && p.invoiceNumber && p.status,
    );
    if (validPayments.length === 0) return null;
    return validPayments[validPayments.length - 1];
  };

  const handleViewAkt = (application, payment) => {
    const aktDetails = {
      full_name: application.patientName,
      date_of_birth: application.patient?.dateOfBirth || t("applications.na"),
      email: application.patient?.email,
      phone_no: application.patient?.phoneNumber || t("applications.na"),
      agreement_number: payment.invoiceNumber,
      akt_number: `AKT-${payment.invoiceNumber}`,
      agreement_date: formatPaymentDate(payment.paidAt),
      packages: payment.packages || [],
      total_amount: `${payment.totalAmount} ${payment.currency}`,
    };
    setAktData(aktDetails);
    setIsAktOpen(true);
    setShowInvoiceModal(false);
    setInvoiceApplication(null);
  };

  const handleViewContract = (application, payment) => {
    const contractDetails = {
      full_name: application.patientName,
      email: application.patient?.email,
      phone_no: application.patient?.phoneNumber || t("applications.na"),
      agreement_number: payment.invoiceNumber,
      agreement_date: formatPaymentDate(payment.paidAt),
      packages: payment.packages || [],
      total_amount: `${payment.totalAmount} ${payment.currency}`,
      date_of_birth: application.patient?.dateOfBirth || t("applications.na"),
    };
    setContractData(contractDetails);
    setIsContractOpen(true);
    setShowInvoiceModal(false);
    setInvoiceApplication(null);
  };

  const copyMeetingLink = (link, e) => {
    e?.stopPropagation();
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success(t("applications.link_copied")));
  };

  const handleAddDocument = (applicationId, e) => {
    e?.stopPropagation();
    setSelectedApplicationId(applicationId);
    setShowDocumentPopup(true);
    setDocumentInput({ type: "file", file: null, url: "", filename: "" });
  };

  const handleDocumentSubmit = async () => {
    if (documentInput.type === "file" && !documentInput.file) {
      toast.error(t("applications.document_file_required"));
      return;
    }
    if (documentInput.type === "url" && !documentInput.url) {
      toast.error(t("applications.document_url_required"));
      return;
    }
    try {
      const documentPayload = {
        ...documentInput,
        paymentMethod: "yookassa",
      };
      await addDocument(selectedApplicationId, documentPayload);
      fetchApplications();
      setShowDocumentPopup(false);
      setSelectedApplicationId(null);
      setDocumentInput({ type: "file", file: null, url: "", filename: "" });
      toast.success(t("applications.document_added"));
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("applications.document_add_failed"),
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        setCurrentUserEmail("");
        navigate("/");
      }
    }
  };

  const handleFilterApply = () => {
    setCurrentPage(1);
    fetchApplications();
    setShowFilterDropdown(false);
  };

  const handleFilterReset = () => {
    setFilters({
      appointmentStatus: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
    });
    setCurrentPage(1);
    fetchApplications();
    setShowFilterDropdown(false);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleAddInvoice = (application, e) => {
    e?.stopPropagation();
    setInvoiceApplication(application);
    setShowInvoiceModal(true);
  };

  const handleInvoiceSuccess = () => {
    fetchApplications();
    toast.success(t("applications.payment_added"));
  };

  const handleEmailClick = (recipientType, application, e) => {
    e?.stopPropagation();
    const email =
      recipientType === "patient"
        ? application.patient?.email
        : application.doctor?.email;
    if (!email) {
      toast.error(t(`applications.no_email_${recipientType}`));
      return;
    }
    setEmailRecipient(email);
    setChatApplicationId(application._id);
    setEmailSubject("");
    setEmailBody("");
    setShowEmailPopup(true);
  };

  const handleWhatsAppClick = (recipientType, application, e) => {
    e?.stopPropagation();
    const phone =
      recipientType === "patient"
        ? application.patient?.phoneNumber
        : application.doctor?.phoneNumber;
    if (!phone) {
      toast.error(t(`applications.no_phone_${recipientType}`));
      return;
    }
    setChatPhoneNumber(phone.replace("@c.us", ""));
    setChatApplicationId(application._id);
    setShowWhatsAppChat(true);
  };

  const handleTelegramClick = (recipientType, application, e) => {
    e?.stopPropagation();
    const phone =
      recipientType === "patient"
        ? application.patient?.phoneNumber
        : application.doctor?.phoneNumber;
    if (!phone) {
      toast.error(t(`applications.no_phone_${recipientType}`));
      return;
    }
    setChatPhoneNumber(phone);
    setChatApplicationId(application._id);
    setShowTelegramChat(true);
  };

  const handleSendEmail = async () => {
    if (!emailRecipient || !emailSubject.trim() || !emailBody.trim()) {
      setError(t("applications.email_fields_required"));
      toast.error(t("applications.email_fields_required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendEmail(chatApplicationId, {
        to: emailRecipient,
        subject: emailSubject,
        body: emailBody,
      });
      setShowEmailPopup(false);
      setEmailRecipient("");
      setEmailSubject("");
      setEmailBody("");
      setChatApplicationId(null);
      toast.success(t("applications.email_sent"));
    } catch (error) {
      setError(error.response?.data?.message || t("applications.email_failed"));
      toast.error(
        error.response?.data?.message || t("applications.email_failed"),
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        setCurrentUserEmail("");
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const previewDocument = async (doc, e) => {
    e?.stopPropagation();
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
          t("applications.document_preview_failed"),
      );
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        setCurrentUserEmail("");
        navigate("/");
      }
    }
  };

  const hasPendingOrPaidPayment = (application) => {
    return (
      application.payments &&
      Array.isArray(application.payments) &&
      application.payments.some((p) =>
        ["pending", "paid"].includes(p.status?.toLowerCase()),
      )
    );
  };

  const hasPaidPayment = (application) => {
    return (
      application.payments &&
      Array.isArray(application.payments) &&
      application.payments.some((p) => p.status?.toLowerCase() === "paid")
    );
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-button ${currentPage === i ? "active" : ""}`}
        >
          {i}
        </button>,
      );
    }
    return (
      <div className="pagination-container">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-arrow"
        >
          <ArrowLeft size={16} />
        </button>
        {pageNumbers}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-arrow"
        >
          <ArrowRight size={16} />
        </button>
        <span className="pagination-info">
          {t("applications.pagination_info", {
            start: (currentPage - 1) * itemsPerPage + 1,
            end: Math.min(currentPage * itemsPerPage, applications.length),
            total: totalPages * itemsPerPage,
          })}
        </span>
      </div>
    );
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedApplication(null);
  };

  // Mobile: show only details when an application is selected
  if (activeTab === "Applications" && isMobileDetail) {
    return (
      <div className="applications-layout">
        <div className="application-details-panel mobile-full">
          <ApplicationDetail
            id={selectedApplication.applicationId}
            onClose={handleCloseDetails}
            onUpdate={fetchApplications}
          />
        </div>
      </div>
    );
  }

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sorted = [...applications].sort((a, b) => {
      if (!a[key]) return 1;
      if (!b[key]) return -1;
      if (typeof a[key] === "string") {
        return direction === "asc"
          ? a[key].localeCompare(b[key])
          : b[key].localeCompare(a[key]);
      }
      return direction === "asc"
        ? new Date(a[key]) - new Date(b[key])
        : new Date(b[key]) - new Date(a[key]);
    });

    setApplications(sorted);
  };

  const getStatusBadge = (status) => {
    return (
      <span className={`appt-status-badge ${getApptStatusClass(status)}`}>
        {t(`applications.status_${status?.toLowerCase().replace(" ", "_")}`)}
      </span>
    );
  };

  // Fetch all applications for export with pagination limit
  const fetchApplicationsForExport = async (pageLimit = 100) => {
    let page = 1;
    let totalPagesForExport = 1;
    const allApps = [];

    do {
      const response = await getApplications({
        page,
        limit: pageLimit,
        search: searchTerm.trim() || undefined,
        appointmentStatus: filters.appointmentStatus || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        branch: selectedBranch !== "All" ? selectedBranch : undefined,
      });

      const apps = response?.data?.applications || [];
      allApps.push(...apps);
      totalPagesForExport = Number(response?.data?.totalPages || 1);
      page += 1;
    } while (page <= totalPagesForExport);

    return allApps;
  };

  const handleExportCSV = async () => {
    try {
      const allApplications = await fetchApplicationsForExport(100);

      if (!allApplications.length) {
        toast.error("No applications to export");
        return;
      }

      const lang = i18n.language?.slice(0, 2) || "ru";

      const csvData = allApplications.flatMap((app) => {
        const patientName = app.patient
          ? `${app.patient.firstName || ""} ${app.patient.middleName || ""} ${app.patient.lastName || ""}`.trim()
          : t("applications.unknown_patient");

        const doctorName = app.doctor
          ? [
            getFieldValue(app.doctor.lastName, lang),
            getFieldValue(app.doctor.firstName, lang),
            getFieldValue(app.doctor.middleName, lang),
          ]
            .filter(Boolean)
            .join(" ")
          : app.doctors?.[0]?.doctorName || t("applications.unknown_doctor");

        const baseRow = {
          Application_ID: app.applicationId || app._id || "N/A",
          Patient_Name: patientName,
          Doctor_Name: doctorName,
          Specialty: app.specialty || "",
          Appointment_Mode: app.appointmentMode || "N/A",
          Appointment_Status: app.appointmentStatus || "N/A",
          Date_Time: formatDateTime(app.date, app.startTime, app.endTime),
          Total_Payments: Array.isArray(app.payments) ? app.payments.length : 0,
        };

        const payments = Array.isArray(app.payments) ? app.payments : [];

        if (payments.length === 0) {
          return [
            {
              ...baseRow,
              Payment_Number: "N/A",
              Payment_ID: "N/A",
              Invoice_Number: "N/A",
              Payment_Status: "N/A",
              Payment_Method: "N/A",
              Payment_Type: "N/A",
              Attendance_Mode: "N/A",
              Currency: "N/A",
              Amount_Before_Discount: "N/A",
              Discount: "N/A",
              Final_Amount: "N/A",
              Total_Amount: "N/A",
              Packages: "N/A",
              Items: "N/A",
              Payment_Link: "N/A",
              Invoice_File_ID: "N/A",
              Paid_At: "N/A",
              Created_At: "N/A",
            },
          ];
        }

        return payments.map((p, idx) => ({
          ...baseRow,
          Payment_Number: idx + 1,
          Payment_ID: p.id || p._id || "N/A",
          Invoice_Number: p.invoiceNumber || "N/A",
          Payment_Status: p.status || "N/A",
          Payment_Method: p.paymentMethod || "N/A",
          Payment_Type: p.type || "N/A",
          Attendance_Mode: p.attendanceMode || "N/A",
          Currency: p.currency || "N/A",
          Amount_Before_Discount: p.amount ?? "N/A",
          Discount: p.discount ?? "N/A",
          Final_Amount: p.finalAmount ?? "N/A",
          Total_Amount: p.totalAmount ?? "N/A",
          Packages: Array.isArray(p.packages)
            ? p.packages
              .map((pkg) => `${pkg.name || "Package"} x${pkg.quantity || 1} (${pkg.amount ?? "N/A"} ${pkg.currency || ""})`)
              .join("; ")
            : "N/A",
          Items: Array.isArray(p.items)
            ? p.items
              .map((item) => `${item.name || "Item"} (${item.amount ?? "N/A"})`)
              .join("; ")
            : "N/A",
          Payment_Link: p.paymentLink || "N/A",
          Invoice_File_ID: p.invoiceFileId || "N/A",
          Paid_At: p.paidAt ? new Date(p.paidAt).toLocaleString() : "N/A",
          Created_At: p.createdAt ? new Date(p.createdAt).toLocaleString() : "N/A",
        }));
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `applications_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error(error?.response?.data?.message || t("applications.error_fetch"));
    }
  };

  const handleExportPDF = () => {
    if (!applications.length) {
      toast.error("No applications to export");
      return;
    }

    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text("Applications List", 14, 14);

    const tableColumn = [
      "#",
      "Application ID",
      "Patient Name",
      "Doctor Name",
      "Specialty",
      "Appointment Mode",
      "Appointment Status",
      "Date & Time",
      "Payment Status",
    ];

    const tableRows = applications.map((app, index) => [
      index + 1,
      app.applicationId,
      app.patientName,
      app.doctorName,
      app.specialty || "",
      app.appointmentMode,
      app.appointmentStatus,
      formatDateTime(app.date, app.startTime, app.endTime),
      getLatestPaymentStatus(app.payments) || "N/A",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: { fillColor: [22, 160, 133] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
      },
    });

    doc.save(`applications_${Date.now()}.pdf`);
  };

  return (
    <div className="applications-layout">
      {/* Tab Navigation Commented Out */}
      {/* <div className="tab-navigation">...</div> */}

      {isMobileDetail ? (
        <div className="application-details-panel mobile-full">
          <ApplicationDetail
            id={selectedApplication.applicationId}
            onClose={handleCloseDetails}
            onUpdate={fetchApplications}
          />
        </div>
      ) : (
        <div className="applications-content">
          {/* Applications List Panel */}
          <div
            className={`applications-list-panel ${
              selectedApplication ? "condensed" : "full-width"
            } ${isMobile && selectedApplication ? "mobile-hidden" : ""}`}
          >
            {/* Header Section */}
            <div className="applications-section-header">
              <div className="applications-header-content">
                <div className="application-title-section">
                  {/*
                  <h1 className="application-page-title">
                    {t("applications.title")}
                  </h1>
                
                  {selectedApplication && (
                    <button
                      className="close-details-btn"
                      onClick={handleCloseDetails}
                    >
                      <ChevronLeft size={20} />
                      Close Details
                    </button>
                  )}
                  */}
                </div>

                <div className="action-section">
                  <div className="search-wrapper">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && fetchApplications()
                      }
                      placeholder={t("applications.search_placeholder")}
                      className="search-input"
                    />
                  </div>

                  <div className="filter-section">
                    <button
                      className="filter-button"
                      onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                      title={t("applications.filter")}
                    >
                      <Filter size={16} />
                    </button>

                    {showFilterDropdown && (
                      <div className="filter-dropdown">
                        <div className="filter-group">
                          <label className="filter-label">
                            {t("applications.filter_appointments")}
                          </label>
                          <select
                            value={filters.appointmentStatus}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                appointmentStatus: e.target.value,
                              }))
                            }
                            className="filter-select"
                          >
                            <option value="">
                              {t("applications.filter_all")}
                            </option>
                            <option value="Paid">
                              {t("applications.status_paid")}
                            </option>
                            <option value="Cancelled">
                              {t("applications.status_cancelled")}
                            </option>
                            <option value="Unconfirmed">
                              {t("applications.status_unconfirmed")}
                            </option>
                            <option value="Confirmed">
                              {t("applications.status_confirmed")}
                            </option>
                            <option value="Pending payment">
                              {t("applications.status_pending_payment")}
                            </option>
                          </select>
                        </div>

                        <div className="filter-group">
                          <label className="filter-label">
                            {t("applications.filter_payments")}
                          </label>
                          <select
                            value={filters.paymentStatus}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                paymentStatus: e.target.value,
                              }))
                            }
                            className="filter-select"
                          >
                            <option value="">
                              {t("applications.filter_all")}
                            </option>
                            <option value="new">
                              {t("applications.payment_new")}
                            </option>
                            <option value="invoice-sent">
                              {t("applications.payment_invoice_sent")}
                            </option>
                            <option value="paid">
                              {t("applications.payment_paid")}
                            </option>
                            <option value="cancelled">
                              {t("applications.payment_cancelled")}
                            </option>
                            <option value="free">
                              {t("applications.payment_free")}
                            </option>
                            <option value="pending">
                              {t("applications.payment_pending")}
                            </option>
                          </select>
                        </div>

                        <div className="filter-group">
                          <label className="filter-label">
                            {t("applications.filter_date_from")}
                          </label>
                          <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                dateFrom: e.target.value,
                              }))
                            }
                            className="filter-select"
                          />
                        </div>

                        <div className="filter-group">
                          <label className="filter-label">
                            {t("applications.filter_date_to")}
                          </label>
                          <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                dateTo: e.target.value,
                              }))
                            }
                            className="filter-select"
                          />
                        </div>

                        <div className="filter-actions">
                          <button
                            onClick={handleFilterApply}
                            className="primary-button"
                          >
                            {t("applications.apply")}
                          </button>
                          <button
                            onClick={handleFilterReset}
                            className="primary-button"
                          >
                            {t("applications.reset")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => setShowCreateModal(true)}
                    title={t("applications.add")}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="primary-button"
                    onClick={handleExportCSV}
                    title={t("applications.export_csv")}
                  >
                    <FileText size={14} />
                  </button>

                  <button
                    className="primary-button"
                    onClick={() => {
                      if (!applications.length) {
                        toast.error("No applications to export");
                        return;
                      }
                      setExportPDFApps(applications);
                      setShowExportPDFModal(true);
                    }}
                    title={t("applications.export_pdf")}
                  >
                    <File size={14} />
                  </button>

                  <div
                    className="view-toggle-section"
                    style={{ marginLeft: "auto" }}
                  >
                    <button
                      className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                      onClick={() => setViewMode("table")}
                      title={t("applications.view_table")}
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      className={`view-toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
                      onClick={() => setViewMode("calendar")}
                      title={t("applications.view_calendar")}
                    >
                      <Calendar size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Applications Table or Calendar */}
            <div className="table-container">
              {loading ? (
                <div className="calendar-loading">
                  <div className="loading-spinner" />
                </div>
              ) : viewMode === "calendar" ? (
                <CalendarView
                  onSelectApplication={handleRowClick}
                  selectedApplication={selectedApplication}
                />
              ) : (
                <div className="apps-list-table-wrapper">
                  <table className="apps-list-data-table">
                    <thead>
                      <tr className="apps-list-header-row">
                        <th
                          onClick={() => handleSort("applicationId")}
                          className="apps-list-header-cell apps-list-sortable-col"
                        >
                          <div className="apps-list-col-content">
                            <User size={16} className="apps-list-col-icon" />
                            <span className="apps-list-col-label">
                              {t("applications.table_appointments")}
                            </span>
                            <div className="apps-list-sort-indicator">
                              {sortConfig.key === "applicationId" ? (
                                sortConfig.direction === "asc" ? (
                                  <ArrowUp size={14} />
                                ) : (
                                  <ArrowDown size={14} />
                                )
                              ) : (
                                <ArrowUpDown
                                  size={14}
                                  className="apps-list-sort-inactive"
                                />
                              )}
                            </div>
                          </div>
                        </th>

                        <th className="apps-list-header-cell">
                          <div className="apps-list-col-content">
                            <User size={16} className="apps-list-col-icon" />
                            <span className="apps-list-col-label">
                              {t("applications.patients_details")}
                            </span>
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("doctorName")}
                          className="apps-list-header-cell apps-list-sortable-col"
                        >
                          <div className="apps-list-col-content">
                            <Calendar
                              size={16}
                              className="apps-list-col-icon"
                            />
                            <span className="apps-list-col-label">
                              {t("applications.table_consultation_details")}
                            </span>
                            <div className="apps-list-sort-indicator">
                              {sortConfig.key === "doctorName" ? (
                                sortConfig.direction === "asc" ? (
                                  <ArrowUp size={14} />
                                ) : (
                                  <ArrowDown size={14} />
                                )
                              ) : (
                                <ArrowUpDown
                                  size={14}
                                  className="apps-list-sort-inactive"
                                />
                              )}
                            </div>
                          </div>
                        </th>

                        <th className="apps-list-header-cell">
                          <div className="apps-list-col-content">
                            <FileText
                              size={16}
                              className="apps-list-col-icon"
                            />
                            <span className="apps-list-col-label">
                              {t("applications.table_documents")}
                            </span>
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("createdAt")}
                          className="apps-list-header-cell apps-list-sortable-col"
                        >
                          <div className="apps-list-col-content">
                            <CheckCircle
                              size={16}
                              className="apps-list-col-icon"
                            />
                            <span className="apps-list-col-label">
                              {t("applications.table_payment")}
                            </span>
                            <div className="apps-list-sort-indicator">
                              {sortConfig.key === "createdAt" ? (
                                sortConfig.direction === "asc" ? (
                                  <ArrowUp size={14} />
                                ) : (
                                  <ArrowDown size={14} />
                                )
                              ) : (
                                <ArrowUpDown
                                  size={14}
                                  className="apps-list-sort-inactive"
                                />
                              )}
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {applications.map((app) => {
                        const latestPayment = getLatestPayment(app.payments);

                        return (
                          <tr
                            key={app._id}
                            className={`table-row ${
                              selectedApplication?._id === app._id
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => handleRowClick(app)}
                          >
                            <td className="appointment-cell">
                              <div className="cell-content">
                                <div className="app-id-section">
                                  <span className="applicationId-text">
                                    #{app.applicationId || app._id}
                                  </span>
                                  <button
                                    className="row-pdf-btn"
                                    title={t("applications.export_pdf")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExportPDFApps([app]);
                                      setShowExportPDFModal(true);
                                    }}
                                  >
                                    <File size={12} />
                                  </button>
                                </div>

                                {getStatusBadge(app.appointmentStatus)}

                                <div className="datetime-info">
                                  <Calendar size={12} />
                                  <span className="datetime-text">
                                    {formatDateTime(
                                      app.date,
                                      app.startTime,
                                      app.endTime,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="consultation-cell">
                              <button
                                className="patient-name-link"
                                onClick={(e) =>
                                  handlePatientNameClick(app.patientId, e)
                                }
                              >
                                <User size={14} />
                                {app.patientName}
                              </button>
                              <div className="contact-actions">
                                <button
                                  className="contact-btn email-btn"
                                  onClick={(e) =>
                                    handleEmailClick("patient", app, e)
                                  }
                                  title="Send Email"
                                >
                                  <Mail size={14} />
                                </button>
                                {/* <button
                                  className="contact-btn whatsapp-btn"
                                  onClick={(e) =>
                                    handleWhatsAppClick("patient", app, e)
                                  }
                                  title="WhatsApp"
                                >
                                  <MessageCircle size={14} />
                                </button> */}
                                <button
                                  className="contact-btn phone-btn"
                                  title="Call"
                                >
                                  <Phone size={14} />
                                </button>
                                <button
                                  className="contact-btn telegram-btn"
                                  onClick={(e) =>
                                    handleTelegramClick("patient", app, e)
                                  }
                                  title="Telegram"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </td>

                            <td className="consultation-cell">
                              <div className="cell-content">
                                <button
                                  className="doctor-name-link"
                                  onClick={(e) =>
                                    handleDoctorNameClick(app.doctorId, e)
                                  }
                                >
                                  <User size={14} />
                                  {app.doctorName}
                                </button>
                                {/*
                                <div className="specialty-info">
                                  {app.specialty || t("applications.na")}
                                </div>
                                */}

                                <div className="appointment-mode-info">
                                  <span
                                    className={`mode-badge mode-${app.appointmentMode?.toLowerCase() || "offline"}`}
                                  >
                                    {t(
                                      `applications.mode_${app.appointmentMode?.toLowerCase() || "offline"}`,
                                    )}
                                  </span>
                                  {app.appointmentMode === "Online" &&
                                    app.meetingLink && (
                                      <button
                                        className="link-copy-btn"
                                        onClick={(e) =>
                                          copyMeetingLink(app.meetingLink, e)
                                        }
                                      >
                                        <Link size={12} />
                                      </button>
                                    )}
                                </div>

                                <div className="contact-actions">
                                  <button
                                    className="contact-btn email-btn"
                                    onClick={(e) =>
                                      handleEmailClick("doctor", app, e)
                                    }
                                    title="Send Email"
                                  >
                                    <Mail size={14} />
                                  </button>
                                  {/* <button
                                    className="contact-btn whatsapp-btn"
                                    onClick={(e) =>
                                      handleWhatsAppClick("doctor", app, e)
                                    }
                                    title="WhatsApp"
                                  >
                                    <MessageCircle size={14} />
                                  </button> */}
                                  <button
                                    className="contact-btn phone-btn"
                                    title="Call"
                                  >
                                    <Phone size={14} />
                                  </button>
                                  <button
                                    className="contact-btn telegram-btn"
                                    onClick={(e) =>
                                      handleTelegramClick("doctor", app, e)
                                    }
                                    title="Telegram"
                                  >
                                    <Send size={14} />
                                  </button>
                                </div>
                              </div>
                            </td>

                            <td className="documents-cell">
                              <div className="cell-content">
                                <div className="document-icons">
                                  {(app.documents || []).map((doc) => (
                                    <div
                                      key={doc._id || doc.filename}
                                      className="document-icon-wrapper"
                                      title={
                                        doc.filename ||
                                        t("applications.unnamed_document")
                                      }
                                    >
                                      <button
                                        className="document-icon-btn"
                                        onClick={(e) => previewDocument(doc, e)}
                                      >
                                        <FileText size={18} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="add-doc-icon-btn"
                                    onClick={(e) =>
                                      handleAddDocument(app.applicationId, e)
                                    }
                                    title="Add Document"
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>
                              </div>
                            </td>

                            <td className="payment-cell">
                              <div className="cell-content">
                                <button
                                  className="primary-button-light"
                                  onClick={(e) => handleAddInvoice(app, e)}
                                >
                                  <Plus size={14} />
                                  {t("applications.add_invoice")}
                                </button>

                                <div className="document-actions">
                                  <button
                                    className={`primary-button-light ${
                                      hasPendingOrPaidPayment(app)
                                        ? "enabled"
                                        : "disabled"
                                    }`}
                                    onClick={(e) => {
                                      e?.stopPropagation();
                                      latestPayment &&
                                        handleViewContract(app, latestPayment);
                                    }}
                                    disabled={!hasPendingOrPaidPayment(app)}
                                  >
                                    <FileText size={14} />
                                    {t("applications.contract")}
                                  </button>

                                  <button
                                    className={`primary-button-light ${
                                      hasPaidPayment(app)
                                        ? "enabled"
                                        : "disabled"
                                    }`}
                                    onClick={(e) => {
                                      e?.stopPropagation();
                                      latestPayment &&
                                        handleViewAkt(app, latestPayment);
                                    }}
                                    disabled={!hasPaidPayment(app)}
                                  >
                                    <File size={14} />
                                    {t("applications.akt")}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading &&
                applications.length === 0 &&
                viewMode !== "calendar" && (
                  <div className="empty--state">
                    <File size={48} className="empty-icon" />
                    <h3>{t("applications.no_applications")}</h3>
                    <p>{t("applications.no_matching_applications")}</p>
                    <button
                      className="primary-button"
                      onClick={() =>
                        navigate("/applications/add", {
                          state: {
                            currentPage,
                            scrollPosition: window.scrollY,
                          },
                        })
                      }
                    >
                      <Plus size={16} />
                      {t("applications.add")}
                    </button>
                  </div>
                )}

              {applications.length > 0 && hasMore && (
                <div ref={lastElementRef} className="load-more-sentinel">
                  {loadMoreLoading && (
                    <div className="load-more-spinner">
                      <div className="spinner-dot"></div>
                      <div className="spinner-dot"></div>
                      <div className="spinner-dot"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Application Details Panel */}
          {!isMobile && selectedApplication && (
            <div className="application-details-panel">
              <ApplicationDetail
                id={selectedApplication.applicationId}
                onClose={handleCloseDetails}
                onUpdate={fetchApplications}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals and Popups */}
      {showDocumentPopup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{t("applications.add_document")}</h2>
              <button
                className="close-button"
                onClick={() => setShowDocumentPopup(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="input-type-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="file"
                    checked={documentInput.type === "file"}
                    onChange={() =>
                      setDocumentInput({
                        ...documentInput,
                        type: "file",
                        url: "",
                        filename: "",
                      })
                    }
                  />
                  <span>{t("applications.upload_file")}</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    value="url"
                    checked={documentInput.type === "url"}
                    onChange={() =>
                      setDocumentInput({
                        ...documentInput,
                        type: "url",
                        file: null,
                      })
                    }
                  />
                  <span>{t("applications.cloud_link")}</span>
                </label>
              </div>

              {documentInput.type === "file" ? (
                <div className="file-input-section">
                  <input
                    type="file"
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        file: e.target.files[0],
                      })
                    }
                    className="app-file-input"
                  />
                </div>
              ) : (
                <div className="url-input-section">
                  <input
                    type="text"
                    value={documentInput.url}
                    onChange={(e) =>
                      setDocumentInput({
                        ...documentInput,
                        url: e.target.value,
                      })
                    }
                    placeholder={t("applications.document_url_placeholder")}
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
                    placeholder={t("applications.document_name_placeholder")}
                    className="text-input"
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={handleDocumentSubmit} className="submit-button">
                {t("applications.submit")}
              </button>
              <button
                onClick={() => setShowDocumentPopup(false)}
                className="cancel-button"
              >
                {t("applications.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailPopup && (
        <div className="modal-overlay">
          <div className="modal-content email-modal">
            <div className="modal-header">
              <h2>{t("applications.new_email")}</h2>
              <button
                className="close-button"
                onClick={() => setShowEmailPopup(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t("applications.to")}:</label>
                <input
                  type="text"
                  value={emailRecipient}
                  readOnly
                  className="text-input readonly"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {t("applications.subject")}:
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t("applications.email_subject_placeholder")}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t("applications.body")}:</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={t("applications.email_body_placeholder")}
                  className="textarea-input"
                  rows={6}
                />
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="modal-footer">
              <button
                onClick={handleSendEmail}
                disabled={loading}
                className="submit-button"
              >
                {loading
                  ? t("applications.sending")
                  : t("applications.send_email")}
              </button>
              <button
                onClick={() => setShowEmailPopup(false)}
                className="cancel-button"
              >
                {t("applications.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && invoiceApplication && (
        <AddPaymentModal
          application={invoiceApplication}
          onClose={() => {
            setShowInvoiceModal(false);
            setInvoiceApplication(null);
          }}
          onCreated={handleInvoiceSuccess}
        />
      )}

      {isAktOpen && (
        <div className="document-modal-overlay">
          <AktDocument
            data={aktData}
            isOpen={isAktOpen}
            onClose={() => setIsAktOpen(false)}
          />
        </div>
      )}

      {isContractOpen && (
        <div className="document-modal-overlay">
          <ContractDocument
            data={contractData}
            isOpen={isContractOpen}
            onClose={() => setIsContractOpen(false)}
          />
        </div>
      )}

      {/* {showWhatsAppChat && (
        <WhatsAppChatBot
          isOpen={showWhatsAppChat}
          onClose={() => {
            setShowWhatsAppChat(false);
            setChatApplicationId(null);
          }}
          phoneNumber={chatPhoneNumber}
          profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_WHATSAPP}
        />
      )} */}

      {showTelegramChat && (
        <TelegramChatBot
          isOpen={showTelegramChat}
          onClose={() => {
            setShowTelegramChat(false);
            setChatApplicationId(null);
          }}
          phoneNumber={chatPhoneNumber}
          profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_TELEGRAM}
        />
      )}

      {showCreateModal && (
        <CreateAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          doctorEmail=""
          date={new Date().toISOString().split("T")[0]}
          startTime={(() => {
            const d = new Date();
            d.setMinutes(0, 0, 0);
            return d.toISOString();
          })()}
          endTime={(() => {
            const d = new Date();
            d.setMinutes(0, 0, 0);
            d.setHours(d.getHours() + 1);
            return d.toISOString();
          })()}
          onSuccess={async (newApp) => {
            setShowCreateModal(false);
            await fetchApplications(true);
            if (newApp) {
              const appId = newApp.applicationId || newApp._id;
              navigate(
                `/applications/appointment/${encodeURIComponent(appId)}?tab=general`,
              );
            }
          }}
        />
      )}

      {showExportPDFModal && (
        <ExportPDFModal
          applications={exportPDFApps || applications}
          onClose={() => {
            setShowExportPDFModal(false);
            setExportPDFApps(null);
          }}
        />
      )}
    </div>
  );
};

export default ApplicationsList;
