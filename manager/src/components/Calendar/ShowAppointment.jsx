import React from "react";
import { useTranslation } from 'react-i18next';
import "./ShowAppointment.css";
import { PiGenderMaleBold, PiGenderFemaleBold, PiTelegramLogo } from "react-icons/pi";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import { IoMail } from "react-icons/io5";

const ShowAppointment = ({ selectedEvent, isHover, onViewDetails }) => {
  const { t } = useTranslation('show_appointment');
  
  if (!selectedEvent) return null;

  const {
    patientName,
    doctorName,
    serviceType,
    specialty,
    appointmentMode,
    appointmentStatus,
    meetingLink,
    age,
    gender,
    serviceNo,
  } = selectedEvent.extendedProps || {};

  return (
    <div className={`show-appointment-container ${isHover ? "show-appointment-hover" : ""}`}>
      <div className="show-appointment-header">
        <h4 className="show-appointment-title">{selectedEvent.title || t('default_title')}</h4>
        <span className="show-appointment-icon">
          {gender === "female" ? (
            <PiGenderFemaleBold />
          ) : gender === "male" ? (
            <PiGenderMaleBold />
          ) : (
            <span>?</span>
          )}
        </span>
      </div>
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('requested_service')}</p>
        <span>{serviceType || t('na')}</span>
      </div>
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('doctor')}</p>
        <span>{doctorName || t('na')}</span>
      </div>
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('specialty')}</p>
        <span>{specialty || t('na')}</span>
      </div>
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('mode')}</p>
        <span>{appointmentMode || t('na')}</span>
      </div>
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('status')}</p>
        <span>{appointmentStatus ? t(`applications:status_${appointmentStatus.toLowerCase().replace(/\s+/g, "_")}`, appointmentStatus) : t('na')}</span>
      </div>
      {appointmentMode === "Online" && meetingLink && (
        <div className="show-appointment-info">
          <p className="show-appointment-info-title">{t('link')}</p>
          <a href={meetingLink} target="_blank" rel="noopener noreferrer">
            {meetingLink}
          </a>
        </div>
      )}
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('age')}</p>
        <span>{age || t('na')}</span>
      </div>
      <div className="show-appointment-info">
        <p className="show-appointment-info-title">{t('time_of_request')}</p>
        <span>
          {selectedEvent.start
            ? new Date(selectedEvent.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : t('na')}{" "}
          -{" "}
          {selectedEvent.end
            ? new Date(selectedEvent.end).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : t('na')}
        </span>
      </div>
      <div className="show-appointment-service-no">
        {t('service_no')}: {serviceNo || t('na')}
      </div>
      {!isHover && (
        <div className="show-appointment-actions">
          <button className="show-btn-view">{t('view_report')}</button>
          <button className="show-btn-delete">{t('delete_appointment')}</button>
          <button className="show-btn-view-details" onClick={onViewDetails}>
            {t('view_details')}
          </button>
          <div className="show-appointment-colors">
            <a href="/" className="show-dot show-dot-green" aria-label={t('phone')}>
              <FaPhoneAlt />
            </a>
            <a href="/" className="show-dot show-dot-pink" aria-label={t('email')}>
              <IoMail />
            </a>
            <a href="/" className="show-dot show-dot-darkgreen" aria-label={t('whatsapp')}>
              <FaWhatsapp />
            </a>
            <a href="/" className="show-dot show-dot-blue" aria-label={t('telegram')}>
              <PiTelegramLogo />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ShowAppointment);