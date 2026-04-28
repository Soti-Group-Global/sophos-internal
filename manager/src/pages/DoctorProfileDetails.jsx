import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useTranslation } from "react-i18next";
import {
  createDoctorProfile,
  updateDoctorProfile,
  getDoctorProfileById,
  getDoctorsProfileImage,
  getAllSpecialties,
  getAllSubSpecialities,
} from "../utils/api";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaTimes,
  FaArrowLeft,
  FaCamera,
  FaTimesCircle,
  FaStar,
  FaCog,
} from "react-icons/fa";
import CommonRichTextEditor from "../components/RichTextEditor/CommonRichTextEditor";
import PhoneInput from "react-phone-input-2";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import "react-phone-input-2/lib/style.css";
import "react-toastify/dist/ReactToastify.css";
import "../styles/EmployeeModal.css";
import "../styles/DoctorProfileDetails.css";
import { getProfile } from "../utils/api";
import SpecialtyManagementPopup from "../components/SpecialtyManagementPopup";

const DoctorProfileDetails = ({
  doctor,
  isEdit,
  onClose,
  onSave,
  onDelete,
  showDeleteButton = false,
}) => {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    // Basic Information - Multilingual
    firstName: { en: "", ru: "" },
    middleName: { en: "", ru: "" },
    lastName: { en: "", ru: "" },
    email: "",
    phoneNumber: "",
    dateOfBirth: "",
    gender: "Male",
    age: "",
    photo: "",
    yearOfExperience: "",

    // Professional Information - Multilingual
    specialtyIds: [],
    subSpecialityIds: [],
    position: { en: "", ru: "" },
    regalia: { en: "", ru: "" },

    // Location & Languages - Multilingual
    location: { en: "", ru: "" },
    languages: [],

    // Services
    services: {
      online: false,
      offline: false,
    },

    expert: false,
    specialist: false,

    // Branches - Multilingual
    branches: [],

    // Professional Organizations - Rich Text Editors
    internationalMemberships: { en: "", ru: "" },
    russianMemberships: { en: "", ru: "" },

    // Awards - Rich Text Editor
    awards: { en: "", ru: "" },

    // Work Experience and Education - Rich Text Editors
    workExperience: { en: "", ru: "" },
    education: { en: "", ru: "" },
    advancedTraining: { en: "", ru: "" },

    // Scientific Activities - Rich Text Editor
    scientificActivities: { en: "", ru: "" },
    professionalDevelopments: { en: "", ru: "" },

    // Reviews
    reviews: [],

    // Fees
    feesAmount: "",
    currency: "RUB",

    // Rich Content - Multilingual
    about: { en: "", ru: "" },

    // Status
    status: "active",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("common");
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [availableBranches, setAvailableBranches] = useState([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const navigate = useNavigate();
  const formRef = useRef();
  const fileInputRef = useRef();

  // Specialty management states
  const [showSpecialtyPopup, setShowSpecialtyPopup] = useState(false);
  const [specialties, setSpecialties] = useState([]);
  const [subSpecialities, setSubSpecialities] = useState([]);
  const [allSubSpecialities, setAllSubSpecialities] = useState([]);



  // Get translation for a specific key
  const getTranslationForKey = (key, language) => {
    try {
      return t(key, { lng: language });
    } catch (error) {
      
      return key;
    }
  };

  // Get reverse translation - ONLY for common fields (services, languages, branches, etc.)
  const getReverseTranslation = (value, sourceLanguage, targetLanguage) => {
    if (!value || typeof value !== "string") return value;

    const trimmedValue = value.trim();
    if (!trimmedValue) return "";

    // Common translation mappings from your JSON files - ONLY FOR COMMON FIELDS
    const translationMappings = {
      // Services
      Online: "doctorProfile.options.services.online",
      Offline: "doctorProfile.options.services.offline",
      "Online Consultation": "doctorProfile.options.services.online",
      "Offline Consultation": "doctorProfile.options.services.offline",

      // Languages
      English: "doctorProfile.languages.english",
      Russian: "doctorProfile.languages.russian",
      Hindi: "doctorProfile.languages.hindi",
      Spanish: "doctorProfile.languages.spanish",
      French: "doctorProfile.languages.french",
      German: "doctorProfile.languages.german",
      Chinese: "doctorProfile.languages.chinese",
      Japanese: "doctorProfile.languages.japanese",
      Arabic: "doctorProfile.languages.arabic",

      // Branches
      "Main Branch": "doctorProfile.branches.main",
      "North Branch": "doctorProfile.branches.north",
      "South Branch": "doctorProfile.branches.south",
      "East Branch": "doctorProfile.branches.east",
      "West Branch": "doctorProfile.branches.west",
    };

    // Try to find the translation key by comparing values
    for (const [englishValue, translationKey] of Object.entries(
      translationMappings
    )) {
      const sourceTranslation = getTranslationForKey(
        translationKey,
        sourceLanguage
      );
      const targetTranslation = getTranslationForKey(
        translationKey,
        targetLanguage
      );

      if (sourceTranslation === trimmedValue) {
        return targetTranslation;
      }
    }

    // If no translation found, return the original value
    return trimmedValue;
  };

  // Normalize branches that may come as string/array/object
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

  // Language options for dropdown - using translations
  const languageOptions = useMemo(() => {
    return Object.entries(
      t("doctorProfile.languages", { returnObjects: true })
    ).map(([key, label]) => ({
      value: getTranslationForKey(`doctorProfile.languages.${key}`, "en"),
      label: label,
    }));
  }, [t]);

  // Branch options limited to branches current user can access
  const branchOptions = useMemo(() => {
    if (availableBranches.length > 0) {
      return availableBranches.map((branchName) => {
        const key = branchName.toLowerCase().replace(/\s+/g, "_");
        return {
          value: branchName,
          label: t(`branches.${key}`, { defaultValue: branchName }),
        };
      });
    }
    // Fallback to all translated branches if we could not load user-specific data
    const branches = t("branches", { returnObjects: true }) || {};
    return Object.entries(branches)
      .filter(([key]) => key !== "all")
      .map(([key, label]) => ({
        value: typeof label === "string" ? label : key,
        label: typeof label === "string" ? label : key,
      }));
  }, [availableBranches, t]);

  // Fetch specialties and sub-specialities
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const response = await getAllSpecialties();
        setSpecialties(response || []);
      } catch (error) {
        setSpecialties([]);
      }
    };

    const fetchSubSpecialities = async () => {
      try {
        const response = await getAllSubSpecialities();
        setAllSubSpecialities(response || []);
      } catch (error) {
        setAllSubSpecialities([]);
      }
    };

    fetchSpecialties();
    fetchSubSpecialities();
  }, []);

  // Filter sub-specialities based on selected specialties
  useEffect(() => {
    if (formData.specialtyIds && formData.specialtyIds.length > 0) {
      const filtered = allSubSpecialities.filter(
        sub => formData.specialtyIds.includes(sub.specialtyId._id)
      );
      setSubSpecialities(filtered);
    } else {
      setSubSpecialities([]);
    }
  }, [formData.specialtyIds, allSubSpecialities]);

  // Handle specialty popup close and refresh data
  const handleSpecialtyPopupClose = async () => {
    setShowSpecialtyPopup(false);
    // Refresh specialties and sub-specialities
    try {
      const [specialtiesRes, subSpecialitiesRes] = await Promise.all([
        getAllSpecialties(),
        getAllSubSpecialities()
      ]);
      setSpecialties(specialtiesRes || []);
      setAllSubSpecialities(subSpecialitiesRes || []);
    } catch (error) {
    }
  };

  // Fetch accessible branches for the logged-in user
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const response = await getProfile();
        const profileBranches = normalizeBranches(
          response?.data?.user?.branches || response?.data?.user?.branch
        );
        if (profileBranches.length > 0) {
          setAvailableBranches(profileBranches);
        }
      } catch (error) {
      }
    };
    loadBranches();
  }, []);

  // Calculate age from date of birth
  const calculateAge = (dateString) => {
    if (!dateString) return "";
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age.toString();
  };

  // Initialize form data when doctor prop changes
  useEffect(() => {
    const initializeDoctorData = async () => {
      if (isEdit && doctor) {
        // Convert languages array to react-select format
        const selectedLanguages = languageOptions.filter((lang) =>
          doctor.languages?.some(
            (docLang) => docLang.en === lang.value || docLang.ru === lang.label
          )
        );

        // Convert branches array to react-select format
        const selectedBranches = branchOptions.filter((branch) =>
          doctor.branches?.some(
            (docBranch) =>
              docBranch.en === branch.value || docBranch.ru === branch.label
          )
        );


        setFormData({
          firstName: doctor.firstName || { en: "", ru: "" },
          middleName: doctor.middleName || { en: "", ru: "" },
          lastName: doctor.lastName || { en: "", ru: "" },
          email: doctor.email || "",
          phoneNumber: doctor.phoneNumber || "",
          dateOfBirth: doctor.dateOfBirth
            ? new Date(doctor.dateOfBirth).toISOString().split("T")[0]
            : "",
          expert: doctor.expert || false,
          specialist: doctor.specialist || false,
          gender: doctor.gender || "Male",
          age: doctor.age || "",
          photo: doctor.photo || "",
          specialtyIds: Array.isArray(doctor.specialtyIds) 
            ? doctor.specialtyIds.map(s => typeof s === 'object' ? s._id : s)
            : doctor.specialtyIds ? [typeof doctor.specialtyIds === 'object' ? doctor.specialtyIds._id : doctor.specialtyIds] : [],
          subSpecialityIds: Array.isArray(doctor.subSpecialityIds)
            ? doctor.subSpecialityIds.map(s => typeof s === 'object' ? s._id : s)
            : doctor.subSpecialityIds ? [typeof doctor.subSpecialityIds === 'object' ? doctor.subSpecialityIds._id : doctor.subSpecialityIds] : [],
          position: doctor.position || { en: "", ru: "" },
          regalia: doctor.regalia || { en: "", ru: "" },
          location: doctor.location || { en: "", ru: "" },
          languages: selectedLanguages,
          services: doctor.services || { online: false, offline: false },
          branches: selectedBranches,
          yearOfExperience: doctor.yearOfExperience || 0,
          internationalMemberships: doctor.internationalMemberships || {
            en: "",
            ru: "",
          },
          russianMemberships: doctor.russianMemberships || { en: "", ru: "" },
          professionalDevelopments: doctor.professionalDevelopments || { en: "", ru: "" },
          awards: doctor.awards || { en: "", ru: "" },
          workExperience: doctor.workExperience || { en: "", ru: "" },
          education: doctor.education || { en: "", ru: "" },
          advancedTraining: doctor.advancedTraining || { en: "", ru: "" },
          scientificActivities: doctor.scientificActivities || {
            en: "",
            ru: "",
          },
          reviews: doctor.reviews || [],
          feesAmount: doctor.feesAmount || "",
          currency: doctor.currency || "RUB",
          about: doctor.about || { en: "", ru: "" },
          status: doctor.status || "active",
        });

        // Handle profile image - CLEAR FIRST to prevent caching
        setPhotoPreview("");
        setFormData((prev) => ({
          ...prev,
          photo: "",
        }));

        // Then load new image if exists
        if (doctor.profileFileId) {
          try {
            const imageResponse = await getDoctorsProfileImage(
              doctor.profileFileId
            );
            if (imageResponse.imageUrl) {
              setPhotoPreview(imageResponse.imageUrl);
              setFormData((prev) => ({
                ...prev,
                photo: imageResponse.imageUrl,
              }));
            } else if (imageResponse.profilePicture) {
              const base64Image = `data:image/jpeg;base64,${imageResponse.profilePicture}`;
              setPhotoPreview(base64Image);
              setFormData((prev) => ({ ...prev, photo: base64Image }));
            }
          } catch (error) {
            if (doctor.photo) {
              setPhotoPreview(doctor.photo);
            }
          }
        } else if (doctor.photo) {
          setPhotoPreview(doctor.photo);
        } else if (doctor.profilePicture) {
          const base64Image = `data:image/jpeg;base64,${doctor.profilePicture}`;
          setPhotoPreview(base64Image);
          setFormData((prev) => ({ ...prev, photo: base64Image }));
        }
        // If no image found, photoPreview stays empty (already cleared above)
      }
    };

    initializeDoctorData();
  }, [doctor, isEdit, languageOptions, branchOptions]);

  // Auto-calculate age when date of birth changes
  useEffect(() => {
    if (formData.dateOfBirth) {
      const calculatedAge = calculateAge(formData.dateOfBirth);
      setFormData((prev) => ({
        ...prev,
        age: calculatedAge,
      }));
    }
  }, [formData.dateOfBirth]);

  // Handle photo upload
  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      showErrorToast(t("doctorProfile.notifications.invalidImageType"));
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showErrorToast(t("doctorProfile.notifications.imageTooLarge"));
      return;
    }

    setUploadingPhoto(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
        setSelectedFile(file);
        setHasUnsavedChanges(true);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      showErrorToast(t("doctorProfile.notifications.photoUploadFailed"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle photo removal
  const handleRemovePhoto = () => {
    setPhotoPreview("");
    setFormData((prev) => ({ ...prev, photo: "" }));
    setSelectedFile(null);
    setHasUnsavedChanges(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setFormData((prev) => ({
      ...prev,
      removeProfilePhoto: true,
    }));
  };

  // Trigger file input click
  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle multilingual input change
  const handleMultilingualInputChange = (field, language, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [language]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Handle regular input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSpecialtyChange = (selectedOptions) => {
    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
    setFormData((prev) => ({
      ...prev,
      specialtyIds: selectedIds,
      subSpecialityIds: [] // Clear sub-specialties when main specialties change
    }));
    setHasUnsavedChanges(true);
  };

  const handleSubSpecialtyChange = (selectedOptions) => {
    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
    setFormData((prev) => ({
      ...prev,
      subSpecialityIds: selectedIds
    }));
    setHasUnsavedChanges(true);
  };

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      phoneNumber: value ? `+${value}` : "",
    }));
    setHasUnsavedChanges(true);
  };

  const handleRichTextChange = (field, language, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [language]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSubSpecialtiesChange = (language, value) => {
    setFormData((prev) => ({
      ...prev,
      subSpecialties: {
        ...prev.subSpecialties,
        [language]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleServicesChange = (serviceType) => {
    setFormData((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceType]: !prev.services[serviceType],
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleLanguageChange = (selectedOptions) => {
    setFormData((prev) => ({
      ...prev,
      languages: selectedOptions || [],
    }));
    setHasUnsavedChanges(true);
  };

  const handleBranchChange = (selectedOptions) => {
    setFormData((prev) => ({
      ...prev,
      branches: selectedOptions || [],
    }));
    setHasUnsavedChanges(true);
  };

  const handleCheckboxChange = (fieldName) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
    setHasUnsavedChanges(true);
  };

  // Reviews handlers
  const addReview = () => {
    setFormData((prev) => ({
      ...prev,
      reviews: [
        ...prev.reviews,
        {
          patientName: "",
          rating: 0,
          description: "",
          date: new Date().toISOString().split("T")[0],
        },
      ],
    }));
    setHasUnsavedChanges(true);
  };

  const updateReview = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      reviews: prev.reviews.map((review, i) =>
        i === index ? { ...review, [field]: value } : review
      ),
    }));
    setHasUnsavedChanges(true);
  };

  const removeReview = (index) => {
    setFormData((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((_, i) => i !== index),
    }));
    setHasUnsavedChanges(true);
  };

  // Star Rating Component
  const StarRating = ({ rating, onRatingChange, readonly = false }) => {
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar
            key={star}
            className={star <= rating ? "star filled" : "star"}
            onClick={() => !readonly && onRatingChange(star)}
            style={{ cursor: readonly ? "default" : "pointer" }}
          />
        ))}
      </div>
    );
  };

  const showSuccessToast = (message) => {
    toast.success(message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  const showErrorToast = (message) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  const showInfoToast = (message) => {
    toast.info(message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formDataToSend = new FormData();

      if (selectedFile) {
        formDataToSend.append("profileImage", selectedFile);
      }

      const submitData = {
        ...formData,
        languages: formData.languages.map((lang) => ({
          en: lang.value,
          ru: getReverseTranslation(lang.value, "en", "ru"),
        })),
        branches: formData.branches.map((branch) => ({
          en: branch.value,
          ru: getReverseTranslation(branch.value, "en", "ru"),
        })),
      };

      const { photo, removeProfilePhoto, ...dataWithoutPhoto } = submitData;

      Object.keys(dataWithoutPhoto).forEach((key) => {
        if (
          typeof dataWithoutPhoto[key] === "object" &&
          dataWithoutPhoto[key] !== null
        ) {
          formDataToSend.append(key, JSON.stringify(dataWithoutPhoto[key]));
        } else {
          formDataToSend.append(key, dataWithoutPhoto[key]);
        }
      });

      if (removeProfilePhoto) {
        formDataToSend.append("removeProfilePhoto", "true");
      }

      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      let response;
      if (isEdit) {
        response = await updateDoctorProfile(
          doctor._id,
          formDataToSend,
          config
        );
        showSuccessToast(t("doctorProfile.notifications.updateSuccess"));
      } else {
        response = await createDoctorProfile(formDataToSend, config);
        showSuccessToast(t("doctorProfile.notifications.createSuccess"));
      }

      setHasUnsavedChanges(false);
      setSelectedFile(null);
      setFormData((prev) => ({ ...prev, removeProfilePhoto: false }));

      // Refetch doctor data after save to get updated values
      if (isEdit && doctor._id) {
        try {
          const updatedDoctor = await getDoctorProfileById(doctor._id);
          if (updatedDoctor) {
            // Update the form with fresh data from server
            setFormData(prev => ({
              ...prev,
              feesAmount: updatedDoctor.feesAmount || "",
              currency: updatedDoctor.currency || "RUB",
            }));
          }
        } catch (refreshError) {
        }
      }

      if (onSave) {
        onSave();
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || t("doctorProfile.notifications.error");
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const handleDeleteClick = () => {
    if (window.confirm(t("doctorProfile.actions.deleteConfirmation"))) {
      showInfoToast(t("doctorProfile.actions.deleting"));
      if (onDelete) {
        onDelete();
      }
    }
  };

  const RequiredStar = () => <span className="required-star">*</span>;

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      border: state.isFocused ? "1px solid #007bff" : "1px solid #ddd",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 123, 255, 0.25)" : "none",
      "&:hover": {
        border: "1px solid #007bff",
      },
      minHeight: "44px",
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "#007bff",
      color: "white",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "white",
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "white",
      ":hover": {
        backgroundColor: "#0056b3",
        color: "white",
      },
    }),
  };

  // Handle back navigation
  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      Swal.fire({
        title: t("common.unsavedChanges"),
        text: t("common.unsavedChangesWarning"),
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: t("common.leaveAnyway"),
        cancelButtonText: t("common.stay"),
      }).then((result) => {
        if (result.isConfirmed) {
          setHasUnsavedChanges(false);
          if (onClose) {
            onClose();
          } else {
            navigate(-1);
          }
        }
      });
    } else {
      if (onClose) {
        onClose();
      } else {
        navigate(-1);
      }
    }
  };

  // Handle browser back button/refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Render Common Tab (shared across languages)
  const renderCommonTab = () => (
    <div className="tab-content">
      {/* Photo Upload Section */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.profilePhoto")}</h3>
        <div className="photo-upload-section">
          <div className="photo-preview-container">
            {photoPreview ? (
              <div className="photo-preview-wrapper">
                <img
                  src={photoPreview}
                  alt={t("doctorProfile.placeholders.profilePhoto")}
                  className="photo-preview"
                />
                <button
                  type="button"
                  className="photo-remove-btn"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                >
                  <FaTimesCircle />
                </button>
              </div>
            ) : (
              <div
                className="photo-upload-placeholder"
                onClick={handlePhotoClick}
              >
                <FaCamera className="photo-upload-icon" />
                <span>{t("doctorProfile.placeholders.uploadPhoto")}</span>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/jpeg,image/jpg,image/png,image/gif"
            style={{ display: "none" }}
          />

          <div className="photo-upload-info">
            <p className="photo-upload-hint">
              {t("doctorProfile.hints.photoUpload")}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                t("doctorProfile.actions.uploading")
              ) : (
                <>
                  <FaCamera className="btn-icon" />
                  {photoPreview
                    ? t("doctorProfile.actions.changePhoto")
                    : t("doctorProfile.actions.uploadPhoto")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Basic Information - Common Fields */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.basicInfo")}</h3>
        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.email")} <RequiredStar />
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.phoneNumber")} <RequiredStar />
            </label>
            <PhoneInput
              country={"ru"}
              value={formData.phoneNumber?.replace("+", "")}
              onChange={handlePhoneChange}
              inputProps={{ required: true }}
              containerClass="phone-input-container"
              inputClass="phone-input"
              buttonClass="phone-button"
              dropdownClass="phone-dropdown"
            />
          </div>
        </div>

        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.dateOfBirth")} <RequiredStar />
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.gender")} <RequiredStar />
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              required
            >
              <option value="Male">
                {t("doctorProfile.options.gender.male")}
              </option>
              <option value="Female">
                {t("doctorProfile.options.gender.female")}
              </option>
              <option value="Other">
                {t("doctorProfile.options.gender.other")}
              </option>
            </select>
          </div>
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.age")} <RequiredStar />
            </label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              min="1"
              max="150"
              required
              readOnly
              className="readonly-input"
            />
          </div>
          <div className="doctor-form-group">
            <label>{t("doctorProfile.fields.yearOfExperience")} <RequiredStar /></label>
            <input
              type="number"
              name="yearOfExperience"
              value={formData.yearOfExperience}
              onChange={handleInputChange}
              min="0"
              step="1"
              required
            />
          </div>
        </div>
      </div>

      {/* Services & Languages */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.servicesLanguages")}</h3>
        <div className="doctor-form-group">
          <label>
            {t("doctorProfile.fields.services")} <RequiredStar />
          </label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.services.online}
                onChange={() => handleServicesChange("online")}
              />
              <span className="checkmark"></span>
              {t("doctorProfile.options.services.online")}
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.services.offline}
                onChange={() => handleServicesChange("offline")}
              />
              <span className="checkmark"></span>
              {t("doctorProfile.options.services.offline")}
            </label>
          </div>
        </div>

        <div className="doctor-form-group">
          <label>{t("doctorProfile.fields.branches")}</label>
          <Select
            isMulti
            name="branches"
            options={branchOptions}
            className="basic-multi-select"
            classNamePrefix="select"
            value={formData.branches}
            onChange={handleBranchChange}
            placeholder={t("doctorProfile.placeholders.branches")}
            styles={customSelectStyles}
          />
          <small className="input-hint">
            {t("doctorProfile.hints.selectMultiple")}
          </small>
        </div>

      </div>

      {/* Specialty & Sub-Specialty */}
      <div className="form-section">
        <h3>
          {t("doctorProfile.sections.specialtyInfo") || "Specialty Information"}
          <button
            type="button"
            className="settings-icon-btn"
            onClick={() => setShowSpecialtyPopup(true)}
            title="Manage Specialties"
          >
            <FaCog />
          </button>
        </h3>
        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.specialty")} <RequiredStar />
            </label>
            <Select
              isMulti
              placeholder={t("common.select") || "Select..."}
              value={(specialties || [])
                .filter(specialty => formData.specialtyIds?.includes(specialty._id))
                .map(specialty => ({
                  value: specialty._id,
                  label: i18n.language === 'ru' ? specialty.name_ru : specialty.name_en
                }))}
              onChange={handleSpecialtyChange}
              options={(specialties || []).map(specialty => ({
                value: specialty._id,
                label: i18n.language === 'ru' ? specialty.name_ru : specialty.name_en
              }))}
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
          <div className="doctor-form-group">
            <label>{t("doctorProfile.fields.subSpecialties")}</label>
            <Select
              isMulti
              placeholder={t("common.select") || "Select..."}
              value={(subSpecialities || [])
                .filter(subSpeciality => formData.subSpecialityIds?.includes(subSpeciality._id))
                .map(subSpeciality => ({
                  value: subSpeciality._id,
                  label: i18n.language === 'ru' ? subSpeciality.name_ru : subSpeciality.name_en
                }))}
              onChange={handleSubSpecialtyChange}
              options={(subSpecialities || []).map(subSpeciality => ({
                value: subSpeciality._id,
                label: i18n.language === 'ru' ? subSpeciality.name_ru : subSpeciality.name_en
              }))}
              isDisabled={!formData.specialtyIds || formData.specialtyIds.length === 0}
              className="react-select-container"
              classNamePrefix="react-select"
            />
            <small className="input-hint">
              {(!formData.specialtyIds || formData.specialtyIds.length === 0) && (t("doctorProfile.hints.selectSpecialtyFirst") || "Select specialty first")}
            </small>
          </div>
        </div>
      </div>

      {/* Fees */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.fees")}</h3>
        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.feesAmount")}
            </label>
            <input
              type="number"
              name="feesAmount"
              value={formData.feesAmount}
              onChange={handleInputChange}
              min="0"
              step="0.01"
            />
          </div>
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.currency")} <RequiredStar />
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              required
            >
              <option value="RUB">
                {t("doctorProfile.options.currency.rub")}
              </option>
              <option value="INR">
                {t("doctorProfile.options.currency.inr")}
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.status")}</h3>
        <div className="doctor-form-group">
          <label>{t("doctorProfile.fields.status")}</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="active">
              {t("doctorProfile.options.status.active")}
            </option>
            <option value="inactive">
              {t("doctorProfile.options.status.inactive")}
            </option>
            <option value="pending">
              {t("doctorProfile.options.status.pending")}
            </option>
          </select>
        </div>
      </div>
    </div>
  );

  // Render Language Specific Tab
  const renderLanguageTab = (language) => (
    <div className="tab-content">
      {/* Basic Information - Language Specific */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.basicInfo")}</h3>
        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.lastName")} <RequiredStar />
            </label>
            <input
              type="text"
              value={formData.lastName[language] || ""}
              onChange={(e) =>
                handleMultilingualInputChange(
                  "lastName",
                  language,
                  e.target.value
                )
              }
              required
            />
          </div>
          <div className="doctor-form-group">
            <label>
              {t("doctorProfile.fields.firstName")} <RequiredStar />
            </label>
            <input
              type="text"
              value={formData.firstName[language] || ""}
              onChange={(e) =>
                handleMultilingualInputChange(
                  "firstName",
                  language,
                  e.target.value
                )
              }
              required
            />
          </div>
          <div className="doctor-form-group">
            <label>{t("doctorProfile.fields.middleName")}</label>
            <input
              type="text"
              value={formData.middleName[language] || ""}
              onChange={(e) =>
                handleMultilingualInputChange(
                  "middleName",
                  language,
                  e.target.value
                )
              }
              placeholder={t("doctorProfile.placeholders.middleName")}
            />
          </div>

        </div>
      </div>

      {/* Professional Information */}
      <div className="form-section">
        <h3>{t("doctorProfile.sections.professionalInfo")}</h3>
        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label>{t("doctorProfile.fields.description")} <RequiredStar /></label>
            <input
              type="text"
              value={formData.position[language] || ""}
              onChange={(e) =>
                handleMultilingualInputChange(
                  "position",
                  language,
                  e.target.value
                )
              }
            />
          </div>
          <div className="doctor-form-group">
            <label>{t("doctorProfile.fields.regalia")}</label>
            <input
              type="text"
              value={formData.regalia[language] || ""}
              onChange={(e) =>
                handleMultilingualInputChange(
                  "regalia",
                  language,
                  e.target.value
                )
              }
              placeholder={t("doctorProfile.placeholders.regalia")}
            />
          </div>
        </div>
      </div>

    </div>
  );

  return createPortal(
    <div className="employee-modal-overlay-modern" onClick={handleBackClick}>
      <div
        className="employee-modal-content-modern dpd-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />

        {/* Header */}
        <div className="employee-modal-header-modern">
          <div className="header-left-section">
            <h2>
              {isEdit
                ? t("doctorProfile.actions.updateProfile")
                : t("doctorProfile.actions.createProfile")}
            </h2>
            <p>
              {isEdit
                ? t("doctorProfile.subtitle.edit", "Update doctor information")
                : t("doctorProfile.subtitle.create", "Fill in doctor details")}
            </p>
          </div>

          {/* Language tabs centred */}
          <div className="doctor-language-tabs dpd-tabs-center">
            <button
              type="button"
              className={`language-tab ${activeTab === "common" ? "active" : ""}`}
              onClick={() => setActiveTab("common")}
            >
              {t("doctorProfile.tabs.common")}
            </button>
            <button
              type="button"
              className={`language-tab ${activeTab === "en" ? "active" : ""}`}
              onClick={() => setActiveTab("en")}
            >
              {t("doctorProfile.tabs.english")}
            </button>
            <button
              type="button"
              className={`language-tab ${activeTab === "ru" ? "active" : ""}`}
              onClick={() => setActiveTab("ru")}
            >
              {t("doctorProfile.tabs.russian")}
            </button>
          </div>

          <div className="header-actions-modern">
            {showDeleteButton && onDelete && (
              <button
                className="action-btn-modern delete-action"
                onClick={handleDeleteClick}
                type="button"
                disabled={loading}
              >
                <FaTrash size={16} />
              </button>
            )}
            <button
              className="action-btn-modern close-action"
              onClick={handleBackClick}
              type="button"
            >
              <FaTimes size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="employee-modal-body-modern">
          <form ref={formRef} onSubmit={handleSubmit} className="doctor-form">
            {activeTab === "common" && renderCommonTab()}
            {activeTab === "en" && renderLanguageTab("en")}
            {activeTab === "ru" && renderLanguageTab("ru")}
          </form>
        </div>

        {/* Footer */}
        <div className="employee-modal-footer-modern">
          <button
            type="button"
            className="em-btn-cancel"
            onClick={handleBackClick}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="em-btn-send"
            disabled={loading}
            onClick={handleSaveClick}
          >
            {loading
              ? t("doctorProfile.actions.saving")
              : isEdit
                ? t("doctorProfile.actions.updateProfile")
                : t("doctorProfile.actions.createProfile")}
          </button>
        </div>
      </div>

      {/* Specialty Management Popup */}
      {showSpecialtyPopup && createPortal(
        <SpecialtyManagementPopup onClose={handleSpecialtyPopupClose} />,
        document.body
      )}
    </div>,
    document.body
  );
};

export default DoctorProfileDetails;
