import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { getAllDoctorsProfiles, deleteDoctorProfile, getDoctorProfileById, getSpecialties, updateDoctorsOrder, getDoctorsProfileImage } from "../utils/api";
import DoctorProfileCard from "../components/DoctorProfileCard";
import DoctorProfileDetails from "./DoctorProfileDetails";
import { useBranch } from "../context/BranchContext";
import { tField } from "../utils/lang";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import "../styles/DoctorProfile.css";

const DoctorProfile = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [specialties, setSpecialties] = useState([]);
  const [viewMode, setViewMode] = useState("card"); // "card" or "list"

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { selectedBranch } = useBranch();

  // Filters state
  const [filters, setFilters] = useState({
    search: "",
    specialty: "",
    location: "",
    service: "",
    expert: false,
    specialist: false,
  });

  const observer = useRef();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before activating drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setDoctors((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        const reorderedDoctors = arrayMove(items, oldIndex, newIndex);
        
        // Save the new order to backend
        const doctorIds = reorderedDoctors.map(d => d._id);
        updateDoctorsOrder(doctorIds).catch((error) => {
          console.error("Failed to update doctors order:", error);
          // Optionally show an error message to the user
        });
        
        return reorderedDoctors;
      });
    }
  };

  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth <= 1024);
    };

    checkMobileView();
    window.addEventListener("resize", checkMobileView);

    return () => window.removeEventListener("resize", checkMobileView);
  }, []);

  // Fetch specialties from backend
  useEffect(() => {
    const loadSpecialties = async () => {
      try {
        const response = await getSpecialties();
        
        // Handle both array and object responses
        if (Array.isArray(response)) {
          setSpecialties(response);
        } else if (response && Array.isArray(response.data)) {
          setSpecialties(response.data);
        } else {
          setSpecialties([]);
        }
      } catch (error) {
        setSpecialties([]);
      }
    };
    loadSpecialties();
  }, []);

  const lastDoctorElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreDoctors();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  // Initial load and when filters change
  const fetchDoctors = async (page = 1, isNewSearch = false) => {
    try {
      if (isNewSearch) {
        setLoading(true);
      } else if (page === 1) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }

      // Include selectedBranch in the filters
      const requestFilters = {
        ...filters,
        expert: filters.expert ? "true" : undefined,
        specialist: filters.specialist ? "true" : undefined,
        branch: selectedBranch,
        page,
        limit: 12,
      };

      const response = await getAllDoctorsProfiles(requestFilters);

      if (isNewSearch || page === 1) {
        setDoctors(response.data);
      } else {
        setDoctors((prev) => [...prev, ...response.data]);
      }

      setCurrentPage(response.currentPage);
      setTotalPages(response.totalPages);
      setHasMore(response.hasNextPage);
    } catch (error) {
      setError(t("doctorProfile.errors.fetchFailed"));
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  // Load more doctors for infinite scroll
  const loadMoreDoctors = () => {
    if (!loading && hasMore) {
      fetchDoctors(currentPage + 1, false);
    }
  };

  // Handle search and filter changes
  const handleSearch = () => {
    setCurrentPage(1);
    setHasMore(true);
    fetchDoctors(1, true);
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      search: "",
      specialty: "",
      location: "",
      service: "",
      expert: false,
      specialist: false,
    });
    setCurrentPage(1);
    setHasMore(true);
    fetchDoctors(1, true);
  };

  // Handle doctor card click
  const handleDoctorClick = (doctor) => {
    setSelectedDoctor(doctor);
    setShowAddForm(false);
    // Update URL with doctor ID without reloading
    navigate(`/doctors-profile/${doctor._id}`, { replace: true });
  };

  // Handle back to list view
  const handleBackToList = () => {
    setSelectedDoctor(null);
    setShowAddForm(false);
    // Clear URL parameter
    navigate("/doctors-profile", { replace: true });
  };

  // Handle add new doctor
  const handleAddNewDoctor = () => {
    setSelectedDoctor(null);
    setShowAddForm(true);
  };

  // Handle close details/form
  const handleCloseDetails = () => {
    setShowAddForm(false);
    setSelectedDoctor(null);
  };

  // Handle doctor deletion
  const handleDeleteDoctor = async (doctorId) => {
    if (window.confirm(t("doctorProfile.actions.deleteConfirmation"))) {
      try {
        await deleteDoctorProfile(doctorId);
        const updatedDoctors = doctors.filter(
          (doctor) => doctor._id !== doctorId
        );
        setDoctors(updatedDoctors);

        // If deleted doctor was selected, go back to list view
        if (selectedDoctor && selectedDoctor._id === doctorId) {
          handleBackToList();
        }
      } catch (error) {
        setError(t("doctorProfile.errors.deleteFailed"));
      }
    }
  };

  // Load initial data when component mounts
  useEffect(() => {
    fetchDoctors(1, true);
  }, []);

  // Load doctor from URL parameter if present
  useEffect(() => {
    const loadDoctorFromUrl = async () => {
      if (id) {
        // Skip loading if doctor is already selected with the same ID
        if (selectedDoctor && selectedDoctor._id === id) {
          return;
        }

        try {
          setInitialLoading(true);
          const response = await getDoctorProfileById(id);
          setSelectedDoctor(response.data);
          setShowAddForm(false);
        } catch (error) {
          setError(t("doctorProfile.errors.fetchFailed"));
          // Navigate back to list if doctor not found
          navigate("/doctors-profile", { replace: true });
        } finally {
          setInitialLoading(false);
        }
      } else if (!id && selectedDoctor) {
        // Clear selection if URL has no ID but doctor is selected
        setSelectedDoctor(null);
      }
    };

    loadDoctorFromUrl();
  }, [id]);

  // Auto-search when filters change (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.search, filters.specialty, filters.location, filters.service, filters.expert, filters.specialist]);

  // Refetch doctors when selectedBranch changes
  useEffect(() => {
    if (selectedBranch) {
      setCurrentPage(1);
      setHasMore(true);
      fetchDoctors(1, true);
    }
  }, [selectedBranch]);

  // Determine current view state
  const showDetailsView = selectedDoctor || showAddForm;
  const showListView = !showDetailsView;
  const showHeader = !(isMobileView && showDetailsView);

  if (initialLoading) {
    return (
      <div className="doctor-profile-loading">
        <div className="spinner"></div>
        <p>{t("doctorProfile.loading.loadingDoctors")}</p>
      </div>
    );
  }

  return (
    <div
      className={`doctor-profile-container ${
        showDetailsView ? "has-selection" : "no-selection"
      }`}
    >
      {showHeader && (
        <div className="doctor-profile-header">
          <div className="dp-header-main">
            {/* Left Section: Title */}
            <div className="dp-header-left-section">
              <h1 className="dp-header-title">{t("doctorProfile.title")}</h1>
              {/*  
              {selectedBranch && (
                <div className="branch-filter-indicator">
                  <span className="branch-label">
                    {t("doctorProfile.filters.branch")}:
                  </span>
                  <span className="branch-value">{selectedBranch}</span>
                </div>
              )}
                 */}
            </div>

            {/* Center Section: Search and Filters */}
            <div className="dp-header-center-section">
              {/* Search Box */}
              <div className="dp-profile-search-box">
                <span className="dp-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder={t("doctorProfile.search.placeholder")}
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="dp-search-input"
                />
              </div>

              {/* Filters */}
              <div className="dp-filter-group">
                <select
                  value={filters.specialty}
                  onChange={(e) =>
                    handleFilterChange("specialty", e.target.value)
                  }
                  className="dp-filter-select"
                >
                  <option value="">
                    {t("doctorProfile.filters.allSpecialties")}
                  </option>
                  {Array.isArray(specialties) && specialties.map((specialty) => (
                    <option key={specialty._id} value={specialty._id}>
                      {i18n.language === "ru" ? specialty.name_ru : specialty.name_en}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.service}
                  onChange={(e) =>
                    handleFilterChange("service", e.target.value)
                  }
                  className="dp-filter-select"
                >
                  <option value="">
                    {t("doctorProfile.filters.allServices")}
                  </option>
                  <option value="online">
                    {t("doctorProfile.services.online")}
                  </option>
                  <option value="offline">
                    {t("doctorProfile.services.offline")}
                  </option>
                </select>

                {/* Expert and Specialist Dropdown */}
                <select
                  value={filters.expert ? "expert" : filters.specialist ? "specialist" : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "expert") {
                      handleFilterChange("expert", true);
                      handleFilterChange("specialist", false);
                    } else if (value === "specialist") {
                      handleFilterChange("expert", false);
                      handleFilterChange("specialist", true);
                    } else {
                      handleFilterChange("expert", false);
                      handleFilterChange("specialist", false);
                    }
                  }}
                  className="dp-filter-select dp-filter-select-premium"
                >
                  <option value="">{t("doctorProfile.filters.allTypes", "All Types")}</option>
                  <option value="expert">{t("doctorProfile.filters.expert", "Expert")}</option>
                  <option value="specialist">{t("doctorProfile.filters.specialist", "Specialist")}</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="dp-view-toggle">
                <button
                  className={`dp-view-btn ${viewMode === "card" ? "active" : ""}`}
                  onClick={() => setViewMode("card")}
                  title={t("doctorProfile.viewMode.card", "Card View")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
                <button
                  className={`dp-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title={t("doctorProfile.viewMode.list", "List View")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor"/>
                    <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/>
                    <rect x="1" y="12" width="14" height="2" rx="1" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Right Section: Add Doctor Button */}
            <div className="dp-header-right-section">
              <button
                className="dp-btn dp-btn-primary dp-add-doctor-btn"
                onClick={handleAddNewDoctor}
              >
                <span className="dp-btn-icon">+</span>
                {t("doctorProfile.actions.addNewDoctor")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="doctor-content-area">
        {/* Desktop Split View */}
        {showDetailsView && !isMobileView && (
          <div className="split-view-container">
            {/* Left Section - Doctors List */}
            <div className="doctors-list-section">
              <div className="doctors-section-header">
                <h3>
                  {t("doctorProfile.doctorsList.title", {
                    count: doctors.length,
                  })}
                  {selectedBranch && (
                    <span className="branch-filter-info">
                      {" "}
                      • {t(`branches.${selectedBranch.toLowerCase()}`)}
                    </span>
                  )}
                </h3>
              </div>
              <div className="doctors-list-content">
                {doctors.map((doctor, index) => {
                  const isLast = doctors.length === index + 1;
                  const isSelected =
                    selectedDoctor && selectedDoctor._id === doctor._id;

                  return (
                    <div
                      key={doctor._id}
                      ref={isLast ? lastDoctorElementRef : null}
                      className={`doctor-list-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => handleDoctorClick(doctor)}
                    >
                      <DoctorProfileCard
                        doctor={doctor}
                        isCompact={true}
                        isSelected={isSelected}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Loading indicator for infinite scroll */}
              {loading && (
                <div className="loading-indicator">
                  <div className="spinner-small"></div>
                </div>
              )}

              {/* No more doctors message 
              {!hasMore && doctors.length > 0 && (
                <div className="no-more-doctors">
                  <p>{t("doctorProfile.messages.allDoctorsLoaded")}</p>
                </div>
              )}
                */}
            </div>

            {/* Right Section - Doctor Details */}
            <div className="doctor-details-section">
              <div className="doctor-details-content">
                {showAddForm ? (
                  <DoctorProfileDetails
                    key="new"
                    doctor={null}
                    isEdit={false}
                    onClose={handleCloseDetails}
                    onSave={() => {
                      fetchDoctors(1, true); // Refresh the list
                      handleCloseDetails();
                    }}
                  />
                ) : selectedDoctor ? (
                  <DoctorProfileDetails
                    key={selectedDoctor._id}
                    doctor={selectedDoctor}
                    isEdit={true}
                    onClose={handleBackToList}
                    onSave={() => {
                      fetchDoctors(1, true); // Refresh the list
                    }}
                    onDelete={() => handleDeleteDoctor(selectedDoctor._id)}
                    showDeleteButton={true}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Details Overlay View */}
        {showDetailsView && isMobileView && (
          <div className="doctor-details-mobile">
            <div className="mobile-details-content">
              {showAddForm ? (
                <DoctorProfileDetails
                  key="new"
                  doctor={null}
                  isEdit={false}
                  onClose={handleCloseDetails}
                  onSave={() => {
                    fetchDoctors(1, true); // Refresh the list
                    handleCloseDetails();
                  }}
                />
              ) : selectedDoctor ? (
                <DoctorProfileDetails
                  key={selectedDoctor._id}
                  doctor={selectedDoctor}
                  isEdit={true}
                  onClose={handleBackToList}
                  onSave={() => {
                    fetchDoctors(1, true); // Refresh the list
                  }}
                  onDelete={() => handleDeleteDoctor(selectedDoctor._id)}
                  showDeleteButton={true}
                />
              ) : null}
            </div>
          </div>
        )}

        {/* Card/List View (shown when no selection) */}
        {showListView && (
          <div className={viewMode === "list" ? "doctors-list-view-container" : "doctors-grid-container"}>
            {doctors.length === 0 ? (
              <div className="no-doctors">
                <div className="no-doctors-content">
                  <div className="no-doctors-icon">👨‍⚕️</div>
                  <h3>{t("doctorProfile.messages.noDoctorsFound")}</h3>
                  <p>
                    {selectedBranch
                      ? t("doctorProfile.messages.noDoctorsInBranch", {
                          branch: selectedBranch,
                        })
                      : t("doctorProfile.messages.adjustSearchCriteria")}
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddNewDoctor}
                  >
                    <span className="btn-icon">+</span>
                    {t("doctorProfile.actions.addNewDoctor")}
                  </button>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={doctors.map((d) => d._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="doctors-list-view">
                    {doctors.map((doctor, index) => {
                      const isLast = doctors.length === index + 1;
                      return (
                        <SortableListItem
                          key={doctor._id}
                          doctor={doctor}
                          isLast={isLast}
                          lastDoctorElementRef={lastDoctorElementRef}
                          onDoctorClick={handleDoctorClick}
                          onDelete={handleDeleteDoctor}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="doctors-grid">
                {doctors.map((doctor, index) => {
                  const isLast = doctors.length === index + 1;

                  return (
                    <div
                      key={doctor._id}
                      ref={isLast ? lastDoctorElementRef : null}
                      className="doctor-grid-item"
                      onClick={() => handleDoctorClick(doctor)}
                    >
                      <DoctorProfileCard
                        doctor={doctor}
                        isCompact={false}
                        onDelete={() => handleDeleteDoctor(doctor._id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading indicator for infinite scroll */}
            {loading && (
              <div className="loading-indicator">
                <div className="spinner-small"></div>
              </div>
            )}

            {/* No more doctors message */}
            {!hasMore && doctors.length > 0 && (
              <div className="no-more-doctors">
                <p>{t("doctorProfile.messages.allDoctorsLoaded")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Sortable List Item Component
const SortableListItem = ({ doctor, isLast, lastDoctorElementRef, onDoctorClick, onDelete }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doctor._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Extract multilingual fields properly
  const firstName = tField(doctor.firstName, lang);
  const lastName = tField(doctor.lastName, lang);
  const middleName = tField(doctor.middleName, lang);
  const fullName = `${lastName} ${firstName} ${middleName}`.trim();
  const specialtyText = tField(doctor.specialty, lang);
  const locationText = tField(doctor.location, lang);

  // Load profile image (same logic as DoctorProfileCard)
  const [profileImage, setProfileImage] = useState(null);
  useEffect(() => {
    const fetchImage = async () => {
      if (doctor.imageUrl) { setProfileImage(doctor.imageUrl); return; }
      if (doctor.profilePicture) { setProfileImage(`data:image/jpeg;base64,${doctor.profilePicture}`); return; }
      if (doctor.profileFileId) {
        try {
          const res = await getDoctorsProfileImage(doctor.profileFileId);
          if (res.imageUrl) setProfileImage(res.imageUrl);
          else if (res.profilePicture) setProfileImage(`data:image/jpeg;base64,${res.profilePicture}`);
        } catch (err) {}
      }
    };
    fetchImage();
  }, [doctor.profileFileId, doctor.imageUrl, doctor.profilePicture]);

  // Handle services - can be array or object
  const hasOnlineService = Array.isArray(doctor.services) 
    ? doctor.services.some(s => s === "Online" || s?.name === "online" || s === "online")
    : doctor.services?.online;
  
  const hasOfflineService = Array.isArray(doctor.services)
    ? doctor.services.some(s => s === "Offline" || s?.name === "offline" || s === "offline")
    : doctor.services?.offline;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (isLast && lastDoctorElementRef) {
          lastDoctorElementRef(node);
        }
      }}
      style={style}
      className={`doctor-list-view-item ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="drag-handle">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="6" cy="4" r="1.5"/>
          <circle cx="10" cy="4" r="1.5"/>
          <circle cx="6" cy="8" r="1.5"/>
          <circle cx="10" cy="8" r="1.5"/>
          <circle cx="6" cy="12" r="1.5"/>
          <circle cx="10" cy="12" r="1.5"/>
        </svg>
      </div>
      <div className="doctor-list-content" onClick={() => onDoctorClick(doctor)}>
        <div className="doctor-list-avatar">
          {profileImage ? (
            <img src={profileImage} alt={fullName} />
          ) : (
            <div className="doctor-avatar-placeholder">
              {firstName?.charAt(0) || lastName?.charAt(0) || "D"}
            </div>
          )}
        </div>
        <div className="doctor-list-info">
          <div className="doctor-list-header">
            <h3 className="doctor-list-name">{fullName}</h3>
            <div className="doctor-list-badges">
              {doctor.isExpert && (
                <span className="badge badge-expert">{t("doctorProfile.badges.expert", "Expert")}</span>
              )}
              {doctor.isSpecialist && (
                <span className="badge badge-specialist">{t("doctorProfile.badges.specialist", "Specialist")}</span>
              )}
              <span className={`badge badge-status ${doctor.status?.toLowerCase() === 'active' ? "active" : "inactive"}`}>
                {doctor.status || t("doctorProfile.status.inactive", "Inactive")}
              </span>
            </div>
          </div>
          <div className="doctor-list-details">
            {specialtyText && (
              <span className="doctor-list-specialty">{specialtyText}</span>
            )}
            {locationText && <span className="doctor-list-location">{locationText}</span>}
          </div>
          <div className="doctor-list-services">
            {hasOnlineService && (
              <span className="service-badge online">{t("doctorProfile.services.online", "Online")}</span>
            )}
            {hasOfflineService && (
              <span className="service-badge offline">{t("doctorProfile.services.offline", "Offline")}</span>
            )}
          </div>
        </div>
        <div className="doctor-list-price">
          <span className="price-label">{t("doctorProfile.consultation", "Consultation")}:</span>
          <span className="price-amount">{doctor.currency || "₱"}{doctor.feesAmount || "0"}</span>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile;
