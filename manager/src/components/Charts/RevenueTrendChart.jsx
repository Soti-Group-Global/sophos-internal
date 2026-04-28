import React from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";
import {
  FiTrendingUp,
  FiDollarSign,
  FiCalendar,
  FiLayers,
} from "react-icons/fi";

const RevenueTrendChart = ({ data = [], t }) => {
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US';

  // Parse "9/2025" → Date object
  const parseMonth = (m) => {
    const [month, year] = m.split("/").map(Number);
    return new Date(year, month - 1);
  };

  // Clean & Sort Chronologically
  const cleanedData = [...data]
    .filter((d) => d && d.month)
    .sort((a, b) => parseMonth(a.month) - parseMonth(b.month));

  // Prepare Chart Data
  const chartData = cleanedData.map((item, index) => {
    const revenue = item.totalRevenue || 0;
    const prevRevenue =
      index > 0 ? cleanedData[index - 1].totalRevenue || 0 : revenue;
    const trend = revenue - prevRevenue;
    const trendPercentage = prevRevenue > 0 ? (trend / prevRevenue) * 100 : 0;
    const dateObj = parseMonth(item.month);

    return {
      month: item.month,
      dateObj,
      revenue,
      trend,
      trendPercentage,
      isPositive: trend >= 0,
      statuses: item.statuses || {},
    };
  });

  // Summary Calculations
  const totalRevenue = chartData.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const growthRate =
    chartData.length > 1 && chartData[0].revenue > 0
      ? (
          ((chartData[chartData.length - 1].revenue - chartData[0].revenue) /
            chartData[0].revenue) *
          100
        ).toFixed(1)
      : 0;
  const averageRevenue =
    chartData.length > 0 ? Math.round(totalRevenue / chartData.length) : 0;

  const peakMonth =
    chartData.reduce(
      (max, d) => (d.revenue > max.revenue ? d : max),
      { revenue: 0, month: "-" }
    ).month || "-";

  // Function to translate status labels
  const translateStatus = (status) => {
    const key = status?.toLowerCase().replace(/\s+/g, '_');
    return t(`revenueTrend.status.${key}`, status);
  };

  // Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const current = payload[0].payload;
      const isPositive = current.isPositive;

      const formattedMonth = new Date(current.dateObj).toLocaleDateString(
        locale,
        { month: "short", year: "numeric" }
      );

      return (
        <div className="revenue-tooltip">
          <div className="tooltip-header">
            <FiCalendar className="tooltip-icon" />
            <span className="tooltip-period">{formattedMonth}</span>
          </div>

          <div className="tooltip-content">
            <div className="tooltip-item">
              <div className="tooltip-label">
                <FiDollarSign className="label-icon" />
                {t('revenueTrend.tooltip.totalRevenue')}
              </div>
              <div className="tooltip-value">
                ₽{(current.revenue || 0).toLocaleString()}
              </div>
            </div>

            {Object.entries(current.statuses || {}).map(([status, val]) => (
              <div key={status} className="tooltip-item small">
                <div className="tooltip-label">
                  <FiLayers className="label-icon" />
                  {translateStatus(status)}
                </div>
                <div className="tooltip-value">
                  ₽{val.revenue.toLocaleString()} ({val.applications})
                </div>
              </div>
            ))}

            {current.trend !== undefined && (
              <div className="tooltip-item trend">
                <div className="tooltip-label">{t('revenueTrend.tooltip.change')}</div>
                <div
                  className={`trend-indicator ${
                    isPositive ? "positive" : "negative"
                  }`}
                >
                  {isPositive ? "↗" : "↘"} ₽
                  {Math.abs(current.trend).toLocaleString()}
                  {current.trendPercentage !== 0 && (
                    <span className="trend-percentage">
                      (
                      {isPositive ? "+" : ""}
                      {current.trendPercentage.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Dot Component
  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="#ffffff"
          stroke={payload.isPositive ? "#10b981" : "#ef4444"}
          strokeWidth={2}
        />
      </g>
    );
  };

  // Active Dot Component (when hovering)
  const CustomActiveDot = (props) => {
    const { cx, cy, payload } = props;
    
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#ffffff"
          stroke={payload.isPositive ? "#10b981" : "#ef4444"}
          strokeWidth={3}
        />
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={payload.isPositive ? "#10b981" : "#ef4444"}
          fillOpacity={0.2}
        />
      </g>
    );
  };

  // Gradient Definitions
  const GradientDefs = () => (
    <defs>
      {/* Main area gradient */}
      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
        <stop offset="50%" stopColor="#a3a3a3" stopOpacity={0.1} />
        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.25} />
      </linearGradient>
      
      {/* Stroke gradient for the line */}
      <linearGradient id="strokeGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="50%" stopColor="#a3a3a3" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
    </defs>
  );

  // Render
  return (
    <div className="revenue-trend-card">
      {/* Header */}
      <div className="revenue-header">
        <div className="revenue-title-section">
          <div className="revenue-icon-wrapper">
            <FiTrendingUp className="revenue-main-icon" />
          </div>
          <div className="revenue-title-content">
            <h3 className="revenue-title">{t('revenueTrend.title')}</h3>
            <p className="revenue-subtitle">
              {t('revenueTrend.subtitle')}
            </p>
          </div>
        </div>
        <div className="revenue-stats">
          <div className="revenue-stat">
            <div className="stat-label">{t('revenueTrend.stats.total')}</div>
            <div className="stat-value">
              ₽{totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="revenue-stat">
            <div className="stat-label">{t('revenueTrend.stats.growth')}</div>
            <div
              className={`stat-growth ${
                growthRate >= 0 ? "positive" : "negative"
              }`}
            >
              {growthRate >= 0 ? "+" : ""}
              {growthRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="revenue-chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={chartData.map((d) => ({
              ...d,
              dateObj: d.dateObj.getTime(), // Use timestamp for continuous scale
            }))}
            margin={{ top: 10, right: 40, left: 20, bottom: 10 }}
          >
            <GradientDefs />
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="dateObj"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(val) =>
                new Date(val).toLocaleDateString(locale, {
                  month: "short",
                  year: "numeric",
                })
              }
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(val) => `₽${val / 1000}k`}
              tickMargin={10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="url(#strokeGradient)"
              fill="url(#revGradient)"
              strokeWidth={3}
              fillOpacity={1}
              isAnimationActive={true}
              dot={<CustomDot />}
              activeDot={<CustomActiveDot />}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="revenue-legend">
        <div className="legend-item">
          <div className="legend-color positive"></div>
          <span className="legend-label">{t('revenueTrend.legend.increase')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color negative"></div>
          <span className="legend-label">{t('revenueTrend.legend.decrease')}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="revenue-summary">
        <div className="summary-item">
          <div className="summary-label">{t('revenueTrend.stats.averageMonthly')}</div>
          <div className="summary-value">
            ₽{averageRevenue.toLocaleString()}
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-label">{t('revenueTrend.stats.peakMonth')}</div>
          <div className="summary-value">
            {peakMonth && peakMonth !== '-'
              ? parseMonth(peakMonth).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
              : peakMonth}
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-label">{t('revenueTrend.stats.trend')}</div>
          <div
            className={`summary-trend ${
              growthRate >= 0 ? "positive" : "negative"
            }`}
          >
            {growthRate >= 0 ? t('revenueTrend.trend.improving') : t('revenueTrend.trend.declining')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueTrendChart;