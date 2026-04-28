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
  User,
  Info,
  Banknote,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createSubService,
  updateSubService,
  deleteSubService,
  getAllSubServices,
  getServiceById,
} from "../utils/api";
import Select from "react-select";
import "../styles/SubServices.css";

const SubServices = ({ serviceId, onBack }) => {
  const { t, i18n } = useTranslation();
  const [subServices, setSubServices] = useState([]);
  const [search, setSearch] = useState("");
  const [serviceDoctors, setServiceDoctors] = useState([]);
  const [form, setForm] = useState({
    code: "",
    name_en: "",
    name_ru: "",
    price: "",
    notes_en: "",
    notes_ru: "",
    doctorEmails: [],
  });
  const [editingId, setEditingId] = useState(null);
  const [showSubServiceModal, setShowSubServiceModal] = useState(false);
  const [selectedSubService, setSelectedSubService] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (serviceId) {
      loadSubServices();
      loadServiceDoctors();
    }
  }, [serviceId, search]);

  const loadSubServices = async () => {
    try {
      const res = await getAllSubServices({ serviceId, search });
      setSubServices(res);
    } catch (error) {
    }
  };

  const loadServiceDoctors = async () => {
    try {
      setLoading(true);
      const service = await getServiceById(serviceId);
      setServiceDoctors(service.doctors || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getDoctorOptions = () => {
    return serviceDoctors.map(doctor => {
      const lName = doctor.lastName?.[i18n.language] || doctor.lastName?.en || doctor.lastName || "";
      const fName = doctor.firstName?.[i18n.language] || doctor.firstName?.en || doctor.firstName || "";
      const mName = doctor.middleName?.[i18n.language] || doctor.middleName?.en || doctor.middleName || "";
      const fullName = `${lName} ${fName} ${mName}`.trim().replace(/\s+/g, ' ');
      return {
        value: doctor.email,
        label: fullName || doctor.email,
      };
    });
  };

  const handleFormChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleDoctorEmailsChange = (selectedOptions) => {
    const emails = selectedOptions ? selectedOptions.map(option => option.value) : [];
    setForm({ ...form, doctorEmails: emails });
  };

  const resetForm = () => {
    setForm({
      code: "",
      name_en: "",
      name_ru: "",
      price: "",
      notes_en: "",
      notes_ru: "",
      doctorEmails: [],
    });
    setEditingId(null);
    setShowSubServiceModal(false);
    setSelectedSubService(null);
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!form.name_en || !form.name_en.trim()) {
      toast.error(t("subServices.validation.nameEnRequired", "English name is required"));
      return;
    }
    if (!form.name_ru || !form.name_ru.trim()) {
      toast.error(t("subServices.validation.nameRuRequired", "Russian name is required"));
      return;
    }
    if (!form.price || form.price <= 0) {
      toast.error(t("subServices.validation.priceRequired", "Price must be greater than 0"));
      return;
    }

    try {
      await createSubService({
        serviceId,
        code: form.code ? form.code.trim() : "",
        name: { en: form.name_en.trim(), ru: form.name_ru.trim() },
        price: Number(form.price),
        notes: { en: form.notes_en, ru: form.notes_ru },
        doctorEmails: form.doctorEmails,
      });
      resetForm();
      loadSubServices();
      toast.success(t("subServices.notifications.createSuccess"));
    } catch (error) {
      toast.error(error.response?.data?.message || t("subServices.notifications.error"));
    }
  };

  const handleEdit = (s) => {
    setEditingId(s._id);
    setSelectedSubService(s);
    setForm({
      code: s.code,
      name_en: s.name.en,
      name_ru: s.name.ru,
      price: s.price,
      notes_en: s.notes.en,
      notes_ru: s.notes.ru,
      doctorEmails: s.doctorEmails || [],
    });
    setShowSubServiceModal(true);
  };

  const handleUpdate = async () => {
    // Validate required fields
    if (!form.name_en || !form.name_en.trim()) {
      toast.error(t("subServices.validation.nameEnRequired", "English name is required"));
      return;
    }
    if (!form.name_ru || !form.name_ru.trim()) {
      toast.error(t("subServices.validation.nameRuRequired", "Russian name is required"));
      return;
    }
    if (!form.price || form.price <= 0) {
      toast.error(t("subServices.validation.priceRequired", "Price must be greater than 0"));
      return;
    }

    try {
      await updateSubService(editingId, {
        code: form.code ? form.code.trim() : "",
        name: { en: form.name_en.trim(), ru: form.name_ru.trim() },
        price: Number(form.price),
        notes: { en: form.notes_en, ru: form.notes_ru },
        doctorEmails: form.doctorEmails,
      });
      resetForm();
      loadSubServices();
      toast.success(t("subServices.notifications.updateSuccess"));
    } catch (error) {
      toast.error(error.response?.data?.message || t("subServices.notifications.error"));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t("subServices.actions.deleteConfirmation"))) {
      try {
        await deleteSubService(id);
        loadSubServices();
        toast.success(t("subServices.notifications.deleteSuccess"));
      } catch (error) {
        toast.error(t("subServices.notifications.error"));
      }
    }
  };

  const selectedDoctorOptions = getDoctorOptions().filter(option =>
    form.doctorEmails.includes(option.value)
  );

  return (
    <div className="subservmgmt-container">
      {onBack && (
        <button className="subservmgmt-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          {t("services.actions.backToList")}
        </button>
      )}
      <div className="subservmgmt-header">
        <h2 className="subservmgmt-title">{t("subServices.title")}</h2>
        <button className="subservmgmt-add-btn" onClick={() => setShowSubServiceModal(true)}>
          <Plus size={18} />
          {t("subServices.actions.addSubService")}
        </button>
      </div>

      <div className="subservmgmt-search-box">
        <Search className="subservmgmt-search-icon" size={18} />
        <input
          type="text"
          placeholder={t("subServices.search.placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="subservmgmt-search-input"
        />
      </div>

      <motion.div
        layout
        className="subservmgmt-table-container"
      >
        <table className="subservmgmt-table">
          <thead className="subservmgmt-thead">
            <tr>
              {/* <th className="subservmgmt-th">{t("subServices.table.headers.code")}</th> */}
              <th className="subservmgmt-th">{t("subServices.table.headers.nameEn")}</th>
              <th className="subservmgmt-th">{t("subServices.table.headers.price")}</th>
              <th className="subservmgmt-th">{t("subServices.table.headers.assignedDoctors")}</th>
              <th className="subservmgmt-th">{t("subServices.table.headers.actions")}</th>
            </tr>
          </thead>
          <tbody className="subservmgmt-tbody">
            <AnimatePresence>
              {subServices.map((s) => (
                <motion.tr
                  key={s._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="subservmgmt-table-row"
                  onClick={() => handleEdit(s)}
                >
                  {/* 
                  <td className="subservmgmt-td">
                    <span className="subservmgmt-code-badge">{s.code}</span>
                  </td> 
                  */}
                  <td className="subservmgmt-td" style={{ fontWeight: "600" }}>
                    {s.name[i18n.language] || s.name.en}
                  </td>
                  <td className="subservmgmt-td">
                    <div className="subservmgmt-price-cell">
                      <Banknote size={16} />
                      {s.price} {t("common.currency.rub", "RUB")}
                    </div>
                  </td>
                  <td className="subservmgmt-td">
                    <div className="subservmgmt-table-doctors">
                      {s.doctors?.length > 0 ? (
                        s.doctors.slice(0, 1).map((doc, idx) => (
                          <span key={idx} className="subservmgmt-doctor-pill">
                            {doc.firstName?.[i18n.language] || doc.firstName?.en ?
                              `${doc.firstName[i18n.language] || doc.firstName.en} ${doc.lastName?.[i18n.language] || doc.lastName?.en || ""}`.trim() :
                              (doc.email ? doc.email.split("@")[0] : t("applications.doctor"))
                            }
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>{t("common.status.none", "None")}</span>
                      )}
                      {s.doctors?.length > 1 && (
                        <span className="subservmgmt-doctor-pill">
                          +{s.doctors.length - 1}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="subservmgmt-td">
                    <div className="subservmgmt-action-buttons" onClick={e => e.stopPropagation()}>
                      <button className="subservmgmt-btn-edit" onClick={() => handleEdit(s)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="subservmgmt-btn-delete" onClick={() => handleDelete(s._id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {subServices.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <FileText style={{ opacity: 0.2, marginBottom: '12px' }} size={48} />
            <p>{t("subServices.table.emptyState")}</p>
          </div>
        )}
      </motion.div>

      {showSubServiceModal && createPortal(
        <AnimatePresence>
          <div className="servmgmt-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="servmgmt-modal-premium"
              style={{ maxWidth: '600px' }}
            >
              <div className="servmgmt-modal-header-premium">
                <div className="servmgmt-modal-header-title">
                  <h2>{editingId ? t("subServices.form.editTitle") : t("subServices.form.createTitle")}</h2>
                </div>
                <button className="servmgmt-modal-close-btn" onClick={resetForm}><X /></button>
              </div>

              <div className="servmgmt-modal-body-premium" style={{ gridTemplateColumns: '1fr' }}>
                <div className="servmgmt-form-section">
                  <div className="servmgmt-form-grid-premium" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">
                        {t("subServices.form.labels.code")}
                      </label>
                      <input 
                        name="code" 
                        value={form.code} 
                        onChange={handleFormChange} 
                        className="servmgmt-input-premium" 
                        placeholder={t("subServices.form.placeholders.code")}
                      />
                    </div>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">
                        {t("subServices.form.labels.nameEn")}
                        <span style={{ color: '#DC2626', marginLeft: '4px' }}>*</span>
                      </label>
                      <input 
                        name="name_en" 
                        value={form.name_en} 
                        onChange={handleFormChange} 
                        className="servmgmt-input-premium" 
                        placeholder={t("subServices.form.placeholders.nameEn")}
                        required
                      />
                    </div>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">
                        {t("subServices.form.labels.nameRu")}
                        <span style={{ color: '#DC2626', marginLeft: '4px' }}>*</span>
                      </label>
                      <input 
                        name="name_ru" 
                        value={form.name_ru} 
                        onChange={handleFormChange} 
                        className="servmgmt-input-premium" 
                        placeholder={t("subServices.form.placeholders.nameRu")}
                        required
                      />
                    </div>
                    <div className="servmgmt-form-group-premium">
                      <label className="servmgmt-label-premium">
                        {t("subServices.form.labels.price")} ({t("common.currency.rub", "RUB")})
                        <span style={{ color: '#DC2626', marginLeft: '4px' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Banknote size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)', opacity: 0.5 }} />
                        <input 
                          name="price" 
                          type="number" 
                          value={form.price} 
                          onChange={handleFormChange} 
                          className="servmgmt-input-premium" 
                          style={{ paddingLeft: '40px' }} 
                          placeholder={t("subServices.form.placeholders.price")}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="servmgmt-form-section" style={{ marginBottom: 0 }}>
                  <div className="servmgmt-form-group-premium">
                    <label className="servmgmt-label-premium">{t("subServices.form.labels.assignDoctors")}</label>
                    <Select
                      isMulti
                      options={getDoctorOptions()}
                      value={selectedDoctorOptions}
                      onChange={handleDoctorEmailsChange}
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderRadius: '12px',
                          padding: '2px',
                          border: '1.5px solid var(--color-border)',
                          backgroundColor: '#F8FAFC'
                        })
                      }}
                      placeholder={t("subServices.form.placeholders.doctors")}
                    />
                  </div>
                </div>
              </div>

              <div className="servmgmt-modal-footer-premium">
                <button className="servmgmt-btn-cancel-premium" onClick={resetForm}>{t("subServices.actions.cancel")}</button>
                <button className="servmgmt-btn-submit-premium" onClick={editingId ? handleUpdate : handleCreate}>
                  {editingId ? t("subServices.actions.updateSubService") : t("subServices.actions.createSubService")}
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

export default SubServices;