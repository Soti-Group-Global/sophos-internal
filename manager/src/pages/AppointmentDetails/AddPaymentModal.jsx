import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { FiX, FiPlus, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { createPayment, getApplicationServicePositions } from "../../utils/api";
import "./AddPaymentModal.css";

const PAYMENT_METHOD_OPTIONS = [
  { value: "tbank",            label: "T-Bank" },
  { value: "vtb",              label: "VTB" },
  { value: "yandex",           label: "Yandex" },
  { value: "bank_transfer",    label: "Bank Transfer" },
  { value: "cash",             label: "Cash" },
  { value: "payment_terminal", label: "Payment Terminal" },
  { value: "yookassa",         label: "YooKassa" },
  { value: "free",             label: "Free of charge" },
];

export default function AddPaymentModal({ application, onClose, onCreated }) {
  const { t } = useTranslation("payments_tab");

  const [items,   setItems]   = useState([{ name: "", amount: "", pct: "" }]);
  const [vat,     setVat]     = useState("");
  const [method,  setMethod]  = useState("tbank");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!application?.applicationId) return;
    getApplicationServicePositions(application.applicationId)
      .then((data) => {
        const positions = data?.positions || [];
        if (positions.length > 0)
          setItems(positions.map((p) => ({ name: p.name || "", amount: p.price != null ? String(p.price) : "", pct: "" })));
      })
      .catch(() => {});
  }, [application?.applicationId]);

  const currency = "RUB";

  const subtotal = useMemo(
    () => items.reduce((s, it) => {
      const amt  = parseFloat(it.amount) || 0;
      const disc = parseFloat(it.pct)    || 0;
      return s + amt * (1 - disc / 100);
    }, 0),
    [items]
  );
  const vatAmount   = subtotal * ((parseFloat(vat) || 0) / 100);
  const finalAmount = method === "free" ? 0 : Math.max(0, subtotal + vatAmount);

  const addItem    = () => setItems((p) => [...p, { name: "", amount: "", pct: "" }]);
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
      let status = "pending";
      if (method === "free") status = "free";

      await createPayment(application.applicationId, {
        items:         items.map((it) => ({ name: it.name.trim(), amount: parseFloat(it.amount) || 0, discount: parseFloat(it.pct) || 0 })),
        amount:        subtotal,
        vat:           parseFloat(vat) || 0,
        finalAmount,
        currency,
        paymentMethod: method,
        paymentType:   "card",
        status,
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
          <h3 className="apm-title">{t("modal.title", "Add Payment")}</h3>
          <button className="apm-close" type="button" onClick={onClose}><FiX size={18} /></button>
        </div>

        <form className="apm-body" onSubmit={handleSubmit}>

          {/* Items */}
          <div>
            <div className="apm-label">{t("modal.items", "Items")}</div>
            <div className="apm-items">
              {items.map((item, i) => (
                <div className="apm-item-row" key={i}>
                  <input
                    className="apm-input apm-input--name"
                    placeholder={t("modal.item_name", "Service name")}
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                    required
                  />
                  <input
                    className="apm-input apm-input--amount"
                    type="number" min="0" step="0.01"
                    placeholder={t("modal.item_amount", "Amount")}
                    value={item.amount}
                    onChange={(e) => updateItem(i, "amount", e.target.value)}
                  />
                  <input
                    className="apm-input apm-input--pct"
                    type="number" min="0" max="100" step="0.01"
                    placeholder="0"
                    value={item.pct}
                    onChange={(e) => updateItem(i, "pct", e.target.value)}
                  />
                  <span className="apm-pct-label">%</span>
                  {items.length > 1 && (
                    <button type="button" className="apm-remove-item" onClick={() => removeItem(i)}>
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="apm-add-item-btn" onClick={addItem}>
              <FiPlus size={13} /> {t("modal.add_item", "Add item")}
            </button>
          </div>

          {/* Totals */}
          <div className="apm-totals">
            <div className="apm-total-row">
              <span>{t("modal.subtotal", "Subtotal")}</span>
              <strong>{fmt(subtotal)} {currency}</strong>
            </div>
            <div className="apm-total-row">
              <label htmlFor="apm-vat">{t("modal.vat", "VAT")}</label>
              <div className="apm-vat-input-wrap">
                <input
                  id="apm-vat"
                  className="apm-input apm-input--vat"
                  type="number" min="0" max="100" step="0.01"
                  placeholder="0"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                />
                <span className="apm-pct-label">%</span>
              </div>
            </div>
            <div className="apm-total-row apm-total-row--final">
              <span>{t("modal.total", "Total")}</span>
              <strong className="apm-final-amount">{fmt(finalAmount)} {currency}</strong>
            </div>
          </div>

          {/* Payment Method — full width */}
          <div className="apm-field">
            <label className="apm-label">{t("modal.method", "Payment Method")}</label>
            <select className="apm-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Contextual notes */}
          {(method === "yookassa" || method === "tbank" || method === "vtb" || method === "yandex") && (
            <div className="apm-note apm-note--gateway">💳 {t("modal.gateway_note", "A payment link will be generated for the patient.")}</div>
          )}
          {method === "free" && (
            <div className="apm-note apm-note--free">🎁 {t("modal.free_note", "This service will be marked as free of charge.")}</div>
          )}
          {(method === "cash" || method === "payment_terminal" || method === "bank_transfer") && (
            <div className="apm-note apm-note--cash">💵 {t("modal.cash_note", "Mark as paid manually once cash is received.")}</div>
          )}

          {/* Footer */}
          <div className="apm-footer">
            <button type="button" className="apm-btn apm-btn--cancel" onClick={onClose}>
              {t("modal.cancel", "Cancel")}
            </button>
            <button type="submit" className="apm-btn apm-btn--submit" disabled={loading}>
              {loading ? t("modal.creating", "Creating…") : t("modal.create", "Create Payment")}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
