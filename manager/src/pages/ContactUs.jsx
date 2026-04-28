import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "../styles/ContactUs.css";
import { getContactUsForm, updateContact, deleteContact } from "../utils/api";
import { Mail, MessageCircle, Send, Search } from "lucide-react";

// Import the communication components
import EmailModal from "../components/Communications/EmailModal";
import WhatsAppChatBot from "./WhatsAppChatBot";
import TelegramChatBot from "./TelegramChatBot";
import MaxChatBot from "../components/Communications/MaxChatBot";

const ContactUs = () => {
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
        const response = await getContactUsForm();
        if (Array.isArray(response.contacts)) {
          setContacts(response.contacts);
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
      toast.error(t("contactUs.no_email"));
      return;
    }
    setEmailContact(contact);
    setShowEmailModal(true);
  };

  const handleWhatsAppClick = (contact, e) => {
    e?.stopPropagation();
    const phone = contact.phoneNumber;
    if (!phone) {
      toast.error(t("contactUs.no_phone"));
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
      toast.error(t("contactUs.no_phone"));
      return;
    }
    setChatPhoneNumber(phone);
    setChatContactId(contact._id);
    setShowTelegramChat(true);
  };

  // CORRECTED: Fixed the function name (was handleMaxClick)
  const handleMaxClick = (contact, e) => {
    e?.stopPropagation();
    const phone = contact.phoneNumber;
    if (!phone) {
      toast.error(t("contactUs.no_phone"));
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
      await updateContact(selectedContact._id, selectedContact);
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
    if (window.confirm(t("contactUs.deleteConfirm"))) {
      try {
        await deleteContact(contactId);
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

  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "";
    return phoneNumber;
  };

  const getFullName = (contact) => {
    return `${contact.firstName || ""} ${contact.middleName || ""} ${
      contact.lastName || ""
    }`.trim();
  };

  if (loading) return <div className="loading">{t("contactUs.loading")}</div>;
  if (error)
    return <div className="error">{t("contactUs.error", { error })}</div>;

  return (
    <div className="contact-us-form-page">
      <div className="contact-us-form-page-header">
        <div className="page-title-section">
          <div className="form-breadcrumb">
            <span className="form-breadcrumb-link">{t("contactUs.breadcrumb.dashboard")}</span>
            <span className="form-breadcrumb-separator">›</span>
            <span className="form-breadcrumb-current">{t("contactUs.breadcrumb.current")}</span>
          </div>
          <h1 className="form-page-title">{t("contactUs.title")}</h1>
        </div>
      </div>

      <div className="header-search-section">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t("contactUs.search.placeholder")}
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
          {t("contactUs.search.results", {
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
          <th>{t("contactUs.table.email")}</th>
          <th>{t("contactUs.table.name")}</th>
          <th>{t("contactUs.table.phone")}</th>
          <th>{t("contactUs.table.city")}</th>
          <th>{t("contactUs.table.socialMedia")}</th>
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
                {contact.firstName} {contact.middleName} {contact.lastName}
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
                    className="contact-btn whatsapp-btn disabled"
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
                ? t("contactUs.search.noResults")
                : t("contactUs.search.noContacts")}
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

      {/* CORRECTED: Max Chat Modal - Fixed the condition and props */}
      {showMaxChat && (
        <MaxChatBot
          isOpen={showMaxChat}
          onClose={() => {
            setShowMaxChat(false);
            setChatContactId(null);
          }}
          contactId={chatContactId} // Use contactId instead of phoneNumber for Max
          contactName={getFullName(
            contacts.find((c) => c._id === chatContactId) || {}
          )}
          contactPhone={chatPhoneNumber}
        />
      )}

      {isModalOpen && selectedContact && (
        <div className="contact-form-modal-overlay" onClick={handleCloseModal}>
          <div
            className="contact-form-modal-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="contact-modal-popup-header">
              <h1>{t("contactUs.modal.title")}</h1>
              <button onClick={handleCloseModal}>
                {t("contactUs.modal.close")}
              </button>
            </div>
            <div className="contact-modal-popup-body">
              <div className="form-group">
                <label>{t("contactUs.modal.firstName")}:</label>
                <input
                  type="text"
                  value={selectedContact.firstName || ""}
                  onChange={(e) =>
                    handleInputChange("firstName", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>{t("contactUs.modal.middleName")}:</label>
                <input
                  type="text"
                  value={selectedContact.middleName || ""}
                  onChange={(e) =>
                    handleInputChange("middleName", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>{t("contactUs.modal.lastName")}:</label>
                <input
                  type="text"
                  value={selectedContact.lastName || ""}
                  onChange={(e) =>
                    handleInputChange("lastName", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>{t("contactUs.modal.email")}:</label>
                <input
                  type="email"
                  value={selectedContact.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              <div className="form-group phone-input-group">
                <label>{t("contactUs.modal.phoneNumber")}:</label>
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={selectedContact.phoneNumber || ""}
                  onChange={handlePhoneChange}
                  className="custom-phone-input"
                />
              </div>
              <div className="form-group">
                <label>{t("contactUs.modal.city")}:</label>
                <input
                  type="text"
                  value={selectedContact.city || ""}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t("contactUs.modal.message")}:</label>
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
                  {t("contactUs.modal.socialMedia.whatsapp")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedContact.telegram || false}
                    onChange={(e) =>
                      handleInputChange("telegram", e.target.checked)
                    }
                  />
                  {t("contactUs.modal.socialMedia.telegram")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedContact.max || false}
                    onChange={(e) => handleInputChange("max", e.target.checked)}
                  />
                  {t("contactUs.modal.socialMedia.max")}
                </label>
              </div>
              <div className="modal-actions">
                <button onClick={handleUpdateContact} className="update-btn">
                  {t("contactUs.modal.update")}
                </button>
                <button
                  onClick={() => handleDeleteContact(selectedContact._id)}
                  className="delete-btn"
                >
                  {t("contactUs.modal.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactUs;
