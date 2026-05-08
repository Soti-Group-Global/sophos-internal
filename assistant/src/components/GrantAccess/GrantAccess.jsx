import { useState, useEffect } from 'react';
import { FiShield, FiX, FiChevronDown, FiChevronUp, FiDownload } from "react-icons/fi";
import { AuthContext } from '../../context/AuthContext';
import "./GrantAccess.css";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";
import { getDoctorsLite, grantAssistantAccess } from "../../utils/api";
import { toast } from "react-toastify";

const GrantAccess = ({ assistantEmail, onClose, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ru") ? "ru" : "en";
  const resolveName = (name) => {
    if (!name) return "";
    if (typeof name === "string") return name;
    if (typeof name === "object") return name[lang] || name.en || name.ru || "";
    return String(name);
  };

  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getDoctorsLite();
        if (mounted) setAllDoctors(list || []);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSendRequest = async () => {
    if (!selectedDoctor || !assistantEmail || !startDateTime || !endDateTime)
      return;
  
    try {
      setSubmitting(true);
  
      // Treat user input as Moscow time and convert to UTC
      const utcStartDateTime = moment.tz(startDateTime, "Europe/Moscow").utc().toISOString();
      const utcEndDateTime = moment.tz(endDateTime, "Europe/Moscow").utc().toISOString();
  
      const response = await grantAssistantAccess({
        assistantEmail,
        doctorEmail: selectedDoctor,
        startDateTime: utcStartDateTime,
        endDateTime: utcEndDateTime,
      });
  
      if (response.ok) {
        toast.success(t("messages.grant_access_successfully"));
  
        setSelectedDoctor("");
        setStartDateTime("");
        setEndDateTime("");

        // Only close modal if request succeeded
        onSuccess();
        
      } else {
        toast.warn(response.message || t("messages.grant_access_failed"));
        // Do NOT close the modal if request not accepted
      }
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.message || e.message || t("errors.failed_to_send_request");
      toast.error(msg);
      // Do NOT close the modal on error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="assistant__modal">
      <div
        className="modal__backdrop"
        onClick={onClose}
      />
      <div className="modal__content">
        <div className="modal__header">
          <h3 className="modal__title">{t("modal.grant_access_title")}</h3>
          <button
            className="modal__close"
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>

        <div className="modal__body">
          <label className="field">
            <span className="field__label">{t("modal.select_doctor")}</span>
            <select
              className="field__select"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
            >
              <option value="">— {t("modal.choose")} —</option>
              {allDoctors.map((d) => (
                <option key={d.email} value={d.email}>
                  {resolveName(d.name) || d.email}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t("modal.start_datetime")}</span>
            <input
              type="datetime-local"
              className="field__input"
              value={startDateTime}
              onChange={(e) => {
                const start = e.target.value;
                setStartDateTime(start);

                // Auto-set end date 7 days later (same time)
                if (start) {
                  const startDate = new Date(start);
                  const endDate = new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));
                  
                  // Format as YYYY-MM-DDTHH:MM for datetime-local input
                  const endISO = endDate.toISOString().slice(0, 16);
                  setEndDateTime(endISO);
                }
              }}/>
          </label>

          <label className="field">
            <span className="field__label">{t("modal.end_datetime")}</span>
            <input
              type="datetime-local"
              className="field__input"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
            />
          </label>
        </div>

        <div className="modal__footer">
          <button
            className="btn btn--ghost"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn--success"
            onClick={handleSendRequest}
            disabled={
              !selectedDoctor ||
              !startDateTime ||
              !endDateTime ||
              submitting ||
              !assistantEmail
            }
          >
            {submitting ? t("common.sending") : t("actions.grant_access")}
          </button>
        </div>
      </div>
    </div>
  )
}
export default GrantAccess;