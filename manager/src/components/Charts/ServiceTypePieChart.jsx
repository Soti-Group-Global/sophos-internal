import React from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { FiPieChart, FiArrowUpRight, FiInfo } from "react-icons/fi";

const ServiceTypePieChart = ({ data = [], t }) => {
  const { i18n } = useTranslation();
  const COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
    "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"
  ];

  const totalCount = data.reduce((sum, item) => sum + (item.count || 0), 0);

  const translateService = (name) =>
    t(`serviceGrowth.serviceTypes.${name}`, { defaultValue: name });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0].payload;
      const percentage = ((dataItem.count / totalCount) * 100).toFixed(1);
      
      return (
        <div className="service-tooltip">
          <div className="tooltip-header">
            <div 
              className="tooltip-color-indicator"
              style={{ backgroundColor: payload[0].color }}
            />
            <span className="tooltip-service">{translateService(dataItem._id)}</span>
          </div>
          <div className="tooltip-content">
            <div className="tooltip-item">
              <span className="tooltip-label">{t('servicePieChart.tooltip.applications')}</span>
              <span className="tooltip-value">{dataItem.count}</span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-label">{t('servicePieChart.tooltip.percentage')}</span>
              <span className="tooltip-percentage">{percentage}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index
  }) => {
    if (percent < 0.1) return null; // Hide labels for very small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="600"
        className="pie-label"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Get the most requested service
  const mostRequestedService = data.length > 0 
    ? data.reduce((max, item) => item.count > max.count ? item : data[0])
    : null;

  return (
    <div className="service-distribution-card">
      {/* Header */}
      <div className="service-header">
        <div className="service-title-section">
          <div className="service-icon-wrapper">
            <FiPieChart className="service-main-icon" />
          </div>
          <div className="service-title-content">
            <h3 className="service-title">{t('servicePieChart.title')}</h3>
            <p className="service-subtitle">{t('servicePieChart.subtitle')}</p>
          </div>
        </div>
        <div className="service-total">
          <div className="total-badge">
            <span className="total-count">{totalCount}</span>
            <span className="total-label">{t('servicePieChart.total')}</span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="service-chart-container">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="_id"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Metric */}
        <div className="chart-center-metric">
          <div className="center-value">{totalCount}</div>
          <div className="center-label">{t('servicePieChart.applications')}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="service-legend">
        <div className="legend-header">
          <span className="legend-title">{t('servicePieChart.legend.title')}</span>
          <FiInfo className="legend-info" />
        </div>
        <div className="legend-items">
          {data.map((item, index) => {
            const percentage = ((item.count / totalCount) * 100).toFixed(1);
            
            return (
              <div key={index} className="legend-item">
                <div className="legend-item-main">
                  <div 
                    className="legend-color"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="legend-content">
                    <span className="legend-label">{translateService(item._id)}</span>
                    <span className="legend-count">
                      {item.count} {t('servicePieChart.legend.apps')}
                    </span>
                  </div>
                </div>
                <div className="legend-percentage">
                  {percentage}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      {mostRequestedService && (
        <div className="service-insights">
          <div className="insights-header">
            <FiArrowUpRight className="insights-icon" />
            <span>{t('servicePieChart.insights.keyInsight')}</span>
          </div>
          <div className="insights-content">
            {translateService(mostRequestedService._id)} {t('servicePieChart.insights.mostRequested')}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceTypePieChart;