import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { FiX, FiPlus, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { createPayment } from "../../utils/api";
import "./AddPaymentModal.css";

const PAYMENT_METHOD_OPTIONS = [
  { value: "tbank", label: "T-Bank" },
  { value: "vtb", label: "VTB" },
  { value: "yandex", label: "Yandex" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "payment_terminal", label: "Payment Terminal" },
  { value: "yookassa", label: "YooKassa" },
  { value: "free", label: "Free of charge" },
];

export default function AddPaymentModal({ application, onClose, onCreated }) {
  const { t } = useTranslation("payments_tab");

  const [items,    setItems]    = useState([{ name: "", amount: "" }]);
  const [discount, setDiscount] = useState("");
  const [method,   setMethod]   = useState("tbank");
  const [type,     setType]     = useState("consultation");
  const [loading,  setLoading]  = useState(false);

  const currency = "RUB";

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0),
    [items]
  );
  const finalAmount = method === "free" ? 0 : Math.max(0, subtotal - (parseFloat(discount) || 0));

  const addItem    = () => setItems((p) => [...p, { name: "", amount: "" }]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) =>
    setItems((p) => { const u = [...p]; u[i] = { ...u[i], [field]: val }; return u; });

  const fmt = (n) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.some((it) => !it.name.trim() || it.amount === "")) {
      toast.error(t("modal.items_required"));
      return;
    }
    if (method !== "free" && subtotal <= 0) {
      toast.error(t("modal.amount_required"));
      return;
    }
    setLoading(true);
    try {
      // Determine status based on payment method
      let status = "pending";
      if (method === "free") status = "free";
      if (method === "cash") status = "pending";
      
      await createPayment(application.applicationId, {
        items:         items.map((it) => ({ name: it.name.trim(), amount: parseFloat(it.amount) || 0 })),
        amount:        subtotal,
        discount:      parseFloat(discount) || 0,
        finalAmount,
        currency,
        paymentMethod: method,
        paymentType:   "card",
        status:        status,
        type,
      });
      toast.success(t("modal.created"));
      onCreated();
      onClose();
    } catch {
      toast.error(t("modal.create_error"));
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="apm-overlay" onMouseDown={onClose}>
      <div className="apm-modal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="apm-header">
          <h3 className="apm-title">{t("modal.title")}</h3>
          <button className="apm-close" type="button" onClick={onClose}><FiX size={18} /></button>
        </div>

        <form className="apm-body" onSubmit={handleSubmit}>

          {/* Items */}
          <div>
            <div className="apm-label">{t("modal.items")}</div>
            <div className="apm-items">
              {items.map((item, i) => (
                <div className="apm-item-row" key={i}>
                  <input
                    className="apm-input apm-input--name"
                    placeholder={t("modal.item_name")}
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                    required
                  />
                  <input
                    className="apm-input apm-input--amount"
                    type="number" min="0" step="0.01"
                    placeholder={t("modal.item_amount")}
                    value={item.amount}
                    onChange={(e) => updateItem(i, "amount", e.target.value)}
                  />
                  {items.length > 1 && (
                    <button type="button" className="apm-remove-item" title={t("modal.remove_item")} onClick={() => removeItem(i)}>
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="apm-add-item-btn" onClick={addItem}>
              <FiPlus size={13} /> {t("modal.add_item")}
            </button>
          </div>

          {/* Totals */}
          <div className="apm-totals">
            <div className="apm-total-row">
              <span>{t("modal.subtotal")}</span>
              <strong>{fmt(subtotal)} {currency}</strong>
            </div>
            <div className="apm-total-row">
              <label htmlFor="apm-discount">{t("modal.discount")}</label>
              <input
                id="apm-discount"
                className="apm-input apm-input--discount"
                type="number" min="0" step="0.01" placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="apm-total-row apm-total-row--final">
              <span>{t("modal.total")}</span>
              <strong className="apm-final-amount">{fmt(finalAmount)} {currency}</strong>
            </div>
          </div>

          {/* Method + Type */}
          <div className="apm-fields-row">
            <div className="apm-field">
              <label className="apm-label">{t("modal.method")}</label>
              <select className="apm-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="apm-field">
              <label className="apm-label">{t("modal.type")}</label>
              <select className="apm-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="consultation">{t("type_consultation")}</option>
                <option value="test">{t("type_test")}</option>
              </select>
            </div>
          </div>

          {/* Contextual notes */}
          {(method === "yookassa" || method === "tbank" || method === "vtb" || method === "yandex") && (
            <div className="apm-note apm-note--gateway">💳 {t("modal.gateway_note")}</div>
          )}
          {method === "free" && (
            <div className="apm-note apm-note--free">🎁 {t("modal.free_note")}</div>
          )}
          {(method === "cash" || method === "payment_terminal" || method === "bank_transfer") && (
            <div className="apm-note apm-note--cash">💵 {t("modal.cash_note")}</div>
          )}

          {/* Footer */}
          <div className="apm-footer">
            <button type="button" className="apm-btn apm-btn--cancel" onClick={onClose}>
              {t("modal.cancel")}
            </button>
            <button type="submit" className="apm-btn apm-btn--submit" disabled={loading}>
              {loading ? t("modal.creating") : t("modal.create")}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
