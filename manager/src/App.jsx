import { useContext, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { BranchProvider } from "./context/BranchContext";
import { LayoutTopBarProvider } from "./context/LayoutTopBarContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./i18n";
import "./App.css";
import AppLayout from "./components/AppLayout";
import DetailedReport from "./pages/DetailedReport";

// Lazy-loaded pages
const ManagerSignIn = lazy(() => import("./pages/ManagerSignIn"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Doctors = lazy(() => import("./pages/Doctors"));
const AddDoctorForm = lazy(() => import("./pages/AddDoctorForm"));
const EditDoctorForm = lazy(() => import("./pages/EditDoctorForm"));
const DoctorDetails = lazy(() => import("./pages/DoctorDetails"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientForm = lazy(() => import("./pages/PatientForm"));
const PatientDetails = lazy(() => import("./pages/PatientDetails"));
const EarlyDetectionBookings = lazy(() => import("./pages/EarlyDetectionBookings"));
const CreateEarlyDetectionBooking = lazy(() => import("./pages/CreateEarlyDetectionBooking"));
const EarlyDetectionBookingDetails = lazy(() => import("./pages/EarlyDetectionBookingDetails"));
const EarlyDetectionPaymentSuccess = lazy(() => import("./pages/EarlyDetectionPaymentSuccess"));
const EarlyDetectionPaymentFailed = lazy(() => import("./pages/EarlyDetectionPaymentFailed"));
const Messages = lazy(() => import("./pages/Messages"));
const Reports = lazy(() => import("./pages/Reports"));
const Notification = lazy(() => import("./pages/Notification"));
const WhatsApp = lazy(() => import("./pages/Whatsapp"));
const Telegram = lazy(() => import("./pages/Telegram"));
const Promos = lazy(() => import("./pages/Promos"));
const Assistants = lazy(() => import("./pages/Assistants"));
const AssistantDetails = lazy(() => import("./pages/AssistantDetails"));
const AddAssistantForm = lazy(() => import("./pages/AddAssistantForm"));
const EditAssistantForm = lazy(() => import("./pages/EditAssistantForm"));
const Analysis = lazy(() => import("./pages/Analysis"));
const AddSpecialtyForm = lazy(() => import("./pages/AddSpecialtyForm"));
const EditSpecialtyForm = lazy(() => import("./pages/EditSpecialtyForm"));
const AddVendorForm = lazy(() => import("./pages/AddVendorForm"));
const EditVendorForm = lazy(() => import("./pages/EditVendorForm"));
const VendorDetails = lazy(() => import("./pages/VendorDetails"));
const SpecialtyDetails = lazy(() => import("./pages/SpecialtyDetails"));
const MeetingRoom = lazy(() => import("./pages/MeetingRoom"));
const EmployeeManagement = lazy(() => import("./pages/EmployeeManagement"));
const InventoryManagement = lazy(() => import("./pages/InventoryManagement"));
const MaxMessenger = lazy(() => import("./pages/MaxMessenger"));
const ProjectWorkspace = lazy(() => import("./pages/ProjectWorkspace"));
const ScheduleManagement = lazy(() => import("./pages/ScheduleManagementCalendar"));
const ConsultationPage = lazy(() => import("./pages/ConsultationPage"));
const ScheduleConsultation = lazy(() => import("./pages/ScheduleConsultation"));
const DoctorProfile = lazy(() => import("./pages/DoctorProfile"));
const DoctorAppointmentsCalendar = lazy(() => import("./pages/DoctorAppointmentsCalendar"));
const DoctorTemplatesPage = lazy(() => import("./pages/DoctorTemplatesPage"));
const DoctorProfileDetails = lazy(() => import("./pages/DoctorProfileDetails"));
const Services = lazy(() => import("./pages/Services"));
const ServiceManager = lazy(() => import("./pages/ServiceManager"));
const JobPostsManagement = lazy(() => import("./pages/JobPostsManagement"));
const JobPostsApplicationsManagement = lazy(() => import("./pages/JobPostsApplicationsManagement"));
const Reviews = lazy(() => import("./pages/Reviews"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const PatientCoordinationForms = lazy(() => import("./pages/PatientCoordinationForms"));
const ComplicatedCasesForms = lazy(() => import("./pages/ComplicatedCasesForms"));
const BlogsManagement = lazy(() => import("./pages/BlogsManagement"));
const ContactViaPhone = lazy(() => import("./pages/ContactViaPhone"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const CorporateRegistration = lazy(() => import("./pages/CorporateRegistration"));

// Lazy-loaded components used as pages
const ApplicationsList = lazy(() => import("./components/Applications/ApplicationsList"));
const AddApplicationForm = lazy(() => import("./components/Applications/AddApplicationForm"));
const EditApplicationForm = lazy(() => import("./components/Applications/EditApplicationForm"));
const ApplicationDetails = lazy(() => import("./components/Applications/ApplicationDetails"));
const ApplicationDetail = lazy(() => import("./components/Applications/ApplicationDetail"));
const AppointmentDetailsPage = lazy(() => import("./pages/AppointmentDetailsPage"));
const EarlyDetection = lazy(() => import("./components/EarlyDetection/EarlyDetection"));
const EarlyDetectionApplicationDetails = lazy(() => import("./components/EarlyDetection/EarlyDetectionApplicationsDetails"));

const LoadingScreen = () => (
  <div style={{
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 16px'
      }} />
      <p style={{ color: '#64748b', fontWeight: '500' }}>Loading application...</p>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { token, isLoading } = useContext(AuthContext);
  if (isLoading) {
    return <LoadingScreen />;
  }
  return token ? children : <Navigate to="/manager-signin" />;
};

const RoleProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { token, user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!token) {
    return <Navigate to="/manager-signin" />;
  }

  if (user?.role === "super_admin") {
    return children;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    if (user?.role === "content_manager") {
      return <Navigate to="/profile" />;
    }
    return <Navigate to="/applications" />;
  }

  return children;
};

const ProtectedLayout = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  if (user?.role === "content_manager") {
    // Mapping of canManage keys to their routes
    const routeMapping = {
      messenger: ["/messenger"],
      whatsapp: ["/whatsapp"],
      telegram: ["/telegram"],
      max: ["/max"],
      notifications: ["/notifications"],
      profile: ["/profile"],
      doctors: ["/doctors-profile", "/doctors-profile/:id"],
      blogs: ["/blogs"],
      services: ["/services"],
      serviceManager: ["/service-manager"],
      vacancies: ["/vacancies", "/vacancies/:id"],
      reviews: ["/reviews"],
      promos: ["/promos"],
      contactUsForms: ["/contact-us-forms"],
      patientCoordinationForms: ["/patient-coordination-forms"],
      contactViaPhone: ["/contact-via-phone"],
      complicatedCasesForms: ["/complicated-cases-forms"],
      earlyDetectionBookings: ["/early-detection-bookings"],
    };

    // Build allowed routes based on canManage
    let allowedContentManagerRoutes = ["/profile"]; // Always allow profile

    if (user?.canManage && Array.isArray(user.canManage) && user.canManage.length > 0) {
      user.canManage.forEach((key) => {
        if (routeMapping[key]) {
          allowedContentManagerRoutes = [...allowedContentManagerRoutes, ...routeMapping[key]];
        }
      });
    }
    // If no canManage, only allow profile (removed fallback to all content/forms routes)

    const isAllowedRoute = allowedContentManagerRoutes.some((route) => {
      if (route.includes(":")) {
        const routeParts = route.split("/");
        const pathParts = location.pathname.split("/");
        if (routeParts.length !== pathParts.length) return false;
        return routeParts.every(
          (part, index) => part.startsWith(":") || part === pathParts[index]
        );
      }
      return location.pathname === route;
    });

    if (!isAllowedRoute && location.pathname !== "/profile") {
      return <Navigate to="/profile" />;
    }
  }

  return (
    <ProtectedRoute>
      <LayoutTopBarProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </LayoutTopBarProvider>
    </ProtectedRoute>
  );
};

function App() {

  return (
    <Router>
      <AuthProvider>
        <BranchProvider>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          <Routes>
            {/* Public routes wrapped in individual suspense if needed, or keeping it clean */}
            <Route
              path="/manager-signin"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <ManagerSignIn />
                </Suspense>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <ForgotPassword />
                </Suspense>
              }
            />
            <Route
              path="/reset-password"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <ResetPassword />
                </Suspense>
              }
            />
            <Route path="/" element={<Navigate to="/manager-signin" />} />

            {/* Protected routes */}
            <Route element={<ProtectedLayout />}>
              <Route
                path="/manager-dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Dashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route path="/dash" element={<Navigate to="/applications" />} />
              <Route
                path="/calendar"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Calendar />
                  </RoleProtectedRoute>
                }
              />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/applications"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ApplicationsList />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/applications/add"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AddApplicationForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/applications/edit/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EditApplicationForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/applications/details/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ApplicationDetail />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/applications/appointment/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AppointmentDetailsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patients/medical-history/:appointmentId"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ApplicationDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/early-detection"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EarlyDetection />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/early-detection/bookings"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EarlyDetectionBookings />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/early-detection-bookings"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <EarlyDetectionBookings />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/early-detection-bookings/create"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <CreateEarlyDetectionBooking />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/early-detection-bookings/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <EarlyDetectionBookingDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/early-detection/payment-success"
                element={<EarlyDetectionPaymentSuccess />}
              />
              <Route
                path="/early-detection/payment-failed"
                element={<EarlyDetectionPaymentFailed />}
              />
              <Route
                path="/early-detection/:applicationId"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EarlyDetectionApplicationDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/messenger"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <Messages />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/whatsapp"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <WhatsApp />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/telegram"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <Telegram />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/max"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <MaxMessenger />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ProjectWorkspace />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ScheduleManagement />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/consultation/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ConsultationPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/schedule-assign"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <ScheduleConsultation />
                  </RoleProtectedRoute>
                }
              />

              {/* Corporate routes */}
              <Route
                path="/doctors"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Doctors />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors/add"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AddDoctorForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors/edit/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EditDoctorForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <DoctorDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors/:email/schedule"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Schedule />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors/:email/appointments"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <DoctorAppointmentsCalendar />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors/:email/templates"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <DoctorTemplatesPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patients"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Patients />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patients/add"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <PatientForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patients/edit/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <PatientForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patients/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <PatientDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Reports />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <DetailedReport />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <Notification />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AuditLogs />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/corporate-registration"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <CorporateRegistration />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/assistants"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Assistants />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/assistants/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AssistantDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/assistants/add"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AddAssistantForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/assistants/edit/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EditAssistantForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/analysis"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <Analysis />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/specialties/add"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AddSpecialtyForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/specialties/edit/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EditSpecialtyForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/specialties/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <SpecialtyDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/vendors/add"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <AddVendorForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/vendors/edit/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <EditVendorForm />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/vendors/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <VendorDetails />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/add-employee"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "head_manager"]}>
                    <EmployeeManagement />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager"]}>
                    <InventoryManagement />
                  </RoleProtectedRoute>
                }
              />

              {/* Content routes */}
              <Route
                path="/promos"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <Promos />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors-profile"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <DoctorProfile />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/doctors-profile/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <DoctorProfile />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/blogs"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <BlogsManagement />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/services"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <Services />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/service-manager"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <ServiceManager />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/vacancies"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <JobPostsManagement />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/vacancies/:id"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <JobPostsApplicationsManagement />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/reviews"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <Reviews />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/contact-us-forms"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <ContactUs />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patient-coordination-forms"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <PatientCoordinationForms />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/complicated-cases-forms"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <ComplicatedCasesForms />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/contact-via-phone"
                element={
                  <RoleProtectedRoute allowedRoles={["super_admin", "manager", "head_manager", "content_manager"]}>
                    <ContactViaPhone />
                  </RoleProtectedRoute>
                }
              />
            </Route>

            {/* Meeting room - outside layout, no sidebar/header */}
            <Route
              path="/meeting-room"
              element={
                <ProtectedRoute>
                  <MeetingRoom />
                </ProtectedRoute>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/manager-signin" />} />
          </Routes>
        </BranchProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
