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
import CustomCalendar from "../components/CustomCalendar/CustomCalendar";

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
  const [doctorProfileId, setDoctorProfileId] = useState(null);
  const [effectiveIsEdit, setEffectiveIsEdit] = useState(isEdit);
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
        // Fetch the full doctor profile — try by ID first, then fall back to email
        const pickProfile = (res) =>
          [res?.profile, res?.data, res?.doctor, res].find((x) => x?._id) || null;

        let fullDoctor = null;
        const doctorId = doctor._id || doctor.id;

        // 1. Try by ID (the employee list _id is typically the profile ID)
        if (doctorId) {
          try {
            const res = await getDoctorProfileById(doctorId);
            fullDoctor = pickProfile(res);
          } catch (_) {}
        }

        // 2. Fallback: try by email
        if (!fullDoctor && doctor.email) {
          try {
            const res = await getDoctorProfileByEmail(doctor.email);
            fullDoctor = pickProfile(res);
          } catch (_) {}
        }

        if (fullDoctor) {
          setDoctorProfileId(fullDoctor._id);
          setEffectiveIsEdit(true);
        } else {
          // No profile found — will create a new one on save
          setDoctorProfileId(null);
          setEffectiveIsEdit(false);
          fullDoctor = doctor;
        }

        // Normalize string fields (employee user objects have plain strings, profiles have {en,ru})
        const toMultilingual = (val) =>
          val && typeof val === "string" ? { en: val, ru: "" } : val || { en: "", ru: "" };

        // Cross-fill empty multilingual name from original doctor user object as fallback
        const fillName = (profileVal, userVal) => {
          const ml = toMultilingual(profileVal);
          if (!ml.en && !ml.ru && userVal) return toMultilingual(userVal);
          return ml;
        };

        // Use fullDoctor from here on
        const doctor_ = fullDoctor;

        // Convert languages array to react-select format
        const selectedLanguages = languageOptions.filter((lang) =>
          doctor_.languages?.some(
            (docLang) => docLang.en === lang.value || docLang.ru === lang.label
          )
        );

        // Convert branches array to react-select format
        const selectedBranches = branchOptions.filter((branch) =>
          doctor_.branches?.some(
            (docBranch) =>
              docBranch.en === branch.value || docBranch.ru === branch.label
          )
        );


        setFormData({
          firstName: fillName(doctor_.firstName, doctor.firstName),
          middleName: fillName(doctor_.middleName, doctor.middleName),
          lastName: fillName(doctor_.lastName, doctor.lastName),
          email: doctor_.email || "",
          phoneNumber: doctor_.phoneNumber || "",
          dateOfBirth: doctor_.dateOfBirth
            ? new Date(doctor_.dateOfBirth).toISOString().split("T")[0]
            : "",
          expert: doctor_.expert || false,
          specialist: doctor_.specialist || false,
          gender: doctor_.gender || "Male",
          age: doctor_.age || "",
          photo: doctor_.photo || "",
          specialtyIds: Array.isArray(doctor_.specialtyIds)
            ? doctor_.specialtyIds.map(s => typeof s === 'object' ? s._id : s)
            : doctor_.specialtyIds ? [typeof doctor_.specialtyIds === 'object' ? doctor_.specialtyIds._id : doctor_.specialtyIds] : [],
          subSpecialityIds: Array.isArray(doctor_.subSpecialityIds)
            ? doctor_.subSpecialityIds.map(s => typeof s === 'object' ? s._id : s)
            : doctor_.subSpecialityIds ? [typeof doctor_.subSpecialityIds === 'object' ? doctor_.subSpecialityIds._id : doctor_.subSpecialityIds] : [],
          position: toMultilingual(doctor_.position),
          regalia: toMultilingual(doctor_.regalia),
          location: toMultilingual(doctor_.location),
          languages: selectedLanguages,
          services: doctor_.services || { online: false, offline: false },
          branches: selectedBranches,
          yearOfExperience: doctor_.yearOfExperience || 0,
          internationalMemberships: doctor_.internationalMemberships || {
            en: "",
            ru: "",
          },
          russianMemberships: doctor_.russianMemberships || { en: "", ru: "" },
          professionalDevelopments: doctor_.professionalDevelopments || { en: "", ru: "" },
          awards: doctor_.awards || { en: "", ru: "" },
          workExperience: doctor_.workExperience || { en: "", ru: "" },
          education: doctor_.education || { en: "", ru: "" },
          advancedTraining: doctor_.advancedTraining || { en: "", ru: "" },
          scientificActivities: doctor_.scientificActivities || {
            en: "",
            ru: "",
          },
          reviews: doctor_.reviews || [],
          feesAmount: doctor_.feesAmount || "",
          currency: doctor_.currency || "RUB",
          about: doctor_.about || { en: "", ru: "" },
          status: doctor_.status || "active",
        });

        // Handle profile image - CLEAR FIRST to prevent caching
        setPhotoPreview("");
        setFormData((prev) => ({
          ...prev,
          photo: "",
        }));

        // Then load new image if exists
        if (doctor_.profileFileId) {
          try {
            const imageResponse = await getDoctorsProfileImage(
              doctor_.profileFileId
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
            if (doctor_.photo) {
              setPhotoPreview(doctor_.photo);
            }
          }
        } else if (doctor_.photo) {
          setPhotoPreview(doctor_.photo);
        } else if (doctor_.profilePicture) {
          const base64Image = `data:image/jpeg;base64,${doctor_.profilePicture}`;
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

      // Ensure age is always calculated from DOB before submitting
      const resolvedAge = formData.dateOfBirth
        ? calculateAge(formData.dateOfBirth)
        : formData.age;

      const submitData = {
        ...formData,
        age: resolvedAge || formData.age,
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
        const val = dataWithoutPhoto[key];
        // Skip empty age (e.g. 0 from invalid DOB) — let backend calculate from dateOfBirth
        if (key === "age" && (!val || val === "0" || val === 0)) return;
        if (
          typeof val === "object" &&
          val !== null
        ) {
          formDataToSend.append(key, JSON.stringify(val));
        } else {
          formDataToSend.append(key, val);
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
      if (effectiveIsEdit) {
        response = await updateDoctorProfile(
          doctorProfileId,
          formDataToSend,
          config
        );
        showSuccessToast(t("doctorProfile.notifications.updateSuccess"));
      } else {
        response = await createDoctorProfile(formDataToSend, config);
        showSuccessToast(t("doctorProfile.notifications.createSuccess"));
        // After creating, switch to edit mode with the new profile's ID
        if (response?._id) {
          setDoctorProfileId(response._id);
          setEffectiveIsEdit(true);
        }
      }

      setHasUnsavedChanges(false);
      setSelectedFile(null);
      setFormData((prev) => ({ ...prev, removeProfilePhoto: false }));

      // Refetch doctor data after save to get updated values
      const profileId = doctorProfileId || response?._id;
      if (profileId) {
        try {
          const updatedDoctor = await getDoctorProfileById(profileId);
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
      <div className="dpd-single-section">

        {/* Profile Photo */}
        <p className="dpd-field-heading">{t("doctorProfile.sections.profilePhoto")}</p>
        <div className="photo-upload-section">
          <div className="photo-preview-container">
            {photoPreview ? (
              <div className="photo-preview-wrapper">
                <img src={photoPreview} alt={t("doctorProfile.placeholders.profilePhoto")} className="photo-preview" />
                <button type="button" className="photo-remove-btn" onClick={handleRemovePhoto} disabled={uploadingPhoto}>
                  <FaTimesCircle />
                </button>
              </div>
            ) : (
              <div className="photo-upload-placeholder" onClick={handlePhotoClick}>
                <FaCamera className="photo-upload-icon" />
                <span>{t("doctorProfile.placeholders.uploadPhoto")}</span>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/jpeg,image/jpg,image/png,image/gif" style={{ display: "none" }} />
          <div className="photo-upload-info">
            <p className="photo-upload-hint">{t("doctorProfile.hints.photoUpload")}</p>
            <button type="button" className="btn-secondary" onClick={handlePhotoClick} disabled={uploadingPhoto}>
              {uploadingPhoto ? t("doctorProfile.actions.uploading") : (
                <><FaCamera className="btn-icon" />{photoPreview ? t("doctorProfile.actions.changePhoto") : t("doctorProfile.actions.uploadPhoto")}</>
              )}
            </button>
          </div>
        </div>

        {/* Email */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.email")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
        </div>

        {/* Phone */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.phoneNumber")} <RequiredStar /></p>
        <div className="doctor-form-group">
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

        {/* Date of Birth */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.dateOfBirth")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <CustomCalendar
            value={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
            onChange={(date) => {
              const yyyy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, "0");
              const dd = String(date.getDate()).padStart(2, "0");
              setFormData((prev) => ({ ...prev, dateOfBirth: `${yyyy}-${mm}-${dd}` }));
            }}
            maxDate={new Date()}
            dateFormat="dd/MM/yyyy"
            placeholder={t("doctorProfile.placeholders.dateOfBirth") || "DD/MM/YYYY"}
          />
        </div>

        {/* Age (auto) */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.age")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <input type="number" name="age" value={formData.age} onChange={handleInputChange} min="1" max="150" required readOnly className="readonly-input" />
        </div>

        {/* Gender */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.gender")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <select name="gender" value={formData.gender} onChange={handleInputChange} required>
            <option value="Male">{t("doctorProfile.options.gender.male")}</option>
            <option value="Female">{t("doctorProfile.options.gender.female")}</option>
            <option value="Other">{t("doctorProfile.options.gender.other")}</option>
          </select>
        </div>

        {/* Experience */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.yearOfExperience")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <input type="number" name="yearOfExperience" value={formData.yearOfExperience} onChange={handleInputChange} min="0" step="1" required />
        </div>

        {/* Services */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.services")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.services.online} onChange={() => handleServicesChange("online")} />
              <span className="checkmark"></span>
              {t("doctorProfile.options.services.online")}
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.services.offline} onChange={() => handleServicesChange("offline")} />
              <span className="checkmark"></span>
              {t("doctorProfile.options.services.offline")}
            </label>
          </div>
        </div>

        {/* Branches */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.branches")}</p>
        <div className="doctor-form-group">
          <Select isMulti name="branches" options={branchOptions} className="basic-multi-select" classNamePrefix="select" value={formData.branches} onChange={handleBranchChange} placeholder={t("doctorProfile.placeholders.branches")} styles={customSelectStyles} />
          <small className="input-hint">{t("doctorProfile.hints.selectMultiple")}</small>
        </div>

        {/* Specialty */}
        <p className="dpd-field-heading">
          {t("doctorProfile.fields.specialty")} <RequiredStar />
          <button type="button" className="settings-icon-btn" onClick={() => setShowSpecialtyPopup(true)} title="Manage Specialties" style={{ marginLeft: 8 }}>
            <FaCog />
          </button>
        </p>
        <div className="doctor-form-group">
          <Select
            isMulti
            placeholder={t("common.select") || "Select..."}
            value={(specialties || []).filter(s => formData.specialtyIds?.includes(s._id)).map(s => ({ value: s._id, label: i18n.language === "ru" ? s.name_ru : s.name_en }))}
            onChange={handleSpecialtyChange}
            options={(specialties || []).map(s => ({ value: s._id, label: i18n.language === "ru" ? s.name_ru : s.name_en }))}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>

        {/* Sub-Specialty */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.subSpecialties")}</p>
        <div className="doctor-form-group">
          <Select
            isMulti
            placeholder={t("common.select") || "Select..."}
            value={(subSpecialities || []).filter(s => formData.subSpecialityIds?.includes(s._id)).map(s => ({ value: s._id, label: i18n.language === "ru" ? s.name_ru : s.name_en }))}
            onChange={handleSubSpecialtyChange}
            options={(subSpecialities || []).map(s => ({ value: s._id, label: i18n.language === "ru" ? s.name_ru : s.name_en }))}
            isDisabled={!formData.specialtyIds || formData.specialtyIds.length === 0}
            className="react-select-container"
            classNamePrefix="react-select"
          />
          {(!formData.specialtyIds || formData.specialtyIds.length === 0) && (
            <small className="input-hint">{t("doctorProfile.hints.selectSpecialtyFirst") || "Select specialty first"}</small>
          )}
        </div>

        {/* Consultation Fee */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.feesAmount")}</p>
        <div className="doctor-form-group">
          <input type="number" name="feesAmount" value={formData.feesAmount} onChange={handleInputChange} min="0" step="0.01" />
        </div>

        {/* Currency */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.currency")} <RequiredStar /></p>
        <div className="doctor-form-group">
          <select name="currency" value={formData.currency} onChange={handleInputChange} required>
            <option value="RUB">{t("doctorProfile.options.currency.rub")}</option>
            <option value="INR">{t("doctorProfile.options.currency.inr")}</option>
          </select>
        </div>

        {/* Status */}
        <p className="dpd-field-heading">{t("doctorProfile.fields.status")}</p>
        <div className="doctor-form-group">
          <select name="status" value={formData.status} onChange={handleInputChange}>
            <option value="active">{t("doctorProfile.options.status.active")}</option>
            <option value="inactive">{t("doctorProfile.options.status.inactive")}</option>
            <option value="pending">{t("doctorProfile.options.status.pending")}</option>
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
              {effectiveIsEdit
                ? t("doctorProfile.actions.updateProfile")
                : t("doctorProfile.actions.createProfile")}
            </h2>
            <p>
              {effectiveIsEdit
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
              : effectiveIsEdit
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
