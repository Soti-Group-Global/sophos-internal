import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Download,
  Eye,
  Search,
  Filter,
  Mail,
  Phone,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  PhoneCall,
  UserX,
  ShieldAlert,
} from "lucide-react";
import {
  getApplicationsByVacancy,
  updateApplicationStatus,
  getVacancies,
  downloadResume,


  getContactRequestsByVacancy,
  updateContactRequest,
  deleteContactRequest,
} from "../utils/api";
import "../styles/JobPostsApplicationsManagement.css";
import LoadingComponent from "../components/Loading/LoadingComponent";

const JobPostsApplicationsManagement = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [contactRequests, setContactRequests] = useState([]);
  const [vacancy, setVacancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contactLoading, setContactLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contactStatusFilter, setContactStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isContactDetailModalOpen, setIsContactDetailModalOpen] =
    useState(false);
  const [isContactStatusModalOpen, setIsContactStatusModalOpen] =
    useState(false);
  const [activeTab, setActiveTab] = useState("applications"); // "applications" or "contacts"
  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "",
    internalNotes: "",
  });
  const [contactStatusUpdateData, setContactStatusUpdateData] = useState({
    status: "",
    notes: "",
  });
  const [expandedApplication, setExpandedApplication] = useState(null);
  const [expandedContact, setExpandedContact] = useState(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState(null);

  // Application status options
  const statusOptions = [
    {
      value: "pending",
      label: t("jobApplications.status_pending"),
      icon: Clock,
      color: "warning",
    },
    {
      value: "reviewed",
      label: t("jobApplications.status_reviewed"),
      icon: Eye,
      color: "info",
    },
    {
      value: "shortlisted",
      label: t("jobApplications.status_shortlisted"),
      icon: UserCheck,
      color: "primary",
    },
    {
      value: "rejected",
      label: t("jobApplications.status_rejected"),
      icon: XCircle,
      color: "danger",
    },
    {
      value: "hired",
      label: t("jobApplications.status_hired"),
      icon: CheckCircle,
      color: "success",
    },
  ];

  // Contact request status options
  const contactStatusOptions = [
    {
      value: "pending",
      label: t("contacts.status_pending"),
      icon: Clock,
      color: "warning",
    },
    {
      value: "contacted",
      label: t("contacts.status_contacted"),
      icon: PhoneCall,
      color: "info",
    },
    {
      value: "resolved",
      label: t("contacts.status_resolved"),
      icon: CheckCircle,
      color: "success",
    },
    {
      value: "spam",
      label: t("contacts.status_spam"),
      icon: ShieldAlert,
      color: "danger",
    },
  ];

  useEffect(() => {
    fetchApplications();
    fetchContactRequests();
    fetchVacancyDetails();
  }, [id]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await getApplicationsByVacancy(id);
      setApplications(response.data || response);
    } catch (error) {
      toast.error(t("jobApplications.error_fetch"));
    } finally {
      setLoading(false);
    }
  };

// In JobPostsApplicationsManagement.jsx
const fetchContactRequests = async () => {
  try {
    setContactLoading(true);
    
    // Simple call - just pass the vacancy ID
    const response = await getContactRequestsByVacancy(id);
    
    // Handle response - assuming response.data.contactRequests contains the array
    let contactList = [];
    if (response.data && response.data.contactRequests) {
      contactList = response.data.contactRequests;
    } else if (Array.isArray(response.data)) {
      contactList = response.data;
    } else if (Array.isArray(response)) {
      contactList = response;
    }
    
    setContactRequests(contactList);
  } catch (error) {
    toast.error(t("contacts.error_fetch"));
  } finally {
    setContactLoading(false);
  }
};

  const fetchVacancyDetails = async () => {
    try {
      const vacancies = await getVacancies();
      const currentVacancy = vacancies.data.find((v) => v._id === id);
      setVacancy(currentVacancy);
    } catch (error) {
    }
  };

  const filteredApplications = applications.filter((application) => {
    const matchesSearch =
      application.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${application.firstName} ${application.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || application.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredContacts = contactRequests.filter((contact) => {
    const matchesSearch =
      contact.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.vacancyTitle?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      contactStatusFilter === "all" || contact.status === contactStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleApplicationStatusUpdate = async () => {
    try {
      await updateApplicationStatus(selectedApplication._id, statusUpdateData);
      toast.success(t("jobApplications.status_update_success"));
      setIsStatusModalOpen(false);
      setSelectedApplication(null);
      setStatusUpdateData({ status: "", internalNotes: "" });
      fetchApplications();
    } catch (error) {
      toast.error(t("jobApplications.status_update_error"));
    }
  };

  const handleContactStatusUpdate = async () => {
    try {
      await updateContactRequest(selectedContact._id, contactStatusUpdateData);
      toast.success(t("contacts.status_update_success"));
      setIsContactStatusModalOpen(false);
      setSelectedContact(null);
      setContactStatusUpdateData({ status: "", notes: "" });
      fetchContactRequests();
    } catch (error) {
      toast.error(t("contacts.status_update_error"));
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (window.confirm(t("contacts.confirm_delete"))) {
      try {
        await deleteContactRequest(contactId);
        toast.success(t("contacts.delete_success"));
        fetchContactRequests();
      } catch (error) {
        toast.error(t("contacts.delete_error"));
      }
    }
  };

  const openApplicationStatusModal = (application) => {
    setSelectedApplication(application);
    setStatusUpdateData({
      status: application.status,
      internalNotes: application.internalNotes || "",
    });
    setIsStatusModalOpen(true);
  };

  const openContactStatusModal = (contact) => {
    setSelectedContact(contact);
    setContactStatusUpdateData({
      status: contact.status,
      notes: contact.notes || "",
    });
    setIsContactStatusModalOpen(true);
  };

  const openApplicationDetailModal = (application) => {
    setSelectedApplication(application);
    setIsDetailModalOpen(true);
  };

  const openContactDetailModal = (contact) => {
    setSelectedContact(contact);
    setIsContactDetailModalOpen(true);
  };

  const handleDownloadResume = async (application) => {
    if (downloadingResumeId === application._id) {
      return;
    }

    try {
      setDownloadingResumeId(application._id);

      if (!application || !application.resume || !application.resume.fileId) {
        toast.error(t("jobApplications.no_resume_available"));
        return;
      }

      const blobData = await downloadResume(application.resume.fileId);

      if (!blobData || blobData.size === 0) {
        throw new Error("Empty file received from server");
      }

      const originalFilename =
        application.resume.filename ||
        `${application.firstName}_${application.lastName}_resume`;

      let filename;
      if (application.resume.filename) {
        filename = application.resume.filename;
      } else {
        const extension =
          blobData.type === "application/pdf"
            ? "pdf"
            : blobData.type.includes("word")
            ? "docx"
            : blobData.type.includes("sheet")
            ? "xlsx"
            : "pdf";
        filename = `${application.firstName}_${application.lastName}_resume.${extension}`;
      }

      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success(t("jobApplications.download_success"));
    } catch (error) {
      toast.error(t("jobApplications.download_error"));
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const getApplicationStatusIcon = (status) => {
    const statusConfig = statusOptions.find((opt) => opt.value === status);
    const IconComponent = statusConfig?.icon || Clock;
    return <IconComponent size={16} />;
  };

  const getContactStatusIcon = (status) => {
    const statusConfig = contactStatusOptions.find(
      (opt) => opt.value === status
    );
    const IconComponent = statusConfig?.icon || Clock;
    return <IconComponent size={16} />;
  };

  const getApplicationStatusClass = (status) => {
    const statusConfig = statusOptions.find((opt) => opt.value === status);
    return `hd-application-status hd-application-status-${
      statusConfig?.color || "warning"
    }`;
  };

  const getContactStatusClass = (status) => {
    const statusConfig = contactStatusOptions.find(
      (opt) => opt.value === status
    );
    return `hd-contact-status hd-contact-status-${
      statusConfig?.color || "warning"
    }`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleApplicationExpand = (applicationId) => {
    setExpandedApplication(
      expandedApplication === applicationId ? null : applicationId
    );
  };

  const toggleContactExpand = (contactId) => {
    setExpandedContact(expandedContact === contactId ? null : contactId);
  };

  const getApplicationsCountByStatus = (status) => {
    return applications.filter((app) => app.status === status).length;
  };

  const getContactsCountByStatus = (status) => {
    return contactRequests.filter((contact) => contact.status === status)
      .length;
  };

  const formatPhoneNumber = (phone) => {
    // Format phone number for display
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `+${cleaned[0]} (${cleaned.substring(1, 4)}) ${cleaned.substring(
        4,
        7
      )}-${cleaned.substring(7)}`;
    }
    return phone;
  };

  if (loading && activeTab === "applications") {
    return <LoadingComponent message={t("jobApplications.loading")} />;
  }

  if (contactLoading && activeTab === "contacts") {
    return <LoadingComponent message={t("contacts.loading")} />;
  }

  return (
    <div className="hd-applications-management">
      {/* Header */}
      <div className="hd-applications-header">
        <div className="hd-applications-header-content">
          <button
            className="hd-applications-back-btn"
            onClick={() => navigate("/vacancies")}
          >
            <ArrowLeft size={20} />
            {t("jobApplications.back_to_jobs")}
          </button>

          <div className="hd-applications-title-section">
            <h1 className="hd-applications-title">
              {vacancy?.title || t("jobApplications.applications")}
            </h1>
            <p className="hd-applications-subtitle">
              {activeTab === "applications"
                ? t("jobApplications.total_applications", {
                    count: applications.length,
                  })
                : t("contacts.total_contacts", {
                    count: contactRequests.length,
                  })}
              {vacancy?.department && ` • ${vacancy.department}`}
              {vacancy?.location && ` • ${vacancy.location}`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="hd-applications-tabs">
          <button
            className={`hd-applications-tab ${
              activeTab === "applications" ? "hd-applications-tab-active" : ""
            }`}
            onClick={() => setActiveTab("applications")}
          >
            <FileText size={18} />
            <span>{t("jobApplications.applications")}</span>
            <span className="hd-applications-tab-count">
              {applications.length}
            </span>
          </button>
          <button
            className={`hd-applications-tab ${
              activeTab === "contacts" ? "hd-applications-tab-active" : ""
            }`}
            onClick={() => setActiveTab("contacts")}
          >
            <MessageSquare size={18} />
            <span>{t("contacts.contact_requests")}</span>
            <span className="hd-applications-tab-count">
              {contactRequests.length}
            </span>
          </button>
        </div>

        {/* Status Overview */}
        {activeTab === "applications" ? (
          <div className="hd-applications-stats">
            {statusOptions.map((status) => (
              <div key={status.value} className="hd-application-stat">
                <div
                  className={`hd-application-stat-icon hd-application-stat-${status.color}`}
                >
                  {getApplicationStatusIcon(status.value)}
                </div>
                <div className="hd-application-stat-content">
                  <span className="hd-application-stat-count">
                    {getApplicationsCountByStatus(status.value)}
                  </span>
                  <span className="hd-application-stat-label">
                    {status.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="hd-applications-stats">
            {contactStatusOptions.map((status) => (
              <div key={status.value} className="hd-application-stat">
                <div
                  className={`hd-application-stat-icon hd-application-stat-${status.color}`}
                >
                  {getContactStatusIcon(status.value)}
                </div>
                <div className="hd-application-stat-content">
                  <span className="hd-application-stat-count">
                    {getContactsCountByStatus(status.value)}
                  </span>
                  <span className="hd-application-stat-label">
                    {status.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="hd-applications-filters">
        <div className="hd-applications-search">
          <Search size={20} className="hd-applications-search-icon" />
          <input
            type="text"
            placeholder={
              activeTab === "applications"
                ? t("jobApplications.search_placeholder")
                : t("contacts.search_placeholder")
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="hd-applications-search-input"
          />
        </div>

        <div className="hd-applications-filter-group">
          <Filter size={16} />
          <select
            value={
              activeTab === "applications" ? statusFilter : contactStatusFilter
            }
            onChange={(e) => {
              if (activeTab === "applications") {
                setStatusFilter(e.target.value);
              } else {
                setContactStatusFilter(e.target.value);
              }
            }}
            className="hd-applications-filter-select"
          >
            <option value="all">
              {activeTab === "applications"
                ? t("jobApplications.all_statuses")
                : t("contacts.all_statuses")}
            </option>
            {(activeTab === "applications"
              ? statusOptions
              : contactStatusOptions
            ).map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications List */}
      {activeTab === "applications" ? (
        <div className="hd-applications-list">
          {filteredApplications.length === 0 ? (
            <div className="hd-applications-empty">
              <FileText size={64} className="hd-applications-empty-icon" />
              <h3 className="hd-applications-empty-title">
                {t("jobApplications.no_applications")}
              </h3>
              <p className="hd-applications-empty-description">
                {searchTerm || statusFilter !== "all"
                  ? t("jobApplications.no_matching_applications")
                  : t("jobApplications.no_applications_description")}
              </p>
            </div>
          ) : (
            filteredApplications.map((application) => (
              <div key={application._id} className="hd-application-card">
                <div className="hd-application-card-header">
                  <div className="hd-application-info">
                    <div className="hd-application-avatar">
                      {application.firstName?.[0]}
                      {application.lastName?.[0]}
                    </div>
                    <div className="hd-application-details">
                      <h3 className="hd-application-name">
                        {application.firstName} {application.middleName}{" "}
                        {application.lastName}
                      </h3>
                      <div className="hd-application-contacts">
                        <div className="hd-application-contact">
                          <Mail size={14} />
                          <span>{application.email}</span>
                        </div>
                        <div className="hd-application-contact">
                          <Phone size={14} />
                          <span>{application.phoneNumber}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hd-application-actions">
                    <div
                      className={getApplicationStatusClass(application.status)}
                    >
                      {getApplicationStatusIcon(application.status)}
                      <span>
                        {
                          statusOptions.find(
                            (s) => s.value === application.status
                          )?.label
                        }
                      </span>
                    </div>

                    <div className="hd-application-action-buttons">
                      <button
                        className="hd-application-action-btn hd-application-action-view"
                        onClick={() => openApplicationDetailModal(application)}
                        title={t("jobApplications.view_details")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className={`hd-application-action-btn hd-application-action-download ${
                          downloadingResumeId === application._id
                            ? "hd-application-action-loading"
                            : ""
                        }`}
                        onClick={() => handleDownloadResume(application)}
                        disabled={downloadingResumeId === application._id}
                        title={
                          downloadingResumeId === application._id
                            ? t("jobApplications.downloading")
                            : t("jobApplications.download_resume")
                        }
                      >
                        {downloadingResumeId === application._id ? (
                          <div className="hd-download-spinner"></div>
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                      <button
                        className="hd-application-action-btn hd-application-action-more"
                        onClick={() => toggleApplicationExpand(application._id)}
                        title={t("jobApplications.more_actions")}
                      >
                        {expandedApplication === application._id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Actions */}
                {expandedApplication === application._id && (
                  <div className="hd-application-expanded-actions">
                    <button
                      className="hd-application-expanded-btn hd-application-expanded-status"
                      onClick={() => openApplicationStatusModal(application)}
                    >
                      <UserCheck size={16} />
                      <span>{t("jobApplications.update_status")}</span>
                    </button>
                    <button
                      className="hd-application-expanded-btn hd-application-expanded-contact"
                      onClick={() => window.open(`mailto:${application.email}`)}
                    >
                      <Mail size={16} />
                      <span>{t("jobApplications.send_email")}</span>
                    </button>
                    <button
                      className="hd-application-expanded-btn hd-application-expanded-call"
                      onClick={() =>
                        window.open(`tel:${application.phoneNumber}`)
                      }
                    >
                      <Phone size={16} />
                      <span>{t("jobApplications.call")}</span>
                    </button>
                  </div>
                )}

                {/* Application Meta */}
                <div className="hd-application-meta">
                  <div className="hd-application-meta-item">
                    <Calendar size={14} />
                    <span>
                      {t("jobApplications.applied_on")}{" "}
                      {formatDate(application.submittedAt)}
                    </span>
                  </div>
                  {application.internalNotes && (
                    <div className="hd-application-meta-item">
                      <FileText size={14} />
                      <span className="hd-application-notes-preview">
                        {application.internalNotes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Contact Requests List */
        <div className="hd-applications-list">
          {filteredContacts.length === 0 ? (
            <div className="hd-applications-empty">
              <MessageSquare size={64} className="hd-applications-empty-icon" />
              <h3 className="hd-applications-empty-title">
                {t("contacts.no_contacts")}
              </h3>
              <p className="hd-applications-empty-description">
                {searchTerm || contactStatusFilter !== "all"
                  ? t("contacts.no_matching_contacts")
                  : t("contacts.no_contacts_description")}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div key={contact._id} className="hd-contact-card">
                <div className="hd-contact-card-header">
                  <div className="hd-contact-info">
                    <div className="hd-contact-avatar">
                      <PhoneCall size={20} />
                    </div>
                    <div className="hd-contact-details">
                      <h3 className="hd-contact-name">
                        {formatPhoneNumber(contact.phoneNumber)}
                      </h3>
                      <div className="hd-contact-meta">
                        <div className="hd-contact-meta-item">
                          <FileText size={12} />
                          <span>{contact.vacancyTitle}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hd-contact-actions">
                    <div className={getContactStatusClass(contact.status)}>
                      {getContactStatusIcon(contact.status)}
                      <span>
                        {
                          contactStatusOptions.find(
                            (s) => s.value === contact.status
                          )?.label
                        }
                      </span>
                    </div>

                    <div className="hd-contact-action-buttons">
                      <button
                        className="hd-contact-action-btn hd-contact-action-view"
                        onClick={() => openContactDetailModal(contact)}
                        title={t("contacts.view_details")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="hd-contact-action-btn hd-contact-action-call"
                        onClick={() =>
                          window.open(`tel:${contact.phoneNumber}`)
                        }
                        title={t("contacts.call")}
                      >
                        <Phone size={16} />
                      </button>
                      <button
                        className="hd-contact-action-btn hd-contact-action-more"
                        onClick={() => toggleContactExpand(contact._id)}
                        title={t("contacts.more_actions")}
                      >
                        {expandedContact === contact._id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Actions */}
                {expandedContact === contact._id && (
                  <div className="hd-contact-expanded-actions">
                    <button
                      className="hd-contact-expanded-btn hd-contact-expanded-status"
                      onClick={() => openContactStatusModal(contact)}
                    >
                      <UserCheck size={16} />
                      <span>{t("contacts.update_status")}</span>
                    </button>
                    <button
                      className="hd-contact-expanded-btn hd-contact-expanded-delete"
                      onClick={() => handleDeleteContact(contact._id)}
                    >
                      <UserX size={16} />
                      <span>{t("contacts.delete")}</span>
                    </button>
                  </div>
                )}

                {/* Contact Meta */}
                <div className="hd-contact-meta">
                  <div className="hd-contact-meta-item">
                    <Calendar size={14} />
                    <span>
                      {t("contacts.submitted_on")}{" "}
                      {formatDate(contact.createdAt)}
                    </span>
                  </div>
                  {contact.notes && (
                    <div className="hd-contact-meta-item">
                      <FileText size={14} />
                      <span className="hd-contact-notes-preview">
                        {contact.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Application Detail Modal */}
      {isDetailModalOpen && selectedApplication && (
        <div className="hd-application-modal-overlay">
          <div className="hd-application-modal-content">
            <div className="hd-application-modal-header">
              <h2 className="hd-application-modal-title">
                {t("jobApplications.application_details")}
              </h2>
              <button
                className="hd-application-modal-close"
                onClick={() => setIsDetailModalOpen(false)}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="hd-application-modal-body">
              <div className="hd-application-detail-section">
                <h3 className="hd-application-detail-section-title">
                  {t("jobApplications.personal_info")}
                </h3>
                <div className="hd-application-detail-grid">
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.first_name")}</label>
                    <p>{selectedApplication.firstName}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.middle_name")}</label>
                    <p>{selectedApplication.middleName || "-"}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.last_name")}</label>
                    <p>{selectedApplication.lastName}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.email")}</label>
                    <p>{selectedApplication.email}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.phone_number")}</label>
                    <p>{selectedApplication.phoneNumber}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.status")}</label>
                    <div className={getApplicationStatusClass(selectedApplication.status)}>
                      {getApplicationStatusIcon(selectedApplication.status)}
                      <span>
                        {statusOptions.find(s => s.value === selectedApplication.status)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedApplication.internalNotes && (
                <div className="hd-application-detail-section">
                  <h3 className="hd-application-detail-section-title">
                    {t("jobApplications.internal_notes")}
                  </h3>
                  <div className="hd-application-notes">
                    {selectedApplication.internalNotes}
                  </div>
                </div>
              )}

              <div className="hd-application-detail-section">
                <h3 className="hd-application-detail-section-title">
                  {t("jobApplications.application_info")}
                </h3>
                <div className="hd-application-detail-grid">
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.applied_on")}</label>
                    <p>{formatDate(selectedApplication.submittedAt)}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("jobApplications.resume")}</label>
                    <button
                      className="hd-application-detail-download-btn"
                      onClick={() => handleDownloadResume(selectedApplication)}
                      disabled={downloadingResumeId === selectedApplication._id}
                    >
                      {downloadingResumeId === selectedApplication._id ? (
                        <div className="hd-download-spinner"></div>
                      ) : (
                        <Download size={16} />
                      )}
                      <span>
                        {downloadingResumeId === selectedApplication._id
                          ? t("jobApplications.downloading")
                          : t("jobApplications.download_resume")}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="hd-application-modal-actions">
              <button
                className="hd-application-modal-btn hd-application-modal-secondary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                {t("jobApplications.close")}
              </button>
              <button
                className="hd-application-modal-btn hd-application-modal-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  openApplicationStatusModal(selectedApplication);
                }}
              >
                <UserCheck size={16} />
                {t("jobApplications.update_status")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Status Update Modal */}
      {isStatusModalOpen && selectedApplication && (
        <div className="hd-application-modal-overlay">
          <div className="hd-application-modal-content">
            <div className="hd-application-modal-header">
              <h2 className="hd-application-modal-title">
                {t("jobApplications.update_status")}
              </h2>
              <button
                className="hd-application-modal-close"
                onClick={() => setIsStatusModalOpen(false)}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="hd-application-modal-body">
              <div className="hd-application-status-form">
                <div className="hd-application-form-group">
                  <label className="hd-application-form-label">
                    {t("jobApplications.status")}
                  </label>
                  <select
                    value={statusUpdateData.status}
                    onChange={(e) =>
                      setStatusUpdateData((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="hd-application-form-select"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hd-application-form-group">
                  <label className="hd-application-form-label">
                    {t("jobApplications.internal_notes")}
                  </label>
                  <textarea
                    value={statusUpdateData.internalNotes}
                    onChange={(e) =>
                      setStatusUpdateData((prev) => ({
                        ...prev,
                        internalNotes: e.target.value,
                      }))
                    }
                    className="hd-application-form-textarea"
                    placeholder={t("jobApplications.notes_placeholder")}
                    rows="4"
                  />
                </div>
              </div>
            </div>

            <div className="hd-application-modal-actions">
              <button
                className="hd-application-modal-btn hd-application-modal-secondary"
                onClick={() => setIsStatusModalOpen(false)}
              >
                {t("jobApplications.cancel")}
              </button>
              <button
                className="hd-application-modal-btn hd-application-modal-primary"
                onClick={handleApplicationStatusUpdate}
              >
                <CheckCircle size={16} />
                {t("jobApplications.update_status")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {isContactDetailModalOpen && selectedContact && (
        <div className="hd-application-modal-overlay">
          <div className="hd-application-modal-content">
            <div className="hd-application-modal-header">
              <h2 className="hd-application-modal-title">
                {t("contacts.contact_details")}
              </h2>
              <button
                className="hd-application-modal-close"
                onClick={() => setIsContactDetailModalOpen(false)}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="hd-application-modal-body">
              <div className="hd-application-detail-section">
                <h3 className="hd-application-detail-section-title">
                  {t("contacts.contact_info")}
                </h3>
                <div className="hd-application-detail-grid">
                  <div className="hd-application-detail-field">
                    <label>{t("contacts.phone_number")}</label>
                    <p>{formatPhoneNumber(selectedContact.phoneNumber)}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("contacts.vacancy_title")}</label>
                    <p>{selectedContact.vacancyTitle}</p>
                  </div>
                  <div className="hd-application-detail-field">
                    <label>{t("contacts.status")}</label>
                    <div
                      className={getContactStatusClass(selectedContact.status)}
                    >
                      {getContactStatusIcon(selectedContact.status)}
                      <span>
                        {
                          contactStatusOptions.find(
                            (s) => s.value === selectedContact.status
                          )?.label
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedContact.notes && (
                <div className="hd-application-detail-section">
                  <h3 className="hd-application-detail-section-title">
                    {t("contacts.notes")}
                  </h3>
                  <div className="hd-application-notes">
                    {selectedContact.notes}
                  </div>
                </div>
              )}

              <div className="hd-application-detail-section">
                <h3 className="hd-application-detail-section-title">
                  {t("contacts.submission_info")}
                </h3>
                <div className="hd-application-detail-grid">
                  <div className="hd-application-detail-field">
                    <label>{t("contacts.submitted_on")}</label>
                    <p>{formatDate(selectedContact.createdAt)}</p>
                  </div>
                  {selectedContact.updatedAt && (
                    <div className="hd-application-detail-field">
                      <label>{t("contacts.last_updated")}</label>
                      <p>{formatDate(selectedContact.updatedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="hd-application-modal-actions">
              <button
                className="hd-application-modal-btn hd-application-modal-secondary"
                onClick={() => setIsContactDetailModalOpen(false)}
              >
                {t("contacts.close")}
              </button>
              <button
                className="hd-application-modal-btn hd-application-modal-call"
                onClick={() =>
                  window.open(`tel:${selectedContact.phoneNumber}`)
                }
              >
                <Phone size={16} />
                {t("contacts.call_now")}
              </button>
              <button
                className="hd-application-modal-btn hd-application-modal-primary"
                onClick={() => {
                  setIsContactDetailModalOpen(false);
                  openContactStatusModal(selectedContact);
                }}
              >
                <UserCheck size={16} />
                {t("contacts.update_status")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Status Update Modal */}
      {isContactStatusModalOpen && selectedContact && (
        <div className="hd-application-modal-overlay">
          <div className="hd-application-modal-content">
            <div className="hd-application-modal-header">
              <h2 className="hd-application-modal-title">
                {t("contacts.update_status")}
              </h2>
              <button
                className="hd-application-modal-close"
                onClick={() => setIsContactStatusModalOpen(false)}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="hd-application-modal-body">
              <div className="hd-application-status-form">
                <div className="hd-application-form-group">
                  <label className="hd-application-form-label">
                    {t("contacts.status")}
                  </label>
                  <select
                    value={contactStatusUpdateData.status}
                    onChange={(e) =>
                      setContactStatusUpdateData((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="hd-application-form-select"
                  >
                    {contactStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hd-application-form-group">
                  <label className="hd-application-form-label">
                    {t("contacts.notes")}
                  </label>
                  <textarea
                    value={contactStatusUpdateData.notes}
                    onChange={(e) =>
                      setContactStatusUpdateData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="hd-application-form-textarea"
                    placeholder={t("contacts.notes_placeholder")}
                    rows="4"
                  />
                </div>
              </div>
            </div>

            <div className="hd-application-modal-actions">
              <button
                className="hd-application-modal-btn hd-application-modal-secondary"
                onClick={() => setIsContactStatusModalOpen(false)}
              >
                {t("contacts.cancel")}
              </button>
              <button
                className="hd-application-modal-btn hd-application-modal-primary"
                onClick={handleContactStatusUpdate}
              >
                <CheckCircle size={16} />
                {t("contacts.update_status")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPostsApplicationsManagement;
