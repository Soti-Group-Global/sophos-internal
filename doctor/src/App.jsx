import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useContext } from "react";

import DoctorLogin from "./pages/DoctorLogin";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import Patients from "./pages/Patients";
import Schedule from "./pages/Schedule";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";
import { WebSocketProvider } from "./utils/WebSocketContext";
import { TabProvider } from "./context/TabContext";
import { PatientProvider } from "./context/PatientContext";
import PatientDetails from "./pages/PatientDetails";
import MedicalHistoryDetail from "./components/PatientDetails/MedicalHistoryDetail";
import AppointmentDetails from "./pages/AppointmentDetails";
import NetworkGuard from "./NetworkGuard";
import EarlyDetection from "./pages/EarlyDetection";
import Assistants from "./pages/Assistants";
import EarlyDetectionApplicationsDetails from "./pages/EarlyDetectionApplicationsDetails";
import EarlyDetectionBookingDetails from "./pages/EarlyDetectionBookingDetails";
import ResetPassword from "./pages/ResetPassword";
import { AuthContext } from "./context/AuthContext";
import MedicalHistory from "./pages/MedicalHistory";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import MeetingRoom from "./pages/meetingRoom";


// check login state using refresh token
const ProtectedRoute = () => {
  const { refreshToken, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (!refreshToken) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const PublicRoute = () => {
  const { refreshToken, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (refreshToken) {
    // user is already signed in — send them to their appointments by default
    return <Navigate to="/appointments" replace />;
  }

  return <Outlet />;
};

// Special route for password reset (always public)
const ResetPasswordRoute = () => <Outlet />;

function App() {
  return (
    <WebSocketProvider>
      <TabProvider>
        <PatientProvider>
          <NetworkGuard>
            <Routes>
              {/* Public (login only if not already authenticated) */}
              <Route element={<PublicRoute />}>
                <Route path="/" element={<DoctorLogin />} />
              </Route>

              {/* Password Reset Route (doesn't require authentication) */}
              <Route element={<ResetPasswordRoute />}>
                <Route
                  path="/reset-password/:token"
                  element={<ResetPassword />}
                />
              </Route>

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/assistants" element={<Assistants />} />
                  <Route path="/early-detection" element={<EarlyDetection />} />
                  <Route
                    path="/early-detection-bookings/:id"
                    element={<EarlyDetectionBookingDetails />}
                  />
                  <Route path="/meeting-room" element={<MeetingRoom />} />
                  <Route path="/tasks" element={<ProjectWorkspace />} />
                  <Route
                    path="/early-detection/:id"
                    element={<EarlyDetectionApplicationsDetails />}
                  />
                  <Route path="/patients/:id" element={<PatientDetails />} />
                  <Route
                    path="/patients/medical-history/:id"
                    element={<MedicalHistoryDetail />}
                  />
                  <Route
                    path="/appointments/:id"
                    element={<AppointmentDetails />}
                  />
                  <Route
                    path="/medical-history/:patientEmail"
                    element={<MedicalHistory />}
                  />
                </Route>
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NetworkGuard>
        </PatientProvider>
      </TabProvider>
    </WebSocketProvider>
  );
}

export default App;
