import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, FileText, Clock, DollarSign, CheckCircle2, Search, Eye, Edit2, Copy, ChevronLeft, ChevronRight, Calendar, LayoutList, Download, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { getEarlyDetectionBookings, deleteEarlyDetectionBooking } from "../utils/api";
import EarlyDetectionCalendarView from "../components/EarlyDetection/EarlyDetectionCalendarView";
import EarlyDetectionExportPDFModal from "../components/EarlyDetection/EarlyDetectionExportPDFModal";
import { getApptStatusClass } from "../utils/appointmentStatus";
import html2pdf from "html2pdf.js";
import "../styles/EarlyDetectionBookings.css";

const EarlyDetectionBookings = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("calendar"); // "table" | "calendar"
  const [showDetailedExportModal, setShowDetailedExportModal] = useState(false);
  const [selectedExportBooking, setSelectedExportBooking] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await getEarlyDetectionBookings();
      const list = res?.data || res?.bookings || [];
      setBookings(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(t("earlyDiagnosis.failedToLoadBookings"));
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalBookings = bookings.length;
  const paidBookings = bookings.filter(b => b.payment?.status === "paid").length;
  const pendingBookings = bookings.filter(b => b.payment?.status === "pending").length;
  const totalRevenue = bookings
    .filter(b => b.payment?.status === "paid")
    .reduce((sum, b) => sum + (b.package?.price || 0), 0);

  const handleAddFirstBooking = () => {
    navigate("/early-detection-bookings/create");
  };

  const getPatient = (booking) => booking?.patient || booking?.customer || null;

  // Filter and search bookings
  const filteredBookings = bookings.filter(booking => {
    const patient = getPatient(booking);
    const fullName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      patient?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (patient?.phone || patient?.phoneNumber || '').includes(searchTerm) ||
      booking.bookingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      booking.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBookings = filteredBookings.slice(startIndex, endIndex);

  const getInitials = (customer) => {
    if (!customer) return "?";
    const firstName = customer.firstName || "";
    const lastName = customer.lastName || "";
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    if (lastName) return lastName[0].toUpperCase();
    return "?";
  };

  const getFullName = (customer) => {
    if (!customer) return "N/A";
    const parts = [
      customer.lastName,
      customer.firstName,
      customer.middleName
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "N/A";
  };

  const toStableDate = (value) => {
    if (!value) return null;

    if (typeof value === "string") {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    const stableDate = toStableDate(date);
    if (!stableDate) return "-";

    return stableDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatDateForCsv = (date) => {
    if (!date) return "";
    const stableDate = toStableDate(date);
    if (!stableDate) return "";
    return stableDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US');
  };

  const getPaymentStatusClass = (status) => getApptStatusClass(status);

  const getBookingStatusClass = (status) => getApptStatusClass(status);

  const pdfRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  // ── CSV Export ────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!filteredBookings.length) { toast.error(t('earlyDiagnosis.noBookingsYet')); return; }
    const isRu = i18n.language?.startsWith('ru');
    const headers = [
      isRu ? 'Номер записи' : 'Booking #',
      isRu ? 'Фамилия' : 'Last Name',
      isRu ? 'Имя' : 'First Name',
      isRu ? 'Отчество' : 'Middle Name',
      isRu ? 'Email' : 'Email',
      isRu ? 'Телефон' : 'Phone',
      isRu ? 'Пакет' : 'Package',
      isRu ? 'Сумма' : 'Amount',
      isRu ? 'Статус оплаты' : 'Payment Status',
      isRu ? 'Статус записи' : 'Booking Status',
      isRu ? 'Дата приёма' : 'Appointment Date',
      isRu ? 'Время' : 'Time',
      isRu ? 'Дополнительные опции' : 'Add-ons',
      isRu ? 'Создано' : 'Created',
    ];

    const esc = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = filteredBookings.map((b) => [
      b.invoiceNumber || b.bookingNumber || '',
      getPatient(b)?.lastName || '',
      getPatient(b)?.firstName || '',
      getPatient(b)?.middleName || '',
      getPatient(b)?.email || '',
      getPatient(b)?.phone || getPatient(b)?.phoneNumber || '',
      b.package?.name || '',
      b.totalAmount || b.package?.price || 0,
      b.payment?.status || 'pending',
      b.status || '',
      formatDateForCsv(b.appointmentDate),
      b.appointmentTime || '',
      (b.addOns || []).map((a) => a.name).join('; '),
      formatDateForCsv(b.createdAt),
    ].map(esc).join(','));

    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `early_detection_bookings_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isRu ? 'CSV экспортирован' : 'CSV exported');
  };

  // ── PDF Export ────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!filteredBookings.length) { toast.error(t('earlyDiagnosis.noBookingsYet')); return; }
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      await html2pdf()
        .from(pdfRef.current)
        .set({
          margin: 10,
          filename: `early_detection_bookings_${Date.now()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: 900 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .save();
      toast.success(i18n.language?.startsWith('ru') ? 'PDF экспортирован' : 'PDF exported');
    } finally {
      setExporting(false);
    }
  };

  // Build hidden PDF table
  const isRu = i18n.language?.startsWith('ru');
  // Vertical card-style PDF
  const tdL = { padding: '4px 10px', fontWeight: 'bold', color: '#475569', background: '#f1f5f9', borderBottom: '1px solid #eef2f7', fontSize: '9px', lineHeight: '1.4', verticalAlign: 'top', whiteSpace: 'nowrap' };
  const tdV = { padding: '4px 10px', color: '#0f172a', borderBottom: '1px solid #eef2f7', fontSize: '9px', lineHeight: '1.4', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word' };
  const colGroup = (
    <colgroup>
      <col style={{ width: '20%' }} />
      <col style={{ width: '30%' }} />
      <col style={{ width: '20%' }} />
      <col style={{ width: '30%' }} />
    </colgroup>
  );
  const empty = '—';

  const pdfFields = (b) => [
    [isRu ? 'Номер записи' : 'Booking #', b.invoiceNumber || b.bookingNumber || empty],
    [isRu ? 'Пациент' : 'Customer', getFullName(getPatient(b))],
    [isRu ? 'Email' : 'Email', getPatient(b)?.email || empty],
    [isRu ? 'Телефон' : 'Phone', getPatient(b)?.phone || getPatient(b)?.phoneNumber || empty],
    [isRu ? 'Дата рождения' : 'Date of Birth', getPatient(b)?.dateOfBirth ? formatDate(getPatient(b).dateOfBirth) : empty],
    [isRu ? 'Пакет' : 'Package', b.package?.name || empty],
    [isRu ? 'Дополнительные опции' : 'Add-ons', (b.addOns || []).map((a) => `${a.name} (${(a.price || 0).toLocaleString()} ₽)`).join(', ') || empty],
    [isRu ? 'Сумма' : 'Amount', `${(b.totalAmount || b.package?.price || 0).toLocaleString()} ₽`],
    [isRu ? 'Статус оплаты' : 'Payment Status', b.payment?.status || 'pending'],
    [isRu ? 'Дата оплаты' : 'Paid At', b.payment?.paidAt ? formatDate(b.payment.paidAt) : empty],
    [isRu ? 'Статус записи' : 'Booking Status', b.status || empty],
    [isRu ? 'Дата приёма' : 'Appointment Date', b.appointmentDate ? formatDate(b.appointmentDate) : empty],
    [isRu ? 'Время приёма' : 'Appointment Time', b.appointmentTime || empty],
    [isRu ? 'Создано' : 'Created', formatDate(b.createdAt)],
  ];

  const pdfHidden = filteredBookings.length > 0 ? (
    <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
      <div ref={pdfRef} style={{ width: '718px', padding: '20px 0', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10px', color: '#1e293b', background: '#fff' }}>
        <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#0a2e5d', marginBottom: '3px' }}>
          {isRu ? 'Записи на раннюю диагностику' : 'Early Diagnosis Bookings'}
        </div>
        <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '18px' }}>
          {isRu ? 'Экспортировано' : 'Exported'}: {new Date().toLocaleString(isRu ? 'ru-RU' : 'en-GB')}&nbsp;&nbsp;|&nbsp;&nbsp;{filteredBookings.length} {isRu ? 'записей' : 'records'}
          &nbsp;&nbsp;|&nbsp;&nbsp;{isRu ? 'Оплачено' : 'Paid'}: {paidBookings}&nbsp;&nbsp;|&nbsp;&nbsp;{isRu ? 'В ожидании' : 'Pending'}: {pendingBookings}
          &nbsp;&nbsp;|&nbsp;&nbsp;{isRu ? 'Выручка' : 'Revenue'}: {totalRevenue.toLocaleString()} ₽
        </div>

        {filteredBookings.map((b, idx) => {
          const rows = pdfFields(b);
          const pairs = [];
          for (let i = 0; i < rows.length; i += 2) {
            pairs.push([rows[i], rows[i + 1] || null]);
          }
          return (
            <div key={b._id || idx} style={{ marginBottom: '18px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', pageBreakInside: 'avoid' }}>
              {/* Header */}
              <div style={{ background: '#0a2e5d', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', flex: 1 }}>
                  {idx + 1}.&nbsp;&nbsp;{getFullName(getPatient(b))}
                </span>
                <span style={{ background: 'rgba(255,255,255,0.18)', padding: '2px 10px', borderRadius: '10px', fontSize: '9px', whiteSpace: 'nowrap' }}>
                  {b.payment?.status || 'pending'}
                </span>
                <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>
                  {b.invoiceNumber || b.bookingNumber || ''}
                </span>
              </div>

              {/* Section: Customer */}
              <div style={{ background: '#0a2e5d', padding: '4px 10px', fontSize: '8px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {isRu ? 'Информация о пациенте' : 'Customer Information'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                {colGroup}
                <tbody>
                  {pairs.slice(0, 3).map(([f1, f2], ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={tdL}>{f1[0]}</td>
                      <td style={tdV}>{f1[1]}</td>
                      <td style={tdL}>{f2 ? f2[0] : ''}</td>
                      <td style={tdV}>{f2 ? f2[1] : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Section: Package & Payment */}
              <div style={{ background: '#0a2e5d', padding: '4px 10px', fontSize: '8px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {isRu ? 'Пакет и оплата' : 'Package & Payment'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                {colGroup}
                <tbody>
                  {pairs.slice(3, 5).map(([f1, f2], ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={tdL}>{f1[0]}</td>
                      <td style={tdV}>{f1[1]}</td>
                      <td style={tdL}>{f2 ? f2[0] : ''}</td>
                      <td style={tdV}>{f2 ? f2[1] : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Section: Appointment */}
              <div style={{ background: '#0a2e5d', padding: '4px 10px', fontSize: '8px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {isRu ? 'Запись и статус' : 'Appointment & Status'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                {colGroup}
                <tbody>
                  {pairs.slice(5).map(([f1, f2], ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={tdL}>{f1[0]}</td>
                      <td style={tdV}>{f1[1]}</td>
                      <td style={tdL}>{f2 ? f2[0] : ''}</td>
                      <td style={tdV}>{f2 ? f2[1] : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="ed-bookings-modern-page">
      {/* Header */}
      <div className="ed-modern-header">
        <div className="ed-header-left">
          <h1 className="ed-modern-title">{t('earlyDiagnosis.earlyDiagnosisBookingsManagement')}</h1>
          <p className="ed-modern-description">{t('earlyDiagnosis.earlyDiagnosisBookingsDescription')}</p>
        </div>
        <div className="ed-header-actions">
          <div className="ed-view-toggle">
            <button
              className={`ed-view-btn${viewMode === "table" ? " active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <LayoutList size={16} />
            </button>
            <button
              className={`ed-view-btn${viewMode === "calendar" ? " active" : ""}`}
              onClick={() => setViewMode("calendar")}
              title="Calendar View"
            >
              <Calendar size={16} />
            </button>
          </div>
          <button
            className="ed-export-btn"
            onClick={handleExportCSV}
            title={isRu ? 'Экспорт CSV' : 'Export CSV'}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            className="ed-export-btn"
            onClick={() => setShowDetailedExportModal(true)}
            title={isRu ? 'Детальный экспорт PDF' : 'Detailed PDF export'}
          >
            <FileText size={16} />
            PDF
          </button>
          <button className="ed-add-booking-btn" onClick={handleAddFirstBooking}>
            <Plus size={20} />
            {t('earlyDiagnosis.addNewBooking')}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {viewMode !== "calendar" && (
      <div className="ed-stats-grid">
        <div className="ed-stat-card">
          <div className="ed-stat-icon blue">
            <FileText size={24} />
          </div>
          <div className="ed-stat-content">
            <div className="ed-stat-value">{totalBookings}</div>
            <div className="ed-stat-label">{t('earlyDiagnosis.totalBookings').toUpperCase()}</div>
          </div>
        </div>

        <div className="ed-stat-card">
          <div className="ed-stat-icon green">
            <CheckCircle2 size={24} />
          </div>
          <div className="ed-stat-content">
            <div className="ed-stat-value">{paidBookings}</div>
            <div className="ed-stat-label">{t('earlyDiagnosis.paidBookings').toUpperCase()}</div>
          </div>
        </div>

        <div className="ed-stat-card">
          <div className="ed-stat-icon orange">
            <Clock size={24} />
          </div>
          <div className="ed-stat-content">
            <div className="ed-stat-value">{pendingBookings}</div>
            <div className="ed-stat-label">{t('earlyDiagnosis.pending').toUpperCase()}</div>
          </div>
        </div>

        <div className="ed-stat-card">
          <div className="ed-stat-icon purple">
            <DollarSign size={24} />
          </div>
          <div className="ed-stat-content">
            <div className="ed-stat-value">{totalRevenue.toLocaleString()} ₽</div>
            <div className="ed-stat-label">{t('earlyDiagnosis.revenue').toUpperCase()}</div>
          </div>
        </div>
      </div>
      )}

      {/* Empty State or Bookings List */}
      {loading ? (
        <div className="ed-modern-loading">
          <div className="ed-spinner"></div>
          <p>{t('earlyDiagnosis.loadingBookings')}</p>
        </div>
      ) : viewMode === "calendar" ? (
        <div style={{ height: "calc(100vh - 180px)", minHeight: 0 }}>
          <EarlyDetectionCalendarView bookings={bookings} />
        </div>
      ) : totalBookings === 0 ? (
        <div className="ed-empty-state">
          <div className="ed-empty-icon">
            <FileText size={48} />
            <div className="ed-empty-plus">
              <Plus size={20} />
            </div>
          </div>
          <h2 className="ed-empty-title">{t('earlyDiagnosis.noBookingsYet')}</h2>
          <p className="ed-empty-description">
            {t('earlyDiagnosis.noBookingsDescription')}
          </p>
          <button className="ed-add-first-btn" onClick={handleAddFirstBooking}>
            <Plus size={20} />
            {t('earlyDiagnosis.addFirstBooking')}
          </button>
        </div>
      ) : (
        <div className="ed-bookings-table-container">
          {/* Search and Filter Bar */}
          <div className="ed-table-header">
            <div className="ed-search-box">
              <Search size={20} className="ed-search-icon" />
              <input
                type="text"
                placeholder={t('earlyDiagnosis.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ed-search-input"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ed-status-filter"
            >
              <option value="all">{t('earlyDiagnosis.allStatus')}</option>
              <option value="confirmed">{t('earlyDiagnosis.confirmed')}</option>
              <option value="pending">{t('earlyDiagnosis.pendingStatus')}</option>
              <option value="cancelled">{t('earlyDiagnosis.cancelled')}</option>
            </select>
          </div>

          {/* Bookings Table */}
          <div className="ed-table-wrapper">
            <table className="ed-bookings-table">
              <thead>
                <tr>
                  <th>{t('earlyDiagnosis.customer').toUpperCase()}</th>
                  <th>{t('earlyDiagnosis.package').toUpperCase()}</th>
                  <th>{t('earlyDiagnosis.paymentStatus').toUpperCase()}</th>
                  <th>{t('earlyDiagnosis.bookingStatus').toUpperCase()}</th>
                  <th>{t('earlyDiagnosis.amount').toUpperCase()}</th>
                  <th>{t('earlyDiagnosis.actions') ? t('earlyDiagnosis.actions').toUpperCase() : 'ACTIONS'}</th>
                </tr>
              </thead>
              <tbody>
                {currentBookings.map((booking) => (
                  <tr
                    key={booking._id || booking.bookingNumber}
                    onClick={() => window.open(`/early-detection-bookings/${booking._id}?lang=${i18n.language}`, "_blank", "noopener,noreferrer")}
                    className="ed-clickable-row"
                  >
                    <td>
                      <div className="ed-customer-cell">
                        <div className="ed-customer-avatar">
                          {getInitials(getPatient(booking))}
                        </div>
                        <div className="ed-customer-info">
                          <div className="ed-customer-name">{getFullName(getPatient(booking))}</div>
                          <div className="ed-booking-number">
                            # {booking.invoiceNumber || booking.bookingNumber || "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="ed-package-name">
                        {booking.package?.name || booking.packageName || "N/A"}
                      </div>
                    </td>
                    <td>
                      <div className="ed-status-cell">
                        <span className={`appt-status-badge ${getPaymentStatusClass(booking.payment?.status)}`}>
                          {(() => {
                            const status = String(booking.payment?.status || "").toLowerCase();
                            const statusLabel = ({
                              failed: t('earlyDiagnosis.failedPayment', 'Failed payment'),
                              paid: t('earlyDiagnosis.paid', 'Paid'),
                              pending: t('earlyDiagnosis.pendingPayment', 'Pending'),
                              processing: t('earlyDiagnosis.status_processing', 'Processing'),
                              cancelled: t('earlyDiagnosis.status_cancelled', 'Cancelled'),
                              partially_paid: t('earlyDiagnosis.status_partially_paid', 'Partially paid'),
                              refunded: t('earlyDiagnosis.status_refunded', 'Refunded'),
                            }[status]);

                            if (!status) return "● N/A";
                            return `● ${(statusLabel || status).toUpperCase()}`;
                          })()}
                        </span>
                        {booking.payment?.status === "paid" && booking.payment?.paidAt && (
                          <div className="ed-payment-date">
                            ● {t('earlyDiagnosis.paid').toUpperCase()}: {formatDate(booking.payment.paidAt)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`appt-status-badge ${getBookingStatusClass(booking.status)}`}>
                        ● {({
                          confirmed: t('earlyDiagnosis.confirmed'),
                          pending: t('earlyDiagnosis.pendingStatus'),
                          cancelled: t('earlyDiagnosis.cancelled'),
                          completed: t('earlyDiagnosis.completed'),
                        }[booking.status?.toLowerCase()] || booking.status || 'N/A').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="ed-amount">
                        {booking.package?.price || booking.amount || 0} ₽
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="ed-actions">
                        <button
                          className="ed-export-btn"
                          style={{ padding: '4px 10px', fontSize: '12px', gap: '4px' }}
                          title={isRu ? 'Экспорт PDF' : 'Export PDF'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExportBooking(booking);
                            setShowDetailedExportModal(true);
                          }}
                        >
                          <FileText size={13} />
                          PDF
                        </button>
                        <button
                          className="ed-delete-btn"
                          title={isRu ? 'Удалить' : 'Delete'}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(isRu ? 'Вы уверены, что хотите удалить эту запись?' : 'Are you sure you want to delete this booking?')) return;
                            try {
                              await deleteEarlyDetectionBooking(booking._id);
                              toast.success(isRu ? 'Запись удалена' : 'Booking deleted');
                              setBookings(prev => prev.filter(b => b._id !== booking._id));
                            } catch {
                              toast.error(isRu ? 'Ошибка при удалении' : 'Failed to delete booking');
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="ed-table-footer">
            <div className="ed-showing-text">
              {t('earlyDiagnosis.showingEntries', {
                start: startIndex + 1,
                end: Math.min(endIndex, filteredBookings.length),
                total: filteredBookings.length
              })}
            </div>
            <div className="ed-pagination">
              <button
                className="ed-pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="ed-pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      {pdfHidden}
      {showDetailedExportModal && (
        <EarlyDetectionExportPDFModal
          bookings={selectedExportBooking ? [selectedExportBooking] : filteredBookings}
          onClose={() => { setShowDetailedExportModal(false); setSelectedExportBooking(null); }}
        />
      )}
    </div>
  );
};

export default EarlyDetectionBookings;
