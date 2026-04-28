import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "../styles/ContactViaPhone.css";
import {
  submitContactViaPhone,
  getContactViaPhoneRequests,
  updateContactViaPhoneRequest,
  deleteContactViaPhoneRequest
} from "../utils/api";
import { Phone, Search, X } from "lucide-react";
import ConsultationPage from "./ConsultationPage";
import ScheduleConsultation from "./ScheduleConsultation";

const ContactViaPhone = () => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // New contact form state
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    phone: "",
    status: "pending"
  });
  const [showNewContactForm, setShowNewContactForm] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await getContactViaPhoneRequests();
      if (Array.isArray(response.data)) {
        setContacts(response.data);
      } else {
        setContacts([]);
      }
    } catch (error) {
      setError(error.response?.data?.message || error.message);
      toast.error(t("contactViaPhone.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  // Handle new contact submission
  const handleSubmitNewContact = async (e) => {
    e.preventDefault();
    if (!newContact.phone) {
      toast.error(t("contactViaPhone.phoneRequired"));
      return;
    }

    try {
      const response = await submitContactViaPhone(newContact);
      toast.success(response.message || t("contactViaPhone.submitSuccess"));
      setNewContact({
        firstName: "",
        lastName: "",
        middleName: "",
        phone: "",
        status: "pending"
      });
      setShowNewContactForm(false);
      fetchContacts(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || t("contactViaPhone.submitError"));
    }
  };

  // Filter contacts based on search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;

    const lowercasedSearch = searchTerm.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.phone?.toLowerCase().includes(lowercasedSearch) ||
        contact.firstName?.toLowerCase().includes(lowercasedSearch) ||
        contact.lastName?.toLowerCase().includes(lowercasedSearch) ||
        contact.middleName?.toLowerCase().includes(lowercasedSearch) ||
        contact.status?.toLowerCase().includes(lowercasedSearch) ||
        contact._id?.toLowerCase().includes(lowercasedSearch)
    );
  }, [contacts, searchTerm]);

  const handleRowClick = (contact) => {
    setIsModalOpen(true);
    setSelectedContact(contact);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };

  const handleInputChange = (field, value) => {
    setSelectedContact((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePhoneChange = (value) => {
    setSelectedContact((prev) => ({
      ...prev,
      phone: value,
    }));
  };

  const handleUpdateContact = async () => {
    try {
      await updateContactViaPhoneRequest(selectedContact._id, selectedContact);
      setContacts((prev) =>
        prev.map((contact) =>
          contact._id === selectedContact._id ? selectedContact : contact
        )
      );
      toast.success(t("contactViaPhone.updateSuccess"));
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.message || t("contactViaPhone.updateError"));
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (window.confirm(t("contactViaPhone.deleteConfirm"))) {
      try {
        await deleteContactViaPhoneRequest(contactId);
        setContacts((prev) =>
          prev.filter((contact) => contact._id !== contactId)
        );
        if (selectedContact && selectedContact._id === contactId) {
          handleCloseModal();
        }
        toast.success(t("contactViaPhone.deleteSuccess"));
      } catch (error) {
        toast.error(error.response?.data?.message || t("contactViaPhone.deleteError"));
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "";
    return phoneNumber;
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: "cvp-status-pending",
      contacted: "cvp-status-contacted",
    };

    return (
      <span className={`cvp-status-badge ${statusClasses[status] || ''}`}>
        {t(`contactViaPhone.status.${status}`)}
      </span>
    );
  };

  if (loading) return <div className="cvp-loading">{t("contactViaPhone.loading")}</div>;
  if (error) return <div className="cvp-error">{t("contactViaPhone.error", { error })}</div>;

  return (
    <div className="cvp-page">
      <div className="cvp-header">
        <div className="page-title-section">
          <div className="form-breadcrumb">
            <span className="form-breadcrumb-link">{t("contactViaPhone.breadcrumb.dashboard")}</span>
            <span className="form-breadcrumb-separator">›</span>
            <span className="form-breadcrumb-current">{t("contactViaPhone.breadcrumb.current")}</span>
          </div>
          <h1 className="form-page-title">{t("contactViaPhone.title")}</h1>
        </div>
      </div>

      {/* Search Section - Outside Header */}
      <div className="header-search-section">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t("contactViaPhone.search.placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="clear-search-btn">
              ✕
            </button>
          )}
        </div>
        <div className="search-results-count">
          {t("contactViaPhone.search.results", {
            count: filteredContacts.length,
            total: contacts.length,
          })}
        </div>
      </div>

      {/* Add New Contact Button 
      <div className="cvp-add-section">
        <button 
          className="cvp-add-btn"
          onClick={() => setShowNewContactForm(!showNewContactForm)}
        >
          <Phone size={16} />
          {t("contactViaPhone.addNewContact")}
        </button>
      </div>

      */}

      {/* New Contact Form */}
      {showNewContactForm && (
        <div className="cvp-new-form">
          <h3 className="cvp-new-form-title">{t("contactViaPhone.newContactForm.title")}</h3>
          <form onSubmit={handleSubmitNewContact}>
            <div className="cvp-form-row">
              <div className="cvp-form-group">
                <label className="cvp-label">{t("contactViaPhone.newContactForm.lastName")}: *</label>
                <input
                  type="text"
                  className="cvp-input"
                  value={newContact.lastName}
                  onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
              <div className="cvp-form-group">
                <label className="cvp-label">{t("contactViaPhone.newContactForm.firstName")}: *</label>
                <input
                  type="text"
                  className="cvp-input"
                  value={newContact.firstName}
                  onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="cvp-form-group">
                <label className="cvp-label">{t("contactViaPhone.newContactForm.middleName")}:</label>
                <input
                  type="text"
                  className="cvp-input"
                  value={newContact.middleName}
                  onChange={(e) => setNewContact(prev => ({ ...prev, middleName: e.target.value }))}
                />
              </div>
            </div>
            <div className="cvp-form-group cvp-phone-input-group">
              <label className="cvp-label">{t("contactViaPhone.newContactForm.phone")}: *</label>
              <PhoneInput
                international
                defaultCountry="US"
                value={newContact.phone}
                onChange={(value) => setNewContact(prev => ({ ...prev, phone: value }))}
                className="cvp-phone-input"
                required
              />
            </div>
            <div className="cvp-form-group">
              <label className="cvp-label">{t("contactViaPhone.newContactForm.status")}:</label>
              <select
                className="cvp-select"
                value={newContact.status}
                onChange={(e) => setNewContact(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="pending">{t("contactViaPhone.status.pending")}</option>
                <option value="contacted">{t("contactViaPhone.status.contacted")}</option>
              </select>
            </div>
            <div className="cvp-form-actions">
              <button type="submit" className="cvp-submit-btn">
                {t("contactViaPhone.newContactForm.submit")}
              </button>
              <button
                type="button"
                className="cvp-cancel-btn"
                onClick={() => setShowNewContactForm(false)}
              >
                {t("contactViaPhone.newContactForm.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts Table */}
      <div className="cvp-list">
        <div className="cvp-table-container">
          <table className="cvp-table">
            <thead className="cvp-table-head">
              <tr className="cvp-table-row">
                <th className="cvp-table-header">{t("contactViaPhone.table.clientName")}</th>
                <th className="cvp-table-header">{t("contactViaPhone.table.phone")}</th>
                <th className="cvp-table-header">{t("contactViaPhone.table.status")}</th>
                <th className="cvp-table-header">{t("contactViaPhone.table.created")}</th>
              </tr>
            </thead>
            <tbody className="cvp-table-body">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact._id}
                    onClick={() => handleRowClick(contact)}
                    className="cvp-table-row cvp-contact-row"
                  >
                    <td className="cvp-table-cell cvp-name-cell">
                      {`${contact.lastName || ""} ${contact.firstName || ""} ${contact.middleName || ""}`.trim() || t("contactViaPhone.table.noName")}
                    </td>
                    <td className="cvp-table-cell cvp-phone-cell">{formatPhoneNumber(contact.phone)}</td>
                    <td className="cvp-table-cell cvp-status-cell">{getStatusBadge(contact.status)}</td>
                    <td className="cvp-table-cell cvp-created-cell">{new Date(contact.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr className="cvp-table-row">
                  <td colSpan="3" className="cvp-table-cell cvp-no-results">
                    {searchTerm
                      ? t("contactViaPhone.search.noResults")
                      : t("contactViaPhone.search.noContacts")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Contact Modal */}
      {isModalOpen && selectedContact && (
        <div className="cvp-modal-overlay" onClick={handleCloseModal}>
          <div
            className="cvp-modal-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cvp-modal-header">
              <h1 className="cvp-modal-title">{t("contactViaPhone.modal.title")}</h1>
              <button className="cvp-modal-close-btn" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <div className="cvp-modal-body">
              <div className="cvp-form-row">
                <div className="cvp-form-group">
                  <label className="cvp-label">{t("contactViaPhone.modal.lastName")}:</label>
                  <input
                    type="text"
                    name="lastName"
                    id="edit-lastName"
                    className="cvp-input"
                    value={selectedContact.lastName || ""}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                  />
                </div>
                <div className="cvp-form-group">
                  <label className="cvp-label">{t("contactViaPhone.modal.firstName")}:</label>
                  <input
                    type="text"
                    name="firstName"
                    id="edit-firstName"
                    className="cvp-input"
                    value={selectedContact.firstName || ""}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                  />
                </div>
                <div className="cvp-form-group">
                  <label className="cvp-label">{t("contactViaPhone.modal.middleName")}:</label>
                  <input
                    type="text"
                    name="middleName"
                    id="edit-middleName"
                    className="cvp-input"
                    value={selectedContact.middleName || ""}
                    onChange={(e) => handleInputChange("middleName", e.target.value)}
                  />
                </div>
              </div>
              <div className="cvp-form-group cvp-modal-phone-group">
                <label className="cvp-label">{t("contactViaPhone.modal.phoneNumber")}:</label>
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={selectedContact.phone || ""}
                  onChange={handlePhoneChange}
                  className="cvp-phone-input"
                />
              </div>
              <div className="cvp-form-group">
                <label className="cvp-label">{t("contactViaPhone.modal.status")}:</label>
                <select
                  className="cvp-select"
                  value={selectedContact.status || "pending"}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                >
                  <option value="pending">{t("contactViaPhone.status.pending")}</option>
                  <option value="contacted">{t("contactViaPhone.status.contacted")}</option>
                </select>
              </div>
              <div className="cvp-modal-actions">
                <button onClick={handleUpdateContact} className="cvp-update-btn">
                  {t("contactViaPhone.modal.update")}
                </button>
                <button
                  onClick={() => handleDeleteContact(selectedContact._id)}
                  className="cvp-delete-btn"
                >
                  {t("contactViaPhone.modal.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ContactViaPhone;