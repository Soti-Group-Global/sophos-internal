import React, { useEffect } from "react";
import {
  FiUsers,
  FiCalendar,
  FiTrendingUp,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import { FaRubleSign } from "react-icons/fa";

const AnalyticsCards = ({ summary, t }) => {
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="analytics-loading text-gray-400 text-sm">
        {t('analyticsCards.loading')}
      </div>
    );
  }

  // Extract totals intelligently depending on API shape
  const totalApplications =
    Number(summary?.totalApplications) ||
    Number(summary?.totalRecords?.[0]?.count) ||
    0;

  const totalRevenue =
    Number(summary?.revenueSummary?.overallRevenue) ||
    Number(summary?.totalRevenue?.[0]?.revenue) ||
    0;

  const followUpNeeded =
    Number(summary?.followUpStats?.totalNeeded) ||
    Number(summary?.followUps?.[0]?.totalNeeded) ||
    0;

  const followUpBooked =
    Number(summary?.followUpStats?.totalBooked) ||
    Number(summary?.followUps?.[0]?.totalBooked) ||
    0;

  // Derived metric
  const followUpCompletion =
    followUpNeeded > 0
      ? Math.round((followUpBooked / followUpNeeded) * 100)
      : 0;

  // Mock growth
  const growthData = {
    applications: 12.5,
    revenue: 8.3,
    followUps: -2.1,
  };

  const cards = [
    {
      id: "totalApplications",
      title: t('analyticsCards.cards.totalApplications.title'),
      value: totalApplications.toLocaleString(),
      icon: FiUsers,
      color: "blue",
      growth: growthData.applications,
      description: t('analyticsCards.cards.totalApplications.description'),
      trendText: t('analyticsCards.cards.totalApplications.trend'),
      negativeTrendText: t('analyticsCards.cards.totalApplications.negativeTrend'),
    },
    {
      id: "totalRevenue",
      title: t('analyticsCards.cards.totalRevenue.title'),
      value: `₽${totalRevenue.toLocaleString()}`,
      icon: FaRubleSign,
      color: "green",
      growth: growthData.revenue,
      description: t('analyticsCards.cards.totalRevenue.description'),
      trendText: t('analyticsCards.cards.totalRevenue.trend'),
      negativeTrendText: t('analyticsCards.cards.totalRevenue.negativeTrend'),
    },
    {
      id: "followUps",
      title: t('analyticsCards.cards.followUps.title'),
      value: `${followUpBooked}/${followUpNeeded}`,
      icon: FiCalendar,
      color: "purple",
      growth: growthData.followUps,
      description: t('analyticsCards.cards.followUps.description', { completion: followUpCompletion }),
      trendText: t('analyticsCards.cards.followUps.trend'),
      negativeTrendText: t('analyticsCards.cards.followUps.negativeTrend'),
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: "bg-blue-50",
        icon: "text-blue-600",
        gradient: "from-blue-500 to-blue-600",
        progress: "bg-blue-500",
      },
      green: {
        bg: "bg-green-50",
        icon: "text-green-600",
        gradient: "from-green-500 to-green-600",
        progress: "bg-green-500",
      },
      purple: {
        bg: "bg-purple-50",
        icon: "text-purple-600",
        gradient: "from-purple-500 to-purple-600",
        progress: "bg-purple-500",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="analytics-cards-grid">
      {cards.map((card, index) => {
        const colorClasses = getColorClasses(card.color);
        const isPositiveGrowth = card.growth >= 0;

        return (
          <div key={index} className="analytics-card">
            <div
              className={`analytics-card-gradient ${colorClasses.gradient}`}
            ></div>

            <div className="analytics-card-content">
              <div className="analytics-card-top">
                <div className={`analytics-icon-wrapper ${colorClasses.bg}`}>
                  <card.icon
                    className={`analytics-card-icon ${colorClasses.icon}`}
                  />
                </div>
                <div className="analytics-card-main">
                  <div className="analytics-card-value">{card.value}</div>
                  <div className="analytics-card-title">{card.title}</div>
                </div>
                <div className="analytics-growth-indicator">
                  {isPositiveGrowth ? (
                    <FiArrowUp className="growth-arrow positive" />
                  ) : (
                    <FiArrowDown className="growth-arrow negative" />
                  )}
                  <span
                    className={`growth-text ${
                      isPositiveGrowth ? "positive" : "negative"
                    }`}
                  >
                    {Math.abs(card.growth)}%
                  </span>
                </div>
              </div>

              {card.id === "followUps" && (
                <div className="analytics-progress-container">
                  <div className="analytics-progress-bar">
                    <div
                      className={`analytics-progress-fill ${colorClasses.progress}`}
                      style={{ width: `${followUpCompletion}%` }}
                    ></div>
                  </div>
                  <div className="analytics-progress-text">
                    {t('analyticsCards.cards.followUps.completionRate', { completion: followUpCompletion })}
                  </div>
                </div>
              )}

              <div className="analytics-card-description">
                {card.description}
              </div>

              <div className="analytics-trend-indicator">
                <FiTrendingUp className="trend-icon" />
                <span className="trend-text">
                  {isPositiveGrowth ? card.trendText : card.negativeTrendText}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnalyticsCards;