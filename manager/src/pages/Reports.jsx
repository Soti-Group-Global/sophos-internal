import React, { useState, useMemo } from "react";
import { useFetchAnalytics } from "../hooks/useFetchAnalytics";
import AnalyticsCards from "../components/AnalyticsCards";
import RevenueTrendChart from "../components/Charts/RevenueTrendChart";
import ServiceTypePieChart from "../components/Charts/ServiceTypePieChart";
import DoctorPerformanceChart from "../components/Charts/DoctorPerformanceChart";
import ServiceTypeGrowthChart from "../components/Charts/ServiceTypeGrowthChart";
import {
  FiBarChart2,
  FiCalendar,
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiX,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import Select from "react-select";
import "../styles/Reports.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { useTranslation } from "react-i18next";

const Reports = () => {
  const { t } = useTranslation();

  const [type, setType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appointmentStatuses, setAppointmentStatuses] = useState([]);
  const [paymentStatuses, setPaymentStatuses] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const appointmentStatusOptions = [
    { value: "New", label: t("reports.statusOptions.appointment.New") },
    { value: "Paid", label: t("reports.statusOptions.appointment.Paid") },
    { value: "Cancelled", label: t("reports.statusOptions.appointment.Cancelled") },
    { value: "Unconfirmed", label: t("reports.statusOptions.appointment.Unconfirmed") },
    { value: "Confirmed", label: t("reports.statusOptions.appointment.Confirmed") },
    { value: "Pending payment", label: t("reports.statusOptions.appointment.Pending payment") },
    { value: "Completed", label: t("reports.statusOptions.appointment.Completed") },
    { value: "Awaiting for Payment", label: t("reports.statusOptions.appointment.Awaiting for Payment") },
  ];

  const paymentStatusOptions = [
    { value: "new", label: t("reports.statusOptions.payment.new") },
    { value: "invoice-sent", label: t("reports.statusOptions.payment.invoice-sent") },
    { value: "paid", label: t("reports.statusOptions.payment.paid") },
    { value: "cancelled", label: t("reports.statusOptions.payment.cancelled") },
    { value: "free", label: t("reports.statusOptions.payment.free") },
    { value: "pending", label: t("reports.statusOptions.payment.pending") },
  ];

  const reportTypeOptions = [
    { value: "all", label: t("reports.reportTypeOptions.all") },
    { value: "early-detection", label: t("reports.reportTypeOptions.earlyDetection") },
  ];

  const { data, loading, refetch } = useFetchAnalytics(
    type,
    startDate,
    endDate,
    appointmentStatuses.map((s) => s.value),
    paymentStatuses.map((s) => s.value)
  );

  const handleExport = () => {};
  const handleRefresh = () => refetch();

  const handleResetFilters = () => {
    setType("all");
    setStartDate("");
    setEndDate("");
    setAppointmentStatuses([]);
    setPaymentStatuses([]);
  };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (type !== "all") c++;
    if (startDate) c++;
    if (endDate) c++;
    if (appointmentStatuses.length) c++;
    if (paymentStatuses.length) c++;
    return c;
  }, [type, startDate, endDate, appointmentStatuses, paymentStatuses]);

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "38px",
      fontSize: "13px",
      border: state.isFocused ? "1.5px solid #0a2e5d" : "1.5px solid #e2e8f0",
      borderRadius: "8px",
      boxShadow: "none",
      backgroundColor: "#fff",
      "&:hover": { borderColor: "#cbd5e1" },
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      zIndex: 20,
      fontSize: "13px",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? "#0a2e5d" : state.isFocused ? "#f1f5f9" : "#fff",
      color: state.isSelected ? "#fff" : "#334155",
      padding: "8px 12px",
      borderRadius: "4px",
      cursor: "pointer",
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "#eef2ff",
      borderRadius: "6px",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "#0a2e5d",
      fontWeight: 500,
      fontSize: "12px",
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "#0a2e5d",
      "&:hover": { backgroundColor: "#0a2e5d", color: "#fff" },
    }),
    placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: "13px" }),
    indicatorSeparator: () => ({ display: "none" }),
  };

  return (
    <div className="rpt-page">
      {/* ─── Top bar ─── */}
      <div className="rpt-topbar">
        <div className="rpt-topbar-left">
          <div className="rpt-icon-box">
            <FiBarChart2 size={20} />
          </div>
          <div>
            <h1 className="rpt-title">{t("reports.title.all")}</h1>
            <p className="rpt-subtitle">{t("reports.subtitle.all")}</p>
          </div>
        </div>
        <div className="rpt-topbar-actions">
          <button
            className={`rpt-btn rpt-btn-outline ${filtersOpen ? "active" : ""}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <FiFilter size={15} />
            <span>{t("reports.filters.reportType")}</span>
            {activeFilterCount > 0 && (
              <span className="rpt-filter-badge">{activeFilterCount}</span>
            )}
            {filtersOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </button>
          <button
            className="rpt-btn rpt-btn-outline"
            onClick={handleRefresh}
            disabled={loading}
            title={t("reports.actions.refresh")}
          >
            <FiRefreshCw size={15} className={loading ? "rpt-spin" : ""} />
          </button>
          <button className="rpt-btn rpt-btn-primary" onClick={handleExport}>
            <FiDownload size={15} />
            <span>{t("reports.actions.export")}</span>
          </button>
        </div>
      </div>

      {/* ─── Collapsible filters ─── */}
      {filtersOpen && (
        <div className="rpt-filters">
          <div className="rpt-filters-row">
            <div className="rpt-filter-col">
              <label className="rpt-label">{t("reports.filters.reportType")}</label>
              <Select
                options={reportTypeOptions}
                value={reportTypeOptions.find((o) => o.value === type)}
                onChange={(sel) => setType(sel?.value || "all")}
                styles={selectStyles}
                isSearchable={false}
              />
            </div>
            <div className="rpt-filter-col">
              <label className="rpt-label">
                <FiCalendar size={13} style={{ marginRight: 4 }} />
                {t("reports.filters.dateRange")}
              </label>
              <div className="rpt-date-row">
                <input
                  type="date"
                  className="rpt-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="rpt-date-sep">—</span>
                <input
                  type="date"
                  className="rpt-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="rpt-filter-col">
              <label className="rpt-label">{t("reports.filters.appointmentStatus")}</label>
              <Select
                isMulti
                options={appointmentStatusOptions}
                value={appointmentStatuses}
                onChange={setAppointmentStatuses}
                styles={selectStyles}
                placeholder={t("reports.filters.selectStatuses")}
                closeMenuOnSelect={false}
              />
            </div>
            <div className="rpt-filter-col">
              <label className="rpt-label">{t("reports.filters.paymentStatus")}</label>
              <Select
                isMulti
                options={paymentStatusOptions}
                value={paymentStatuses}
                onChange={setPaymentStatuses}
                styles={selectStyles}
                placeholder={t("reports.filters.selectStatuses")}
                closeMenuOnSelect={false}
              />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="rpt-clear-filters" onClick={handleResetFilters}>
              <FiX size={14} />
              {t("reports.actions.resetFilters")}
            </button>
          )}
        </div>
      )}

      {/* ─── Content ─── */}
      {!loading && !data.summary && (
        <div className="rpt-coming-soon">
          <FiBarChart2 size={36} />
          <p>{t("reports.actions.comingSoon", "Analytics dashboard is coming soon. Backend integration pending.")}</p>
        </div>
      )}
      {loading ? (
        <LoadingComponent message={t("reports.actions.loadingDescription")} />
      ) : data.summary ? (
        <div className="rpt-content">
          <section className="rpt-section">
            <AnalyticsCards summary={data.summary} t={t} />
          </section>

          <section className="rpt-charts-grid">
            <div className="rpt-chart-card rpt-chart-wide">
              <RevenueTrendChart data={data.revenue} t={t} />
            </div>
            <div className="rpt-chart-card rpt-chart-wide">
              <ServiceTypeGrowthChart data={data.serviceGrowth} t={t} />
            </div>
            <div className="rpt-chart-card">
              <DoctorPerformanceChart data={data.doctors} t={t} />
            </div>
            <div className="rpt-chart-card">
              <ServiceTypePieChart data={data.summary?.byServiceType || []} t={t} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default Reports;
