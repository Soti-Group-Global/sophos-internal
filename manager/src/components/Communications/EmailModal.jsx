import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Send, Mail } from "lucide-react";
import { toast } from "react-toastify";
import { sendEmail } from "../../utils/api";

const EmailModal = ({
  isOpen,
  onClose,
  recipientEmail,
  contactId,
  contactName,
}) => {
  const { t } = useTranslation();
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendEmail = async () => {
    if (!recipientEmail || !emailSubject.trim() || !emailBody.trim()) {
      setError(t("email.fields_required"));
      toast.error(t("email.fields_required"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendEmail(contactId, {
        to: recipientEmail,
        subject: emailSubject,
        body: emailBody,
      });

      onClose();
      setEmailSubject("");
      setEmailBody("");
      toast.success(t("email.sent_success"));
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || t("email.send_failed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmailSubject("");
    setEmailBody("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content email-modal">
        <div className="modal-header">
          <div className="modal-title-section">
            <Mail size={20} />
            <h2>{t("email.new_email")}</h2>
          </div>
          <button className="close-button" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="recipient-info">
            <strong>{t("email.to")}:</strong>
            <span>{recipientEmail}</span>
            {contactName && (
              <span className="contact-name">({contactName})</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t("email.subject")}:</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={t("email.subject_placeholder")}
              className="text-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t("email.body")}:</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder={t("email.body_placeholder")}
              className="textarea-input"
              rows={8}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button
            onClick={handleSendEmail}
            disabled={loading || !emailSubject.trim() || !emailBody.trim()}
            className="submit-button"
          >
            {loading ? (
              <>{t("email.sending")}...</>
            ) : (
              <>
                <Send size={16} />
                {t("email.send_email")}
              </>
            )}
          </button>
          <button onClick={handleClose} className="cancel-button">
            {t("email.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
