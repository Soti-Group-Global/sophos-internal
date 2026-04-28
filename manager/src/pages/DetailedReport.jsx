import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText, Calendar, Users, Stethoscope,
  DollarSign, Activity, ChevronDown,
  Search, X, BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  getApplications,
  getAnalyticsSummary,
  getRevenueTrend,
  getDoctorPerformance,
  getSpecialtiesData,
  getServiceGrowth,
  getPatients,
  getAllDoctors,
} from "../utils/api";
import "../styles/DetailedReport.css";
import CustomCalendar from "../components/CustomCalendar/CustomCalendar";

/* ── Palette ──────────────────────────────────────────────────────────────── */
const COLORS = ["#0A2E5D","#22c55e","#f59e0b","#ef4444","#8b5cf6","#3b82f6","#10b981","#f97316"];

const STATUS_COLORS = {
  Confirmed:         "#22c55e",
  Completed:         "#3b82f6",
  Cancelled:         "#ef4444",
  "Pending payment": "#f59e0b",
  Upcoming:          "#f59e0b",
  Paid:              "#10b981",
};

const fmt     = (v) => v != null ? `₽${Number(v).toLocaleString("ru-RU")}` : "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";

/* Field helpers — normalize inconsistent API shape */
const getSvcName  = (a) => a.doctors?.[0]?.serviceName || a.serviceType || "Unknown";
const getDocEmail = (a) => a.doctors?.[0]?.doctorEmail || a.doctorEmail || a.doctor?.email || "—";
const pick = (field, lang) => {
  if (!field) return "";
  if (typeof field === "string") return field;
  return (lang === "ru" ? field.ru || field.en : field.en || field.ru) || "";
};
const getDocName  = (a, lang = "en") => {
  /* Prefer the enriched DoctorsProfile object — it has { en, ru } fields */
  const d = a.doctor;
  if (d) {
    const ln = pick(d.lastName,   lang);
    const fn = pick(d.firstName,  lang);
    const mn = pick(d.middleName, lang);
    const name = [ln, fn, mn].filter(Boolean).join(" ");
    if (name) return name;
  }
  /* Fall back to the plain doctorName stored on the appointment */
  if (a.doctors?.[0]?.doctorName) return a.doctors[0].doctorName;
  return getDocEmail(a);
};
const getPatName  = (a) => {
  if (a.patientName) return a.patientName;
  const { firstName="", lastName="", middleName="" } = a.patient || {};
  return [lastName, firstName, middleName].filter(Boolean).join(" ") || "—";
};
const getAmount   = (a) => {
  const p = a.payments?.[0];
  return p ? (p.finalAmount ?? p.amount ?? 0) : 0;
};

/* ── Report categories ────────────────────────────────────────────────────── */
const REPORT_CATEGORIES = [
  { key:"appointments", icon:Calendar, label:"Appointments", reports:[
    { key:"patient_movement",    label:"Patient Movement" },
    { key:"appointment_summary", label:"Summary of Appointments" },
    { key:"service_summary",     label:"Summary Report on Services" },
    // { key:"services_rendered",   label:"Report on Services Rendered" },
    { key:"cancelled",           label:"Report on Cancelled" },
    { key:"by_doctor",           label:"Report by Doctor" },
    { key:"by_specialty",        label:"Report by Specialty" },
  ]},
  { key:"financial", icon:DollarSign, label:"Financial", reports:[
    { key:"revenue_summary", label:"Revenue Summary" },
    { key:"revenue_trend",   label:"Revenue Trend" },
    { key:"payment_status",  label:"Payment Status" },
  ]},
  { key:"patients", icon:Users, label:"Patients", reports:[
    { key:"patient_list", label:"Patient List" },
    { key:"new_patients", label:"New Patients" },
  ]},
  { key:"doctors", icon:Stethoscope, label:"Doctors", reports:[
    { key:"doctor_performance", label:"Doctor Performance" },
    { key:"doctor_workload",    label:"Doctor Workload" },
  ]},
  { key:"services", icon:Activity, label:"Services", reports:[
    { key:"service_growth",  label:"Service Growth Trends" },
    { key:"specialty_stats", label:"Specialty Statistics" },
  ]},
];

/* ── Date presets ─────────────────────────────────────────────────────────── */
const PRESETS = ["today","week","month","quarter","year"];
function getPreset(preset) {
  const now = new Date(), start = new Date();
  const p = preset.toLowerCase();
  if (p === "today")        { start.setHours(0,0,0,0); }
  else if (p === "week")    { start.setDate(now.getDate()-7); }
  else if (p === "month")   { start.setMonth(now.getMonth()-1); }
  else if (p === "quarter") { start.setMonth(now.getMonth()-3); }
  else if (p === "year")    { start.setFullYear(now.getFullYear()-1); }
  return { from: start.toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
}

/* ── Tooltip style ────────────────────────────────────────────────────────── */
const TT = { borderRadius:10, border:"1px solid #e2e8f0", boxShadow:"0 4px 20px rgba(0,0,0,0.1)", fontSize:12 };

/* ── Shared UI ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status] || "#6b7280";
  const label = t(`detailedReport.statuses.${status}`, status);
  return <span className="rpt-badge" style={{ background:color+"18", color, border:`1px solid ${color}40` }}>{label}</span>;
}

/**
 * ChartCard — uses the Recharts-safe height pattern:
 *   rpt-chart-outer  → visual padding only, no height
 *   rpt-chart-inner  → explicit px height (inline), no padding
 *   ResponsiveContainer height="100%" measures rpt-chart-inner's px height
 */
function ChartCard({ title, children, height = 300 }) {
  return (
    <div className="rpt-chart-card">
      {title && (
        <div className="rpt-chart-header">
          <span className="rpt-chart-title">{title}</span>
        </div>
      )}
      <div className="rpt-chart-outer">
        <div className="rpt-chart-inner" style={{ height }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DataTable({ cols, rows, loading, label }) {
  const { t } = useTranslation();
  if (loading) return <div className="rpt-loading"><div className="rpt-spinner"/></div>;
  if (!rows?.length) return (
    <div className="rpt-table-wrap">
      <div className="rpt-empty">
        <div className="rpt-empty-icon"><FileText size={22}/></div>
        {t("detailedReport.table.noData")}
      </div>
    </div>
  );
  return (
    <div className="rpt-table-wrap">
      <div className="rpt-table-header-bar">
        <span className="rpt-table-label">{label || t("detailedReport.table.results")}</span>
        <span className="rpt-table-count">{rows.length} {t("detailedReport.table.rows")}</span>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table className="rpt-table">
          <thead><tr>{cols.map((c)=><th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i}>{cols.map((c)=>(
                <td key={c.key}>{c.render ? c.render(row) : (row[c.key]??"—")}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function DetailedReport() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  /* Translate a service name coming from the DB */
  const tSvc = (a) => {
    const raw = getSvcName(a);
    const key = raw.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    return t(`detailedReport.serviceNames.${key}`, raw);
  };

  const [openCats,     setOpenCats]     = useState({ appointments:true });
  const [activeReport, setActive]       = useState("patient_movement");
  const [dateRange,    setDateRange]    = useState(getPreset("Month"));
  const [activePreset, setActivePreset] = useState("Month");
  const [search,       setSearch]       = useState("");
  const [loading,      setLoading]      = useState(false);

  const [applications,  setApplications]  = useState([]);
  const [patients,      setPatients]      = useState([]);
  const [revenueTrend,  setRevenueTrend]  = useState([]);
  const [doctorPerf,    setDoctorPerf]    = useState([]);
  const [specStats,     setSpecStats]     = useState([]);
  const [serviceGrowth, setServiceGrowth] = useState([]);
  const [summary,       setSummary]       = useState(null);

  /* fetch ----------------------------------------------------------------- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { startDate:dateRange.from, endDate:dateRange.to };
      const apptKeys = ["patient_movement","appointment_summary","service_summary",
                        "services_rendered","cancelled","by_doctor","by_specialty",
                        "payment_status","doctor_workload"];
      if (apptKeys.includes(activeReport)) {
        const res = await getApplications({ ...params, limit:500 });
        setApplications(res.data?.applications || res.data || []);
      }
      if (["revenue_summary","revenue_trend"].includes(activeReport)) {
        const [s,t] = await Promise.all([
          getAnalyticsSummary("applications",params),
          getRevenueTrend("applications",params),
        ]);
        setSummary(s.data);
        setRevenueTrend(t.data?.data || []);
      }
      if (["patient_list","new_patients"].includes(activeReport)) {
        const res = await getPatients();
        setPatients(res.data?.patients || res.data || []);
      }
      if (activeReport === "doctor_performance") {
        const [p] = await Promise.all([getDoctorPerformance("applications",params), getAllDoctors()]);
        setDoctorPerf(p.data?.doctors || []);
      }
      if (activeReport === "service_growth") {
        const res = await getServiceGrowth("applications",params);
        setServiceGrowth(res.data?.data || []);
      }
      if (activeReport === "specialty_stats") {
        const res = await getSpecialtiesData("applications",params);
        setSpecStats(res.data?.specialties || []);
      }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [activeReport, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filterApps = (rows) => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r)=>
      getPatName(r).toLowerCase().includes(q)||
      getDocEmail(r).toLowerCase().includes(q)||
      getSvcName(r).toLowerCase().includes(q)||
      (r.applicationId||"").toLowerCase().includes(q)
    );
  };

  const pickPreset = (p) => { setActivePreset(p); setDateRange(getPreset(p)); };
  const toggleCat    = (key) => setOpenCats((p)=>({ ...p,[key]:!p[key] }));
  const selectReport = (key) => { setActive(key); setSearch(""); };

  /* ── renderContent ------------------------------------------------------- */
  const renderContent = () => {

    /* Patient Movement */
    if (activeReport === "patient_movement") {
      const rows = filterApps(applications);
      const byDate = {};
      rows.forEach((a)=>{ byDate[a.date]=(byDate[a.date]||0)+1; });
      const chart = Object.entries(byDate).sort().map(([d,c])=>({ date:d, count:c }));
      const total = rows.length, peak = chart.reduce((m,d)=>d.count>m?d.count:m,0);
      return (<>
        {chart.length > 0 && (
          <ChartCard title={t("detailedReport.charts.dailyPatientVolume")} height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/>
                <Bar dataKey="count" name={t("detailedReport.series.patients")} fill="#22c55e" radius={[6,6,0,0]}>
                  {chart.map((_,i)=>{
                    const palette=["#22c55e","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#10b981","#f97316","#0A2E5D"];
                    return <Cell key={i} fill={palette[i%palette.length]}/>;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.appointmentRecords")} loading={loading} rows={rows} cols={[
          { key:"date",              label:t("detailedReport.table.date"),    render:(r)=>fmtDate(r.date) },
          { key:"applicationId",     label:t("detailedReport.table.id") },
          { key:"patientName",       label:t("detailedReport.table.patient"), render:(r)=>getPatName(r) },
          { key:"doctorEmail",       label:t("detailedReport.table.doctor"),  render:(r)=>getDocName(r,lang) },
          { key:"serviceName",       label:t("detailedReport.table.service"), render:(r)=>tSvc(r) },
          { key:"appointmentStatus", label:t("detailedReport.table.status"),  render:(r)=><StatusBadge status={r.appointmentStatus}/> },
          { key:"amount",            label:t("detailedReport.table.amount"),  render:(r)=>fmt(getAmount(r)) },
        ]}/>
      </>);
    }

    /* Appointment Summary */
    if (activeReport === "appointment_summary") {
      const grouped = {};
      applications.forEach((a)=>{ const s=a.appointmentStatus||"Unknown"; grouped[s]=(grouped[s]||0)+1; });
      const rows = Object.entries(grouped).map(([status,count])=>({
        status: t(`detailedReport.statuses.${status}`, status),
        _orig: status, count,
      }));
      const total = rows.reduce((s,r)=>s+r.count,0);
      return (<>
        {rows.length > 0 && (
          <div className="rpt-charts-row">
            <ChartCard title={t("detailedReport.charts.appointmentsByStatus")} height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rows} dataKey="count" nameKey="status" cx="50%" cy="43%"
                    innerRadius={60} outerRadius={95} paddingAngle={3}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {rows.map((r,i)=><Cell key={i} fill={STATUS_COLORS[r._orig]||COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t("detailedReport.charts.countByStatus")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="status" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey="count" name={t("detailedReport.table.count")} radius={[6,6,0,0]}>
                    {rows.map((r,i)=><Cell key={i} fill={STATUS_COLORS[r.status]||COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
        <DataTable label={t("detailedReport.table.statusBreakdown")} loading={loading} rows={rows} cols={[
          { key:"status", label:t("detailedReport.table.status"), render:(r)=><StatusBadge status={r._orig||r.status}/> },
          { key:"count",  label:t("detailedReport.table.count") },
          { key:"pct",    label:t("detailedReport.table.share"),  render:(r)=>`${((r.count/total)*100).toFixed(1)}%` },
        ]}/>
      </>);
    }

    /* Service Summary */
    if (activeReport === "service_summary") {
      const grouped = {};
      applications.forEach((a)=>{
        const s=tSvc(a);
        if(!grouped[s]) grouped[s]={ service:s,count:0,revenue:0 };
        grouped[s].count++; grouped[s].revenue+=getAmount(a);
      });
      const rows = Object.values(grouped).sort((a,b)=>b.count-a.count);
      return (<>
        {rows.length > 0 && (
          <ChartCard title={t("detailedReport.charts.appointmentsRevenueByService")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="service" tick={{fontSize:10}} interval={0} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="left"  tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                <Bar yAxisId="left"  dataKey="count"   name={t("detailedReport.series.appointments")} fill={COLORS[0]} radius={[5,5,0,0]}/>
                <Bar yAxisId="right" dataKey="revenue" name={t("detailedReport.series.revenue")}       fill={COLORS[1]} radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.serviceBreakdown")} loading={loading} rows={rows} cols={[
          { key:"service", label:t("detailedReport.table.service") },
          { key:"count",   label:t("detailedReport.table.appointments") },
          { key:"revenue", label:t("detailedReport.table.revenue"), render:(r)=>fmt(r.revenue) },
        ]}/>
      </>);
    }

    /* Services Rendered */
    if (activeReport === "services_rendered") {
      const rows = filterApps(applications.filter((a)=>["Completed","Paid"].includes(a.appointmentStatus)));
      return (<>
        <DataTable label={t("detailedReport.table.appointmentRecords")} loading={loading} rows={rows} cols={[
          { key:"date",        label:t("detailedReport.table.date"),    render:(r)=>fmtDate(r.date) },
          { key:"patientName", label:t("detailedReport.table.patient"), render:(r)=>getPatName(r) },
          { key:"doctorEmail", label:t("detailedReport.table.doctor"),  render:(r)=>getDocName(r,lang) },
          { key:"serviceName", label:t("detailedReport.table.service"), render:(r)=>tSvc(r) },
          { key:"amount",      label:t("detailedReport.table.amount"),  render:(r)=>fmt(getAmount(r)) },
        ]}/>
      </>);
    }

    /* Cancelled */
    if (activeReport === "cancelled") {
      const rows = filterApps(applications.filter((a)=>["Cancelled","canceled"].includes(a.appointmentStatus)));
      const byDate = {};
      rows.forEach((a)=>{ byDate[a.date]=(byDate[a.date]||0)+1; });
      const chart = Object.entries(byDate).sort().map(([d,c])=>({ date:d,count:c }));
      const rate = applications.length ? ((rows.length/applications.length)*100).toFixed(1) : 0;
      return (<>
        {chart.length > 0 && (
          <ChartCard title={t("detailedReport.charts.cancellationsOverTime")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/>
                <Line type="monotone" dataKey="count" name={t("detailedReport.series.cancelled")} stroke="#ef4444" strokeWidth={2.5} dot={{r:4,fill:"#ef4444"}}/>
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.cancelledAppointments")} loading={loading} rows={rows} cols={[
          { key:"date",          label:t("detailedReport.table.date"),    render:(r)=>fmtDate(r.date) },
          { key:"applicationId", label:t("detailedReport.table.id") },
          { key:"patientName",   label:t("detailedReport.table.patient"), render:(r)=>getPatName(r) },
          { key:"doctorEmail",   label:t("detailedReport.table.doctor"),  render:(r)=>getDocEmail(r) },
          { key:"serviceName",   label:t("detailedReport.table.service"), render:(r)=>tSvc(r) },
        ]}/>
      </>);
    }

    /* By Doctor */
    if (activeReport === "by_doctor") {
      const grouped = {};
      applications.forEach((a)=>{
        const key=getDocEmail(a);
        const name=getDocName(a,lang);
        if(!grouped[key]) grouped[key]={ doctor:name,count:0,revenue:0,completed:0,cancelled:0 };
        grouped[key].count++;
        grouped[key].revenue+=getAmount(a);
        if(["Completed","Paid"].includes(a.appointmentStatus)) grouped[key].completed++;
        if(["Cancelled","canceled"].includes(a.appointmentStatus)) grouped[key].cancelled++;
      });
      const rows = Object.values(grouped).sort((a,b)=>b.count-a.count);
      return (<>
        {rows.length > 0 && (
          <ChartCard title={t("detailedReport.charts.appointmentsPerDoctor")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="doctor" tick={{fontSize:10}} interval={0} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                <Bar dataKey="completed" name={t("detailedReport.series.completed")} fill={COLORS[1]} stackId="a"/>
                <Bar dataKey="cancelled" name={t("detailedReport.series.cancelled")} fill={COLORS[3]} stackId="a" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.doctorBreakdown")} loading={loading} rows={rows} cols={[
          { key:"doctor",    label:t("detailedReport.table.doctor") },
          { key:"count",     label:t("detailedReport.table.total") },
          { key:"completed", label:t("detailedReport.table.completed") },
          { key:"cancelled", label:t("detailedReport.table.cancelled") },
          { key:"revenue",   label:t("detailedReport.table.revenue"), render:(r)=>fmt(r.revenue) },
        ]}/>
      </>);
    }

    /* By Specialty */
    if (activeReport === "by_specialty") {
      const grouped = {};
      applications.forEach((a)=>{
        const raw=a.specialty||a.serviceType||"Unknown";
        const key=raw.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"");
        const s=t(`detailedReport.serviceNames.${key}`,raw);
        if(!grouped[s]) grouped[s]={ specialty:s,count:0,revenue:0 };
        grouped[s].count++; grouped[s].revenue+=getAmount(a);
      });
      const rows = Object.values(grouped).sort((a,b)=>b.count-a.count);
      return (<>
        {rows.length > 0 && (
          <div className="rpt-charts-row">
            <ChartCard title={t("detailedReport.charts.shareBySpecialty")} height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rows} dataKey="count" nameKey="specialty" cx="50%" cy="43%"
                    innerRadius={60} outerRadius={95} paddingAngle={3}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {rows.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t("detailedReport.charts.revenueBySpecialty")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                  <XAxis type="number" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <YAxis dataKey="specialty" type="category" width={120} tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={TT} formatter={(v)=>fmt(v)}/>
                  <Bar dataKey="revenue" name={t("detailedReport.series.revenue")} radius={[0,5,5,0]}>
                    {rows.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
        <DataTable label={t("detailedReport.table.specialtyBreakdown")} loading={loading} rows={rows} cols={[
          { key:"specialty", label:t("detailedReport.table.specialty") },
          { key:"count",     label:t("detailedReport.table.appointments") },
          { key:"revenue",   label:t("detailedReport.table.revenue"), render:(r)=>fmt(r.revenue) },
        ]}/>
      </>);
    }

    /* Revenue Summary */
    if (activeReport === "revenue_summary") {
      const trend = revenueTrend.map((m)=>({ month:m.month,revenue:m.revenue??m.total }));
      const avg   = summary?.totalApplications ? Math.round(summary.totalRevenue/summary.totalApplications) : null;
      return (<>
        {trend.length > 0 && (
          <ChartCard title={t("detailedReport.charts.revenueOverTime")} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="rpt-revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={(v)=>`₽${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={TT} formatter={(v)=>fmt(v)}/>
                <Area type="monotone" dataKey="revenue" name={t("detailedReport.series.revenue")} stroke="#22c55e" fill="url(#rpt-revGrad)" strokeWidth={2.5}/>
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </>);
    }

    /* Revenue Trend */
    if (activeReport === "revenue_trend") {
      const rows = revenueTrend.map((m)=>({ month:m.month,revenue:m.revenue??m.total }));
      const maxRev = rows.reduce((m,r)=>r.revenue>m?r.revenue:m,0);
      return (<>
        {rows.length > 0 && (
          <ChartCard title={t("detailedReport.charts.revenueTrend")} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={(v)=>`₽${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={TT} formatter={(v)=>fmt(v)}/>
                <Line type="monotone" dataKey="revenue" name={t("detailedReport.series.revenue")} stroke={COLORS[0]} strokeWidth={2.5} dot={{r:5,strokeWidth:2,fill:"#fff",stroke:COLORS[0]}}/>
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.charts.revenueTrend")} loading={loading} rows={rows} cols={[
          { key:"month",   label:t("detailedReport.table.month") },
          { key:"revenue", label:t("detailedReport.table.revenue"), render:(r)=>fmt(r.revenue) },
        ]}/>
      </>);
    }

    /* Payment Status */
    if (activeReport === "payment_status") {
      const grouped = {};
      applications.forEach((a)=>{ const s=a.paymentStatus||a.appointmentStatus||"Unknown"; grouped[s]=(grouped[s]||0)+1; });
      const rows = Object.entries(grouped).map(([status,count])=>({
        status: t(`detailedReport.statuses.${status}`, status),
        _orig: status, count,
      }));
      const total = rows.reduce((s,r)=>s+r.count,0);
      return (<>
        {rows.length > 0 && (
          <div className="rpt-charts-row">
            <ChartCard title={t("detailedReport.charts.paymentStatusDistribution")} height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rows} dataKey="count" nameKey="status" cx="50%" cy="43%"
                    innerRadius={60} outerRadius={95} paddingAngle={3}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {rows.map((r,i)=><Cell key={i} fill={STATUS_COLORS[r._orig]||COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t("detailedReport.charts.countByStatus")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="status" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey="count" name={t("detailedReport.table.count")} radius={[6,6,0,0]}>
                    {rows.map((r,i)=><Cell key={i} fill={STATUS_COLORS[r._orig]||COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
        <DataTable label={t("detailedReport.table.paymentStatus")} loading={loading} rows={rows} cols={[
          { key:"status", label:t("detailedReport.table.paymentStatus"), render:(r)=><StatusBadge status={r._orig||r.status}/> },
          { key:"count",  label:t("detailedReport.table.count") },
          { key:"share",  label:t("detailedReport.table.share"),  render:(r)=>`${((r.count/total)*100).toFixed(1)}%` },
        ]}/>
      </>);
    }

    /* Patient List */
    if (activeReport === "patient_list") {
      const q = search.toLowerCase();
      const rows = patients.filter((p)=>!q||(p.firstName||"").toLowerCase().includes(q)||(p.lastName||"").toLowerCase().includes(q)||(p.email||"").toLowerCase().includes(q));
      return (<>
        <DataTable label={t("detailedReport.table.patientRecords")} loading={loading} rows={rows} cols={[
          { key:"patientId",   label:t("detailedReport.table.id") },
          { key:"lastName",    label:t("detailedReport.table.lastName") },
          { key:"firstName",   label:t("detailedReport.table.firstName") },
          { key:"email",       label:t("detailedReport.table.email") },
          { key:"phoneNumber", label:t("detailedReport.table.phone") },
        ]}/>
      </>);
    }

    /* New Patients */
    if (activeReport === "new_patients") {
      const from = new Date(dateRange.from);
      const rows = patients.filter((p)=>p.createdAt&&new Date(p.createdAt)>=from);
      const byMonth = {};
      rows.forEach((p)=>{ const m=p.createdAt?.slice(0,7)||""; byMonth[m]=(byMonth[m]||0)+1; });
      const chart = Object.entries(byMonth).sort().map(([m,c])=>({ month:m,count:c }));
      return (<>
        {chart.length > 0 && (
          <ChartCard title={t("detailedReport.charts.newPatientsPerMonth")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/>
                <Bar dataKey="count" name={t("detailedReport.series.newPatients")} fill={COLORS[1]} radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.newPatientRecords")} loading={loading} rows={rows} cols={[
          { key:"patientId", label:t("detailedReport.table.id") },
          { key:"lastName",  label:t("detailedReport.table.lastName") },
          { key:"firstName", label:t("detailedReport.table.firstName") },
          { key:"email",     label:t("detailedReport.table.email") },
          { key:"createdAt", label:t("detailedReport.table.registered"), render:(r)=>fmtDate(r.createdAt) },
        ]}/>
      </>);
    }

    /* Doctor Performance */
    if (activeReport === "doctor_performance") {
      const topRev = [...doctorPerf].sort((a,b)=>(b.totalRevenue||0)-(a.totalRevenue||0))[0];
      return (<>
        {doctorPerf.length > 0 && (
          <ChartCard title={t("detailedReport.charts.revenueAppointmentsPerDoctor")} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={doctorPerf} barSize={26}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="doctorName" tick={{fontSize:10}} interval={0} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="left"  tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={(v)=>`₽${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                <Bar yAxisId="left"  dataKey="totalApps"    name={t("detailedReport.series.appointments")} fill={COLORS[0]} radius={[5,5,0,0]}/>
                <Bar yAxisId="right" dataKey="totalRevenue" name={t("detailedReport.series.revenue")}       fill={COLORS[1]} radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.doctorPerformance")} loading={loading} rows={doctorPerf} cols={[
          { key:"doctorName",   label:t("detailedReport.table.doctor") },
          { key:"totalApps",    label:t("detailedReport.table.totalAppointments") },
          { key:"completed",    label:t("detailedReport.table.completed") },
          { key:"cancelled",    label:t("detailedReport.table.cancelled") },
          { key:"totalRevenue", label:t("detailedReport.table.revenue"), render:(r)=>fmt(r.totalRevenue) },
        ]}/>
      </>);
    }

    /* Doctor Workload */
    if (activeReport === "doctor_workload") {
      const grouped = {};
      applications.forEach((a)=>{
        const key=getDocEmail(a);
        const name=getDocName(a,lang);
        if(!grouped[key]) grouped[key]={ doctor:name,slots:0,hours:0 };
        grouped[key].slots++;
        const s=a.startTime?.slice(0,5),e=a.endTime?.slice(0,5);
        if(s&&e){ const [sh,sm]=s.split(":").map(Number),[eh,em]=e.split(":").map(Number); grouped[key].hours+=((eh*60+em)-(sh*60+sm))/60; }
      });
      const rows = Object.values(grouped).sort((a,b)=>b.slots-a.slots);
      return (<>
        {rows.length > 0 && (
          <ChartCard title={t("detailedReport.charts.workloadHoursPerDoctor")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11}} tickLine={false} axisLine={false} unit="h"/>
                <YAxis dataKey="doctor" type="category" width={130} tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/>
                <Bar dataKey="hours" name={t("detailedReport.series.hours")} fill={COLORS[4]} radius={[0,6,6,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.doctorWorkload")} loading={loading} rows={rows} cols={[
          { key:"doctor", label:t("detailedReport.table.doctor") },
          { key:"slots",  label:t("detailedReport.table.appointments") },
          { key:"hours",  label:t("detailedReport.table.hours"), render:(r)=>r.hours.toFixed(1) },
        ]}/>
      </>);
    }

    /* Service Growth */
    if (activeReport === "service_growth") {
      const svcKeys = serviceGrowth[0] ? Object.keys(serviceGrowth[0]).filter((k)=>k!=="month"&&k!=="total") : [];
      return (<>
        {serviceGrowth.length > 0 && (
          <ChartCard title={t("detailedReport.charts.serviceGrowthOverTime")} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serviceGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                {svcKeys.map((k,i)=>(
                  <Line key={k} type="monotone" dataKey={k} name={k}
                    stroke={COLORS[i%COLORS.length]} strokeWidth={2.5}
                    dot={{r:4,strokeWidth:2,fill:"#fff",stroke:COLORS[i%COLORS.length]}}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable label={t("detailedReport.table.serviceGrowthData")} loading={loading} rows={serviceGrowth} cols={[
          { key:"month", label:t("detailedReport.table.month") },
          ...svcKeys.map((k)=>({ key:k, label:k })),
          { key:"total", label:t("detailedReport.table.total") },
        ]}/>
      </>);
    }

    /* Specialty Stats */
    if (activeReport === "specialty_stats") {
      return (<>
        {specStats.length > 0 && (
          <div className="rpt-charts-row">
            <ChartCard title={t("detailedReport.charts.appointmentsBySpecialty")} height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={specStats} dataKey="count" nameKey="specialty" cx="50%" cy="43%"
                    innerRadius={60} outerRadius={95} paddingAngle={3}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {specStats.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={8}/>
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t("detailedReport.charts.revenueBySpecialty")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={specStats} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="specialty" tick={{fontSize:10}} interval={0} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} tickFormatter={(v)=>`₽${(v/1000).toFixed(0)}k`}/>
                  <Tooltip contentStyle={TT} formatter={(v)=>fmt(v)}/>
                  <Bar dataKey="revenue" name={t("detailedReport.series.revenue")} radius={[6,6,0,0]}>
                    {specStats.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
        <DataTable label={t("detailedReport.table.specialtyStatistics")} loading={loading} rows={specStats} cols={[
          { key:"specialty",     label:t("detailedReport.table.specialty") },
          { key:"count",         label:t("detailedReport.table.appointments") },
          { key:"revenue",       label:t("detailedReport.table.revenue"),  render:(r)=>fmt(r.revenue) },
          { key:"avgPercentage", label:t("detailedReport.table.share"),    render:(r)=>r.avgPercentage?`${r.avgPercentage}%`:"—" },
        ]}/>
      </>);
    }

    return null;
  };

  const activeLabel = t(`detailedReport.reports.${activeReport}`,
    REPORT_CATEGORIES.flatMap((c)=>c.reports).find((r)=>r.key===activeReport)?.label||"");

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="rpt-page">

      {/* Header */}
      <div className="rpt-topbar">
        <div className="rpt-topbar-left">
          <div className="rpt-topbar-icon"><BarChart2 size={20}/></div>
          <div>
            <h1 className="rpt-title">{t("detailedReport.title")}</h1>
            <p className="rpt-subtitle">{t("detailedReport.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="rpt-layout">

        {/* Sidebar */}
        <aside className="rpt-sidebar">
          {REPORT_CATEGORIES.map((cat)=>{
            const Icon=cat.icon; const isOpen=!!openCats[cat.key];
            return (
              <div key={cat.key} className="rpt-cat">
                <button className="rpt-cat-header" onClick={()=>toggleCat(cat.key)}>
                  <span className="rpt-cat-left"><Icon size={12}/>{t(`detailedReport.categories.${cat.key}`,cat.label)}</span>
                  <ChevronDown size={11} className={`rpt-cat-arrow${isOpen?" open":""}`}/>
                </button>
                {isOpen && (
                  <div className="rpt-cat-items">
                    {cat.reports.map((rep)=>(
                      <button key={rep.key}
                        className={`rpt-cat-item${activeReport===rep.key?" active":""}`}
                        onClick={()=>selectReport(rep.key)}>
                        {t(`detailedReport.reports.${rep.key}`,rep.label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* Main */}
        <main className="rpt-main">

          {/* Filters */}
          <div className="rpt-filters">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">{t("detailedReport.filter.period")}</label>
              <div className="rpt-presets">
                {PRESETS.map((p)=>(
                  <button key={p}
                    className={`rpt-preset-btn${activePreset===p?" rpt-preset-active":""}`}
                    onClick={()=>pickPreset(p)}>{t(`detailedReport.filter.${p}`)}
                  </button>
                ))}
              </div>
            </div>
           
            <div className="rpt-filter-group rpt-search-wrap">
              <Search size={13} className="rpt-search-icon"/>
              <input className="rpt-search" placeholder={t("detailedReport.filter.searchPlaceholder")} value={search}
                onChange={(e)=>setSearch(e.target.value)}/>
              {search && <button className="rpt-search-clear" onClick={()=>setSearch("")}><X size={12}/></button>}
            </div>
          </div>

          {/* Report header */}
          <div className="rpt-report-header">
            <h2 className="rpt-report-title">
              <div className="rpt-report-title-icon"><FileText size={15}/></div>
              {activeLabel}
            </h2>
            <div className="rpt-header-dates">
              <div className="rpt-header-date-group">
                <span className="rpt-header-date-label">{t("detailedReport.filter.from")}</span>
                <CustomCalendar
                  value={dateRange.from}
                  onChange={(date) => {
                    const str = date ? new Date(date).toISOString().split("T")[0] : "";
                    setActivePreset("");
                    setDateRange((d) => ({ ...d, from: str }));
                  }}
                  maxDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  className="rpt-custom-calendar"
                  dropdownAlign="right"
                />
              </div>
              <div className="rpt-header-date-group">
                <span className="rpt-header-date-label">{t("detailedReport.filter.to")}</span>
                <CustomCalendar
                  value={dateRange.to}
                  onChange={(date) => {
                    const str = date ? new Date(date).toISOString().split("T")[0] : "";
                    setActivePreset("");
                    setDateRange((d) => ({ ...d, to: str }));
                  }}
                  maxDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  className="rpt-custom-calendar"
                  dropdownAlign="right"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="rpt-report-body">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
