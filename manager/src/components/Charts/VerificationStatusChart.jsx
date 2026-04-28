import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const VerificationStatusChart = ({ data }) => {
  const chartData = [
    {
      name: "Prescriptions",
      Verified: data.prescriptionsVerified,
      Pending: data.prescriptionsPending,
    },
    {
      name: "Conclusions",
      Verified: data.conclusionsVerified,
      Pending: data.conclusionsPending,
    },
  ];

  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <h3 className="text-lg font-semibold mb-2">Verification Status</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Verified" fill="#22c55e" />
          <Bar dataKey="Pending" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VerificationStatusChart;
