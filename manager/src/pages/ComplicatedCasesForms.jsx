import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "../styles/ComplicatedCasesForms.css";
import {
  getComplicatedCasesForms,
  updateComplicatedCasesForm,
  deleteComplicatedCasesForm,
  getComplicatedCasesFile,
} from "../utils/api";
import { Mail, MessageCircle, Send, FileText, Download, Trash2 } from "lucide-react";

// Import the communication components
import EmailModal from "../components/Communications/EmailModal";
import WhatsAppChatBot from "./WhatsAppChatBot";
import TelegramChatBot from "./TelegramChatBot";
import MaxChatBot from "../components/Communications/MaxChatBot";

const ComplicatedCasesForms = () => {
  const { t } = useTranslation();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Communication states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailContact, setEmailContact] = useState(null);

  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [showTelegramChat, setShowTelegramChat] = useState(false);
  const [showMaxChat, setShowMaxChat] = useState(false);

  const [chatPhoneNumber, setChatPhoneNumber] = useState("");
  const [chatContactId, setChatContactId] = useState(null);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await getComplicatedCasesForms();
      if (response.success && Array.isArray(response.data)) {
        setForms(response.data);
      } else {
        setForms([]);
      }
    } catch (error) {
      setError(error.response?.data?.message || error.message);
      toast.error(t("complicatedCases.messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Filter forms based on search term
  const filteredForms = useMemo(() => {
    if (!searchTerm) return forms;

    const lowercasedSearch = searchTerm.toLowerCase();
    return forms.filter(
      (form) =>
        form.firstName?.toLowerCase().includes(lowercasedSearch) ||
        form.middleName?.toLowerCase().includes(lowercasedSearch) ||
        form.lastName?.toLowerCase().includes(lowercasedSearch) ||
        form.email?.toLowerCase().includes(lowercasedSearch) ||
        form.phone?.toLowerCase().includes(lowercasedSearch) ||
        form.city?.toLowerCase().includes(lowercasedSearch) ||
        `${form.firstName || ""} ${form.middleName || ""} ${form.lastName || ""}`
          .toLowerCase()
          .includes(lowercasedSearch)
    );
  }, [forms, searchTerm]);

  // Communication handlers
  const handleEmailClick = (form, e) => {
    e?.stopPropagation();
    if (!form.email) {
      toast.error(t("complicatedCases.messages.noEmail"));
      return;
    }
    setEmailContact(form);
    setShowEmailModal(true);
  };

  const handleWhatsAppClick = (form, e) => {
    e?.stopPropagation();
    const phone = form.phone;
    if (!phone || !form.whatsapp) {
      toast.error(t("complicatedCases.messages.noWhatsapp"));
      return;
    }
    setChatPhoneNumber(phone.replace("@c.us", ""));
    setChatContactId(form._id);
    setShowWhatsAppChat(true);
  };

  const handleTelegramClick = (form, e) => {
    e?.stopPropagation();
    const phone = form.phone;
    if (!phone || !form.telegram) {
      toast.error(t("complicatedCases.messages.noTelegram"));
      return;
    }
    setChatPhoneNumber(phone);
    setChatContactId(form._id);
    setShowTelegramChat(true);
  };

  const handleMaxClick = (form, e) => {
    e?.stopPropagation();
    const phone = form.phone;
    if (!phone || !form.max) {
      toast.error(t("complicatedCases.messages.noMax"));
      return;
    }
    setChatPhoneNumber(phone);
    setChatContactId(form._id);
    setShowMaxChat(true);
  };

  const handleRowClick = (form) => {
    setIsModalOpen(true);
    setSelectedForm(form);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedForm(null);
  };

  const handleInputChange = (field, value) => {
    setSelectedForm((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };
      
      // Calculate age when dateOfBirth changes
      if (field === 'dateOfBirth') {
        updated.age = calculateAge(value);
      }
      
      return updated;
    });
  };

  const handlePhoneChange = (value) => {
    setSelectedForm((prev) => ({
      ...prev,
      phone: value,
    }));
  };

  const handleUpdateForm = async () => {
    try {
      const response = await updateComplicatedCasesForm(selectedForm._id, selectedForm);
      if (response.success) {
        setForms((prev) =>
          prev.map((form) =>
            form._id === selectedForm._id ? response.data : form
          )
        );
        toast.success(t("complicatedCases.messages.updateSuccess"));
        handleCloseModal();
      }
    } catch (error) {
      toast.error(t("complicatedCases.messages.updateFailed"));
    }
  };

  const handleDeleteForm = async (formId) => {
    if (window.confirm(t("complicatedCases.messages.deleteConfirm"))) {
      try {
        const response = await deleteComplicatedCasesForm(formId);
        if (response.success) {
          setForms((prev) => prev.filter((form) => form._id !== formId));
          toast.success(t("complicatedCases.messages.deleteSuccess"));
          if (selectedForm && selectedForm._id === formId) {
            handleCloseModal();
          }
        }
      } catch (error) {
        toast.error(t("complicatedCases.messages.deleteFailed"));
      }
    }
  };

  const handleDownloadFile = async (fileId) => {
    try {
      // Create a direct download link
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://apimanager.health-direct.ru/api";
      const downloadUrl = `${API_BASE}/complicated-cases-forms/file/${fileId}`;
      
      // Open in new window to trigger download
      window.open(downloadUrl, '_blank');
      
      toast.success(t("complicatedCases.messages.downloadSuccess") || "File download started");
    } catch (error) {
      toast.error(t("complicatedCases.messages.downloadFailed") || "Failed to download file");
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const getFullName = (form) => {
    return `${form.firstName || ""} ${form.middleName || ""} ${form.lastName || ""}`.trim();
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return "";
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  if (loading)
    return <div className="loading">{t("complicatedCases.messages.loading")}</div>;
  if (error)
    return <div className="error">{t("complicatedCases.messages.error", { error })}</div>;

  return (
    <div className="complicated-cases-page">
      {/* Header Section */}
      <div className="complicated-cases-header">
        <div className="page-title-section">
          <div className="cases-breadcrumb">
            <a href="#" className="cases-breadcrumb-link">{t("complicatedCases.breadcrumb.dashboard")}</a>
            <span className="cases-breadcrumb-separator">›</span>
            <span className="cases-breadcrumb-current">{t("complicatedCases.breadcrumb.current")}</span>
          </div>
          <h1 className="cases-page-title">{t("complicatedCases.title")}</h1>
        </div>
      </div>

      {/* Search Section - Outside Header */}
      <div className="header-search-section">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            placeholder={t("complicatedCases.search.placeholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searchTerm && (
            <button onClick={clearSearch} className="clear-search-btn">
              ✕
            </button>
          )}
        </div>
        <div className="search-results-count">
          {t("complicatedCases.search.results", { count: filteredForms.length, total: forms.length })}
        </div>
      </div>

      <div className="complicated-cases-list">
        <div className="complicated-cases-table-container">
          <table className="complicated-cases-table">
            <thead>
              <tr>
                <th>{t("complicatedCases.table.name")}</th>
                <th>{t("complicatedCases.table.email")}</th>
                <th>{t("complicatedCases.table.phone")}</th>
                <th>{t("complicatedCases.table.city")}</th>
                <th>{t("complicatedCases.table.files")}</th>
                <th>{t("complicatedCases.table.agreements")}</th>
                <th>{t("complicatedCases.table.socialMedia")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredForms.length > 0 ? (
                filteredForms.map((form) => (
                  <tr
                    key={form._id}
                    onClick={() => handleRowClick(form)}
                    className="form-row"
                  >
                    <td>{getFullName(form)}</td>
                    <td>{form.email}</td>
                    <td>{form.phone}</td>
                    <td>{form.city}</td>
                    <td>
                      <div className="files-badge">
                        {t("complicatedCases.badges.filesCount", { count: form.files?.length || 0 })}
                      </div>
                    </td>
                    <td>
                      <div className="agreements-info">
                        {form.agree1 && <span className="agreement-badge">{t("complicatedCases.badges.agree1")}</span>}
                        {form.agree2 && <span className="agreement-badge">{t("complicatedCases.badges.agree2")}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="contact-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="contact-btn email-btn"
                          onClick={(e) => handleEmailClick(form, e)}
                          title="Send Email"
                          disabled={!form.email}
                        >
                          <Mail size={14} />
                        </button>
                        {/* <button
                          className={`contact-btn whatsapp-btn ${!form.whatsapp ? "disabled" : ""}`}
                          onClick={(e) => handleWhatsAppClick(form, e)}
                          title="WhatsApp"
                          disabled={!form.whatsapp}
                        >
                          <MessageCircle size={14} />
                        </button> */}
                        <button
                          className={`contact-btn telegram-btn ${!form.telegram ? "disabled" : ""}`}
                          onClick={(e) => handleTelegramClick(form, e)}
                          title="Telegram"
                          disabled={!form.telegram}
                        >
                          <Send size={14} />
                        </button>
                        <button
                          className={`contact-btn max-btn ${!form.max ? "disabled" : ""}`}
                          onClick={(e) => handleMaxClick(form, e)}
                          title="Max"
                          disabled={!form.max}
                        >
                          <img src="/max.png" width={20}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">
                    {t("complicatedCases.table.noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedForm && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t("complicatedCases.modal.title")}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>{t("complicatedCases.modal.firstName")}:</label>
                <input
                  type="text"
                  value={selectedForm.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.middleName")}:</label>
                <input
                  type="text"
                  value={selectedForm.middleName}
                  onChange={(e) => handleInputChange("middleName", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.lastName")}:</label>
                <input
                  type="text"
                  value={selectedForm.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.email")}:</label>
                <input
                  type="email"
                  value={selectedForm.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.phone")}:</label>
                <PhoneInput
                  value={selectedForm.phone}
                  onChange={handlePhoneChange}
                  defaultCountry="IL"
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.city")}:</label>
                <input
                  type="text"
                  value={selectedForm.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.dateOfBirth")}:</label>
                <input
                  type="date"
                  value={selectedForm.dateOfBirth ? selectedForm.dateOfBirth.split('T')[0] : ''}
                  onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.age")}:</label>
                <div className="age-display-field">
                  <img src="/age-icon.png" alt="Age" className="age-icon" width={16} height={16} />
                  <input
                    type="text"
                    value={selectedForm.age || ''}
                    readOnly
                    className="age-readonly"
                    placeholder={t("complicatedCases.modal.agePlaceholder")}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t("complicatedCases.modal.message")}:</label>
                <textarea
                  value={selectedForm.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  rows="4"
                />
              </div>

              <div className="social-media-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedForm.whatsapp}
                    onChange={(e) => handleInputChange("whatsapp", e.target.checked)}
                  />
                  {t("complicatedCases.modal.whatsapp")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedForm.telegram}
                    onChange={(e) => handleInputChange("telegram", e.target.checked)}
                  />
                  {t("complicatedCases.modal.telegram")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedForm.max}
                    onChange={(e) => handleInputChange("max", e.target.checked)}
                  />
                  {t("complicatedCases.modal.max")}
                </label>
              </div>

              <div className="agreements-section">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedForm.agree1}
                    onChange={(e) => handleInputChange("agree1", e.target.checked)}
                  />
                  {t("complicatedCases.modal.agreement1")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedForm.agree2}
                    onChange={(e) => handleInputChange("agree2", e.target.checked)}
                  />
                  {t("complicatedCases.modal.agreement2")}
                </label>
              </div>

              {selectedForm.files && selectedForm.files.length > 0 && (
                <div className="files-section">
                  <h3>{t("complicatedCases.modal.attachedFiles")}</h3>
                  <div className="files-list">
                    {selectedForm.files.map((fileId, index) => (
                      <div key={fileId} className="file-item">
                        <FileText size={16} />
                        <span>{t("complicatedCases.modal.file", { index: index + 1 })}</span>
                        <button
                          className="download-file-btn"
                          onClick={() => handleDownloadFile(fileId)}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-delete" onClick={() => handleDeleteForm(selectedForm._id)}>
                <Trash2 size={16} />
                {t("complicatedCases.modal.deleteBtn")}
              </button>
              <button className="btn-cancel" onClick={handleCloseModal}>
                {t("complicatedCases.modal.cancelBtn")}
              </button>
              <button className="btn-save" onClick={handleUpdateForm}>
                {t("complicatedCases.modal.saveBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Communication Modals */}
      {showEmailModal && (
        <EmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          recipientEmail={emailContact?.email}
          recipientName={getFullName(emailContact)}
        />
      )}

      {/* {showWhatsAppChat && (
        <WhatsAppChatBot
          isOpen={showWhatsAppChat}
          onClose={() => setShowWhatsAppChat(false)}
          phoneNumber={chatPhoneNumber}
          contactId={chatContactId}
        />
      )} */}

      {showTelegramChat && (
        <TelegramChatBot
          isOpen={showTelegramChat}
          onClose={() => setShowTelegramChat(false)}
          phoneNumber={chatPhoneNumber}
          contactId={chatContactId}
        />
      )}

      {showMaxChat && (
        <MaxChatBot
          isOpen={showMaxChat}
          onClose={() => setShowMaxChat(false)}
          phoneNumber={chatPhoneNumber}
          contactId={chatContactId}
        />
      )}
    </div>
  );
};

export default ComplicatedCasesForms;
