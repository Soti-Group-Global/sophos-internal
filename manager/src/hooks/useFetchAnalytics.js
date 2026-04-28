import { useState, useEffect, useCallback } from "react";
import {
  getAnalyticsSummary,
  getRevenueTrend,
  getDoctorPerformance,
  getVerificationStats,
  getSpecialtiesData,
  getServiceGrowth,
} from "../utils/api";
import { useBranch } from "../context/BranchContext";

export const useFetchAnalytics = (
  type,
  startDate,
  endDate,
  appointmentStatuses = [],
  paymentStatuses = []
) => {
  const { selectedBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: null,
    revenue: [],
    doctors: [],
    verification: {},
    specialties: [],
    serviceGrowth: [],
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate };

      if (selectedBranch && selectedBranch !== "All") {
        params.branch = selectedBranch;
      }

      if (appointmentStatuses?.length)
        params.appointmentStatus = appointmentStatuses.join(",");
      if (paymentStatuses?.length)
        params.paymentStatus = paymentStatuses.join(",");

      if (type === "all") {
        const [
          appSummary,
          earlySummary,
          appRevenue,
          earlyRevenue,
          appDoctors,
          earlyDoctors,
          appVerification,
          earlyVerification,
          appSpecialties,
          earlySpecialties,
          appGrowth,
          earlyGrowth,
        ] = await Promise.all([
          getAnalyticsSummary("applications", params),
          getAnalyticsSummary("early-detection", params),
          getRevenueTrend("applications", params),
          getRevenueTrend("early-detection", params),
          getDoctorPerformance("applications", params),
          getDoctorPerformance("early-detection", params),
          getVerificationStats("applications", params),
          getVerificationStats("early-detection", params),
          getSpecialtiesData("applications", params),
          getSpecialtiesData("early-detection", params),
          getServiceGrowth("applications", params),
          getServiceGrowth("early-detection", params),
        ]);

        const mergedSummary = {
          totalApplications:
            (appSummary?.totalApplications ||
              appSummary?.totalRecords?.[0]?.total ||
              0) +
            (earlySummary?.totalApplications ||
              earlySummary?.totalRecords?.[0]?.total ||
              0),
          revenueSummary: {
            overallRevenue:
              (appSummary?.revenueSummary?.overallRevenue ||
                appSummary?.totalRevenue?.[0]?.revenue ||
                0) +
              (earlySummary?.revenueSummary?.overallRevenue ||
                earlySummary?.totalRevenue?.[0]?.revenue ||
                0),
          },
          byServiceType: [
            ...(appSummary?.byServiceType || []),
            ...(earlySummary?.byServiceType || []),
          ],
          followUpStats: {
            totalNeeded:
              (appSummary?.followUpStats?.totalNeeded || 0) +
              (earlySummary?.followUpStats?.totalNeeded || 0),
            totalBooked:
              (appSummary?.followUpStats?.totalBooked || 0) +
              (earlySummary?.followUpStats?.totalBooked || 0),
          },
        };

        const mergedRevenue = [
          ...(appRevenue || []),
          ...(earlyRevenue || []),
        ].sort((a, b) => {
          const parse = (m) => {
            if (!m) return 0;
            const [month, year] = m.split("/").map(Number);
            return new Date(year, month - 1).getTime();
          };
          return parse(a.month) - parse(b.month);
        });

        const mergedDoctors = [...(appDoctors || []), ...(earlyDoctors || [])];
        const mergedVerification = {
          prescriptionsVerified:
            (appVerification?.prescriptionsVerified || 0) +
            (earlyVerification?.prescriptionsVerified || 0),
          prescriptionsPending:
            (appVerification?.prescriptionsPending || 0) +
            (earlyVerification?.prescriptionsPending || 0),
          conclusionsVerified:
            (appVerification?.conclusionsVerified || 0) +
            (earlyVerification?.conclusionsVerified || 0),
          conclusionsPending:
            (appVerification?.conclusionsPending || 0) +
            (earlyVerification?.conclusionsPending || 0),
        };
        const mergedSpecialties = [
          ...(appSpecialties || []),
          ...(earlySpecialties || []),
        ];
        const mergedGrowth = [...(appGrowth || []), ...(earlyGrowth || [])];

        setData({
          summary: mergedSummary,
          revenue: mergedRevenue,
          doctors: mergedDoctors,
          verification: mergedVerification,
          specialties: mergedSpecialties,
          serviceGrowth: mergedGrowth,
        });
      } else {
        const [
          summary,
          revenue,
          doctors,
          verification,
          specialties,
          serviceGrowth,
        ] = await Promise.all([
          getAnalyticsSummary(type, params),
          getRevenueTrend(type, params),
          getDoctorPerformance(type, params),
          getVerificationStats(type, params),
          getSpecialtiesData(type, params),
          getServiceGrowth(type, params),
        ]);

        const normalizedSummary = {
          totalApplications:
            summary?.totalApplications ||
            summary?.totalRecords?.[0]?.total ||
            0,
          revenueSummary: {
            overallRevenue:
              summary?.revenueSummary?.overallRevenue ||
              summary?.totalRevenue?.[0]?.revenue ||
              0,
          },
          byServiceType: summary?.byServiceType || [],
          followUpStats: summary?.followUpStats || {
            totalNeeded: 0,
            totalBooked: 0,
          },
        };

        setData({
          summary: normalizedSummary,
          revenue: revenue || [],
          doctors: doctors || [],
          verification: verification || {},
          specialties: specialties || [],
          serviceGrowth: serviceGrowth || [],
        });
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [
    type,
    startDate,
    endDate,
    selectedBranch,
    JSON.stringify(appointmentStatuses),
    JSON.stringify(paymentStatuses),
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, refetch: fetchAll };
};
