import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { createServicePosition, updateServicePosition, getAllDoctorsProfiles } from "../utils/api";

const EMPTY_DOCTOR = { doctor: "", price: "" };

const EMPTY_FORM = {
  name: "",
  shortName: "",
  serviceCode: "",
  pmuCode: "",
  serialNumber: "",
  type: "service",
  isActive: true,
  price: "",
  costPrice: "",
  costType: "simple",
  sno: "default",
  vat: "default",
  cashRegister: "",
  description: "",
  specification: "",
  tag: "",
  duration: "",
  documentFormTemplate: "",
  executor: "",
  supplier: "",
  excludeFromTaxDeduction: false,
  isConsultation: false,
  consultationDoctors: [{ ...EMPTY_DOCTOR }],
};

const PositionModal = ({ open, editing, currentFolder, onClose, onSaved }) => {
  const { t } = useTranslation("serviceManager");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (open) {
      getAllDoctorsProfiles({ limit: 500 })
        .then(res => {
          const list = res?.data || res || [];
          setDoctors(Array.isArray(list) ? list : []);
        })
        .catch(() => setDoctors([]));

      if (editing) {
        setForm({
          name: editing.name || "",
          shortName: editing.shortName || "",
          serviceCode: editing.serviceCode || "",
          pmuCode: editing.pmuCode || "",
          serialNumber: editing.serialNumber || "",
          type: editing.type || "service",
          isActive: editing.isActive !== undefined ? editing.isActive : true,
          price: editing.price !== undefined ? editing.price : "",
          costPrice: editing.costPrice !== undefined ? editing.costPrice : "",
          costType: editing.costType || "simple",
          sno: editing.sno || "default",
          vat: editing.vat || "default",
          cashRegister: editing.cashRegister || "",
          description: editing.description || "",
          specification: editing.specification || "",
          tag: editing.tag || "",
          duration: editing.duration !== undefined ? editing.duration : "",
          documentFormTemplate: editing.documentFormTemplate || "",
          executor: editing.executor || "",
          supplier: editing.supplier || "",
          excludeFromTaxDeduction: !!editing.excludeFromTaxDeduction,
          isConsultation: !!editing.isConsultation,
          consultationDoctors: Array.isArray(editing.consultationDoctors) && editing.consultationDoctors.length
            ? editing.consultationDoctors.map(e => ({ doctor: e.doctor || "", price: e.price !== undefined ? e.price : "" }))
            : editing.consultationDoctor
              ? [{ doctor: editing.consultationDoctor, price: editing.price || "" }]
              : [{ ...EMPTY_DOCTOR }],
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const updateConsultationDoctor = (idx, field, value) => {
    setForm(prev => {
      const updated = prev.consultationDoctors.map((e, i) => i === idx ? { ...e, [field]: value } : e);
      return { ...prev, consultationDoctors: updated };
    });
  };

  const addConsultationDoctor = () => {
    setForm(prev => ({ ...prev, consultationDoctors: [...prev.consultationDoctors, { ...EMPTY_DOCTOR }] }));
  };

  const removeConsultationDoctor = (idx) => {
    setForm(prev => ({ ...prev, consultationDoctors: prev.consultationDoctors.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(t("position.nameRequired")); return; }
    if (!form.isConsultation && (form.price === "" || form.price === null || form.price === undefined)) {
      toast.error(t("position.priceRequired")); return;
    }

    const consultationDoctors = form.isConsultation
      ? form.consultationDoctors.filter(e => e.doctor).map(e => ({ doctor: e.doctor, price: Number(e.price) || 0 }))
      : [];

    const payload = {
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      serviceCode: form.serviceCode.trim(),
      pmuCode: form.pmuCode.trim(),
      serialNumber: form.serialNumber.trim(),
      type: form.type,
      isActive: form.isActive,
      price: form.isConsultation ? (Number(form.price) || 0) : Number(form.price),
      costPrice: form.costPrice !== "" ? Number(form.costPrice) : undefined,
      costType: form.costType,
      sno: form.sno,
      vat: form.vat,
      cashRegister: form.cashRegister.trim(),
      description: form.description.trim(),
      specification: form.specification.trim(),
      tag: form.tag.trim(),
      duration: form.duration !== "" ? Number(form.duration) : undefined,
      documentFormTemplate: form.documentFormTemplate.trim(),
      executor: form.executor.trim(),
      supplier: form.supplier.trim(),
      excludeFromTaxDeduction: form.excludeFromTaxDeduction,
      isConsultation: form.isConsultation,
      consultationDoctors,
      category: currentFolder || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateServicePosition(editing._id, payload);
        toast.success(t("position.updated"));
      } else {
        await createServicePosition(payload);
        toast.success(t("position.created"));
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("position.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const drawer = (
    <>
      <div className="sm-drawer-overlay" onClick={onClose} />
      <div className="sm-drawer wide" role="dialog" aria-modal="true">
        <div className="sm-modal-header">
          <h2>{editing ? t("position.editTitle") : t("position.addTitle")}</h2>
          <button className="sm-modal-close" onClick={onClose} aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div className="sm-modal-body">

            {/* ── Basic Info ── */}
            <div className="sm-section-header">{t("position.sections.basicInfo")}</div>

            <div className="sm-field">
              <label htmlFor="pos-name">
                {t("position.name")} <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="pos-name"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t("position.namePlaceholder")}
                autoFocus
              />
            </div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-short-name">{t("position.shortName")}</label>
                <input
                  id="pos-short-name"
                  type="text"
                  name="shortName"
                  value={form.shortName}
                  onChange={handleChange}
                  placeholder={t("position.shortNamePlaceholder")}
                />
              </div>
              <div className="sm-field">
                <label htmlFor="pos-serial">{t("position.serialNumber")}</label>
                <input
                  id="pos-serial"
                  type="text"
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleChange}
                  placeholder={t("position.serialNumberPlaceholder")}
                />
              </div>
            </div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-service-code">{t("position.serviceCode")}</label>
                <input
                  id="pos-service-code"
                  type="text"
                  name="serviceCode"
                  value={form.serviceCode}
                  onChange={handleChange}
                  placeholder={t("position.serviceCodePlaceholder")}
                />
              </div>
              <div className="sm-field">
                <label htmlFor="pos-pmu-code">{t("position.pmuCode")}</label>
                <input
                  id="pos-pmu-code"
                  type="text"
                  name="pmuCode"
                  value={form.pmuCode}
                  onChange={handleChange}
                  placeholder={t("position.pmuCodePlaceholder")}
                />
              </div>
            </div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-type">{t("position.type")}</label>
                <select id="pos-type" name="type" value={form.type} onChange={handleChange}>
                  <option value="service">{t("position.typeService")}</option>
                  <option value="good">{t("position.typeGood")}</option>
                  <option value="complex">{t("position.typeComplex")}</option>
                </select>
              </div>
              <div className="sm-field" style={{ justifyContent: "flex-end", paddingBottom: 2 }}>
                <label className="sm-toggle-row" style={{ marginTop: "auto" }}>
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                  {t("position.active")}
                </label>
              </div>
            </div>

            <div className="sm-field">
              <label>{t("position.positionKind")}</label>
              <div style={{ display: "flex", gap: 24, paddingTop: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal" }}>
                  <input
                    type="radio"
                    name="isConsultation"
                    checked={!form.isConsultation}
                    onChange={() => setForm(prev => ({ ...prev, isConsultation: false, consultationDoctor: "" }))}
                  />
                  {t("position.kindPosition")}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal" }}>
                  <input
                    type="radio"
                    name="isConsultation"
                    checked={form.isConsultation}
                    onChange={() => setForm(prev => ({ ...prev, isConsultation: true }))}
                  />
                  {t("position.kindConsultation")}
                </label>
              </div>
            </div>

            {/* ── Doctor list (consultation only) ── */}
            {form.isConsultation && (
              <div className="sm-field">
                <label>{t("position.consultationDoctor")}</label>
                {form.consultationDoctors.map((entry, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <select
                        value={entry.doctor}
                        onChange={e => updateConsultationDoctor(idx, "doctor", e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="">{t("position.selectDoctor")}</option>
                        {doctors
                          .filter(d => !form.consultationDoctors.some((e, i) => i !== idx && e.doctor === d._id))
                          .map(d => {
                            const str = (f) => f?.ru || f?.en || "";
                            const name = [str(d.lastName), str(d.firstName), str(d.middleName)].filter(Boolean).join(" ") || d.email || d._id;
                            return (
                              <option key={d._id} value={d._id}>{name}</option>
                            );
                          })}
                      </select>
                    </div>
                    {entry.doctor && (
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={entry.price}
                          onChange={e => updateConsultationDoctor(idx, "price", e.target.value)}
                          placeholder={t("position.price")}
                          min="0"
                          step="0.01"
                          style={{ width: "100%" }}
                        />
                      </div>
                    )}
                    {form.consultationDoctors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeConsultationDoctor(idx)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "6px 2px" }}
                        aria-label="Remove"
                      >×</button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addConsultationDoctor}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "1px dashed #94a3b8", borderRadius: 6, color: "#475569", cursor: "pointer", fontSize: 13, padding: "4px 10px", marginTop: 2, width: "fit-content" }}
                >
                  + {t("position.addDoctor", "Add Doctor")}
                </button>
              </div>
            )}

            {/* ── Pricing ── */}
            <div className="sm-section-header">{t("position.sections.pricing")}</div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-price">
                  {t("position.price")} <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="pos-price"
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="sm-field">
                <label htmlFor="pos-cost-price">{t("position.costPrice")}</label>
                <input
                  id="pos-cost-price"
                  type="number"
                  name="costPrice"
                  value={form.costPrice}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-cost-type">{t("position.costType")}</label>
                <select id="pos-cost-type" name="costType" value={form.costType} onChange={handleChange}>
                  <option value="simple">{t("position.costTypeSimple")}</option>
                  <option value="complex">{t("position.costTypeComplex")}</option>
                </select>
              </div>
              <div className="sm-field">
                <label htmlFor="pos-cash-register">{t("position.cashRegister")}</label>
                <input
                  id="pos-cash-register"
                  type="text"
                  name="cashRegister"
                  value={form.cashRegister}
                  onChange={handleChange}
                  placeholder={t("position.cashRegisterPlaceholder")}
                />
              </div>
            </div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-sno">{t("position.sno")}</label>
                <select id="pos-sno" name="sno" value={form.sno} onChange={handleChange}>
                  <option value="default">{t("position.snoDefault")}</option>
                  <option value="osn">OSN</option>
                  <option value="usn_d">USN (income)</option>
                  <option value="usn_r">USN (income-expense)</option>
                  <option value="envd">ENVD</option>
                  <option value="eshn">ESHN</option>
                  <option value="patent">Patent</option>
                </select>
              </div>
              <div className="sm-field">
                <label htmlFor="pos-vat">{t("position.vat")}</label>
                <select id="pos-vat" name="vat" value={form.vat} onChange={handleChange}>
                  <option value="default">{t("position.vatDefault")}</option>
                  <option value="none">{t("position.vatNone")}</option>
                  <option value="vat0">VAT 0%</option>
                  <option value="vat10">VAT 10%</option>
                  <option value="vat20">VAT 20%</option>
                </select>
              </div>
            </div>

            {/* ── Content ── */}
            <div className="sm-section-header">{t("position.sections.content")}</div>

            <div className="sm-field">
              <label htmlFor="pos-description">{t("position.description")}</label>
              <textarea
                id="pos-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder={t("position.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="sm-field">
              <label htmlFor="pos-specification">{t("position.specification")}</label>
              <textarea
                id="pos-specification"
                name="specification"
                value={form.specification}
                onChange={handleChange}
                placeholder={t("position.specificationPlaceholder")}
                rows={3}
              />
            </div>

            {/* ── Appearance ── */}
            <div className="sm-section-header">{t("position.sections.appearance")}</div>

            <div className="sm-field">
              <label htmlFor="pos-tag">{t("position.tag")}</label>
              <input
                id="pos-tag"
                type="text"
                name="tag"
                value={form.tag}
                onChange={handleChange}
                placeholder={t("position.tagPlaceholder")}
              />
            </div>


            {/* ── Other ── */}
            <div className="sm-section-header">{t("position.sections.other")}</div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-duration">{t("position.duration")}</label>
                <input
                  id="pos-duration"
                  type="number"
                  name="duration"
                  value={form.duration}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="sm-field">
                <label htmlFor="pos-doc-template">{t("position.documentFormTemplate")}</label>
                <input
                  id="pos-doc-template"
                  type="text"
                  name="documentFormTemplate"
                  value={form.documentFormTemplate}
                  onChange={handleChange}
                  placeholder={t("position.documentFormTemplatePlaceholder")}
                />
              </div>
            </div>

            <div className="sm-field-row">
              <div className="sm-field">
                <label htmlFor="pos-executor">{t("position.executor")}</label>
                <input
                  id="pos-executor"
                  type="text"
                  name="executor"
                  value={form.executor}
                  onChange={handleChange}
                  placeholder={t("position.executorPlaceholder")}
                />
              </div>
              <div className="sm-field">
                <label htmlFor="pos-supplier">{t("position.supplier")}</label>
                <input
                  id="pos-supplier"
                  type="text"
                  name="supplier"
                  value={form.supplier}
                  onChange={handleChange}
                  placeholder={t("position.supplierPlaceholder")}
                />
              </div>
            </div>

            <label className="sm-toggle-row">
              <input
                type="checkbox"
                name="excludeFromTaxDeduction"
                checked={form.excludeFromTaxDeduction}
                onChange={handleChange}
              />
              {t("position.excludeFromTaxDeduction")}
            </label>

            <div className="sm-modal-footer">
              <button type="button" className="sm-btn-cancel" onClick={onClose} disabled={saving}>
                {t("position.cancel")}
              </button>
              <button type="submit" className="sm-btn-submit" disabled={saving}>
                {saving ? t("position.saving") : editing ? t("position.saveChanges") : t("position.create")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
};

export default PositionModal;
