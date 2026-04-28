import { useState, useEffect, useRef } from "react";
import {
  FaPlus,
  FaTrash,
  FaCopy,
  FaEnvelope,
  FaTimes,
  FaFileCsv,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import ReactDOMServer from "react-dom/server";
import "../styles/InvoiceModal.css";
import {
  addPayment,
  getPayments,
  sendEmail,
  sendWhatsAppMessage,
  markPaymentAsPaid,
  markPaymentAsFree,
} from "../utils/api";
import ContractDocument from "./ContractDocument";
import AktDocument from "./AktDocument";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { createPortal } from "react-dom";

const InvoiceModal = ({ application, isOpen, onClose, onPaymentSuccess }) => {
  const { t } = useTranslation();
  const [attendanceMode, setAttendanceMode] = useState(
    application?.appointmentMode?.toLowerCase() || "online"
  );
  const [items, setItems] = useState([
    { id: Date.now(), name: "", amount: "", currency: "RUB", quantity: 1 },
  ]);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [paymentHistory, setPaymentHistory] = useState(
    Array.isArray(application?.payments)
      ? [...application.payments]
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.paidAt || b.date || b.updatedAt || 0) -
              new Date(a.createdAt || a.paidAt || a.date || a.updatedAt || 0)
          )
          .map((p) => ({
            ...p,
            time: p.paidAt
              ? new Date(p.paidAt).toLocaleString()
              : t("invoiceModal.na"),
          }))
      : []
  );
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [contractPdfBlob, setContractPdfBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isResendingWhatsAppId, setIsResendingWhatsAppId] = useState(null);
  const [isSendingEmailId, setIsSendingEmailId] = useState(null);
  const isCreatingPaymentRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false); // Changed from isContractOnlineOpen/isContractOfflineOpen
  const [isAktOpen, setIsAktOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null); // Changed from contractData
  const [aktData, setAktData] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [gateway, setGateway] = useState("yookassa"); // "yookassa" or "bank"
  const [paymentType, setPaymentType] = useState("card"); // "card" or "qr"

  const MySwal = withReactContent(Swal);


  useEffect(() => {
    if (
      isOpen &&
      paymentHistory.some(
        (p) => p.status === "pending" && p.paymentMethod === "yookassa"
      ) &&
      !isCreatingPaymentRef.current
    ) {
      pollIntervalRef.current = setInterval(fetchPaymentHistory, 10000);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [paymentHistory, isOpen]);

  const fetchPaymentHistory = async () => {
    try {
      const response = await getPayments(application._id);
      const payments = Array.isArray(response?.payments)
        ? response.payments
        : [];
      setPaymentHistory(
        [...payments]
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.paidAt || b.date || b.updatedAt || 0) -
              new Date(a.createdAt || a.paidAt || a.date || a.updatedAt || 0)
          )
          .map((p) => ({
            ...p,
            time: p.paidAt
              ? new Date(p.paidAt).toLocaleString()
              : t("invoiceModal.na"),
          }))
      );
    } catch (error) {
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: Date.now(), name: "", amount: "", currency: "RUB", quantity: 1 },
    ]);
  };

  const handleDeleteItem = (id) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const totalAmount = items.reduce(
    (sum, item) =>
      sum + (Number(item.amount) || 0) * (parseInt(item.quantity) || 1),
    0
  );

  const handleCopyLink = () => {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl).then(() => {
        toast.success(t("invoiceModal.linkCopied"));
      });
    } else {
      toast.error(t("invoiceModal.noLink"));
    }
  };

  const handleSendPaymentEmail = async () => {
    if (!paymentUrl) {
      toast.error(t("invoiceModal.errors.noPaymentLink"));
      return;
    }
    try {
      setIsSendingEmailId("initial");
      await sendEmail(application._id, {
        to: application.patient.email,
        subject: `Ссылка на оплату по заявке ${
          application?.applicationId || ""
        }`,
        body: buildRussianMessage(paymentUrl),
      });
      toast.success(t("invoiceModal.success.emailSent"));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          t("invoiceModal.errors.sendEmailFailed")
      );
    } finally {
      setIsSendingEmailId(null);
    }
  };

  const getPatientPhone = () =>
    application?.patient?.phone ||
    application?.patient?.phoneNumber ||
    application?.patientPhone ||
    application?.patient?.phone_no;

  const buildRussianMessage = (link) => {
    const name = application?.patientName || application?.patient?.name || "";
    const appId = application?.applicationId || application?._id || "";
    const service = application?.serviceType || "";
    const intro = name ? `Здравствуйте, ${name}!` : "Здравствуйте!";
    const bodyLines = [
      intro,
      "Вы оформили заявку в нашей клинике.",
      appId ? `Номер заявки: ${appId}` : null,
      service ? `Услуга: ${service}` : null,
      `Ссылка для оплаты: ${link}`,
      "",
      "С уважением, команда Health Direct",
    ].filter(Boolean);
    return bodyLines.join("\n");
  };

  const handleSendWhatsApp = async () => {
    if (!paymentUrl) {
      toast.error(t("invoiceModal.errors.noPaymentLink"));
      return;
    }
    const to = getPatientPhone();
    if (!to) {
      toast.error(t("invoiceModal.errors.noPhone") || "No phone number");
      return;
    }
    const message = buildRussianMessage(paymentUrl);
    try {
      setIsSendingWhatsApp(true);
      await sendWhatsAppMessage(to, message);
      toast.success(
        t("invoiceModal.success.whatsappSent") || "Sent on WhatsApp"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          t("invoiceModal.errors.sendWhatsAppFailed") ||
          "Failed to send WhatsApp"
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleResendWhatsApp = async (payment) => {
    const link = payment?.paymentLink;
    if (!link) {
      toast.error(t("invoiceModal.errors.noPaymentLink"));
      return;
    }
    const to = getPatientPhone();
    if (!to) {
      toast.error(t("invoiceModal.errors.noPhone") || "No phone number");
      return;
    }
    const message = buildRussianMessage(link);
    try {
      setIsResendingWhatsAppId(payment.id || payment._id || link);
      await sendWhatsAppMessage(to, message);
      toast.success(
        t("invoiceModal.success.whatsappSent") || "Sent on WhatsApp"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          t("invoiceModal.errors.sendWhatsAppFailed") ||
          "Failed to send WhatsApp"
      );
    } finally {
      setIsResendingWhatsAppId(null);
    }
  };

  const handleSendPaymentEmailLink = async (link, payment) => {
    if (!link) {
      toast.error(t("invoiceModal.errors.noPaymentLink"));
      return;
    }
    try {
      setIsSendingEmailId(payment?.id || payment?._id || link);
      await sendEmail(application._id, {
        to: application.patient?.email,
        subject: `Ссылка на оплату по заявке ${
          application?.applicationId || ""
        }`,
        body: buildRussianMessage(link),
      });
      toast.success(t("invoiceModal.success.emailSent"));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          t("invoiceModal.errors.sendEmailFailed")
      );
    } finally {
      setIsSendingEmailId(null);
    }
  };

  const createPayment = async () => {
    if (loading || isCreatingPaymentRef.current) return;

    isCreatingPaymentRef.current = true;
    setLoading(true);
    setError(null);

    // Removed invoice number generation - backend will handle it
    const paymentData = {
      paymentMethod: gateway,
      paymentType,
      amount: totalAmount,
      finalAmount: totalAmount,
      items: items.map((item) => ({
        name: item.name,
        amount: Number(item.amount),
        currency: item.currency,
        quantity: parseInt(item.quantity) || 1,
      })),
      status: "pending",
      attendanceMode,
    };

    if (
      !items.length ||
      !paymentData.amount ||
      !paymentData.paymentMethod ||
      !paymentData.status ||
      !paymentData.items.every(
        (it) => it.name && it.amount && it.currency && it.quantity
      )
    ) {
      setError(t("invoiceModal.errors.invalidPaymentData"));
      toast.error(t("invoiceModal.errors.invalidPaymentData"));
      setLoading(false);
      isCreatingPaymentRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    try {
      const newPayment = await addPayment(application._id, paymentData);

      const paymentEntry = {
        ...newPayment,
        time: newPayment.paidAt
          ? new Date(newPayment.paidAt).toLocaleString()
          : t("invoiceModal.na"),
      };

      // Put newest payment on top (and avoid stale state issues)
      setPaymentHistory((prev) => [paymentEntry, ...prev]);
      setSelectedPayment(newPayment);
      setPaymentId(newPayment.id || "");

      if (newPayment.paymentLink) {
        setPaymentUrl(newPayment.paymentLink);
      }

      toast.success(t("invoiceModal.paymentCreated"));
      onPaymentSuccess?.(newPayment);
    } catch (error) {
      setError(
        error.response?.data?.message || t("invoiceModal.errors.createPayment")
      );
      toast.error(
        error.response?.data?.message || t("invoiceModal.errors.createPayment")
      );
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      onClose();
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        navigate("/");
      }
    } finally {
      setLoading(false);
      isCreatingPaymentRef.current = false;
    }
  };

  const generateAktData = (payment) => {
    return {
      full_name: application.patientName,
      date_of_birth: application.patient?.dateOfBirth || t("invoiceModal.na"),
      email: application.patient?.email,
      phone_no: application.patient?.phoneNumber || t("invoiceModal.na"),
      agreement_number: payment.invoiceNumber,
      akt_number: `AKT-${payment.invoiceNumber}`,
      link_created_at: payment.createdAt,
      payment_date: payment.paidAt,
      appointment_created_at: application.createdAt,
      total_amount: `${payment.finalAmount || payment.amount} ${
        payment.currency
      }`,
      items: payment.items,
    };
  };

  const generateInvoiceData = (payment) => {
    return {
      full_name: application.patientName,
      date_of_birth: application.patient?.dateOfBirth || t("invoiceModal.na"),
      email: application.patient?.email,
      phone_no: application.patient?.phoneNumber || t("invoiceModal.na"),
      invoice_number: payment.invoiceNumber,
      invoice_date: payment.paidAt
        ? new Date(payment.paidAt).toLocaleDateString()
        : new Date().toLocaleDateString(),
      link_created_at: payment.createdAt,
      payment_date: payment.paidAt,
      appointment_created_at: application.createdAt,
      total_amount: `${payment.finalAmount || payment.amount} ${
        payment.currency
      }`,
      items: payment.items || [],
      patient_id:
        application.patient?._id ||
        application.patientId ||
        t("invoiceModal.na"),
      application_id:
        application.applicationId || application._id || t("invoiceModal.na"),
      status: payment.status,
      payment_method: payment.paymentMethod || t("invoiceModal.na"),
      
    };
  };

  // Single invoice view function
  const handleViewInvoice = async (payment) => {
    const data = generateInvoiceData(payment);
    const htmlString = ReactDOMServer.renderToStaticMarkup(
      <ContractDocument data={data} />
    );
    setInvoiceData(data);
    setEditContent(htmlString);
    setIsInvoiceOpen(true);
  };

  const handleViewAkt = async (payment) => {
    const data = generateAktData(payment);
    const htmlString = ReactDOMServer.renderToStaticMarkup(
      <AktDocument data={data} />
    );
    setAktData(data);
    setEditContent(htmlString);
    setIsAktOpen(true);
  };

  const handleDownloadDocument = async () => {
    if (!editContent) {
      toast.error(t("invoiceModal.errors.noDocumentContent"));
      return;
    }
    try {
      const tempDiv = document.createElement("div");
      tempDiv.style.display = "none";
      tempDiv.innerHTML = editContent;
      document.body.appendChild(tempDiv);
      const contentElement =
        tempDiv.querySelector(".contract-content") ||
        tempDiv.querySelector(".akt-content");
      if (contentElement) {
        const blob = await generateContractPDFBlob(contentElement);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = isAktOpen
          ? `akt-${aktData.akt_number}.pdf`
          : `invoice-${invoiceData.invoice_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error("Document content not found");
      }
      document.body.removeChild(tempDiv);
    } catch (e) {
      toast.error(t("invoiceModal.errors.pdfGeneration"));
    }
  };

  const handleEditContentChange = (e) => {
    setEditContent(e.target.value);
  };

  const handleCloseDocument = () => {
    setIsInvoiceOpen(false);
    setIsAktOpen(false);
    setEditContent("");
    setInvoiceData(null);
    setAktData(null);
  };

  const handleMarkAsPaid = async (payment) => {
    MySwal.fire({
      title: "Mark payment as Paid?",
      text: "This action cannot be undone. Do you want to continue?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, mark as Paid",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const updatedPayment = await markPaymentAsPaid(
            application._id,
            payment.id
          );

          setPaymentHistory((prev) =>
            prev.map((p) =>
              p.id === payment.id
                ? { ...p, status: "paid", paidAt: new Date() }
                : p
            )
          );

          toast.success("Payment marked as paid successfully");
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Failed to mark payment as paid"
          );
        }
      }
    });
  };

  const handleMarkAsFree = async (payment) => {
    MySwal.fire({
      title: "Mark invoice as Free?",
      text: "This will set the invoice status to Free and cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, mark as Free",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await markPaymentAsFree(application._id, payment.id);

          setPaymentHistory((prev) =>
            prev.map((p) =>
              p.id === payment.id || p._id === payment.id
                ? {
                    ...p,
                    status: "free",
                    paidAt: new Date().toISOString(),
                    time: new Date().toLocaleString(),
                  }
                : p
            )
          );

          toast.success("Marked as Free");
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to mark as Free");
        }
      }
    });
  };

  const ModalPortal = ({ children }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(children, document.body);
  };

  const handleCopyPaymentLink = (link) => {
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        toast.success(t("invoiceModal.linkCopied"));
      });
    } else {
      toast.error(t("invoiceModal.noLink"));
    }
  };

  const formatDateRU = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date)) return "N/A";

    // Format as DD.MM.YYYY HH:MM
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className={`invoice-modal-overlay ${isOpen ? "open" : ""}`}>
        <div className={`modern-invoice-modal ${isOpen ? "open" : ""}`}>
          <div className="modal-header">
            <h2 className="modal-title">{t("invoiceModal.title")}</h2>
            <button className="close-button" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
          <div className="section-card user-info-section">
            <div className="user-name">
              <span>{application?.patientName || t("invoiceModal.na")}</span>
            </div>
            <div className="user-email">
              <span>{application?.patient?.email || t("invoiceModal.na")}</span>
            </div>
          </div>

          <div className="section-card user-info-section">
            <div className="user-div">
              <select
                value={attendanceMode}
                onChange={(e) => setAttendanceMode(e.target.value)}
                className="modern-select"
              >
                <option value="online">{t("invoiceModal.mode_online")}</option>
                <option value="offline">{t("invoiceModal.mode_offline")}</option>
              </select>

              {attendanceMode === "online" && (
                <>
                  <select
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value)}
                    className="modern-select"
                    style={{ marginLeft: "10px" }}
                  >
                    <option value="yookassa">{t("invoiceModal.gateway_yookassa")}</option>
                    <option value="bank">{t("invoiceModal.gateway_bank")}</option>
                  </select>

                  {gateway === "bank" && (
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="modern-select"
                      style={{ marginLeft: "10px" }}
                    >
                      <option value="card">{t("invoiceModal.paymentType_card")}</option>
                      <option value="qr">{t("invoiceModal.paymentType_qr")}</option>
                    </select>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="section-card">
            <h3 className="section-title">{t("invoiceModal.items")}</h3>
            <table className="items-table">
              <thead>
                <tr>
                  <th>{t("invoiceModal.serviceName")}</th>
                  <th>{t("invoiceModal.quantity")}</th>
                  <th>{t("invoiceModal.amount")}</th>
                  <th>{t("invoiceModal.currency")}</th>
                  <th>{t("invoiceModal.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          handleItemChange(item.id, "name", e.target.value)
                        }
                        placeholder={t("invoiceModal.serviceName")}
                        className="modern-input item-name-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(item.id, "quantity", e.target.value)
                        }
                        placeholder={t("invoiceModal.quantity")}
                        className="modern-input quantity-input"
                        min="1"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) =>
                          handleItemChange(item.id, "amount", e.target.value)
                        }
                        placeholder={t("invoiceModal.amount")}
                        className="modern-input amount-input"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <select
                        value={item.currency}
                        onChange={(e) =>
                          handleItemChange(item.id, "currency", e.target.value)
                        }
                        className="modern-select currency-select"
                      >
                        <option value="RUB">RUB</option>
                      </select>
                    </td>
                    <td className="item-actions-cell">
                      <button
                        className="delete-item-button"
                        onClick={() => handleDeleteItem(item.id)}
                        title={t("invoiceModal.deleteItem")}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-item-button" onClick={handleAddItem}>
              <FaPlus /> {t("invoiceModal.addItem")}
            </button>
          </div>

          <div className="section-card total-section">
            <h3 className="section-title">{t("invoiceModal.total")}</h3>
            <div className="amount-details">
              <div className="amount-row">
                <span>{t("invoiceModal.totalAmount")}</span>
                <span>{totalAmount.toFixed(2)} RUB</span>
              </div>
              <div className="total-row amount-row">
                <span>{t("invoiceModal.payableAmount")}</span>
                <span className="total-amount">
                  {totalAmount.toFixed(2)} RUB
                </span>
              </div>
            </div>
          </div>
          <div className="action-buttons-container">
            <button
              className="primary-generate-button"
              onClick={createPayment}
              disabled={
                loading ||
                items.some(
                  (item) =>
                    !item.name ||
                    !item.amount ||
                    !item.currency ||
                    !item.quantity
                )
              }
            >
              {loading
                ? t("invoiceModal.creating")
                : t("invoiceModal.createPayment")}
            </button>
            <button className="secondary-cancel-button" onClick={onClose}>
              {t("invoiceModal.cancel")}
            </button>
          </div>

          {paymentUrl && (
            <div className="section-card payment-link-section">
              <h3 className="section-title">{t("invoiceModal.paymentLink")}</h3>
              <div className="link-container">
                <a
                  href={paymentUrl}
                  className="payment-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {paymentUrl}
                </a>
                <button className="copy-link-button" onClick={handleCopyLink}>
                  <FaCopy />
                </button>
              </div>
              <div className="send-options">
                <button
                  className="send-email-button"
                  onClick={handleSendPaymentEmail}
                  disabled={isSendingWhatsApp}
                  style={{
                    cursor: isSendingWhatsApp ? "not-allowed" : "pointer",
                  }}
                >
                  <FaEnvelope />{" "}
                  {isSendingWhatsApp || isSendingEmailId === "initial"
                    ? t("invoiceModal.sending") || "Sending..."
                    : t("invoiceModal.sendEmail")}
                </button>
                <button
                  className="send-whatsapp-button"
                  onClick={handleSendWhatsApp}
                  disabled={isSendingWhatsApp}
                  style={{
                    cursor: isSendingWhatsApp ? "not-allowed" : "pointer",
                  }}
                >
                  <span>{t("invoiceModal.whatsapp")}</span>{" "}
                  {isSendingWhatsApp
                    ? t("invoiceModal.sending") || "Sending..."
                    : t("invoiceModal.sendWhatsApp")}
                </button>
              </div>
            </div>
          )}

          <div className="section-card">
            <h3 className="section-title">
              {t("invoiceModal.paymentHistory")}
            </h3>
            {paymentHistory.length === 0 ? (
              <div className="empty-state">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <span>{t("invoiceModal.noPayments")}</span>
              </div>
            ) : (
              <div className="payment-history-grid">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="payment-card">
                    <div className="payment-header">
                      <span className="invoice-number">
                        {payment.invoiceNumber || "N/A"}
                      </span>
                      <span
                        className={`status-badge ${payment.status.toLowerCase()}`}
                      >
                        {t(
                          `invoiceModal.status_${payment.status.toLowerCase()}`
                        )}
                      </span>
                    </div>
                    <div className="payment-details">
                      <div className="detail-row">
                        <span>{t("invoiceModal.paymentMethod")}</span>
                        <span>{payment.paymentMethod}</span>
                      </div>
                      <div className="detail-row">
                        <span>{t("invoiceModal.time")}</span>
                        <span>{formatDateRU(payment.createdAt)}</span>
                      </div>
                      <div className="detail-row">
                        <span>{t("invoiceModal.total")}</span>
                        <span>
                          {payment.finalAmount || payment.amount}{" "}
                          {payment.currency}
                        </span>
                      </div>
                    </div>
                    <div className="packages-list">
                      {Array.isArray(payment.items) &&
                      payment.items.length > 0 ? (
                        payment.items.map((item, index) => (
                          <div key={index} className="package-item">
                            <span className="package-name">{item.name}</span>
                            <span className="package-details">
                              {item.quantity || 1} x {item.amount}{" "}
                              {item.currency || "RUB"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="package-item">
                          <span className="package-name">{t("invoiceModal.noItemsFound")}</span>
                        </div>
                      )}
                    </div>

                    <div className="payment-actions">
                      <div className="document-actions">
                        {/* Single Invoice button instead of separate online/offline contract buttons */}
                        <button
                          className={`document-akt-button ${
                            ["pending", "paid"].includes(
                              payment.status.toLowerCase()
                            )
                              ? ""
                              : "payment-disabled"
                          }`}
                          onClick={() => handleViewInvoice(payment)}
                          disabled={
                            !["pending", "paid"].includes(
                              payment.status.toLowerCase()
                            )
                          }
                        >
                          <FaFileCsv /> {t("invoiceModal.invoice")}
                        </button>
                        <button
                          className={`document-akt-button ${
                            payment.status.toLowerCase() === "paid"
                              ? ""
                              : "payment-disabled"
                          }`}
                          onClick={() => handleViewAkt(payment)}
                          disabled={payment.status.toLowerCase() !== "paid"}
                        >
                          <FaFileCsv /> {t("invoiceModal.akt")}
                        </button>
                      </div>
                      {payment.paymentLink && (
                        <div className="resend-actions">
                          <button
                            className="copy-link-button"
                            onClick={() =>
                              handleCopyPaymentLink(payment.paymentLink)
                            }
                          >
                            <FaCopy /> {t("invoiceModal.copyLink")}
                          </button>
                          <button
                            className="send-email-button"
                            onClick={() =>
                              handleSendPaymentEmailLink(
                                payment.paymentLink,
                                payment
                              )
                            }
                            disabled={
                              isSendingEmailId === (payment.id || payment._id)
                            }
                            style={{
                              cursor:
                                isSendingEmailId === (payment.id || payment._id)
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <FaEnvelope />{" "}
                            {isSendingEmailId === (payment.id || payment._id)
                              ? t("invoiceModal.sending") || "Sending..."
                              : t("invoiceModal.sendEmail")}
                          </button>

                          <button
                            className="resend-whatsapp-button"
                            onClick={() => handleResendWhatsApp(payment)}
                            disabled={
                              isResendingWhatsAppId ===
                              (payment.id || payment._id)
                            }
                            style={{
                              cursor:
                                isResendingWhatsAppId ===
                                (payment.id || payment._id)
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {isResendingWhatsAppId ===
                            (payment.id || payment._id)
                              ? t("invoiceModal.sending") || "Sending..."
                              : t("invoiceModal.resendWhatsApp")}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="status-switches">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={payment.status === "paid"}
                          onChange={() => handleMarkAsPaid(payment)}
                          disabled={payment.status === "paid"}
                        />
                        <span className="slider paid"></span>
                        <span className="label-text">{t("invoiceModal.labelPaid")}</span>
                      </label>

                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={payment.status === "free"}
                          onChange={() => handleMarkAsFree(payment)}
                          disabled={payment.status === "free"}
                        />
                        <span className="slider free"></span>
                        <span className="label-text">{t("invoiceModal.labelFree")}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isInvoiceOpen && (
        <ModalPortal>
          <div
            className="document-modal-overlay"
            onClick={handleCloseDocument}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="pdf-preview-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pdf-header">
                <h2>{t("invoiceModal.invoice")}</h2>
                <div className="pdf-header-buttons">
                  <button
                    className="download-contract-button"
                    onClick={handleDownloadDocument}
                    type="button"
                  >
                    {t("invoiceModal.download")}
                  </button>
                  <button
                    className="close-pdf-button"
                    onClick={handleCloseDocument}
                    type="button"
                    aria-label="Close"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              <textarea
                value={editContent}
                onChange={handleEditContentChange}
                className="modern-input"
                style={{ width: "100%", height: "400px", marginBottom: "10px" }}
                placeholder={t("invoiceModal.editDocument")}
              />
              <ContractDocument
                data={invoiceData}
                isOpen={isInvoiceOpen}
                onClose={handleCloseDocument}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {isAktOpen && (
        <ModalPortal>
          <div
            className="document-modal-overlay"
            onClick={handleCloseDocument}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="pdf-preview-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pdf-header">
                <h2>{t("invoiceModal.akt")}</h2>
                <div className="pdf-header-buttons">
                  <button
                    className="download-contract-button"
                    onClick={handleDownloadDocument}
                    type="button"
                  >
                    {t("invoiceModal.download")}
                  </button>
                  <button
                    className="close-pdf-button"
                    onClick={handleCloseDocument}
                    type="button"
                    aria-label="Close"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              <textarea
                value={editContent}
                onChange={handleEditContentChange}
                className="modern-input"
                style={{ width: "100%", height: "400px", marginBottom: "10px" }}
                placeholder={t("invoiceModal.editDocument")}
              />
              <AktDocument
                data={aktData}
                isOpen={isAktOpen}
                onClose={handleCloseDocument}
              />
            </div>
          </div>
        </ModalPortal>
      )}
    </>,
    document.body
  );
};

export default InvoiceModal;