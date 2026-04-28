// src/App.jsx
import { useEffect, useState, useContext, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Layout from "./components/Layout";
import { WebSocketProvider } from "./utils/WebSocketContext";
import { TabProvider } from "./context/TabContext";
import { PatientProvider } from "./context/PatientContext";
import NetworkGuard from "./NetworkGuard";
import { getToken, isTokenExpired } from "./utils/auth";
import axios from "axios";
import { getAssistant } from "./utils/api";
import "./App.css";
import { AuthContext } from "./context/AuthContext";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";

// Lazy-loaded pages
const Dashboard                      = lazy(() => import("./pages/Dashboard"));
const Appointments                   = lazy(() => import("./pages/Appointments"));
const Patients                       = lazy(() => import("./pages/Patients"));
const Calendar                       = lazy(() => import("./pages/Calendar"));
const Schedule                       = lazy(() => import("./pages/Schedule"));
const Messages                       = lazy(() => import("./pages/Messages"));
const Profile                        = lazy(() => import("./pages/Profile"));
const ProjectWorkspace               = lazy(() => import("./pages/ProjectWorkspace"));
const PatientDetails                 = lazy(() => import("./pages/PatientDetails"));
const MedicalHistoryDetail           = lazy(() => import("./components/PatientDetails/MedicalHistoryDetail"));
const AppointmentDetails             = lazy(() => import("./pages/AppointmentDetails"));
const AppointmentDetailsPage         = lazy(() => import("./pages/AppointmentDetailsPage"));
const EarlyDetectionBookingDetails = lazy(() => import("./pages/EarlyDetectionBookingDetails"));
const AssistantLogin                 = lazy(() => import("./pages/AssitantLogin"));
const EarlyDetection                 = lazy(() => import("./pages/EarlyDetection"));
const MySpace                        = lazy(() => import("./pages/MySpace"));
const ResetPassword                  = lazy(() => import("./pages/ResetPassword"));
const ScheduleManagement             = lazy(() => import("./pages/ScheduleManagement"));
const StockManagement                = lazy(() => import("./pages/StockManagement"));
const InventoryManagement            = lazy(() => import("./pages/InventoryManagement"));
const StockRequest                   = lazy(() => import("./pages/StockRequest"));
const ApplicationDetail              = lazy(() => import("./pages/ApplicationDetail"));
const MeetingRoom                    = lazy(() => import("./pages/MeetingRoom"));

const PageLoader = () => (
  <div className="flex justify-center items-center h-screen">Loading...</div>
);

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
    return <Navigate to="/appointments" replace />;
  }

  return <Outlet />;
};

// Special route for password reset that doesn't require authentication
const ResetPasswordRoute = () => {
  const { isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return <Outlet />;
};

const HeadAssistantRoute = () => {
  const { user } = useContext(AuthContext);

  if (user.role !== "head_assistant") {
    return <Navigate to="/appointments" replace />
  }
  
  return <Outlet />;
}

function App() {
  return (
    <WebSocketProvider>
      <TabProvider>
        <PatientProvider>
          <NetworkGuard>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path="/" element={<AssistantLogin />} />
              </Route>

              {/* Password Reset Route (doesn't require authentication) */}
              <Route element={<ResetPasswordRoute />}>
                {/* Update this route to accept token as parameter */}
                <Route
                  path="/reset-password/:token"
                  element={<ResetPassword />}
                />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/calendar" element={<Calendar />} />
                  {/* <Route path="/schedule-appointments" element={<Schedule />} /> */}
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/early-detection" element={<EarlyDetection />} />
                  <Route path="/stock-request" element={<StockRequest />} />
                  <Route path="/tasks" element={<ProjectWorkspace />} />

                  <Route element={<HeadAssistantRoute />}>
                    <Route path="/stock-management" element={<InventoryManagement />} />
                    <Route path="/schedule-management" element={<ScheduleManagement />} />
                    <Route path="/schedule-appointments" element={<Schedule />} />
                  </Route>

                  <Route
                    path="/early-detection/:id"
                    element={<EarlyDetectionBookingDetails />}
                  />
                  <Route path="/my-space" element={<MySpace />} />
                  <Route path="/patients/:id" element={<PatientDetails />} />
                  <Route
                    path="/patients/medical-history/:id"
                    element={<MedicalHistoryDetail />}
                  />
                  <Route
                    path="/appointments/:id"
                    element={<AppointmentDetailsPage />}
                  />
                </Route>
                <Route path="/meeting-room" element={<MeetingRoom />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </NetworkGuard>
        </PatientProvider>
      </TabProvider>
    </WebSocketProvider>
  );
}

export default App;
