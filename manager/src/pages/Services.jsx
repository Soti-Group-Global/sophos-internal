import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  Users,
  Box,
  MapPin,
  Image as ImageIcon,
  Info,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllServices,
  createService,
  updateService,
  deleteService,
  getDoctorsProfileData,
  getProfile,
  uploadServiceFile,
  getFile,
} from "../utils/api";
import SubServices from "./SubServices";
import Select from "react-select";
import CommonRichTextEditor from "../components/RichTextEditor/CommonRichTextEditor";
import { useBranch } from "../context/BranchContext";
import "../styles/Services.css";

const Services = () => {
  const { t, i18n } = useTranslation();
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [search, setSearch] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    name_en: "",
    name_ru: "",
    sectionCode: "",
    description_en: "",
    description_ru: "",
    doctorEmails: [],
    branches: [],
    startColor: "#4f46e5",
    endColor: "#8b5cf6",
    aboutService_en: "",
    aboutService_ru: "",
    file: null,
  });
  const [editingId, setEditingId] = useState(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [filePreview, setFilePreview] = useState(null);

  const { selectedBranch } = useBranch();

  useEffect(() => {
    let isMounted = true;
    let currentUrl = null;

    const cleanup = () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };

    if (form.file instanceof File) {
      currentUrl = URL.createObjectURL(form.file);
      setFilePreview(currentUrl);
    } else if (typeof form.file === "string" && form.file) {
      getFile(form.file)
        .then((blob) => {
          if (isMounted) {
            const url = URL.createObjectURL(blob);
            currentUrl = url;
            setFilePreview(url);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setFilePreview(null);
          }
        });
    } else {
      setFilePreview(null);
    }

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [form.file]);

  useEffect(() => {
    loadServices();
    loadDoctors();
  }, [search, selectedBranch]);

  useEffect(() => {
    const fetchProfileBranches = async () => {
      try {
        setLoadingBranches(true);
        const res = await getProfile();
        const branches = res.data.user?.branches || [];
        const formatted = branches.map((b) => ({
          value: b,
          label: t(`services.branches.${b.toLowerCase()}`),
        }));
        setAvailableBranches(formatted);

        // Pre-fill branch if current selected branch is valid for this user
        if (!editingId && selectedBranch && selectedBranch !== "All" && branches.includes(selectedBranch)) {
          setForm(prev => ({ ...prev, branches: [selectedBranch] }));
        } else if (!editingId && branches.length === 1) {
          // If user has only one branch, auto-select it
          setForm(prev => ({ ...prev, branches: [branches[0]] }));
        }
      } catch (err) {
        setAvailableBranches([
          { value: "Moscow", label: t("services.branches.moscow") },
          { value: "Makhachkala", label: t("services.branches.makhachkala") },
        ]);
      } finally {
        setLoadingBranches(false);
      }
    };

    if (showServiceModal) {
      fetchProfileBranches();
    }
  }, [showServiceModal, t, editingId, selectedBranch]);

  const loadServices = async () => {
    try {
      const res = await getAllServices({ search, branch: selectedBranch });
      setServices(res);
    } catch (error) {
    }
  };

  const loadDoctors = async (branchToFetch = selectedBranch) => {
    try {
      const res = await getDoctorsProfileData({ branch: branchToFetch });
      setDoctors(res.data || []);
    } catch (error) {
    }
  };

  useEffect(() => {
    if (showServiceModal && form.branches && form.branches.length > 0) {
      loadDoctors(form.branches);
    } else if (showServiceModal && (!form.branches || form.branches.length === 0)) {
      setDoctors([]);
    }
  }, [form.branches, showServiceModal]);

  const handleFormChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleBranchChange = (selectedOptions) => {
    const newBranches = selectedOptions ? selectedOptions.map(o => o.value) : [];
    // If branches changed, we might want to refresh doctors or clear them
    setForm({ ...form, branches: newBranches, doctorEmails: [] });
  };

  const handleDescriptionChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleDoctorEmailsChange = (selectedOptions) => {
    const emails = selectedOptions
      ? selectedOptions.map((option) => option.value)
      : [];
    setForm({ ...form, doctorEmails: emails });
  };

  const resetForm = () => {
    setForm({
      name_en: "",
      name_ru: "",
      sectionCode: "",
      description_en: "",
      description_ru: "",
      doctorEmails: [],
      branches: [],
      startColor: "#4f46e5",
      endColor: "#8b5cf6",
      aboutService_en: "",
      aboutService_ru: "",
      file: null,
    });
    setEditingId(null);
    setShowServiceModal(false);
  };

  const handleCreate = async () => {
    try {
      let fileId = null;
      if (form.file instanceof File) {
        const uploadRes = await uploadServiceFile(form.file);
        fileId = uploadRes.fileId;
      }

      await createService({
        name: { en: form.name_en, ru: form.name_ru },
        sectionCode: form.sectionCode,
        description: { en: form.description_en, ru: form.description_ru },
        doctorEmails: form.doctorEmails,
        branches: form.branches,
        startColor: form.startColor,
        endColor: form.endColor,
        aboutService: { en: form.aboutService_en, ru: form.aboutService_ru },
        fileId: fileId,
      });
      resetForm();
      loadServices();
      toast.success(t("services.notifications.createSuccess"));
    } catch (error) {
      toast.error(t("services.notifications.error"));
    }
  };

  const handleEdit = (service) => {
    setEditingId(service._id);
    setForm({
      name_en: service.name.en,
      name_ru: service.name.ru,
      sectionCode: service.sectionCode,
      description_en: service.description.en,
      description_ru: service.description.ru,
      doctorEmails: service.doctorEmails || [],
      branches: service.branches || [],
      startColor: service.startColor || "#4f46e5",
      endColor: service.endColor || "#8b5cf6",
      aboutService_en: service.aboutService?.en || "",
      aboutService_ru: service.aboutService?.ru || "",
      file: service.fileId || null,
    });
    setShowServiceModal(true);
  };

  const handleUpdate = async () => {
    try {
      let fileId = typeof form.file === "string" ? form.file : null;
      if (form.file instanceof File) {
        const uploadRes = await uploadServiceFile(form.file);
        fileId = uploadRes.fileId;
      }

      await updateService(editingId, {
        name: { en: form.name_en, ru: form.name_ru },
        sectionCode: form.sectionCode,
        description: { en: form.description_en, ru: form.description_ru },
        doctorEmails: form.doctorEmails,
        branches: form.branches,
        startColor: form.startColor,
        endColor: form.endColor,
        aboutService: { en: form.aboutService_en, ru: form.aboutService_ru },
        fileId: fileId,
      });
      resetForm();
      loadServices();
      toast.success(t("services.notifications.updateSuccess"));
    } catch (error) {
      toast.error(t("services.notifications.error"));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setForm({ ...form, file });
  };

  const removeFile = () => setForm({ ...form, file: null });

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm(t("services.actions.deleteConfirmation"))) {
      try {
        await deleteService(id);
        if (selectedService === id) {
          setSelectedService(null);
          setIsSplitView(false);
        }
        loadServices();
        toast.success(t("services.notifications.deleteSuccess"));
      } catch (error) {
        toast.error(t("services.notifications.error"));
      }
    }
  };

  const handleServiceSelect = (serviceId) => {
    setSelectedService(serviceId);
    // On medium and small devices (tablet and below), don't use split view
    const isSmallDevice = window.innerWidth <= 768;
    setIsSplitView(!isSmallDevice);
  };

  const handleBackToList = () => {
    setIsSplitView(false);
    setSelectedService(null);
  };

  const doctorOptions = doctors.map((doctor) => {
    const lName = typeof doctor.lastName === 'object' 
      ? (doctor.lastName?.[i18n.language] || doctor.lastName?.en || "")
      : (doctor.lastName || "");
    const fName = typeof doctor.firstName === 'object'
      ? (doctor.firstName?.[i18n.language] || doctor.firstName?.en || "")
      : (doctor.firstName || "");
    const mName = typeof doctor.middleName === 'object'
      ? (doctor.middleName?.[i18n.language] || doctor.middleName?.en || "")
      : (doctor.middleName || "");
    const fullName = `${lName} ${fName} ${mName}`.trim().replace(/\s+/g, ' ');
    return {
      value: doctor.email,
      label: fullName || doctor.email,
    };
  });

  const selectedDoctorOptions = doctorOptions.filter((option) =>
    form.doctorEmails.includes(option.value)
  );

  const selectedBranchOption = availableBranches.filter(
    (branch) => form.branches.includes(branch.value)
  );

  return (
    <div className="servmgmt-container">
      {/* Header */}
      <div className="servmgmt-header-premium">
        <div className="servmgmt-title-section">
          {isSplitView && (
            <button className="servmgmt-back-btn" onClick={handleBackToList} style={{ marginBottom: '8px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: '600', cursor: 'pointer' }}>
              <ArrowLeft size={16} />
              {t("services.actions.backToList")}
            </button>
          )}
          <div className="service-breadcrumb">
            <a href="#" className="service-breadcrumb-link">{t("services.breadcrumb.dashboard") || "Dashboard"}</a>
            <span className="service-breadcrumb-separator">/</span>
            <span className="service-breadcrumb-current">{t("services.breadcrumb.management") || "Services Management"}</span>
          </div>
          <h1>{t("services.title")}</h1>
        </div>

        <div className="servmgmt-actions-premium">
          {!isSplitView && (
            <button className="servmgmt-add-btn-premium" onClick={() => setShowServiceModal(true)}>
              <Plus size={18} />
              {t("services.actions.addService")}
            </button>
          )}
        </div>
      </div>

      {/* Search Section */}
      <div className="servmgmt-search-wrapper">
        <Search className="servmgmt-search-icon-premium" size={18} />
        <input
          type="text"
          placeholder={t("services.search.placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="servmgmt-search-input-premium"
        />
      </div>

      {/* Branch Status */}
      <p className="servmgmt-subtitle-premium">
        {selectedBranch && selectedBranch !== 'All'
          ? t("services.status.showingBranch", { branch: t(`services.branches.${selectedBranch.toLowerCase()}`) })
          : t("services.status.allBranches")
        }
      </p>

      {selectedService && !isSplitView ? (
        // On small devices, show only SubServices
        <SubServices serviceId={selectedService} onBack={handleBackToList} />
      ) : !selectedService && !isSplitView ? (
        <div className="servmgmt-table-card">
          <div className="servmgmt-table-wrapper">
            <table className="servmgmt-premium-table">
              <thead>
                <tr>
                  {/* <th>{t("services.table.headers.sectionCode")}</th> */}
                  <th>{t("services.table.headers.nameEn")}</th>
                  <th>{t("services.table.headers.branch")}</th>
                  <th>{t("services.table.headers.assignedDoctors")}</th>
                  <th>{t("services.table.headers.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service._id} onClick={() => handleServiceSelect(service._id)}>
                    {/* 
                    <td>
                      <span className="servmgmt-table-code">{service.sectionCode}</span>
                    </td> 
                    */}
                    <td className="servmgmt-table-name">
                      {service.name[i18n.language] || service.name.en}
                    </td>
                    <td>
                      <div className="servmgmt-table-doctors">
                        {service.branches?.length > 0 ? (
                          service.branches.map((b, idx) => (
                            <span key={idx} className="servmgmt-table-doctor-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
                              <MapPin size={10} style={{ marginRight: '4px' }} />
                              {t(`services.branches.${b.toLowerCase()}`)}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                            {t("services.status.allBranches")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="servmgmt-table-doctors">
                        {service.doctors?.length > 0 ? (
                          service.doctors.slice(0, 2).map((doc, idx) => (
                            <span key={idx} className="servmgmt-table-doctor-pill">
                              {doc.firstName?.[i18n.language] || doc.firstName?.en ?
                                `${doc.firstName[i18n.language] || doc.firstName.en} ${doc.lastName?.[i18n.language] || doc.lastName?.en || ""}`.trim() :
                                (doc.email ? doc.email.split("@")[0] : t("applications.doctor"))
                              }
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                            {t("services.status.noDoctors")}
                          </span>
                        )}
                        {service.doctors?.length > 2 && (
                          <span className="servmgmt-table-doctor-pill">
                            +{service.doctors.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="servmgmt-table-actions">
                        <button className="servmgmt-btn-icon" onClick={(e) => { e.stopPropagation(); handleEdit(service); }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="servmgmt-btn-icon delete" onClick={(e) => handleDelete(service._id, e)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.length === 0 && (
              <div style={{ padding: '60px', textAlign: 'center', color: '#68748b' }}>
                <Box size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <h3>{t("services.table.emptyState")}</h3>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="servmgmt-split-container">
          <div className="servmgmt-list-panel">
            {services.map((service) => (
              <div
                key={service._id}
                className={`servmgmt-item-compact ${selectedService === service._id ? 'active' : ''}`}
                onClick={() => setSelectedService(service._id)}
              >
                <div style={{ fontWeight: '600' }}>{service.name[i18n.language] || service.name.en}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {service.sectionCode} � {service.branches?.length > 0 ? service.branches.map(b => t(`services.branches.${b.toLowerCase()}`)).join(', ') : t("services.status.allBranches")}
                </div>
              </div>
            ))}
          </div>
          <div className="servmgmt-detail-panel">
            {selectedService && <SubServices serviceId={selectedService} />}
          </div>
        </div>
      )}

      {/* Modal - Premium Redesign */}
      {showServiceModal && createPortal(
        <AnimatePresence>
          <div className="servmgmt-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="servmgmt-modal-premium"
            >
              <div className="servmgmt-modal-header-premium">
                <div className="servmgmt-modal-header-title">
                  <h2>{editingId ? t("services.form.editTitle") : t("services.form.createTitle")}</h2>
                  <p>{editingId ? t("services.form.editSubtitle") : t("services.form.createSubtitle")}</p>
                </div>
                <button className="servmgmt-modal-close-btn" onClick={resetForm}>
                  <X size={20} />
                </button>
              </div>

              <div className="servmgmt-modal-body-premium">
                {/* Website Live Preview Section */}
                <div className="servmgmt-form-section">
                  <div className="servmgmt-form-section-title">
                    <Box size={18} color="var(--color-primary)" />
                    <span>{t("services.preview.title")}</span>
                  </div>
                  <div
                    className={`servmgmt-website-preview-banner ${filePreview ? "has-media" : "no-media"}`}
                    style={{
                      background: `linear-gradient(135deg, ${form.startColor}, ${form.endColor})`
                    }}
                  >
                    <div className="servmgmt-banner-pattern"></div>
                    <div className="servmgmt-preview-content">
                      <h1 className="servmgmt-preview-title">
                        {form.name_en || t("services.preview.defaultTitle")}
                      </h1>
                      <div
                        className="servmgmt-preview-desc"
                        dangerouslySetInnerHTML={{
                          __html: form.description_en || t("services.preview.defaultDesc")
                        }}
                      />
                    </div>
                    {filePreview && (
                      <div className="servmgmt-preview-media-wrapper">
                        {form.file instanceof File && form.file.type.startsWith('video/') ? (
                          <video src={filePreview} autoPlay muted loop className="servmgmt-preview-banner-media" />
                        ) : (
                          <img src={filePreview} alt="Banner Preview" className="servmgmt-preview-banner-media" />
                        )}
                        <div className="servmgmt-preview-media-overlay" style={{
                          background: `linear-gradient(to right, ${form.startColor} 0%, transparent 100%)`
                        }}></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 1: General Info */}
                <div className="servmgmt-form-section">
                  <div className="servmgmt-form-grid-premium">
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">{t("services.form.labels.startColor")}</label>
                      <div className="servmgmt-color-input-wrapper">
                        <input
                          type="color"
                          name="startColor"
                          value={form.startColor}
                          onChange={handleFormChange}
                          className="servmgmt-color-input"
                        />
                        <span className="servmgmt-color-value">{form.startColor}</span>
                      </div>
                    </div>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">{t("services.form.labels.endColor")}</label>
                      <div className="servmgmt-color-input-wrapper">
                        <input
                          type="color"
                          name="endColor"
                          value={form.endColor}
                          onChange={handleFormChange}
                          className="servmgmt-color-input"
                        />
                        <span className="servmgmt-color-value">{form.endColor}</span>
                      </div>
                    </div>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">{t("services.form.labels.nameEn")}</label>
                      <input
                        name="name_en"
                        value={form.name_en}
                        onChange={handleFormChange}
                        className="servmgmt-input-premium"
                        placeholder={t("services.form.placeholders.nameEn")}
                      />
                    </div>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">{t("services.form.labels.nameRu")}</label>
                      <input
                        name="name_ru"
                        value={form.name_ru}
                        onChange={handleFormChange}
                        className="servmgmt-input-premium"
                        placeholder={t("services.form.placeholders.nameRu")}
                      />
                    </div>

                    <div className="servmgmt-form-group-premium full-width">
                      <label className="servmgmt-label-premium">{t("services.form.labels.descriptionEn")}</label>
                      <div className="servmgmt-ck-wrapper">
                        <CommonRichTextEditor
                          value={form.description_en}
                          onChange={(data) => handleDescriptionChange("description_en", data)}
                        />
                      </div>
                    </div>
                    <div className="servmgmt-form-group-premium full-width">
                      <label className="servmgmt-label-premium">{t("services.form.labels.descriptionRu")}</label>
                      <div className="servmgmt-ck-wrapper">
                        <CommonRichTextEditor
                          value={form.description_ru}
                          onChange={(data) => handleDescriptionChange("description_ru", data)}
                        />
                      </div>
                    </div>

                    {/* 
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">{t("services.form.labels.sectionCode")}</label>
                      <input
                        name="sectionCode"
                        value={form.sectionCode}
                        onChange={handleFormChange}
                        className="servmgmt-input-premium"
                        placeholder={t("services.form.placeholders.sectionCode")}
                      />
                    </div> 
                    */}
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">{t("services.form.labels.branch")}</label>
                      <Select
                        isMulti
                        options={availableBranches}
                        value={selectedBranchOption}
                        onChange={handleBranchChange}
                        placeholder={t("services.form.placeholders.branch")}
                        menuPortalTarget={document.body}
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: '12px',
                            padding: '2px',
                            border: '1.5px solid var(--color-border)',
                            backgroundColor: '#F8FAFC'
                          }),
                          menuPortal: base => ({ ...base, zIndex: 12000 })
                        }}
                      />
                    </div>

                  </div>
                </div>

                {/* Section 2: Media & Assignments */}
                <div className="servmgmt-form-section">
                  <div className="servmgmt-form-section-title">
                    <ImageIcon size={18} color="var(--color-primary)" />
                    <span>{t("services.form.sections.media")}</span>
                  </div>
                  <div className="servmgmt-form-grid-premium">
                    <div className="servmgmt-form-group-premium full-width">
                      {/* <label className="servmgmt-label-premium">Service Media (Images/Video)</label> */}
                      {form.file ? (
                        <div className="servmgmt-file-preview-container-premium">
                          <div className="servmgmt-file-preview-media">
                            {filePreview ? (
                              form.file instanceof File && form.file.type.startsWith('video/') ? (
                                <video src={filePreview} controls className="servmgmt-preview-element" />
                              ) : (
                                <img src={filePreview} alt="Preview" className="servmgmt-preview-element" />
                              )
                            ) : (
                              <div className="servmgmt-preview-placeholder">
                                <ImageIcon size={48} color="var(--color-primary)" style={{ opacity: 0.2 }} />
                                <p>{t("services.form.placeholders.preparing")}</p>
                              </div>
                            )}
                          </div>
                          <div className="servmgmt-file-info-premium">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ padding: '8px', background: 'var(--color-primary-hover)', borderRadius: '8px' }}>
                                <ImageIcon size={20} color="var(--color-primary)" />
                              </div>
                              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                                {form.file instanceof File ? form.file.name : `Object ID: ${form.file}`}
                              </span>
                            </div>
                            <button
                              onClick={removeFile}
                              style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="servmgmt-upload-zone">
                          <input type="file" onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,video/*" />
                          <div className="servmgmt-upload-icon">
                            <Plus size={32} />
                          </div>
                          <div className="servmgmt-upload-text">
                            <b>{t("services.form.upload.click")}</b> {t("services.form.upload.drag")}<br />
                            <span>{t("services.form.upload.hint")}</span>
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="servmgmt-form-group-premium full-width">
                      <label className="servmgmt-label-premium">{t("services.form.labels.assignDoctors")}</label>
                      <Select
                        isMulti
                        options={doctorOptions}
                        value={selectedDoctorOptions}
                        onChange={handleDoctorEmailsChange}
                        placeholder={t("services.form.placeholders.doctors")}
                        menuPortalTarget={document.body}
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: '12px',
                            padding: '2px',
                            border: '1.5px solid var(--color-border)',
                            backgroundColor: '#F8FAFC'
                          }),
                          menuPortal: base => ({ ...base, zIndex: 12000 })
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: About Service */}
                <div className="servmgmt-form-section" style={{ marginBottom: 0 }}>
                  <div className="servmgmt-form-section-title">
                    <FileText size={18} color="var(--color-primary)" />
                    <span>{t("services.form.sections.aboutService")}</span>
                  </div>
                  <div className="servmgmt-form-grid-premium">
                    <div className="servmgmt-form-group-premium full-width">
                      <label className="servmgmt-label-premium">{t("services.form.labels.aboutServiceEn")}</label>
                      <div className="servmgmt-ck-wrapper">
                        <CommonRichTextEditor
                          value={form.aboutService_en}
                          onChange={(data) => handleDescriptionChange("aboutService_en", data)}
                        />
                      </div>
                    </div>
                    <div className="servmgmt-form-group-premium full-width">
                      <label className="servmgmt-label-premium">{t("services.form.labels.aboutServiceRu")}</label>
                      <div className="servmgmt-ck-wrapper">
                        <CommonRichTextEditor
                          value={form.aboutService_ru}
                          onChange={(data) => handleDescriptionChange("aboutService_ru", data)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="servmgmt-modal-footer-premium">
                <button className="servmgmt-btn-cancel-premium" onClick={resetForm}>
                  {t("services.actions.cancel")}
                </button>
                <button className="servmgmt-btn-submit-premium" onClick={editingId ? handleUpdate : handleCreate}>
                  {editingId ? t("services.actions.updateService") : t("services.actions.createService")}
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Services;