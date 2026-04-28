import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "../styles/PatientCoordinationForms.css";
import {
  getPatientCoordinationForms,
  updateCoordinationFormdata,
  deleteCoordinationFormdata,
} from "../utils/api";
import { Mail, MessageCircle, Send } from "lucide-react";

// Import the communication components
import EmailModal from "../components/Communications/EmailModal";
import WhatsAppChatBot from "./WhatsAppChatBot";
import TelegramChatBot from "./TelegramChatBot";
import MaxChatBot from "../components/Communications/MaxChatBot";

const PatientCoordinationForms = () => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
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
    const fetchContacts = async () => {
      setLoading(true);
      try {
        const response = await getPatientCoordinationForms();
        if (Array.isArray(response.patientCoordinationForm)) {
          setContacts(response.patientCoordinationForm);
        } else {
          setContacts([]);
        }
      } catch (error) {
        setError(error.response?.data?.message || error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  // Filter contacts based on search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;

    const lowercasedSearch = searchTerm.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.firstName?.toLowerCase().includes(lowercasedSearch) ||
        contact.middleName?.toLowerCase().includes(lowercasedSearch) ||
        contact.lastName?.toLowerCase().includes(lowercasedSearch) ||
        contact.email?.toLowerCase().includes(lowercasedSearch) ||
        contact.phoneNumber?.toLowerCase().includes(lowercasedSearch) ||
        contact.city?.toLowerCase().includes(lowercasedSearch) ||
        `${contact.firstName || ""} ${contact.middleName || ""} ${
          contact.lastName || ""
        }`
          .toLowerCase()
          .includes(lowercasedSearch)
    );
  }, [contacts, searchTerm]);

  // Communication handlers
  const handleEmailClick = (contact, e) => {
    e?.stopPropagation();
    if (!contact.email) {
      toast.error(t("patientCoordination.no_email"));
      return;
    }
    setEmailContact(contact);
    setShowEmailModal(true);
  };

  const handleWhatsAppClick = (contact, e) => {
    e?.stopPropagation();
    const phone = contact.phoneNumber;
    if (!phone) {
      toast.error(t("patientCoordination.no_phone"));
      return;
    }
    setChatPhoneNumber(phone.replace("@c.us", ""));
    setChatContactId(contact._id);
    setShowWhatsAppChat(true);
  };

  const handleTelegramClick = (contact, e) => {
    e?.stopPropagation();
    const phone = contact.phoneNumber;
    if (!phone) {
      toast.error(t("patientCoordination.no_phone"));
      return;
    }
    setChatPhoneNumber(phone);
    setChatContactId(contact._id);
    setShowTelegramChat(true);
  };

  const handleMaxClick = (contact, e) => {
    e?.stopPropagation();
    const phone = contact.phoneNumber;
    if (!phone) {
      toast.error(t("patientCoordination.no_phone"));
      return;
    }
    setChatPhoneNumber(phone);
    setChatContactId(contact._id);
    setShowMaxChat(true);
  };

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
      phoneNumber: value,
    }));
  };

  const handleUpdateContact = async () => {
    try {
      await updateCoordinationFormdata(selectedContact._id, selectedContact);
      // Update the contact in the local state
      setContacts((prev) =>
        prev.map((contact) =>
          contact._id === selectedContact._id ? selectedContact : contact
        )
      );
      handleCloseModal();
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (window.confirm(t("patientCoordination.deleteConfirm"))) {
      try {
        await deleteCoordinationFormdata(contactId);
        setContacts((prev) =>
          prev.filter((contact) => contact._id !== contactId)
        );
        if (selectedContact && selectedContact._id === contactId) {
          handleCloseModal();
        }
      } catch (error) {
        setError(error.response?.data?.message || error.message);
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  // Format phone number for display in table
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "";
    return phoneNumber;
  };

  const getFullName = (contact) => {
    return `${contact.firstName || ""} ${contact.middleName || ""} ${
      contact.lastName || ""
    }`.trim();
  };

  if (loading)
    return <div className="loading">{t("patientCoordination.loading")}</div>;
  if (error)
    return (
      <div className="error">{t("patientCoordination.error", { error })}</div>
    );

  return (
    <div className="contact-us-form-page">
      {/* Header Section */}
      <div className="contact-us-form-page-header">
        <div className="page-title-section">
          <div className="form-breadcrumb">
            <a href="#" className="form-breadcrumb-link">{t("patientCoordination.breadcrumb.dashboard")}</a>
            <span className="form-breadcrumb-separator">›</span>
            <span className="form-breadcrumb-current">{t("patientCoordination.breadcrumb.current")}</span>
          </div>
          <h1 className="form-page-title">{t("patientCoordination.title")}</h1>
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
            placeholder={t("patientCoordination.search.placeholder")}
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
          {t("patientCoordination.search.results", {
            count: filteredContacts.length,
            total: contacts.length,
          })}
        </div>
      </div>

      <div className="contact-us-form-list">
        <div className="contact-use-forms-table-container">
          <table className="contact-use-forms-table">
            <thead>
              <tr>
                <th>{t("patientCoordination.table.email")}</th>
                <th>{t("patientCoordination.table.name")}</th>
                <th>{t("patientCoordination.table.phone")}</th>
                <th>{t("patientCoordination.table.city")}</th>
                <th>{t("patientCoordination.table.socialMedia")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact._id}
                    onClick={() => handleRowClick(contact)}
                    className="contact-row"
                  >
                    <td>{contact.email}</td>
                    <td>
                      {contact.firstName} {contact.middleName}{" "}
                      {contact.lastName}
                    </td>
                    <td>{formatPhoneNumber(contact.phoneNumber)}</td>
                    <td>{contact.city}</td>
                    <td>
                      <div
                        className="contact-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="contact-btn email-btn"
                          onClick={(e) => handleEmailClick(contact, e)}
                          title="Send Email"
                          disabled={!contact.email}
                        >
                          <Mail size={14} />
                        </button>
                        {/* <button
                          className="contact-btn whatsapp-btn"
                          onClick={(e) => handleWhatsAppClick(contact, e)}
                          title="WhatsApp"
                          disabled
                        >
                          <MessageCircle size={14} />
                        </button> */}
                        <button
                          className="contact-btn telegram-btn"
                          onClick={(e) => handleTelegramClick(contact, e)}
                          title="Telegram"
                          disabled={!contact.phoneNumber}
                        >
                          <Send size={14} />
                        </button>
                        <button
                          className="contact-btn"
                          onClick={(e) => handleMaxClick(contact, e)}
                          title="Max"
                          disabled={!contact.phoneNumber}
                        >
                         <img src="/max.png" width={20}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-results">
                    {searchTerm
                      ? t("patientCoordination.search.noResults")
                      : t("patientCoordination.search.noContacts")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && emailContact && (
        <EmailModal
          isOpen={showEmailModal}
          onClose={() => {
            setShowEmailModal(false);
            setEmailContact(null);
          }}
          recipientEmail={emailContact.email}
          contactId={emailContact._id}
          contactName={getFullName(emailContact)}
        />
      )}

      {/* WhatsApp Chat Modal */}
      {/* {showWhatsAppChat && (
        <WhatsAppChatBot
          isOpen={showWhatsAppChat}
          onClose={() => {
            setShowWhatsAppChat(false);
            setChatContactId(null);
          }}
          phoneNumber={chatPhoneNumber}
          profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_WHATSAPP}
        />
      )} */}

      {/* Telegram Chat Modal */}
      {showTelegramChat && (
        <TelegramChatBot
          isOpen={showTelegramChat}
          onClose={() => {
            setShowTelegramChat(false);
            setChatContactId(null);
          }}
          phoneNumber={chatPhoneNumber}
          profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_TELEGRAM}
        />
      )}

      {/* Max Chat Modal */}
      {showMaxChat && (
        <MaxChatBot
          isOpen={showMaxChat}
          onClose={() => {
            setShowMaxChat(false);
            setChatContactId(null);
          }}
          contactId={chatContactId}
          contactName={getFullName(
            contacts.find((c) => c._id === chatContactId) || {}
          )}
          contactPhone={chatPhoneNumber}
        />
      )}

      {isModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{t("patientCoordination.modal.title")}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("patientCoordination.modal.firstName")}:</label>
                <input
                  type="text"
                  value={selectedContact.firstName || ""}
                  onChange={(e) =>
                    handleInputChange("firstName", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>{t("patientCoordination.modal.middleName")}:</label>
                <input
                  type="text"
                  value={selectedContact.middleName || ""}
                  onChange={(e) =>
                    handleInputChange("middleName", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>{t("patientCoordination.modal.lastName")}:</label>
                <input
                  type="text"
                  value={selectedContact.lastName || ""}
                  onChange={(e) =>
                    handleInputChange("lastName", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>{t("patientCoordination.modal.email")}:</label>
                <input
                  type="email"
                  value={selectedContact.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              <div className="form-group phone-input-group">
                <label>{t("patientCoordination.modal.phoneNumber")}:</label>
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={selectedContact.phoneNumber || ""}
                  onChange={handlePhoneChange}
                  className="custom-phone-input"
                />
              </div>
              <div className="form-group">
                <label>{t("patientCoordination.modal.city")}:</label>
                <input
                  type="text"
                  value={selectedContact.city || ""}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t("patientCoordination.modal.message")}:</label>
                <textarea
                  value={selectedContact.message || ""}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  rows="4"
                />
              </div>
              <div className="social-media-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedContact.whatsapp || false}
                    onChange={(e) =>
                      handleInputChange("whatsapp", e.target.checked)
                    }
                  />
                  {t("patientCoordination.modal.socialMedia.whatsapp")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedContact.telegram || false}
                    onChange={(e) =>
                      handleInputChange("telegram", e.target.checked)
                    }
                  />
                  {t("patientCoordination.modal.socialMedia.telegram")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedContact.max || false}
                    onChange={(e) => handleInputChange("max", e.target.checked)}
                  />
                  {t("patientCoordination.modal.socialMedia.max")}
                </label>
              </div>
              <div className="modal-actions">
                <button onClick={handleUpdateContact} className="update-btn">
                  {t("patientCoordination.modal.update")}
                </button>
                <button
                  onClick={() => handleDeleteContact(selectedContact._id)}
                  className="delete-btn"
                >
                  {t("patientCoordination.modal.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientCoordinationForms;
