import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  FiCreditCard, FiPlus, FiCheckCircle, FiTag,
  FiFileText, FiClipboard, FiXCircle, FiLink, FiX, FiDownload,
} from "react-icons/fi";
import { toast } from "react-toastify";
import {
  getPayments,
  markPaymentPaid,
  markPaymentFree,
  cancelPaymentRecord,
} from "../../utils/api";
import ContractDocument from "../ContractDocument";
import AktDocument from "../AktDocument";
import AddPaymentModal from "./AddPaymentModal";
import { getApptStatusClass } from "../../utils/appointmentStatus";
import "./PaymentsTab.css";

/* ── Status colour map ── */
const getPaymentStatusClass = (status) => getApptStatusClass(status);

const fmt = (num, currency = "RUB") => {
  if (num == null) return "—";
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(num);
  } catch {
    return `${num} ${currency}`;
  }
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return dateStr; }
};

export default function PaymentsTab({ application }) {
  const { t } = useTranslation("payments_tab");
  const applicationId = application?.applicationId;

  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [busy,    setBusy]      = useState({});

  // Document viewer state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isAktOpen,     setIsAktOpen]     = useState(false);
  const [invoiceData,   setInvoiceData]   = useState(null);
  const [aktData,       setAktData]       = useState(null);

  const refetch = useCallback(() => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    getPayments(applicationId)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.payments || res?.data?.payments || []);
        setPayments(list);
      })
      .catch(() => setError(t("load_error")))
      .finally(() => setLoading(false));
  }, [applicationId, t]);

  useEffect(() => { refetch(); }, [refetch]);

  const withBusy = (id, fn) => {
    setBusy((p) => ({ ...p, [id]: true }));
    return fn().finally(() => setBusy((p) => { const n = { ...p }; delete n[id]; return n; }));
  };

  const handleMarkPaid = (p) => withBusy(p.id, () => markPaymentPaid(applicationId, p.id))
    .then(() => { toast.success(t("marked_paid")); refetch(); })
    .catch(() => toast.error(t("action_error")));

  const handleMarkFree = (p) => withBusy(p.id, () => markPaymentFree(applicationId, p.id))
    .then(() => { toast.success(t("marked_free")); refetch(); })
    .catch(() => toast.error(t("action_error")));

  const handleCancel = (p) => withBusy(p.id, () => cancelPaymentRecord(applicationId, p.id))
    .then(() => { toast.success(t("payment_cancelled")); refetch(); })
    .catch(() => toast.error(t("action_error")));

  const handleCopyLink = (link) =>
    navigator.clipboard.writeText(link).then(() => toast.success(t("link_copied")));

  const generateInvoiceData = (p) => ({
    full_name:               application?.patientName || [application?.patient?.firstName, application?.patient?.lastName].filter(Boolean).join(" "),
    date_of_birth:           application?.patient?.dateOfBirth || "",
    email:                   application?.patient?.email || application?.patientEmail || "",
    phone_no:                application?.patient?.phoneNumber || "",
    invoice_number:          p.invoiceNumber || "",
    invoice_date:            p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date().toLocaleDateString(),
    link_created_at:         p.createdAt,
    payment_date:            p.paidAt,
    appointment_created_at:  application?.createdAt,
    total_amount:            `${p.finalAmount ?? p.amount} ${p.currency || "RUB"}`,
    items:                   p.items || [],
    patient_id:              application?.patient?._id || application?.patientId || "",
    application_id:          application?.applicationId || application?._id || "",
    status:                  p.status,
    payment_method:          p.paymentMethod || "",
  });

  const generateAktData = (p) => ({
    full_name:               application?.patientName || [application?.patient?.firstName, application?.patient?.lastName].filter(Boolean).join(" "),
    date_of_birth:           application?.patient?.dateOfBirth || "",
    email:                   application?.patient?.email || application?.patientEmail || "",
    phone_no:                application?.patient?.phoneNumber || "",
    agreement_number:        p.invoiceNumber || "",
    akt_number:              `AKT-${p.invoiceNumber || ""}`,
    link_created_at:         p.createdAt,
    payment_date:            p.paidAt,
    appointment_created_at:  application?.createdAt,
    total_amount:            `${p.finalAmount ?? p.amount} ${p.currency || "RUB"}`,
    items:                   p.items || [],
  });

  const handleInvoice = (p) => {
    setInvoiceData(generateInvoiceData(p));
    setIsInvoiceOpen(true);
  };

  const handleAkt = (p) => {
    setAktData(generateAktData(p));
    setIsAktOpen(true);
  };

  const handleCloseDocument = () => {
    setIsInvoiceOpen(false);
    setIsAktOpen(false);
    setInvoiceData(null);
    setAktData(null);
  };

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.finalAmount ?? 0), 0);
  const currency  = payments[0]?.currency || "RUB";

  return (
    <div className="pt-container">

      {/* ── Heading ── */}
      <div className="pt-heading-row">
        <div className="pt-heading">
          <FiCreditCard size={18} className="pt-heading-icon" />
          <span>{t("heading")}</span>
          {!loading && <span className="pt-heading-badge">{payments.length}</span>}
        </div>
        <button className="pt-add-btn" onClick={() => setShowAdd(true)}>
          <FiPlus size={15} />
          {t("add_payment")}
        </button>
      </div>

      {/* ── Summary bar ── */}
      <div className="pt-summary">
        <div className="pt-summary-item">
          <span className="pt-summary-label">{t("total_records")}</span>
          <span className="pt-summary-value">{loading ? "…" : payments.length}</span>
        </div>
        <div className="pt-summary-divider" />
        <div className="pt-summary-item">
          <span className="pt-summary-label">{t("total_paid")}</span>
          <span className="pt-summary-value pt-summary-value--paid">{loading ? "…" : fmt(totalPaid, currency)}</span>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="pt-state">
          <div className="pt-spinner" />
          <span>{t("loading")}</span>
        </div>
      ) : error ? (
        <div className="pt-state pt-state--error">{error}</div>
      ) : payments.length === 0 ? (
        <div className="pt-empty">{t("no_payments")}</div>
      ) : (
        <div className="pt-table-wrap">
          <table className="pt-table">
            <thead>
              <tr>
                <th>{t("col_invoice")}</th>
                <th>{t("col_type")}</th>
                <th>{t("col_items")}</th>
                <th>{t("col_amount")}</th>
                <th>{t("col_discount")}</th>
                <th>{t("col_final")}</th>
                <th>{t("col_status")}</th>
                <th>{t("col_date")}</th>
                <th>{t("col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const isActive = !["paid", "cancelled", "free"].includes(p.status);
                const isBusy   = !!busy[p.id];
                return (
                  <tr key={p.id || p.invoiceNumber || i}>
                    <td className="pt-cell-invoice">
                      {p.invoiceNumber || p.id || `#${i + 1}`}
                    </td>
                    <td>
                      <span className={`pt-type-badge pt-type--${p.type}`}>
                        {t(`type_${p.type}`, { defaultValue: p.type })}
                      </span>
                    </td>
                    <td className="pt-cell-items">
                      {p.items?.length ? (
                        <ul className="pt-items-list">
                          {p.items.map((item, j) => (
                            <li key={j}>
                              <span className="pt-item-name">{item.name}</span>
                              <span className="pt-item-amount">{fmt(item.amount, p.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : "—"}
                    </td>
                    <td>{fmt(p.amount, p.currency)}</td>
                    <td>{p.discount ? fmt(p.discount, p.currency) : "—"}</td>
                    <td className="pt-cell-final">{fmt(p.finalAmount, p.currency)}</td>
                    <td>
                      <span className={`appt-status-badge ${getPaymentStatusClass(p.status)}`}>
                        {t(`status_${p.status}`, { defaultValue: p.status })}
                      </span>
                    </td>
                    <td className="pt-cell-date">
                      {p.status === "paid" || p.status === "free"
                        ? fmtDate(p.paidAt)
                        : fmtDate(p.createdAt)}
                    </td>
                    <td className="pt-cell-actions">
                      <div className="pt-actions">
                        {p.paymentLink && (
                          <button className="pt-action-btn pt-action--link" title={t("action_copy_link")}
                            onClick={() => handleCopyLink(p.paymentLink)} disabled={isBusy}>
                            <FiLink size={13} />
                          </button>
                        )}
                        {isActive && (
                          <button className="pt-action-btn pt-action--paid" title={t("action_mark_paid")}
                            onClick={() => handleMarkPaid(p)} disabled={isBusy}>
                            <FiCheckCircle size={13} />
                          </button>
                        )}
                        {["new", "pending"].includes(p.status) && (
                          <button className="pt-action-btn pt-action--free" title={t("action_mark_free")}
                            onClick={() => handleMarkFree(p)} disabled={isBusy}>
                            <FiTag size={13} />
                          </button>
                        )}
                        {p.invoiceNumber && (
                          <button className="pt-action-btn pt-action--invoice" title={t("action_invoice")}
                            onClick={() => handleInvoice(p)} disabled={isBusy}>
                            <FiFileText size={13} />
                          </button>
                        )}
                        {(p.status === "paid" || p.status === "free") && (
                          <button className="pt-action-btn pt-action--akt" title={t("action_akt")}
                            onClick={() => handleAkt(p)} disabled={isBusy}>
                            <FiClipboard size={13} />
                          </button>
                        )}
                        {isActive && (
                          <button className="pt-action-btn pt-action--cancel" title={t("action_cancel")}
                            onClick={() => handleCancel(p)} disabled={isBusy}>
                            <FiXCircle size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddPaymentModal
          application={application}
          onClose={() => setShowAdd(false)}
          onCreated={() => refetch()}
        />
      )}

      {/* ── Invoice document viewer ── */}
      {isInvoiceOpen && invoiceData && createPortal(
        <div className="document-modal-overlay" onClick={handleCloseDocument}>
          <div className="pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-header">
              <h2>{t("action_invoice")}</h2>
              <div className="pdf-header-buttons">
                <button className="close-pdf-button" onClick={handleCloseDocument} type="button" aria-label="Close">
                  <FiX size={16} />
                </button>
              </div>
            </div>
            <ContractDocument data={invoiceData} onClose={handleCloseDocument} />
          </div>
        </div>,
        document.body
      )}

      {/* ── Akt document viewer ── */}
      {isAktOpen && aktData && createPortal(
        <div className="document-modal-overlay" onClick={handleCloseDocument}>
          <div className="pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-header">
              <h2>{t("action_akt")}</h2>
              <div className="pdf-header-buttons">
                <button className="close-pdf-button" onClick={handleCloseDocument} type="button" aria-label="Close">
                  <FiX size={16} />
                </button>
              </div>
            </div>
            <AktDocument data={aktData} onClose={handleCloseDocument} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
