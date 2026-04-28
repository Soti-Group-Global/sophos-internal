import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaTrash } from "react-icons/fa";
import { tField } from "../utils/lang";
import { getDoctorsProfileImage } from "../utils/api";
import "../styles/DoctorProfileCard.css";

const DoctorProfileCard = ({
  doctor,
  onClick,
  onDelete,
  isCompact = false,
  isSelected = false,
}) => {
  const { i18n, t } = useTranslation();
  const lang = i18n.language || "en";

  const [profileImage, setProfileImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  const {
    _id,
    firstName,
    lastName,
    middleName,
    specialty,
    placeOfWork,
    location,
    imageUrl,
    profileFileId,
    profilePicture,
    feesAmount,
    currency,
    services,
    reviewStats,
    status,
  } = doctor;

  /* Load the profile image */
  useEffect(() => {
    const fetchImage = async () => {
      if (imageUrl) {
        setProfileImage(imageUrl);
        return;
      }

      if (profilePicture) {
        setProfileImage(`data:image/jpeg;base64,${profilePicture}`);
        return;
      }

      if (profileFileId) {
        setImageLoading(true);
        try {
          const res = await getDoctorsProfileImage(profileFileId);

          if (res.imageUrl) setProfileImage(res.imageUrl);
          else if (res.profilePicture) {
            setProfileImage(`data:image/jpeg;base64,${res.profilePicture}`);
          }
        } catch (err) {
        } finally {
          setImageLoading(false);
        }
      }
    };

    fetchImage();
  }, [profileFileId, imageUrl, profilePicture]);

  const nameFirst = tField(firstName, lang);
  const nameLast = tField(lastName, lang);
  const nameMiddle = tField(middleName, lang);

  const fullName = `${nameLast} ${nameFirst} ${nameMiddle}`.trim();
  const specialtyText = tField(specialty, lang);
  const locationText = tField(location, lang);
  const placeOfWorkText = tField(placeOfWork, lang);

  const rating = reviewStats?.averageRating || 0;
  const totalReviews = reviewStats?.totalReviews || 0;

  const avatarInitials = `${nameFirst?.[0] || ""}${
    nameLast?.[0] || ""
  }`.toUpperCase();

  // Status translation
  const getStatusText = () => {
    if (!status) return t("doctorProfileCard.status.notAvailable");
    
    const statusKey = status.toLowerCase().replace(/\s+/g, '_');
    return t(`doctorProfileCard.status.${statusKey}`, status);
  };

  // Status styling based on value
  const getStatusClass = () => {
    if (!status) return "status-default";
    
    const statusLower = status.toLowerCase();
    // Check inactive first to avoid matching "active" in "inactive"
    if (statusLower.includes("inactive") || statusLower.includes("rejected")) {
      return "status-inactive";
    } else if (statusLower.includes("active") || statusLower.includes("approved")) {
      return "status-active";
    } else if (statusLower.includes("pending") || statusLower.includes("waiting")) {
      return "status-pending";
    } else if (statusLower.includes("busy") || statusLower.includes("occupied")) {
      return "status-busy";
    }
    return "status-default";
  };

  const renderStars = (r) => {
    const full = Math.floor(r);
    const half = r % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);

    return (
      <>
        {"★".repeat(full)}
        {half && "☆"}
        {"☆".repeat(empty)}
      </>
    );
  };

  const activeServices = (() => {
    if (!services) return [];
    if (Array.isArray(services)) return services;

    const list = [];
    if (services.online) list.push("Online");
    if (services.offline) list.push("Offline");
    return list;
  })();

  const getServiceLabel = (s) => {
    if (typeof s === "object" && s.name) return tField(s.name, lang);
    if (s === "Online") return t("doctorProfile.options.services.online");
    if (s === "Offline") return t("doctorProfile.options.services.offline");
    return s;
  };

  /** Handles image states */
  const renderImage = (compact = false) => {
    if (imageLoading) {
      return (
        <div className={`image-loading ${compact ? "compact" : ""}`}>
          <div className="loading-spinner" />
        </div>
      );
    }

    if (profileImage) {
      return (
        <img
          src={profileImage}
          alt={fullName}
          onError={() => setProfileImage(null)}
        />
      );
    }

    return <div className="doctor-avatar">{avatarInitials}</div>;
  };

  /* COMPACT CARD */
  if (isCompact) {
    return (
      <div className={`doctor-card-compact ${isSelected ? "selected" : ""}`}>
        <div className="compact-header">
          <div className="compact-image">{renderImage(true)}</div>

          <div className="compact-info">
            <h4 className="doctor_name">{fullName}</h4>
            <p className="doctor-specialty">{specialtyText}</p>

          </div>
        </div>
        
        {/* Status badge for compact card */}
        {status && (
          <div className={`status-badge-compact ${getStatusClass()}`}>
            {getStatusText()}
          </div>
        )}
      </div>
    );
  }

  /* FULL CARD */
  return (
    <div className="doctor-card" onClick={onClick}>
      {onDelete && (
        <button
          className="btn-delete-top"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <FaTrash size={14} />
        </button>
      )}

      <div className="doctor-card-header">
        <div className="doctor-image">{renderImage()}</div>

        <div className="doctor-basic-info">
          <h3 className="doctor-name">{fullName}</h3>
          <p className="doctor-specialty">{specialtyText}</p>
          <p className="doctor-location">{locationText}</p>
        </div>
      </div>

      <div className="doctor-card-details">
        <p className="doctor-workplace">{placeOfWorkText}</p>

        <div className="doctor-services">
          {activeServices.map((s, i) => (
            <span key={i} className="service-tag">
              {getServiceLabel(s)}
            </span>
          ))}
        </div>

        <div className="doctor-fees">
          <span className="fees-label">
            {t("doctorProfileCard.fees.consultation")}:
          </span>{" "}
          <span className="fees-amount">
            {currency === "INR" ? "₹" : currency === "RUB" ? "₽" : currency}
            {feesAmount}
          </span>
        </div>
        
        {/* Status badge for full card */}
        <div>
        {status && (
          <div className={`status-badge ${getStatusClass()}`}>
            {getStatusText()}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default DoctorProfileCard;