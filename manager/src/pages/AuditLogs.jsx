import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getAuditLogs } from "../utils/api";
import "../styles/AuditLogs.css";

const AuditLogs = () => {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    email: "",
    method: "",
    path: "",
    statusCode: "",
    from: "",
    to: "",
  });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, value]) => String(value || "").trim() !== "")
        ),
      };

      const response = await getAuditLogs(params);
      setLogs(response?.data || []);
      setPagination((prev) => ({
        ...prev,
        ...(response?.pagination || {}),
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("auditLogs.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchLogs(1);
  };

  const clearFilters = () => {
    const reset = {
      email: "",
      method: "",
      path: "",
      statusCode: "",
      from: "",
      to: "",
    };
    setFilters(reset);
    setTimeout(() => fetchLogs(1), 0);
  };

  const formatDateTime = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat(i18n.language === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const formattedRows = useMemo(
    () =>
      logs.map((log) => ({
        id: log._id,
        createdAt: formatDateTime(log.performedAt || log.createdAt),
        actor: log?.actor?.name || log?.actor?.email || t("auditLogs.anonymous"),
        role: log?.actor?.role || "-",
        method: log?.action?.method || "-",
        path: log?.action?.path || "-",
        statusCode: log?.result?.statusCode || "-",
        description: log?.action?.description || "-",
      })),
    [logs, i18n.language, t]
  );

  return (
    <div className="audit-logs-page">
      <div className="audit-logs-header">
        <h1>{t("auditLogs.title")}</h1>
        <p>{t("auditLogs.subtitle")}</p>
      </div>

      <div className="audit-logs-filters">
        <input
          value={filters.email}
          onChange={(e) => onFilterChange("email", e.target.value)}
          placeholder={t("auditLogs.filters.email")}
        />
        <select value={filters.method} onChange={(e) => onFilterChange("method", e.target.value)}>
          <option value="">{t("auditLogs.filters.method")}</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          value={filters.path}
          onChange={(e) => onFilterChange("path", e.target.value)}
          placeholder={t("auditLogs.filters.path")}
        />
        <input
          value={filters.statusCode}
          onChange={(e) => onFilterChange("statusCode", e.target.value)}
          placeholder={t("auditLogs.filters.statusCode")}
        />
        <input type="date" value={filters.from} onChange={(e) => onFilterChange("from", e.target.value)} />
        <input type="date" value={filters.to} onChange={(e) => onFilterChange("to", e.target.value)} />

        <button onClick={applyFilters}>{t("auditLogs.actions.apply")}</button>
        <button onClick={clearFilters} className="secondary">{t("auditLogs.actions.clear")}</button>
      </div>

      <div className="audit-logs-table-wrap">
        <table className="audit-logs-table">
          <thead>
            <tr>
              <th>{t("auditLogs.table.dateTime")}</th>
              <th>{t("auditLogs.table.actor")}</th>
              <th>{t("auditLogs.table.role")}</th>
              <th>{t("auditLogs.table.method")}</th>
              <th>{t("auditLogs.table.path")}</th>
              <th>{t("auditLogs.table.status")}</th>
              <th>{t("auditLogs.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="audit-logs-empty">{t("auditLogs.loading")}</td>
              </tr>
            ) : formattedRows.length === 0 ? (
              <tr>
                <td colSpan="7" className="audit-logs-empty">{t("auditLogs.noData")}</td>
              </tr>
            ) : (
              formattedRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAt}</td>
                  <td>{row.actor}</td>
                  <td>{row.role}</td>
                  <td>{row.method}</td>
                  <td>{row.path}</td>
                  <td>{row.statusCode}</td>
                  <td>{row.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="audit-logs-pagination">
        <button
          disabled={pagination.page <= 1 || loading}
          onClick={() => fetchLogs(Math.max(1, pagination.page - 1))}
        >
          {t("auditLogs.pagination.prev")}
        </button>
        <span>
          {t("auditLogs.pagination.page")} {pagination.page} / {Math.max(1, pagination.totalPages || 1)}
        </span>
        <button
          disabled={pagination.page >= (pagination.totalPages || 1) || loading}
          onClick={() => fetchLogs(Math.min(pagination.totalPages || 1, pagination.page + 1))}
        >
          {t("auditLogs.pagination.next")}
        </button>
      </div>
    </div>
  );
};

export default AuditLogs;
