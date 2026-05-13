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
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (selectedBranch && selectedBranch !== "All") {
        params.branch = selectedBranch;
      }

      if (appointmentStatuses?.length)
        params.appointmentStatus = appointmentStatuses.join(",");
      if (paymentStatuses?.length)
        params.paymentStatus = paymentStatuses.join(",");

      const ok = (r) => (r?.status === "fulfilled" ? r.value : null);

      // Only early-detection analytics endpoints exist on the backend.
      // Use early-detection for both "all" and "early-detection" types.
      const fetchType = "early-detection";
      {
        const results = await Promise.allSettled([
          getAnalyticsSummary(fetchType, params),
          getRevenueTrend(fetchType, params),
          getDoctorPerformance(fetchType, params),
          getVerificationStats(fetchType, params),
          getSpecialtiesData(fetchType, params),
          getServiceGrowth(fetchType, params),
        ]);
        const [
          summary, revenue, doctors, verification, specialties, serviceGrowth,
        ] = results.map(ok);

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
