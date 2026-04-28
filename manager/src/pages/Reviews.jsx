import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FaStar,
  FaRegStar,
  FaTimes,
  FaUpload,
  FaEdit,
  FaTrash,
  FaSearch,
  FaWhatsapp,
  FaTelegram,
  FaEnvelope,
  FaPhone,
  FaUser,
  FaFileVideo,
  FaImage,
  FaFile,
  FaDownload,
  FaSync,
  FaCheckCircle,
  FaClock,
  FaFilter,
  FaEye,
  FaStethoscope,
  FaPlus,
} from "react-icons/fa";
import {
  MdMessage,
  MdEmail,
  MdPhone,
  MdPerson,
  MdVideoLibrary,
  MdImage,
} from "react-icons/md";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import "../styles/Reviews.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  getReviewFileUrl,
  getProfile,
} from "../utils/api";
import { toast } from "react-toastify";
import { useBranch } from "../context/BranchContext";

const Reviews = () => {
  const { t, i18n } = useTranslation();
  const { selectedBranch, setSelectedBranch } = useBranch();
  const [availableBranches, setAvailableBranches] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editedReview, setEditedReview] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [profilePictures, setProfilePictures] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "https://apimanager.health-direct.ru/api";

  const langKey = i18n.language?.toLowerCase().startsWith("ru") ? "ru" : "en";

  const normalizeBranches = (rawBranches) => {
    if (!rawBranches) return [];
    if (Array.isArray(rawBranches)) {
      return rawBranches
        .map((b) => (typeof b === "string" ? b : b?.name || b?.branch))
        .filter(Boolean);
    }
    if (typeof rawBranches === "string") return [rawBranches];
    if (typeof rawBranches === "object") return [rawBranches.name || rawBranches.branch].filter(Boolean);
    return [];
  };

  const normalizeBranchValue = (value) => {
    if (!value) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower.includes("moscow")) return "Moscow Clinic";
    if (lower.includes("makhachkala")) return "Makhachkala Clinic";
    return raw;
  };

  const branchOptions = useMemo(() => {
    const list = availableBranches.length ? availableBranches : ["Moscow Clinic", "Makhachkala Clinic"];
    const canonical = list.map((b) => normalizeBranchValue(b)).filter(Boolean);
    return Array.from(new Set(canonical));
  }, [availableBranches]);

  const singleBranch = useMemo(
    () => (branchOptions.length === 1 ? branchOptions[0] : null),
    [branchOptions]
  );

  // Get text from language-specific fields
  const getText = (field, language = i18n.language) => {
    if (!field) return "";

    // If it's already a string, return it directly
    if (typeof field === "string") return field;

    // If it's an object with language properties
    if (typeof field === "object") {
      // Return the specific language if it exists
      if (field[language]) {
        return field[language];
      }

      // Fallback to English or any available language
      return field.en || field.ru || Object.values(field)[0] || "";
    }

    return String(field);
  };

  // Get patient name as full string
  const getPatientFullName = (review, language = i18n.language) => {
    if (!review?.patientName) return "Unknown Patient";

    const nameData = review.patientName[language];
    if (!nameData) {
      // Fallback to any available language
      const fallbackData = review.patientName.en || review.patientName.ru || {};
      const { firstName = "", middleName = "", lastName = "" } = fallbackData;
      return (
        `${firstName} ${middleName} ${lastName}`.trim() || "Unknown Patient"
      );
    }

    const { firstName = "", middleName = "", lastName = "" } = nameData;

    if (language === "ru") {
      return `${lastName} ${firstName} ${middleName}`.trim();
    }

    return `${firstName} ${middleName} ${lastName}`.trim();
  };

  // Get contact information
  const getContactInfo = (review) => {
    if (!review?.contactInfo) return null;

    return {
      phone: review.contactInfo.phone || "",
      email: review.contactInfo.email || "",
      whatsapp: review.contactInfo.whatsapp || false,
      telegram: review.contactInfo.telegram || false,
      max: review.contactInfo.max || false,
    };
  };

  // Get doctor display name - handles both doctor object and doctor ID
  const getDoctorDisplayName = (doctor, language = langKey) => {
    if (!doctor) return "";

    // If doctor is an object with name fields
    if (doctor.firstName || doctor.lastName) {
      // Use displayName if available
      if (doctor.displayName && doctor.displayName[language]) {
        return doctor.displayName[language];
      }

      // Otherwise build from individual name parts
      const firstName =
        doctor.firstName?.[language] ||
        doctor.firstName?.en ||
        doctor.firstName?.ru ||
        doctor.firstName ||
        "";
      const middleName =
        doctor.middleName?.[language] ||
        doctor.middleName?.en ||
        doctor.middleName?.ru ||
        doctor.middleName ||
        "";
      const lastName =
        doctor.lastName?.[language] ||
        doctor.lastName?.en ||
        doctor.lastName?.ru ||
        doctor.lastName ||
        "";

      // For Russian, typically it's LastName FirstName MiddleName
      if (language === "ru") {
        return `${lastName} ${firstName} ${middleName}`.trim();
      }

      // For English, typically it's FirstName MiddleName LastName
      return `${firstName} ${middleName} ${lastName}`.trim();
    }

    return "Unknown Doctor";
  };

  // Get doctor from review - handles both doctor object and doctor ID
  const getDoctorFromReview = (review) => {
    if (!review?.doctorId) return null;

    // If doctorId is an object (populated doctor)
    if (typeof review.doctorId === "object" && review.doctorId._id) {
      return review.doctorId;
    }

    // If doctorId is a string (doctor ID), find in doctors list
    if (typeof review.doctorId === "string") {
      return doctors.find((doctor) => doctor._id === review.doctorId) || null;
    }

    return null;
  };

  // Get doctor ID from review - handles both cases
  const getDoctorIdFromReview = (review) => {
    if (!review?.doctorId) return "";

    if (typeof review.doctorId === "object" && review.doctorId._id) {
      return review.doctorId._id;
    }

    return review.doctorId;
  };

  // Get profile picture URL for a review
  const getProfilePicture = (reviewId) => {
    return profilePictures[reviewId] || "/nopic.jpg";
  };

  // Load profile picture for a review
  const loadProfilePicture = async (reviewId, profilePictureId) => {
    if (!profilePictureId) return;

    try {
      const url = getReviewFileUrl(profilePictureId);
      const response = await fetch(url);
      const blob = await response.blob();

      if (blob.type.startsWith("image/")) {
        const profilePictureUrl = URL.createObjectURL(blob);
        setProfilePictures((prev) => ({
          ...prev,
          [reviewId]: profilePictureUrl,
        }));
      }
    } catch (error) {
      // Use default avatar if profile picture fails to load
      setProfilePictures((prev) => ({
        ...prev,
        [reviewId]: "/nopic.jpg",
      }));
    }
  };

  // Initialize empty review for create mode
  const getEmptyReview = () => ({
    patientName: {
      en: { firstName: "", middleName: "", lastName: "" },
      ru: { firstName: "", middleName: "", lastName: "" },
    },
    description: { en: "", ru: "" },
    contactInfo: {
      phone: "",
      email: "",
      whatsapp: false,
      telegram: false,
      max: false,
    },
    rating: 5,
    status: "Posted",
    branch: singleBranch || normalizeBranchValue(selectedBranch) || "",
    doctorId: "",
    doctorEmail: "",
    reviewFileIds: [],
  });

  // Fetch reviews
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await getProfile();
        const branches = normalizeBranches(res?.data?.user?.branches || res?.data?.user?.branch);
        if (branches.length) {
          setAvailableBranches(branches);
        }
      } catch (error) {
      }
    };
    loadBranches();

    const fetchReviews = async () => {
      setLoading(true);
      try {
        const branchFilter =
          String(selectedBranch).toLowerCase() === "all"
            ? singleBranch || undefined
            : normalizeBranchValue(selectedBranch) || singleBranch || undefined;
        const response = await getReviews({ branch: branchFilter });

        if (response && Array.isArray(response.reviews)) {
          setReviews(response.reviews);

          // Load profile pictures for all reviews
          response.reviews.forEach((review) => {
            if (review.userProfileId) {
              loadProfilePicture(review._id, review.userProfileId);
            }
          });
        } else if (Array.isArray(response)) {
          setReviews(response);
        } else {
          setError("Invalid data format received from server");
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, [selectedBranch, singleBranch]);

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      try {
        const response = await fetch(`${API_BASE}/doctors-profile/minimal`);
        const data = await response.json();

        if (response.ok && Array.isArray(data.formattedDoctors)) {
          setDoctors(data.formattedDoctors);
        } else {
          setDoctors([]);
        }
      } catch (error) {
        toast.error("Failed to load doctors list");
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, [API_BASE]);

  // Filter reviews based on search term and filters
  const filteredReviews = useMemo(() => {
    let filtered = reviews;

    // Apply search filter
    if (searchTerm) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (review) =>
          getPatientFullName(review)
            ?.toLowerCase()
            .includes(lowercasedSearch) ||
          getPatientFullName(review, "ru")
            ?.toLowerCase()
            .includes(lowercasedSearch) ||
          getText(review.description)
            ?.toLowerCase()
            .includes(lowercasedSearch) ||
          getText(review.description, "ru")
            ?.toLowerCase()
            .includes(lowercasedSearch) ||
          getContactInfo(review)
            ?.phone?.toLowerCase()
            .includes(lowercasedSearch) ||
          getContactInfo(review)
            ?.email?.toLowerCase()
            .includes(lowercasedSearch) ||
          getDoctorDisplayName(getDoctorFromReview(review))
            ?.toLowerCase()
            .includes(lowercasedSearch)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (review) => review.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Apply rating filter
    if (ratingFilter !== "all") {
      filtered = filtered.filter(
        (review) => review.rating === parseInt(ratingFilter)
      );
    }

    return filtered;
  }, [reviews, searchTerm, statusFilter, ratingFilter, i18n.language, doctors]);

  const StarRating = ({ rating, size = 16 }) => {
    return (
      <div className="reviews-star-rating">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="reviews-star">
            {index < rating ? (
              <FaStar color="#FFD700" size={size} />
            ) : (
              <FaRegStar color="#FFD700" size={size} />
            )}
          </div>
        ))}
        <span className="reviews-rating-text">({rating}/5)</span>
      </div>
    );
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);

    if (files.length + selectedFiles.length > 3) {
      alert(t("reviews.alerts.maxFiles"));
      event.target.value = "";
      return;
    }

    const newFiles = files.slice(0, 3 - selectedFiles.length);
    setSelectedFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreviews((prev) => [
            ...prev,
            {
              url: e.target.result,
              name: file.name,
              type: "image",
              isNew: true,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("video/")) {
        setFilePreviews((prev) => [
          ...prev,
          {
            url: URL.createObjectURL(file),
            name: file.name,
            type: "video",
            isNew: true,
          },
        ]);
      }
    });

    event.target.value = "";
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  const handleCreateReview = () => {
    setSelectedReview(null);
    setEditedReview(getEmptyReview());
    setSelectedFiles([]);
    setFilePreviews([]);
    setIsCreating(true);
    setIsEditing(true); // Directly show edit mode for create
    setIsModalOpen(true);
  };

  // Auto-assign branch when only one available and modal is open
  useEffect(() => {
    if (isModalOpen && singleBranch && !editedReview?.branch) {
      setEditedReview((prev) => ({ ...(prev || {}), branch: singleBranch }));
    }
  }, [isModalOpen, singleBranch, editedReview?.branch]);

  const handleOpenFullReview = (review) => {
    setSelectedReview(review);
    // Ensure we only pass the doctor ID string, not the object
    const doctorId = getDoctorIdFromReview(review);
    setEditedReview({
      ...review,
      doctorId: doctorId, // This ensures we only store the ID string
      branch:
        normalizeBranchValue(
          Array.isArray(review.branch) ? review.branch[0] || "" : review.branch
        ) || singleBranch || "",
    });
    setSelectedFiles([]);
    setFilePreviews([]);

    if (review.reviewFileIds?.length) {
      const previews = review.reviewFileIds.map((fileId) => ({
        fileId,
        url: getReviewFileUrl(fileId),
        name: `File-${fileId}`,
        type: "unknown",
        isNew: false,
      }));
      setFilePreviews(previews);
    }

    setIsModalOpen(true);
    setIsCreating(false);
    setIsEditing(false); // Start in view mode for existing reviews
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReview(null);
    setEditedReview(null);
    setSelectedFiles([]);
    setFilePreviews([]);
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      if (editedReview?.reviewFileIds?.length) {
        const existingPreviews = editedReview.reviewFileIds.map((fileId) => ({
          fileId,
          url: getReviewFileUrl(fileId),
          name: `File-${fileId}`,
          type: "unknown",
          isNew: false,
        }));
        setFilePreviews(existingPreviews);
      }
    } else {
      setSelectedFiles([]);
      setFilePreviews((prev) => prev.filter((preview) => !preview.isNew));
    }
  };

  const handleDoctorChange = (e) => {
    const selectedDoctorId = e.target.value;
    const selectedDoctor = doctors.find(
      (doctor) => doctor._id === selectedDoctorId
    );

    setEditedReview((prev) => ({
      ...prev,
      doctorId: selectedDoctorId, // Store only the ID string
      doctorEmail: selectedDoctor ? selectedDoctor.email : "",
    }));
  };

  const handleSaveChanges = async () => {
    try {
      const formData = new FormData();

      // Patient name with language-specific split fields
      formData.append(
        "patientName",
        JSON.stringify({
          en: {
            firstName: getText(editedReview.patientName?.en?.firstName, "en"),
            middleName: getText(editedReview.patientName?.en?.middleName, "en"),
            lastName: getText(editedReview.patientName?.en?.lastName, "en"),
          },
          ru: {
            firstName: getText(editedReview.patientName?.ru?.firstName, "ru"),
            middleName: getText(editedReview.patientName?.ru?.middleName, "ru"),
            lastName: getText(editedReview.patientName?.ru?.lastName, "ru"),
          },
        })
      );

      // Description with language-specific text
      formData.append(
        "description",
        JSON.stringify({
          en: getText(editedReview.description, "en"),
          ru: getText(editedReview.description, "ru"),
        })
      );

      // Contact information
      const contactInfo = getContactInfo(editedReview) || {};
      formData.append("contactInfo", JSON.stringify(contactInfo));

      // Rating and status
      formData.append("rating", editedReview.rating.toString());
      formData.append("status", editedReview.status);
      formData.append("branch", editedReview.branch || "");

      // Add doctor information - ensure we only send the ID string
      if (editedReview.doctorId) {
        // If doctorId is an object, extract the _id, otherwise use the string
        const doctorId =
          typeof editedReview.doctorId === "object"
            ? editedReview.doctorId._id
            : editedReview.doctorId;

        formData.append("doctorId", doctorId);

        // Find doctor email if available
        const doctor = doctors.find((d) => d._id === doctorId);
        if (doctor && doctor.email) {
          formData.append("doctorEmail", doctor.email);
        } else if (editedReview.doctorEmail) {
          formData.append("doctorEmail", editedReview.doctorEmail);
        }
      }

      // Add files
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      let response;
      if (isCreating) {
        // Create new review
        response = await createReview(formData);
      } else {
        // Update existing review
        response = await updateReview(editedReview._id, formData);
      }

      if (response.success) {
        if (isCreating) {
          // Add new review to the list
          setReviews((prev) => [response.review, ...prev]);
          toast.success(t("reviews.alerts.createSuccess"));
        } else {
          // Update existing review
          const updatedReviews = reviews.map((review) =>
            review._id === editedReview._id ? response.review : review
          );
          setReviews(updatedReviews);
          toast.success(t("reviews.alerts.updateSuccess"));
        }

        handleCloseModal();
      } else {
        throw new Error(
          response.message || isCreating ? "Create failed" : "Update failed"
        );
      }
    } catch (error) {
      
      toast.error(
        t(`reviews.alerts.${isCreating ? "createError" : "updateError"}`, {
          error: error.message,
        })
      );
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (window.confirm(t("reviews.alerts.deleteConfirm"))) {
      try {
        await deleteReview(reviewId);
        setReviews((prev) => prev.filter((review) => review._id !== reviewId));
        if (selectedReview && selectedReview._id === reviewId) {
          handleCloseModal();
        }
        toast.success("Review deleted successfully");
      } catch (error) {
        toast.error(`Error deleting review: ${error.message}`);
      }
    }
  };

  const handleInputChange = (
    field,
    value,
    language = i18n.language,
    nameField = null
  ) => {
    setEditedReview((prev) => {
      if (nameField && field === "patientName") {
        return {
          ...prev,
          patientName: {
            ...prev.patientName,
            [language]: {
              ...prev.patientName?.[language],
              [nameField]: value,
            },
          },
        };
      }

      if (field === "contactInfo") {
        return {
          ...prev,
          contactInfo: {
            ...prev.contactInfo,
            ...value,
          },
        };
      }

      if (field === "description") {
        return {
          ...prev,
          description: {
            ...prev.description,
            [language]: value,
          },
        };
      }

      if (typeof prev[field] === "object" && prev[field] !== null) {
        return {
          ...prev,
          [field]: {
            ...prev[field],
            [language]: value,
          },
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleStatusChange = (newStatus) => {
    setEditedReview((prev) => ({
      ...prev,
      status: newStatus,
    }));
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const FilePreview = ({ preview, index, onRemove }) => {
    const [fileType, setFileType] = useState(preview.type);
    const [loading, setLoading] = useState(
      !preview.isNew && preview.type === "unknown"
    );

    useEffect(() => {
      const detectType = async () => {
        if (preview.isNew) {
          setLoading(false);
          return;
        }

        try {
          const res = await fetch(preview.url);
          const blob = await res.blob();

          if (blob.type.startsWith("image/")) {
            setFileType("image");
          } else if (blob.type.startsWith("video/")) {
            setFileType("video");
          } else if (blob.type === "application/pdf") {
            setFileType("pdf");
          } else {
            setFileType("unknown");
          }
        } catch (err) {
          setFileType("unknown");
        }

        setLoading(false);
      };

      detectType();
    }, [preview.url]);

    if (loading) {
      return (
        <div className="reviews-file-preview-item">
          <div className="reviews-file-placeholder reviews-loading">
            <div className="reviews-loading-spinner"></div>
            <span>{t("reviews.modal.loading")}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="reviews-file-preview-item">
        <div className="reviews-file-preview-content">
          {fileType === "image" && (
            <div className="reviews-preview-image-container">
              <img
                src={preview.url}
                className="reviews-preview-image"
                alt={preview.name}
              />
              <div className="reviews-file-type-badge">
                <MdImage size={14} />
              </div>
            </div>
          )}

          {fileType === "video" && (
            <div className="reviews-preview-video-container">
              <video
                src={preview.url}
                controls
                className="reviews-preview-video"
              />
              <div className="reviews-file-type-badge">
                <MdVideoLibrary size={14} />
              </div>
            </div>
          )}

          {fileType === "pdf" && (
            <div className="reviews-preview-pdf-container">
              <FaFile size={32} className="reviews-pdf-icon" />
              <div className="reviews-file-type-badge">
                <FaFile size={12} />
              </div>
            </div>
          )}

          {fileType === "unknown" && (
            <div className="reviews-file-placeholder">
              <FaFile size={32} className="reviews-file-icon" />
              <div className="reviews-file-type-badge">
                <FaFile size={12} />
              </div>
            </div>
          )}
        </div>

        <div className="reviews-file-preview-info">
          <span className="reviews-file-name" title={preview.name}>
            {preview.name.length > 20
              ? `${preview.name.substring(0, 20)}...`
              : preview.name}
          </span>

          <div className="reviews-file-actions">
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="reviews-download-btn"
              title="Download"
            >
              <FaDownload size={12} />
            </a>

            {onRemove && (
              <button
                className="reviews-remove-file-btn"
                onClick={() => onRemove(index)}
                title="Remove file"
              >
                <FaTimes size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  
  const getTranslatedStatus = () => {
    const statusKey = status.toLowerCase();
    return t(`reviews.status.${statusKey}`, status);
  };
  
  return (
    <div className={`reviews-status-badge reviews-${status.toLowerCase()}`}>
      {status === "Approved" ? (
        <FaCheckCircle size={12} />
      ) : (
        <FaClock size={12} />
      )}
      {getTranslatedStatus()}
    </div>
  );
};

  const ContactBadge = ({ type, active }) =>
    active && (
      <div className={`reviews-contact-badge reviews-${type}`}>
        {type === "whatsapp" && <FaWhatsapp size={12} />}
        {type === "telegram" && <FaTelegram size={12} />}
        {type === "email" && <FaEnvelope size={12} />}
        {type === "phone" && <FaPhone size={12} />}
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </div>
    );

  if (loading)
    return (
      <div className="reviews-loading-container">
        <div className="reviews-loading-spinner reviews-large"></div>
        <p>{t("reviews.loading")}</p>
      </div>
    );

  if (error)
    return (
      <div className="reviews-error-container">
        <div className="reviews-error-icon">⚠️</div>
        <h3>{t("reviews.errorTitle")}</h3>
        <p>{t("reviews.error", { error })}</p>
        <button
          className="reviews-btn-primary"
          onClick={() => window.location.reload()}
        >
          <FaSync /> {t("reviews.retry")}
        </button>
      </div>
    );

  return (
    <div className="reviews-modern">
      {/* Header */}
      <div className="reviews-header">
        <div className="page-title-section">
          <div className="review-breadcrumb">
            <a href="#" className="review-breadcrumb-link">
              {t("reviews.breadcrumb.dashboard")}
            </a>
            <span className="review-breadcrumb-separator">›</span>
            <span className="review-breadcrumb-current">
              {t("reviews.breadcrumb.management")}
            </span>
          </div>
        </div>
        <div className="reviews-header-content">
          <div className="reviews-header-title">
            <h1>{t("reviews.title")}</h1>
            <p>{t("reviews.subtitle")}</p>
          </div>
          <div className="reviews-header-actions">
            <button className="reviews-btn-refresh" onClick={handleCreateReview}>
              <FaPlus /> {t("reviews.createReview")}
            </button>
            <button
              className="reviews-btn-refresh"
              onClick={() => window.location.reload()}
            >
              <FaSync /> {t("reviews.refresh")}
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="reviews-filters-section">
        <div className="reviews-search-box">
          <FaSearch className="reviews-search-icon" />
          <input
            type="text"
            placeholder={t("reviews.search.placeholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            className="reviews-search-input"
          />
          {searchTerm && (
            <button onClick={clearSearch} className="reviews-clear-search-btn">
              <FaTimes />
            </button>
          )}
        </div>

        <div className="reviews-filter-controls">
         

          <div className="reviews-filter-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="reviews-filter-select"
            >
              <option value="all">{t("reviews.status.all")}</option>
              <option value="posted">{t("reviews.status.posted")}</option>
              <option value="approved">{t("reviews.status.approved")}</option>
            </select>
          </div>

          <div className="reviews-filter-group">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="reviews-filter-select"
            >
              <option value="all">{t("reviews.allRating")}</option>
              <option value="5">5 {t("reviews.stars")}</option>
              <option value="4">4 {t("reviews.stars")}</option>
              <option value="3">3 {t("reviews.stars")}</option>
              <option value="2">2 {t("reviews.stars")}</option>
              <option value="1">1 {t("reviews.star")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="reviews-results-count">
        <span>
          {t("reviews.showing")} {filteredReviews.length}  {t("reviews.of")} {reviews.length}  {t("reviews.reviews")}
        </span>
      </div>

      {/* Reviews Grid */}
      <div className="reviews-grid">
        {filteredReviews.length === 0 ? (
          <div className="reviews-empty-state">
            <div className="reviews-empty-icon">📝</div>
            <h3>
              {searchTerm || statusFilter !== "all" || ratingFilter !== "all"
                ? t("reviews.search.noResults")
                : t("reviews.noReviews")}
            </h3>
            <p>{t("reviews.noReviews")}</p>
          </div>
        ) : (
          filteredReviews.map((review) => {
            const doctor = getDoctorFromReview(review);
            return (
              <div key={review._id} className="reviews-card-modern"
              onClick={() => handleOpenFullReview(review)}>
                <div className="reviews-card-header">
                  <div className="reviews-patient-info">
                    <div className="reviews-patient-avatar">
                      <img
                        src={getProfilePicture(review._id)}
                        alt={getPatientFullName(review)}
                        className="reviews-avatar-image"
                      />
                    </div>
                    <div className="reviews-patient-details">
                      <h3 className="reviews-patient-name">
                        {getPatientFullName(review)}
                      </h3>
                      <div className="reviews-review-meta">
                        <StarRating rating={review.rating} size={14} />
                        <span className="reviews-review-date">
                          {new Date(review.postedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={review.status} />
                </div>

                <div className="reviews-card-content">
                   {/* 
                  <p className="reviews-review-text">
                    {getText(review.description)}
                  </p>
*/}
                  {/* Doctor Information */}
                  {doctor && (
                    <div className="reviews-doctor-info">
                      <FaStethoscope className="reviews-doctor-icon" />
                      <span>{t("reviews.doctor")}: {getDoctorDisplayName(doctor)}</span>
                    </div>
                  )}

                  {/* Contact Information 
                  {getContactInfo(review) && (
                    <div className="reviews-contact-info">
                      {getContactInfo(review).phone && (
                        <div className="reviews-contact-item">
                          <FaPhone className="reviews-contact-icon" />
                          <span>{getContactInfo(review).phone}</span>
                        </div>
                      )}
                      {getContactInfo(review).email && (
                        <div className="reviews-contact-item">
                          <FaEnvelope className="reviews-contact-icon" />
                          <span>{getContactInfo(review).email}</span>
                        </div>
                      )}
                      <div className="reviews-social-badges">
                        <ContactBadge
                          type="whatsapp"
                          active={getContactInfo(review).whatsapp}
                        />
                        <ContactBadge
                          type="telegram"
                          active={getContactInfo(review).telegram}
                        />
                      </div>
                    </div>
                  )}

                  */}

                  {/* File Attachments 
                  {review.reviewFileIds && review.reviewFileIds.length > 0 && (
                    <div className="reviews-file-attachments">
                      <div className="reviews-attachments-header">
                        <FaFileVideo className="reviews-attachment-icon" />
                        <span>
                          {review.reviewFileIds.length}{" "}
                          {t("reviews.attachment")}
                          {review.reviewFileIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  )}
                  */}


                </div>
{/*
                <div className="reviews-card-actions">
                  <button
                    className="reviews-btn-view"
                  >
                    <FaEye /> {t("reviews.viewDetails")}
                  </button>
                </div>
                */}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="reviews-modal-overlay">
          <div className="reviews-modal-container">
            <div className="reviews-modal-header">
              <h2>
                <MdPerson className="reviews-header-icon" />
                {isCreating
                  ? t("reviews.createReview")
                  : t("reviews.modal.title")}
              </h2>
              <button
                className="reviews-modal-close"
                onClick={handleCloseModal}
              >
                <FaTimes />
              </button>
            </div>

            <div className="reviews-modal-content">
              {/* Show profile picture only in view mode for existing reviews */}
              {!isCreating && !isEditing && (
                <div className="reviews-form-group">
                  <label>{t("reviews.modal.profilePicture")}:</label>
                  <div className="reviews-profile-picture-display">
                    <img
                      src={getProfilePicture(selectedReview._id)}
                      alt={getPatientFullName(selectedReview)}
                      className="reviews-profile-image"
                    />
                  </div>
                </div>
              )}

              {/* Patient Name - English */}
              <div className="reviews-form-group">
                <label>{t("reviews.modal.patientNameEn")}:</label>
                {isEditing ? (
                  <div className="reviews-name-fields-grid">
                    <input
                      type="text"
                      placeholder={t("reviews.modal.placeholder_first_name")}
                      value={getText(
                        editedReview.patientName?.en?.firstName,
                        "en"
                      )}
                      onChange={(e) =>
                        handleInputChange(
                          "patientName",
                          e.target.value,
                          "en",
                          "firstName"
                        )
                      }
                      className="reviews-edit-input"
                    />
                    <input
                      type="text"
                      placeholder={t("reviews.modal.placeholder_middle_name")}
                      value={getText(
                        editedReview.patientName?.en?.middleName,
                        "en"
                      )}
                      onChange={(e) =>
                        handleInputChange(
                          "patientName",
                          e.target.value,
                          "en",
                          "middleName"
                        )
                      }
                      className="reviews-edit-input"
                    />
                    <input
                      type="text"
                      placeholder={t("reviews.modal.placeholder_last_name")}
                      value={getText(
                        editedReview.patientName?.en?.lastName,
                        "en"
                      )}
                      onChange={(e) =>
                        handleInputChange(
                          "patientName",
                          e.target.value,
                          "en",
                          "lastName"
                        )
                      }
                      className="reviews-edit-input"
                    />
                  </div>
                ) : (
                  <p className="reviews-view-text">
                    {getPatientFullName(
                      isCreating ? editedReview : selectedReview
                    )}
                  </p>
                )}
              </div>

              {/* Patient Name - Russian */}
              {isEditing && (
                <div className="reviews-form-group">
                  <label>{t("reviews.modal.patientNameRu")}:</label>
                  <div className="reviews-name-fields-grid">
                    <input
                      type="text"
                      placeholder={t("reviews.modal.placeholder_first_name")}
                      value={getText(
                        editedReview.patientName?.ru?.firstName,
                        "ru"
                      )}
                      onChange={(e) =>
                        handleInputChange(
                          "patientName",
                          e.target.value,
                          "ru",
                          "firstName"
                        )
                      }
                      className="reviews-edit-input"
                    />
                    <input
                      type="text"
                      placeholder={t("reviews.modal.placeholder_middle_name")}
                      value={getText(
                        editedReview.patientName?.ru?.middleName,
                        "ru"
                      )}
                      onChange={(e) =>
                        handleInputChange(
                          "patientName",
                          e.target.value,
                          "ru",
                          "middleName"
                        )
                      }
                      className="reviews-edit-input"
                    />
                    <input
                      type="text"
                      placeholder={t("reviews.modal.placeholder_last_name")}
                      value={getText(
                        editedReview.patientName?.ru?.lastName,
                        "ru"
                      )}
                      onChange={(e) =>
                        handleInputChange(
                          "patientName",
                          e.target.value,
                          "ru",
                          "lastName"
                        )
                      }
                      className="reviews-edit-input"
                    />
                  </div>
                </div>
              )}

              {/* Doctor Selection */}
              {isEditing && (
                <div className="reviews-form-group">
                  <label>{t("reviews.modal.doctor")}:</label>
                  <select
                    value={getDoctorIdFromReview(editedReview) || ""}
                    onChange={handleDoctorChange}
                    className="reviews-edit-select"
                  >
                    <option value="">{t("reviews.modal.selectDoctor")}</option>
                    {loadingDoctors ? (
                      <option disabled>{t("reviews.modal.loadingDoctor")}</option>
                    ) : (
                      doctors.map((doctor) => (
                        <option key={doctor._id} value={doctor._id}>
                          {getDoctorDisplayName(doctor)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Branch Selection */}
              {isEditing && (
                <div className="reviews-form-group">
                  <label>{t("reviews.modal.branch")}:</label>
                  <select
                    value={editedReview.branch || ""}
                    onChange={(e) => handleInputChange("branch", e.target.value)}
                    className="reviews-edit-select"
                  >
                    <option value="">{t("reviews.modal.select_branch")}</option>
                    {branchOptions.map((branch) => {
                      const key = branch.toLowerCase().replace(/\s+/g, "_");
                      return (
                        <option key={branch} value={branch}>
                          {t(`branches.${key}`, { defaultValue: branch })}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Show doctor in view mode */}
              {!isEditing &&
                !isCreating &&
                getDoctorFromReview(selectedReview) && (
                  <div className="reviews-form-group">
                    <label>{t("reviews.modal.doctor")}:</label>
                    <div className="reviews-doctor-display">
                      <FaStethoscope className="reviews-doctor-display-icon" />
                      <span>
                        {getDoctorDisplayName(
                          getDoctorFromReview(selectedReview)
                        )}
                      </span>
                    </div>
                  </div>
                )}

              {/* Description */}
              <div className="reviews-form-group">
                <label>{t("reviews.modal.descriptionEn")}:</label>
                {isEditing ? (
                  <textarea
                    value={editedReview.description?.en || ""}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value, "en")
                    }
                    className="reviews-edit-textarea"
                    rows="4"
                  />
                ) : (
                  <p className="reviews-view-text">
                    {getText(
                      isCreating
                        ? editedReview.description
                        : selectedReview.description
                    )}
                  </p>
                )}
              </div>

              {/* Description Russian */}
              {isEditing && (
                <div className="reviews-form-group">
                  <label>{t("reviews.modal.descriptionRu")}:</label>
                  <textarea
                    value={editedReview.description?.ru || ""}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value, "ru")
                    }
                    className="reviews-edit-textarea"
                    rows="4"
                  />
                </div>
              )}

              {/* Contact Information */}
              <div className="reviews-form-group">
                <label>{t("reviews.modal.contactInfo")}:</label>
                {isEditing ? (
                  <div className="reviews-contact-fields">
                    <div className="reviews-phone-input-container">
                      <PhoneInput
                        defaultCountry="ru"
                        value={getContactInfo(editedReview)?.phone || ""}
                        onChange={(value) =>
                          handleInputChange("contactInfo", { phone: value })
                        }
                        className="reviews-phone-input"
                      />
                    </div>
                    <input
                      type="email"
                      placeholder={t("reviews.modal.email")}
                      value={getContactInfo(editedReview)?.email || ""}
                      onChange={(e) =>
                        handleInputChange("contactInfo", {
                          email: e.target.value,
                        })
                      }
                      className="reviews-edit-input"
                    />
                    <div className="reviews-social-checkboxes">
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            getContactInfo(editedReview)?.whatsapp || false
                          }
                          onChange={(e) =>
                            handleInputChange("contactInfo", {
                              whatsapp: e.target.checked,
                            })
                          }
                        />
                        WhatsApp
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            getContactInfo(editedReview)?.telegram || false
                          }
                          onChange={(e) =>
                            handleInputChange("contactInfo", {
                              telegram: e.target.checked,
                            })
                          }
                        />
                        Telegram
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={getContactInfo(editedReview)?.max || false}
                          onChange={(e) =>
                            handleInputChange("contactInfo", {
                              max: e.target.checked,
                            })
                          }
                        />
                        Max
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="reviews-contact-info-display">
                    {getContactInfo(isCreating ? editedReview : selectedReview)
                      ?.phone && (
                      <p>
                        <strong>{t("reviews.modal.phone")}:</strong>{" "}
                        {
                          getContactInfo(
                            isCreating ? editedReview : selectedReview
                          ).phone
                        }
                      </p>
                    )}
                    {getContactInfo(isCreating ? editedReview : selectedReview)
                      ?.email && (
                      <p>
                        <strong>{t("reviews.modal.email")}:</strong>{" "}
                        {
                          getContactInfo(
                            isCreating ? editedReview : selectedReview
                          ).email
                        }
                      </p>
                    )}
                    <div className="reviews-social-badges">
                      {getContactInfo(
                        isCreating ? editedReview : selectedReview
                      )?.whatsapp && (
                        <span className="reviews-contact-badge reviews-whatsapp">
                          WhatsApp
                        </span>
                      )}
                      {getContactInfo(
                        isCreating ? editedReview : selectedReview
                      )?.telegram && (
                        <span className="reviews-contact-badge reviews-telegram">
                          Telegram
                        </span>
                      )}
                      {getContactInfo(
                        isCreating ? editedReview : selectedReview
                      )?.max && (
                        <span className="reviews-contact-badge reviews-max">
                          Max
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Rating */}
              <div className="reviews-form-group">
                <label>{t("reviews.modal.rating")}:</label>
                {isEditing ? (
                  <select
                    value={editedReview.rating}
                    onChange={(e) =>
                      handleInputChange("rating", parseInt(e.target.value))
                    }
                    className="reviews-edit-select"
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <option key={num} value={num}>
                        {num} {num !== 1 ? t("reviews.stars") : t("reviews.star")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="reviews-view-rating">
                    <StarRating
                      rating={
                        isCreating ? editedReview.rating : selectedReview.rating
                      }
                    />
                    <span>
                      (
                      {isCreating ? editedReview.rating : selectedReview.rating}
                      /5)
                    </span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="reviews-form-group">
                <label>{t("reviews.modal.status")}:</label>
                {isEditing ? (
                  <select
                    value={editedReview.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="reviews-edit-select"
                  >
                    <option value="Posted">{t("reviews.status.posted")}</option>
                    <option value="Approved">
                      {t("reviews.status.approved")}
                    </option>
                  </select>
                ) : (
                  <span
                    className={`reviews-status-badge reviews-${
                      isCreating
                        ? editedReview.status.toLowerCase()
                        : selectedReview.status.toLowerCase()
                    }`}
                  >
                    {isCreating ? editedReview.status : selectedReview.status}
                  </span>
                )}
              </div>

              {/* File Upload Section - Only in Edit Mode */}
              {isEditing && (
                <div className="reviews-form-group">
                  <label>{t("reviews.modal.files")}:</label>
                  <div className="reviews-file-upload-section">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="reviews-file-input"
                      id="reviews-file-upload"
                    />
                    <label
                      htmlFor="reviews-file-upload"
                      className="reviews-file-upload-label"
                    >
                      <FaUpload /> {t("reviews.modal.chooseFiles")}
                    </label>
                    <span className="reviews-file-upload-hint">
                      {t("reviews.modal.filesSelected", {
                        count: selectedFiles.length,
                      })}
                    </span>

                    {selectedFiles.length > 0 && (
                      <button
                        type="button"
                        className="reviews-btn-clear-files"
                        onClick={clearAllFiles}
                      >
                        {t("reviews.modal.clearAll")}
                      </button>
                    )}
                  </div>

                  {/* File Previews */}
                  {filePreviews.length > 0 && (
                    <div className="reviews-file-previews-grid">
                      <h4>{t("reviews.modal.filePreviews")}:</h4>
                      <div className="reviews-previews-container">
                        {filePreviews.map((preview, index) => (
                          <FilePreview
                            key={index}
                            preview={preview}
                            index={index}
                            onRemove={preview.isNew ? removeFile : null}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show existing files in view mode */}
              {!isEditing &&
                !isCreating &&
                selectedReview.reviewFileIds &&
                selectedReview.reviewFileIds.length > 0 && (
                  <div className="reviews-form-group">
                    <label>{t("reviews.modal.attachedFiles")}:</label>
                    <div className="reviews-file-previews-grid">
                      <div className="reviews-previews-container">
                        {selectedReview.reviewFileIds.map((fileId, index) => (
                          <FilePreview
                            key={index}
                            preview={{
                              fileId,
                              url: getReviewFileUrl(fileId),
                              name: `File-${fileId}`,
                              type: "unknown",
                              isNew: false,
                            }}
                            index={index}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* Action Buttons */}
              <div className="reviews-modal-actions">
                {!isEditing && !isCreating ? (
                  <>
                    <button
                      className="reviews-btn-edit"
                      onClick={handleEditToggle}
                    >
                      <FaEdit /> {t("reviews.actions.editReview")}
                    </button>
                    <button
                      className="reviews-btn-delete"
                      onClick={() => handleDeleteReview(selectedReview._id)}
                    >
                      <FaTrash /> {t("reviews.actions.delete")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="reviews-btn-save"
                      onClick={handleSaveChanges}
                    >
                      <FaCheckCircle />{" "}
                      {isCreating
                        ? t("reviews.createReview")
                        : t("reviews.actions.saveChanges")}
                    </button>
                    <button
                      className="reviews-btn-cancel"
                      onClick={handleCloseModal}
                    >
                      <FaTimes /> {t("reviews.actions.cancel")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
