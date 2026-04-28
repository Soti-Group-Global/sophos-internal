import React from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";
import {
  FiTrendingUp,
  FiActivity,
  FiBarChart2,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";

const ServiceTypeGrowthChart = ({ data = [], t }) => {
  const { i18n } = useTranslation();
  if (!data.length) {
    return (
      <div className="service-growth-empty-state">
        <div className="empty-icon">
          <FiBarChart2 size={48} />
        </div>
        <h3 className="empty-title">{t('serviceGrowth.emptyState.title')}</h3>
        <p className="empty-description">
          {t('serviceGrowth.emptyState.description')}
        </p>
      </div>
    );
  }

  const mergedByMonth = data.reduce((acc, curr) => {
    const existing = acc.find((a) => a.month === curr.month);
    if (existing) {
      Object.keys(curr).forEach((key) => {
        if (key !== "month" && key !== "total") {
          existing[key] = (existing[key] || 0) + (curr[key] || 0);
        }
      });
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, []);

  const processedData = mergedByMonth.map((item) => {
    const processed = { month: item.month };
    Object.keys(item).forEach((key) => {
      if (key !== "month" && key !== "total") processed[key] = item[key] || 0;
    });
    return processed;
  });

  const serviceTypes = Array.from(
    new Set(
      processedData.flatMap((item) =>
        Object.keys(item).filter((k) => k !== "month" && k !== "total")
      )
    )
  );

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
  ];

  const firstMonth = processedData[0];
  const lastMonth = processedData[processedData.length - 1];
  const totalStart = serviceTypes.reduce(
    (sum, s) => sum + (firstMonth[s] || 0),
    0
  );
  const totalEnd = serviceTypes.reduce(
    (sum, s) => sum + (lastMonth[s] || 0),
    0
  );
  const growth = totalStart ? ((totalEnd - totalStart) / totalStart) * 100 : 0;
  const isPositiveGrowth = growth >= 0;

  const MONTH_MAP_RU = {
    'jan':'Янв','feb':'Фев','mar':'Мар','apr':'Апр','may':'Май','jun':'Июн',
    'jul':'Июл','aug':'Авг','sep':'Сен','sept':'Сен','oct':'Окт','nov':'Ноя','dec':'Дек'
  };
  const isRu = (i18n.language || 'en').startsWith('ru');
  const formatMonth = (monthStr) => {
    if (!monthStr) return monthStr;
    if (isRu) {
      // Backend sends "Feb 2026" / "Sept 2025" format
      const match = monthStr.match(/^(\w+)\s+(\d{4})$/);
      if (match) {
        const ru = MONTH_MAP_RU[match[1].toLowerCase()];
        if (ru) return `${ru} ${match[2]}`;
      }
    }
    return monthStr;
  };

  const translateService = (name) =>
    t(`serviceGrowth.serviceTypes.${name}`, { defaultValue: name });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
      return (
        <div className="service-growth-tooltip">
          <div className="tooltip-header">
            <FiActivity className="tooltip-icon" />
            <span className="tooltip-period">{formatMonth(label)}</span>
          </div>
          <div className="tooltip-content">
            {payload.map((p, i) => (
              <div key={i} className="tooltip-item">
                <div className="tooltip-service">
                  <div
                    className="tooltip-color"
                    style={{ backgroundColor: p.stroke }}
                  />
                  <span className="service-name">{translateService(p.name)}</span>
                </div>
                <span className="tooltip-value">{p.value}</span>
              </div>
            ))}
            <div className="tooltip-total">
              <span className="total-label">{t('serviceGrowth.tooltip.total')}</span>
              <span className="total-value">{total}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomizedDot = (props) => {
    const { cx, cy, stroke, payload } = props;
    const isLatest = payload.month === lastMonth.month;
    return isLatest ? (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={stroke}
          stroke="#ffffff"
          strokeWidth={2}
        />
        <circle cx={cx} cy={cy} r={12} fill={stroke} fillOpacity={0.2} />
      </g>
    ) : (
      <circle cx={cx} cy={cy} r={4} fill={stroke} fillOpacity={0.8} />
    );
  };

  const dominantService = serviceTypes
    .map((service) => ({
      name: service,
      total: processedData.reduce((sum, m) => sum + (m[service] || 0), 0),
    }))
    .reduce((max, curr) => (curr.total > max.total ? curr : max), {
      name: "",
      total: 0,
    });

  // Fixed insight message rendering
  const renderInsightMessage = () => {
    const growthValue = Math.abs(growth).toFixed(1);
    const key = isPositiveGrowth ? 'serviceGrowth.insight.growthMessage' : 'serviceGrowth.insight.declineMessage';
    const html = t(key, {
      growth: growthValue,
      startMonth: formatMonth(firstMonth.month),
      endMonth: formatMonth(lastMonth.month),
      dominantService: translateService(dominantService.name || ''),
      dominantCount: dominantService.total || 0,
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="service-growth-modern-card">
      <div className="service-growth-header">
        <div className="growth-title-section">
          <div className="growth-icon-wrapper">
            <FiTrendingUp className="growth-main-icon" />
          </div>
          <div className="growth-title-content">
            <h3 className="growth-title">{t('serviceGrowth.title')}</h3>
            <p className="growth-subtitle">{t('serviceGrowth.subtitle')}</p>
          </div>
        </div>

        <div className="growth-stats">
          <div className="growth-stat">
            <div className="stat-label">{t('serviceGrowth.stats.totalGrowth')}</div>
            <div
              className={`stat-growth ${
                isPositiveGrowth ? "positive" : "negative"
              }`}
            >
              {isPositiveGrowth ? (
                <FiArrowUp className="stat-arrow" />
              ) : (
                <FiArrowDown className="stat-arrow" />
              )}
              {Math.abs(growth).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div className="service-growth-chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={processedData}
            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
          >
            <defs>
              {serviceTypes.map((service, i) => (
                <linearGradient
                  key={service}
                  id={`gradient-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS[i % COLORS.length]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS[i % COLORS.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickMargin={10}
              tickFormatter={formatMonth}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {serviceTypes.map((service, i) => (
              <Area
                key={`area-${service}`}
                type="monotone"
                dataKey={service}
                stroke="none"
                fill={`url(#gradient-${i})`}
                fillOpacity={1}
              />
            ))}

            {serviceTypes.map((service, i) => (
              <Line
                key={service}
                type="monotone"
                dataKey={service}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={3}
                dot={<CustomizedDot />}
                activeDot={{ r: 8, stroke: "#fff", strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insight */}
      <div className="growth-insight">
        <div className="insight-header">
          <div
            className={`insight-indicator ${
              isPositiveGrowth ? "positive" : "negative"
            }`}
          >
            {isPositiveGrowth ? "📈" : "📉"}
          </div>
          <span className="insight-title">
            {isPositiveGrowth 
              ? t('serviceGrowth.insight.growthTrend') 
              : t('serviceGrowth.insight.declineTrend')
            }
          </span>
        </div>
        <div className="insight-content">
          {renderInsightMessage()}
        </div>
      </div>
    </div>
  );
};

export default ServiceTypeGrowthChart;