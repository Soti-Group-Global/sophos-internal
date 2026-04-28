import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { FiTrendingUp, FiAward, FiUser, FiClock, FiBriefcase } from "react-icons/fi";

const getFieldValue = (field, lang = "ru") => {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") return field[lang] || field["en"] || field["ru"] || "";
  return "";
};

const DoctorPerformanceChart = ({ data = [], t }) => {
  const chartData = data.slice(0, 6).map((doctor, index) => {
    // Resolve name: prefer doctorName (already resolved by backend), then try field combos
    let fullName = "";
    if (doctor.doctorName && typeof doctor.doctorName === "string" && doctor.doctorName.trim()) {
      fullName = doctor.doctorName.trim();
    } else {
      const fn = getFieldValue(doctor.firstName) || "";
      const mn = getFieldValue(doctor.middleName) || "";
      const ln = getFieldValue(doctor.lastName) || "";
      fullName = `${ln} ${fn} ${mn}`.replace(/\s+/g, " ").trim();
    }

    // If still empty, use email prefix as fallback
    if (!fullName && doctor.doctorEmail) {
      fullName = doctor.doctorEmail.split("@")[0].replace(/[._-]/g, " ");
      fullName = fullName.charAt(0).toUpperCase() + fullName.slice(1);
    }

    const hours = doctor.totalWorkingHours || 0;
    const revenuePerHour = hours > 0 ? (doctor.totalRevenue / hours).toFixed(0) : 0;

    return {
      ...doctor,
      doctorName: fullName || `${t("doctorPerformance.unknownDoctor")} ${index + 1}`,
      specialty: getFieldValue(doctor.specialty) || t("doctorPerformance.noSpecialty"),
      shortName: fullName
        ? fullName.length > 14
          ? fullName.split(" ")[0]
          : fullName
        : `Dr. ${index + 1}`,
      doctorEmail: doctor.doctorEmail || doctor._id,
      rank: index + 1,
      totalWorkingHours: hours,
      revenuePerHour: parseFloat(revenuePerHour),
    };
  });

  const colors = ["#0a2e5d", "#2563eb", "#3b82f6", "#60a5fa", "#93bbfd", "#bfdbfe"];
  const maxRevenue = Math.max(...chartData.map((d) => d.totalRevenue || 0), 1);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="dpc-tooltip">
          <div className="dpc-tooltip-name">{d.doctorName}</div>
          {d.specialty && d.specialty !== t("doctorPerformance.noSpecialty") && (
            <div className="dpc-tooltip-spec">{d.specialty}</div>
          )}
          <div className="dpc-tooltip-row">
            <span>{t("doctorPerformance.tooltip.revenue")}</span>
            <strong>₽{(d.totalRevenue || 0).toLocaleString()}</strong>
          </div>
          <div className="dpc-tooltip-row">
            <span>{t("doctorPerformance.tooltip.applications")}</span>
            <strong>{d.totalApplications || 0}</strong>
          </div>
          <div className="dpc-tooltip-row">
            <span>{t("doctorPerformance.tooltip.workingHours")}</span>
            <strong>{d.totalWorkingHours?.toFixed(1)}h</strong>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomBar = (props) => {
    const { x, y, width, height, index } = props;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colors[index % colors.length]}
        rx={6}
        ry={6}
        opacity={0.85}
      />
    );
  };

  if (!chartData.length) {
    return (
      <div className="dpc-card">
        <div className="dpc-empty">
          <FiUser size={32} />
          <p>{t("doctorPerformance.noData") || "No data"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dpc-card">
      {/* Header */}
      <div className="dpc-header">
        <div className="dpc-header-left">
          <div className="dpc-header-icon">
            <FiTrendingUp size={16} />
          </div>
          <div>
            <h3 className="dpc-title">{t("doctorPerformance.title")}</h3>
            <p className="dpc-subtitle">{t("doctorPerformance.subtitle")}</p>
          </div>
        </div>
        <div className="dpc-badge">
          <FiAward size={12} />
          {t("doctorPerformance.topBadge")}
        </div>
      </div>

      {/* Chart */}
      <div className="dpc-chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 32 }}
            barSize={28}
          >
            <XAxis
              dataKey="shortName"
              axisLine={false}
              tickLine={false}
              angle={-30}
              textAnchor="end"
              height={40}
              tick={{ fontSize: 11, fill: "#64748b" }}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={(v) => `₽${v / 1000}k`}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", radius: 6 }} />
            <Bar dataKey="totalRevenue" shape={<CustomBar />}>
              {chartData.map((_, i) => (
                <Cell key={`cell-${i}`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Doctor list */}
      <div className="dpc-list">
        {chartData.map((doctor, index) => (
          <div key={index} className="dpc-row">
            <div className={`dpc-rank ${index < 3 ? `dpc-rank-${index + 1}` : ""}`}>
              #{doctor.rank}
            </div>
            <div className="dpc-info">
              <span className="dpc-name">{doctor.doctorName}</span>
              <span className="dpc-spec">
                <FiBriefcase size={10} />
                {doctor.specialty}
              </span>
            </div>
            <div className="dpc-stats">
              <span className="dpc-revenue">₽{(doctor.totalRevenue || 0).toLocaleString()}</span>
              <div className="dpc-bar-track">
                <div
                  className="dpc-bar-fill"
                  style={{
                    width: `${(doctor.totalRevenue / maxRevenue) * 100}%`,
                    background: colors[index % colors.length],
                  }}
                />
              </div>
            </div>
            <div className="dpc-hours">
              <FiClock size={11} />
              <span>{doctor.totalWorkingHours?.toFixed(1)}h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DoctorPerformanceChart;
