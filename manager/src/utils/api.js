import axios from "axios";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";

const api = axios.create({
  baseURL: "http://localhost:3003/api",
  withCredentials: false,
});

let refreshPromise = null;

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("Missing refresh token");

  const response = await axios.post(
    `${api.defaults.baseURL}/auth/refresh-token`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" } }
  );

  const token = response.data?.token;
  if (!token) throw new Error("No token returned from refresh");

  localStorage.setItem("token", token);
  if (response.data?.refreshToken) {
    localStorage.setItem("refreshToken", response.data.refreshToken);
  }
  if (response.data?.user) {
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }

  return token;
};

/* ---------------- Request Interceptor ---------------- */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      // Use Bearer token format
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // Handle Content-Type automatically
    if (!config.headers["Content-Type"]) {
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      } else {
        config.headers["Content-Type"] = "application/json";
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ---------------- Response Interceptor ---------------- */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthRoute =
      originalRequest?.url?.includes("/auth/manager-signin") ||
      originalRequest?.url?.includes("/auth/refresh-token");
    
    // Don't logout for Max Messenger third-party API errors (any status code)
    const isMaxMessengerRoute = 
      originalRequest?.url?.includes("/max/");

    // If it's a Max Messenger route with any error, don't trigger logout
    if (isMaxMessengerRoute) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !isAuthRoute) {
      if (originalRequest._retry) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setTimeout(() => {
          window.location.href = "/manager-signin";
        }, 100);
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setTimeout(() => {
          window.location.href = "/manager-signin";
        }, 100);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Get all orders
export const getOrders = async (params = {}) => {
  try {
    const response = await api.get("/orders", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getAuditLogs = async (params = {}) => {
  try {
    const response = await api.get("/audit-logs", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get orders by vendor ID
export const getOrdersByVendorId = async (vendorId) => {
  try {
    const response = await api.get(`/orders/vendor/${vendorId}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Create a single order
export const createOrder = async (data) => {
  try {
    const response = await api.post("/orders", data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/* ---------------- Meetings ---------------- */
export const meetingCreateOrJoin = async (payload) => {
  try {
    const res = await api.post("/meetings/create-or-join", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const meetingJoinByUser = async (payload) => {
  try {
    const res = await api.post("/meetings/join-by-user", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const meetingCreateDoctorRoom = async (doctorId) => {
  try {
    const res = await api.post(`/meetings/doctor/${doctorId}/create-room`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const meetingJoinDoctorRoom = async (doctorId, body = {}) => {
  try {
    const res = await api.post(`/meetings/doctor/${doctorId}/join`, body);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const meetingJoinToken = async (payload) => {
  try {
    const res = await api.post("/meetings/join-token", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const fetchRecordings = async (roomIds, from = 0, limit = 20, orderBy = "DESC") => {
  try {
    const res = await api.post("/meetings/recordings/fetch", {
      room_ids: roomIds,
      from,
      limit,
      order_by: orderBy,
    });
    return res.data;
  } catch (error) {
    throw error;
  }
};

/* ------------- BBB Telemedicine ------------- */
export const telemedicineCreateRoom = async (applicationId) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/create`);
  return res.data;
};

export const telemedicineJoinRoom = async (applicationId, body = {}) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/join`, body);
  return res.data;
};

export const telemedicineEndRoom = async (applicationId) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/end`);
  return res.data;
};

export const telemedicineGetStatus = async (applicationId) => {
  const res = await api.get(`/telemedicine/${encodeURIComponent(applicationId)}/status`);
  return res.data;
};

// Create multiple orders
export const createBulkOrders = async (data) => {
  try {
    const response = await api.post("/orders/bulk", data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update order status
export const updateOrderStatus = async (id, status, additionalData = {}) => {
  try {
    const response = await api.patch(`/orders/${id}/status`, {
      status,
      ...additionalData,
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Upload test result
export const uploadTestResult = async (testId, formData) => {
  try {
    const response = await api.post(
      `/orders/${testId}/upload-result`,
      formData
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get test result file
export const getTestResultFile = async (fileId) => {
  try {
    const response = await api.get(`/orders/results/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get available tests from specialties
export const getAvailableTests = async () => {
  try {
    const response = await api.get("/specialties", {
      params: { page: 1, limit: 100 },
    });
    const specialties = response.data.specialties || [];
    const tests = specialties.flatMap((specialty) =>
      (specialty.tests || []).map((test) => ({
        _id: test._id,
        name: test.name,
        specialtyName: specialty.name,
      }))
    );
    return tests;
  } catch (error) {
    
    throw error;
  }
};

// Get doctor fees by ID
export const getDoctorFees = async (doctorId) => {
  try {
    const response = await api.get(`/doctors/${doctorId}/fees`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add managers
export const addManager = async (formData) => {
  const response = await api.post("/auth", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateManager = async (id, formData) => {
  const response = await api.put(`/auth/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteManager = async (id) => {
  const response = await api.delete(`/auth/${id}`);
  return response.data;
};

// Manager login
export const managerSignin = async (data) => {
  try {
    const response = await api.post("/auth/manager-signin", data);
    return response;
  } catch (error) {
    throw error;
  }
};

export const forgotPassword = async (data) => {
  try {
    const response = await api.post("/auth/forgot-password", data);
    return response;
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (data) => {
  try {
    const response = await api.post("/auth/reset-password", data);
    return response;
  } catch (error) {
    throw error;
  }
};

// Get all managers
export const getManagers = async () => {
  try {
    const responce = await api.get("/auth");
    return responce.data;
  } catch (error) {
  }
};

// Get current manager profile (token-based)
export const getProfile = async () => {
  try {
    const response = await api.get("/profile");
    return response;
  } catch (error) {
    throw error;
  }
};

// Update manager profile (token-based)
export const updateProfile = async (formData) => {
  try {
    const response = await api.put("/profile", formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Change password
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await api.put("/profile/change-password", {
      currentPassword,
      newPassword,
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Add doctor
export const addDoctor = async (formData) => {
  try {
    const response = await api.post("/doctors", formData);
    return response;
  } catch (error) {
    throw error;
  }
};

// Get doctor profile image
export const getDoctorProfileImage = async (fileId) => {
  try {
    const response = await api.get(`/doctors/profile-image/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get patient profile image
export const getPatientProfileImage = async (fileId) => {
  try {
    const response = await api.get(`/patients/profile-image/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get vendor profile image
export const getVendorProfileImage = async (fileId) => {
  try {
    const response = await api.get(`/vendors/profile-image/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get all doctors (filtered by branch name)
export const getDoctors = async (branchName, filters = {}) => {
  try {
    const params = {
      ...(branchName ? { branch: branchName } : {}),
      ...filters,
    };
    const response = await api.get("/doctors-profile/get-doctors", {
      params,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getEarlyDetectionDoctors = async (branchName) => {
  try {
    const response = await api.get("/doctors-profile/early-detection", {
      params: {
        ...(branchName ? { branch: branchName } : {}),
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get all doctors
export const getAllDoctors = async () => {
  try {
    const response = await api.get("/doctors/all");

    return response.data.doctors || [];
  } catch (error) {
    
    throw error;
  }
};

// Get doctor by ID
export const getDoctorById = async (id) => {
  try {
    const response = await api.get(`/doctors/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get doctor by email
export const getDoctorByEmail = async (email) => {
  try {
    const response = await api.get(
      `/doctors-profile/by-email/${encodeURIComponent(email)}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update doctor
export const updateDoctor = async (id, formData) => {
  try {
    const response = await api.put(`/doctors/${id}`, formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Delete doctor
export const deleteDoctor = async (id) => {
  try {
    const response = await api.delete(`/doctors/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Post availability (save a new slot for a specific doctor)
export const postAvailability = async (doctorEmail, data) => {
  try {
    const response = await api.post("/availability/availability", {
      doctorEmail,
      ...data,
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get availability within date range for a specific doctor
export const getAvailability = async (doctorEmail, start, end) => {
  try {
    const response = await api.get("/availability/availability", {
      params: { doctorEmail: doctorEmail.toLowerCase(), start, end },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete availability for a specific doctor
export const deleteAvailability = async (availabilityId, doctorEmail) => {
  try {
    const response = await api.delete(
      `/availability/availability/${availabilityId}`,
      {
        params: { doctorEmail: doctorEmail.toLowerCase() },
      }
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

export const getEmployeeAvailability = async (params) => {
  return await api.get(`/employees/availability`, { params });
};

// Add patient
export const addPatient = async (formData) => {
  try {
    const response = await api.post("/patients", formData);
    return response;
  } catch (error) {
    throw error;
  }
};

// Update patient
export const updatePatient = async (id, formData) => {
  try {
    const response = await api.put(`/patients/${id}`, formData, {
      timeout: 15000,
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Patch patient – partial update (GeneralInformationTab fields)
export const patchPatient = async (id, data) => {
  try {
    const response = await api.patch(`/patients/${id}`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

// Delete patient
export const deletePatient = async (id) => {
  try {
    const response = await api.delete(`/patients/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get all patients
export const getPatients = async () => {
  try {
    const response = await api.get("/patients");
    // Backend returns { patients: [...] }
    return response.data.patients || response.data;
  } catch (error) {
    throw error;
  }
};

// Get patient by ID
export const getPatient = async (id) => {
  try {
    const response = await api.get(`/patients/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Get patient by email
export const getPatientByEmail = async (email) => {
  try {
    const response = await api.get(
      `/patients/by-email/${encodeURIComponent(email)}`
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Send email to patient
export const sendPatientEmail = async (patientId, emailData) => {
  try {
    const response = await api.post(
      `/patients/${patientId}/emails/send`,
      emailData
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get user ID by email
export const getUserIdByEmail = async (email) => {
  try {
    const response = await api.get(
      `/applications/user-id/${encodeURIComponent(email)}`
    );
    return response.data?.userId || response.data || null;
  } catch (error) {
    
    throw error;
  }
};

// Get all applications
export const getApplications = async (params = {}) => {
  try {
    const response = await api.get("/applications", { params });
    return response;
  } catch (error) {
    
    throw error;
  }
};

//Get All applications by patient ID
export const getApplicationsByPatientId = async (patientId) => {
  try {
    const encodedPatientId = encodeURIComponent(patientId);
    const response = await api.get(`/applications/by-patient-id/${encodedPatientId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Get all applications
export const getApplicationsCalender = async (params = {}) => {
  try {
    const response = await api.get("/availability/calender", { params });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get application by ID
export const getApplication = async (id) => {
  try {
    const response = await api.get(`/applications/${encodeURIComponent(id)}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

export const getDoctorAppointmentsByDate = async (doctorEmail, date) => {
  return await api.get(`/employees/applicationsByDate`, {
    params: { doctorEmail, date },
  });
};

// Get application counts per day for a given month { "YYYY-MM-DD": count }
export const getApplicationCountsByMonth = async (year, month) => {
  try {
    const response = await api.get("/applications/countsByMonth", {
      params: { year, month },
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// Get applications by date for calendar view
export const getApplicationsByDate = async (date) => {
  try {
    const response = await api.get("/applications/applicationsByDate", {
      params: { date },
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get doctor breaks for a specific date
export const getDoctorBreaks = async (doctorEmail, date) => {
  try {
    const response = await api.get(`/doctors/breaks/${doctorEmail}/${date}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Update or create doctor breaks
export const saveDoctorBreaks = async (data) => {
  try {
    const response = await api.post("/doctors/breaks", data);
    return response;
  } catch (error) {
    throw error;
  }
};

// Delete doctor breaks for a specific date
export const deleteDoctorBreaks = async (doctorEmail, date) => {
  try {
    const response = await api.delete(`/doctors/breaks/${doctorEmail}/${date}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Create a doctor leave (admin-issued or self-requested)
export const createDoctorLeave = async (data) => {
  try {
    const response = await api.post("/doctor-leaves", data);
    return response;
  } catch (error) {
    throw error;
  }
};

// Get doctor leaves
export const getDoctorLeaves = async (params = {}) => {
  try {
    const response = await api.get("/doctor-leaves", { params });
    return response;
  } catch (error) {
    throw error;
  }
};

// Update doctor leave status
export const updateDoctorLeaveStatus = async (id, status, reviewComment = "") => {
  try {
    const response = await api.patch(`/doctor-leaves/${id}/status`, { status, reviewComment });
    return response;
  } catch (error) {
    throw error;
  }
};

// Delete doctor leave
export const deleteDoctorLeave = async (id) => {
  try {
    const response = await api.delete(`/doctor-leaves/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Add application
export const addApplication = async (data) => {
  try {
    const response = await api.post("/applications", data);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update application
export const updateApplication = async (id, data) => {
  try {
    const response = await api.put(
      `/applications/${encodeURIComponent(id)}`,
      data
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Save follow-up data for an application
export const saveFollowUp = async (id, followUpData) => {
  try {
    const response = await api.patch(
      `/applications/${encodeURIComponent(id)}/follow-up`,
      followUpData
    );
    return response.data;
  } catch (error) {
    // Fallback: use the general PUT endpoint
    const response = await api.put(
      `/applications/${encodeURIComponent(id)}`,
      { followUp: followUpData }
    );
    return response.data;
  }
};

export const updateHistoryForm = async (id, historyForm) => {
  try {
    const response = await api.patch(
      `/applications/${encodeURIComponent(id)}/history`,
      { historyForm }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

export const updateHistoryFieldVerify = async (id, fieldKey, isVerified) => {
  try {
    const response = await api.patch(
      `/applications/${encodeURIComponent(id)}/history/${fieldKey}/verify`,
      { isVerified }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/* ── History Templates ─────────────────────────────────────────
   Doctors create reusable templates per historyForm field.
   Admins/managers may pass doctorEmail to manage any doctor's templates.
─────────────────────────────────────────────────────────────── */

/** Fetch all templates for the given doctor. Pass fieldKey to filter. */
export const getHistoryTemplates = async (fieldKey, doctorEmail) => {
  const params = {};
  if (fieldKey) params.fieldKey = fieldKey;
  if (doctorEmail) params.doctorEmail = doctorEmail;
  const response = await api.get("/history-templates", { params });
  return response.data;
};

/** Create a new template. data = { fieldKey, name, content, doctorEmail? } */
export const createHistoryTemplate = async (data) => {
  const response = await api.post("/history-templates", data);
  return response.data;
};

/** Update an existing template. data = { name?, content?, doctorEmail? } */
export const updateHistoryTemplate = async (id, data) => {
  const response = await api.put(`/history-templates/${id}`, data);
  return response.data;
};

/** Delete a template by id. Pass doctorEmail for admin scoping. */
export const deleteHistoryTemplate = async (id, doctorEmail) => {
  const params = doctorEmail ? { doctorEmail } : {};
  const response = await api.delete(`/history-templates/${id}`, { params });
  return response.data;
};

// Add comment to application
export const addComment = async (id, data) => {
  try {
    const response = await api.post(`/applications/${id}/comments`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

// Update comment
export const updateComment = async (commentId, data) => {
  try {
    const response = await api.put(`/applications/comments/${commentId}`, data);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Add payment to application
export const addPayment = async (applicationId, paymentData) => {
  try {
    const response = await api.post(
      `/applications/${applicationId}/payments`,
      paymentData
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getPayments = async (applicationId) => {
  try {
    const response = await api.get(`/applications/${encodeURIComponent(applicationId)}/payments`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createPayment = async (applicationId, data) => {
  try {
    const response = await api.post(`/applications/${encodeURIComponent(applicationId)}/payments`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const markPaymentPaid = async (applicationId, paymentId) => {
  try {
    const response = await api.put(`/applications/${encodeURIComponent(applicationId)}/payments/${paymentId}/mark-paid`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const markPaymentFree = async (applicationId, paymentId) => {
  try {
    const response = await api.put(`/applications/${encodeURIComponent(applicationId)}/payments/${paymentId}/mark-free`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const cancelPaymentRecord = async (applicationId, paymentId) => {
  try {
    const response = await api.put(`/applications/${encodeURIComponent(applicationId)}/payments/${paymentId}/cancel`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const openPaymentInvoice = async (applicationId, paymentId) => {
  try {
    const response = await api.get(
      `/applications/${encodeURIComponent(applicationId)}/payments/${paymentId}/invoice`
    );
    const win = window.open("", "_blank");
    if (win) { win.document.write(response.data); win.document.close(); }
  } catch (error) {
    throw error;
  }
};

export const openPaymentAkt = async (applicationId, paymentId) => {
  try {
    const response = await api.get(
      `/applications/${encodeURIComponent(applicationId)}/payments/${paymentId}/akt`
    );
    const win = window.open("", "_blank");
    if (win) { win.document.write(response.data); win.document.close(); }
  } catch (error) {
    throw error;
  }
};

// Generate payment link
export const generatePaymentLink = async (id, data) => {
  try {
    const response = await api.post(`/applications/${id}/payments/link`, data);
    return response;
  } catch (error) {
    
    throw error;
  }
};

/* ---------------- Early Detection ---------------- */
// Create manual booking
export const createManualEarlyDetectionBooking = async (bookingData) => {
  try {
    const res = await api.post("/early-detection/form/bookings/manual", bookingData);
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete an early detection booking by ID
export const deleteEarlyDetectionBooking = async (id) => {
  try {
    const res = await api.delete(`/early-detection/form/bookings/${id}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

// Get all bookings
export const getEarlyDetectionBookings = async () => {
  try {
    const res = await api.get("/early-detection/form/bookings");
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Get user bookings by email
export const getUserEarlyDetectionBookings = async (email) => {
  try {
    const res = await api.get(`/early-detection/form/user-bookings/${email}`);
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Update booking status
export const updateEarlyDetectionBookingStatus = async (bookingId, data) => {
  try {
    const res = await api.put(
      `/early-detection/form/bookings/${bookingId}/status`,
      data
    );
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Update booking details
export const updateEarlyDetectionBooking = async (bookingId, bookingData) => {
  try {
    const res = await api.put(
      `/early-detection/form/bookings/${bookingId}`,
      bookingData
    );
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Add internal note to booking
export const addEarlyDetectionBookingNote = async (bookingId, noteData) => {
  try {
    const res = await api.post(
      `/early-detection/form/bookings/${bookingId}/notes`,
      noteData
    );
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Update internal note
export const updateEarlyDetectionBookingNote = async (bookingId, noteId, noteData) => {
  try {
    const res = await api.put(
      `/early-detection/form/bookings/${bookingId}/notes/${noteId}`,
      noteData
    );
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete internal note
export const deleteEarlyDetectionBookingNote = async (bookingId, noteId) => {
  try {
    const res = await api.delete(
      `/early-detection/form/bookings/${bookingId}/notes/${noteId}`
    );
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Update payment status
export const updateEarlyDetectionPaymentStatus = async (bookingId, data) => {
  try {
    const res = await api.put(
      `/early-detection/form/bookings/${bookingId}/payment-status`,
      data
    );
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Create booking manually
export const createEarlyDetectionBooking = async (data) => {
  try {
    const res = await api.post("/early-detection/form/bookings/manual", data);
    return res.data;
  } catch (error) {
    
    throw error;
  }
};

// Add these functions to your API utility

export const generateEDPaymentLink = async (bookingId, notes = '', paymentMethod = 'tbank', overrides = {}) => {
  try {
    const response = await api.post(
      `/early-detection/form/bookings/${bookingId}/generate-payment-link`,
      { notes, paymentMethod, ...overrides }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const validatePaymentLink = async (bookingId) => {
  try {
    const response = await api.get(
      `/early-detection/form/bookings/${bookingId}/validate-payment-link`
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Managed tests (Medical History -> Laboratory / Instrumental)
export const getEarlyDetectionReport = async (bookingId) => {
  const res = await api.get(`/early-detection/report/${bookingId}`);
  return res.data;
};

export const saveEarlyDetectionReport = async (bookingId, payload) => {
  const res = await api.put(`/early-detection/report/${bookingId}`, payload);
  return res.data;
};

export const getEarlyDetectionTemplates = async (fieldKey) => {
  const params = fieldKey ? { fieldKey } : {};
  const res = await api.get("/early-detection/templates", { params });
  return res.data;
};

export const createEarlyDetectionTemplate = async (data) => {
  const res = await api.post("/early-detection/templates", data);
  return res.data;
};

export const updateEarlyDetectionTemplate = async (id, data) => {
  const res = await api.put(`/early-detection/templates/${id}`, data);
  return res.data;
};

export const deleteEarlyDetectionTemplate = async (id) => {
  const res = await api.delete(`/early-detection/templates/${id}`);
  return res.data;
};

export const getEarlyDetectionManagedTests = async (section) => {
  try {
    const res = await api.get(`/early-detection/form/bookings/tests/${section}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const createEarlyDetectionManagedTest = async (section, payload) => {
  try {
    const res = await api.post(`/early-detection/form/bookings/tests/${section}`, payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const updateEarlyDetectionManagedTest = async (section, testId, payload) => {
  try {
    const res = await api.put(`/early-detection/form/bookings/tests/${section}/${testId}`, payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const deleteEarlyDetectionManagedTest = async (section, testId) => {
  try {
    const res = await api.delete(`/early-detection/form/bookings/tests/${section}/${testId}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const uploadEarlyDetectionScheduleFile = async (
  bookingId,
  { section, itemId, file, customName },
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (itemId) formData.append("itemId", itemId);
  if (customName) formData.append("customName", customName);

  try {
    const res = await api.post(
      `/early-detection/form/bookings/${bookingId}/schedule/${section}/upload`,
      formData,
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getEarlyDetectionScheduleFileUrl = (fileId, download = false) => {
  const normalizedId = String(fileId || '').trim();
  if (!normalizedId) return '';
  return `${api.defaults.baseURL}/early-detection/form/bookings/files/${normalizedId}${download ? '?download=1' : ''}`;
};

export const saveEarlyDetectionSpecialistHistoryForm = async (bookingId, idx, historyForm) => {
  const response = await api.put(
    `/early-detection/form/bookings/${bookingId}/specialist/${idx}`,
    { historyForm },
  );
  return response.data;
};

export const addEarlyDetectionTestEntryNote = async (bookingId, section, itemId, content) => {
  const response = await api.post(
    `/early-detection/form/bookings/${bookingId}/schedule/${section}/items/${itemId}/notes`,
    { content },
  );
  return response.data;
};

export const updateEarlyDetectionTestEntryNote = async (bookingId, section, entryId, noteId, content) => {
  const response = await api.put(
    `/early-detection/form/bookings/${bookingId}/schedule/${section}/entries/${entryId}/notes/${noteId}`,
    { content },
  );
  return response.data;
};

export const deleteEarlyDetectionTestEntryNote = async (bookingId, section, entryId, noteId) => {
  const response = await api.delete(
    `/early-detection/form/bookings/${bookingId}/schedule/${section}/entries/${entryId}/notes/${noteId}`,
  );
  return response.data;
};

// Mark payment as paid
export const markPaymentAsPaid = async (applicationId, paymentId) => {
  try {
    const response = await api.put(
      `/applications/${applicationId}/payments/${paymentId}/mark-paid`
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Mark payment as free
export const markPaymentAsFree = async (applicationId, paymentId) => {
  try {
    const response = await api.put(
      `/applications/${applicationId}/payments/${paymentId}/mark-free`
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

export const addDocument = async (id, data) => {
  try {
    if (data.file) {
      // --- File upload ---
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("filename", data.file.name);

      const response = await api.post(
        `/applications/${encodeURIComponent(id)}/documents/file`,
        formData
      );

      return response;
    }

    if (data.url) {
      // --- URL upload ---
      const response = await api.post(
        `/applications/${encodeURIComponent(id)}/documents/url`,
        {
          url: data.url,
          filename: data.filename || "Cloud Link",
        }
      );

      return response;
    }

    throw new Error("Either file or URL must be provided");
  } catch (error) {
    throw error;
  }
};

// --- File Upload ---
export const uploadDocumentFile = async (id, file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", file.name);

    const response = await api.post(
      `/applications/${encodeURIComponent(id)}/documents/file`,
      formData
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

// --- URL Upload ---
export const uploadDocumentUrl = async (id, url, filename = "Cloud Link") => {
  return api.post(`/applications/${encodeURIComponent(id)}/documents/url`, {
    url,
    filename,
  });
};

// Delete document from application
export const deleteDocument = async (applicationId, filename) => {
  try {
    const response = await api.delete(
      `/applications/${encodeURIComponent(applicationId)}/documents/${filename}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Send email for application
export const sendEmail = async (applicationId, data) => {
  try {
    const response = await api.post(
      `/applications/${applicationId}/emails/send`,
      data
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// Get next sequence number
export const getNextSequence = async (name) => {
  try {
    const response = await api.get(`/counter/${name}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get messages for manager
export const getMessages = async (email) => {
  try {
    const response = await api.get(
      `/messages/messages/${encodeURIComponent(email)}`
    );
    return response.data;
  } catch (err) {
    
    throw new Error(
      err.response?.data?.message ||
      `Failed to fetch messages (Status: ${err.response?.status || "Unknown"
      })`
    );
  }
};

// Send a new message
export const sendMessage = async (data) => {
  try {
    const response = await api.post("/messages/messages", data);
    return response.data;
  } catch (err) {
    
    throw new Error(
      err.response?.data?.message ||
      `Failed to send message (Status: ${err.response?.status || "Unknown"})`
    );
  }
};

// Delete a message
export const deleteMessage = async (email, messageId) => {
  try {
    const response = await api.delete(
      `/messages/messages/${encodeURIComponent(email)}/${messageId}`
    );
    return response.data;
  } catch (err) {
    
    throw new Error(
      err.response?.data?.message ||
      `Failed to delete message (Status: ${err.response?.status || "Unknown"
      })`
    );
  }
};

// Upload file for messaging
export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/messages/messages/upload", formData);
    return response.data;
  } catch (err) {
    
    throw new Error(
      err.response?.data?.message ||
      `Failed to upload file (Status: ${err.response?.status || "Unknown"})`
    );
  }
};

// Get message file by ID
export const getMessageFile = async (fileId) => {
  try {
    const response = await api.get(`/messages/file-by-id/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (err) {
    
    throw new Error(
      err.response?.data?.message ||
      `Failed to fetch file (Status: ${err.response?.status || "Unknown"})`
    );
  }
};

// Get media file by ID
export const getMedia = async (mediaId) => {
  try {
    const response = await api.get(`/applications/media/${mediaId}/media`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// View document in a new browser tab
export const viewDocument = async (docId) => {
  const response = await api.get(`/applications/media/${docId}/media`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke after a short delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// Download document to user's device
export const downloadDocument = async (docId, filename = "document") => {
  const response = await api.get(`/applications/media/${docId}/media`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Get medical history by email
export const getMedicalHistoryByEmail = async (email) => {
  try {
    const res = await api.get(
      `/applications/medical-history/by-email/${encodeURIComponent(email)}`
    );
    const appointments = res.data;

    const updatedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        if (appointment.doctor && appointment.doctor._id) {
          const doctorResponse = await api.get(
            `/doctors/${appointment.doctor._id}`
          );
          appointment.doctor = doctorResponse.data.doctor;
        }
        return appointment;
      })
    );

    return updatedAppointments;
  } catch (error) {
    
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Unknown error",
    };
  }
};

// Get WhatsApp chats
export const getWhatsAppChats = async () => {
  try {
    const response = await api.get("/whatsapp/chats");
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Filter WhatsApp chats by client name
export const filterWhatsAppChats = async (clientName) => {
  try {
    const response = await api.get("/whatsapp/chats/filter", {
      params: { client_name: clientName },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Send WhatsApp message
export const sendWhatsAppMessage = async (to, message) => {
  try {
    const response = await api.post("/whatsapp/send", { to, message });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get WhatsApp chat messages
export const getWhatsAppMessages = async (chatId) => {
  try {
    const response = await api.get("/whatsapp/chat/messages", {
      params: { chat_id: chatId },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get WhatsApp media
export const getWhatsAppMedia = async (messageId, profileId) => {
  try {
    const response = await api.get("/whatsapp/media", {
      params: { message_id: messageId, profile_id: profileId },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Send WhatsApp document
export const sendWhatsAppDocument = async (
  to,
  fileName,
  fileData,
  fileType
) => {
  try {
    const response = await api.post("/whatsapp/document/send", {
      to,
      file_name: fileName,
      file_data: fileData,
      file_type: fileType,
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Send WhatsApp message with payment details
export const sendWhatsAppPayment = async (data) => {
  try {
    const response = await api.post("/whatsapp/send-wp", data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get Telegram chats
export const getTelegramChats = async () => {
  try {
    const response = await api.get("/telegram/chats");
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Filter Telegram chats by client name
export const filterTelegramChats = async (clientName) => {
  try {
    const response = await api.get("/telegram/chats/filter", {
      params: { client_name: clientName },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Send Telegram message
export const sendTelegramMessage = async (chatId, message) => {
  try {
    const response = await api.post("/telegram/send", {
      chat_id: chatId,
      message,
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get Telegram chat messages
export const getTelegramMessages = async (chatId) => {
  try {
    const response = await api.get("/telegram/chat/messages", {
      params: { chat_id: chatId },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get Telegram media
export const getTelegramMedia = async (messageId, profileId) => {
  try {
    const response = await api.get("/telegram/media", {
      params: { message_id: messageId, profile_id: profileId },
      responseType: "json",
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Send Telegram document
export const sendTelegramDocument = async (
  chatId,
  fileName,
  fileData,
  caption
) => {
  try {
    const response = await api.post("/telegram/document/send", {
      chat_id: chatId,
      file_name: fileName,
      b64_file: fileData,
      caption: caption || "",
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all common notifications
export const getNotifications = async () => {
  try {
    const response = await api.get("/notifications/get");
    return response.data.notifications;
  } catch (error) {
    
    throw error;
  }
};

// Create a new notification
export const createNotification = async (payload) => {
  try {
    const response = await api.post("/notifications", payload);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all users for notifications
export const getUsersForNotifications = async (filter = "") => {
  try {
    const response = await api.post("/user/filtered", { filter });
    return response.data.users;
  } catch (error) {
    
    throw error;
  }
};

// Get active promos for public display
export const getActivePromos = async (params = {}) => {
  try {
    const response = await api.get("/promos/active", { params });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get a promo file URL (served as a stream — no base64)
export const getPromoFileUrl = (fileId) => {
  if (!fileId) return null;
  return `${api.defaults.baseURL}/promos/file/${fileId}`;
};

// Get single promo by ID
export const getPromoById = async (id) => {
  try {
    const response = await api.get(`/promos/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update promo
export const updatePromo = async (id, formData) => {
  try {
    const response = await api.put(`/promos/${id}`, formData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get all promos
export const getPromos = async () => {
  try {
    const response = await api.get("/promos");
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Add promo
export const addPromo = async (formData) => {
  try {
    const response = await api.post("/promos", formData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete promo
export const deletePromo = async (id) => {
  try {
    const response = await api.delete(`/promos/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Reorder promos
export const reorderPromos = async (promos) => {
  try {
    const response = await api.put("/promos/reorder", { promos });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all assistants (filtered by branch name)
export const getAssistants = async (branchName) => {
  try {
    const response = await api.get("/assistants", {
      params: { branch: branchName },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get assistant by ID
export const getAssistantById = async (id) => {
  try {
    const response = await api.get(`/assistants/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get assistant profile image
export const getAssistantProfileImage = async (fileId) => {
  try {
    const response = await api.get(`/assistants/profile-image/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Add assistant
export const addAssistant = async (formData) => {
  try {
    const response = await api.post("/assistants", formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update assistant
export const updateAssistant = async (id, formData) => {
  try {
    const response = await api.put(`/assistants/${id}`, formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Delete assistant
export const deleteAssistant = async (id) => {
  try {
    const response = await api.delete(`/assistants/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Assign doctor to assistant
export const assignDoctorToAssistant = (assistantEmail, data) => {
  const payload = {
    assistantEmail,
    ...data,
  };
  return api
    .post(`/assistants/assign-doctor`, payload)
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      
      throw error;
    });
};

// Remove doctor from assistant
export const removeDoctorFromAssistant = async (id, doctorEmail) => {
  try {
    const response = await api.delete(
      `/assistants/${id}/assign-doctor/${encodeURIComponent(doctorEmail)}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get assistants by doctor email
export const getAssistantsByDoctorEmail = async (
  doctorEmail,
  startDateTime,
  endDateTime
) => {
  try {
    const response = await api.get(
      `/assistants/doctors/${encodeURIComponent(doctorEmail)}/assistants`,
      {
        params: { startDateTime, endDateTime },
      }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all specialties
export const getSpecialties = async (page = 1, limit = 10) => {
  try {
    const response = await api.get("/specialty-master/specialties", { params: { page, limit } });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get specialty by ID
export const getSpecialtyById = async (id) => {
  try {
    const response = await api.get(`/specialties/${id}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add specialty
export const addSpecialty = async (data) => {
  try {
    const response = await api.post("/specialties", data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update specialty
export const updateSpecialty = async (id, data) => {
  try {
    const response = await api.put(`/specialties/${id}`, data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add test to specialty
export const addTestToSpecialty = async (id, data) => {
  try {
    const response = await api.post(`/specialties/${id}/tests`, data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete test from specialty
export const deleteTestFromSpecialty = async (id, testId) => {
  try {
    const response = await api.delete(`/specialties/${id}/tests/${testId}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete specialty
export const deleteSpecialty = async (id) => {
  try {
    const response = await api.delete(`/specialties/${id}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all vendors
export const getVendors = async (page = 1, limit = 10) => {
  try {
    const response = await api.get("/vendors", { params: { page, limit } });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get vendor by ID
export const getVendorById = async (id) => {
  try {
    const response = await api.get(`/vendors/${id}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add vendor
export const addVendor = async (formData) => {
  try {
    const response = await api.post("/vendors", formData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update vendor
export const updateVendor = async (id, formData) => {
  try {
    const response = await api.put(`/vendors/${id}`, formData);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add service to vendor
export const addServiceToVendor = async (id, data) => {
  try {
    const response = await api.post(`/vendors/${id}/services`, data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update service in vendor
export const updateServiceInVendor = async (id, specialtyId, data) => {
  try {
    const response = await api.put(
      `/vendors/${id}/services/${specialtyId}`,
      data
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete service from vendor
export const deleteServiceFromVendor = async (id, specialtyId) => {
  try {
    const response = await api.delete(`/vendors/${id}/services/${specialtyId}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete vendor
export const deleteVendor = async (id) => {
  try {
    const response = await api.delete(`/vendors/${id}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all early detection applications
export const getAllEarlyDetectionApplications = async (params = {}) => {
  try {
    const response = await api.get("/early-detection", { params });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get a single early detection application
export const getEarlyDetectionApplication = async (
  applicationId,
  doctorEmail
) => {
  try {
    const response = await api.get("/early-detection/doctor/single", {
      params: { applicationId, doctorEmail },
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update early detection prescription
export const updateEarlyDetectionAppointmentPrescription = async (
  applicationId,
  text,
  doctorEmail
) => {
  try {
    const response = await api.put(
      `/early-detection/${encodeURIComponent(applicationId)}/prescription`,
      {
        text,
        doctorEmail,
      }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update early detection conclusion
export const updateEarlyDetectionAppointmentConclusion = async (
  applicationId,
  text,
  doctorEmail
) => {
  try {
    const response = await api.put(
      `/early-detection/${encodeURIComponent(applicationId)}/conclusion`,
      {
        text,
        doctorEmail,
      }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Upload document to early detection application
export const uploadEarlyDetectionDocument = async (applicationId, file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(
      `/early-detection/${applicationId}/upload-document`,
      formData
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get document by ID
export const getDocument = async (fileId) => {
  try {
    const response = await api.get(
      `/early-detection/appointments/document-by-id/${fileId}`,
      {
        responseType: "blob",
      }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// Update verification status for early detection application
export const updateEarlyDetectionVerificationStatus = async (
  applicationId,
  type,
  field,
  status,
  doctorEmail
) => {
  try {
    const response = await api.put(
      `/early-detection/${applicationId}/update-verification`,
      {
        type,
        field,
        status,
        doctorEmail,
      }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add comment to early detection application
export const addEarlyDetectionAppointmentComment = async (
  applicationId,
  comment
) => {
  try {
    const response = await api.put(
      `/early-detection/${encodeURIComponent(applicationId)}/comments`,
      { comments: comment }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update early detection comment
export const updateEarlyDetectionAppointmentComment = async (
  applicationId,
  commentId,
  commentData
) => {
  try {
    const response = await api.put(
      `/early-detection/${encodeURIComponent(
        applicationId
      )}/comments/${commentId}`,
      commentData
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete early detection comment
export const deleteEarlyDetectionAppointmentComment = async (
  applicationId,
  commentId
) => {
  try {
    const response = await api.delete(
      `/early-detection/${encodeURIComponent(
        applicationId
      )}/comments/${commentId}`
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add multiple tests to early detection application
export const addMultipleTestsToEarlyDetectionAppointment = async (
  applicationId,
  tests
) => {
  try {
    const response = await api.put(
      `/early-detection/${applicationId}/add-multiple-tests`,
      { tests }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

export const grantAccess = async ({
  assistantEmail,
  accessId,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  try {
    const response = await api.patch("/assistants/grant-access", {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const revokeAccess = async ({
  assistantEmail,
  accessId,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  try {
    const response = await api.patch("/assistants/revoke-access", {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// New (corrected path)
export const updateAccessTime = async ({
  assistantEmail,
  accessId,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  try {
    const response = await api.patch("/assistants/update-access-time", {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get application by appointment ID
export const getApplicationByAppointmentId = async (appointmentId) => {
  try {
    const response = await api.get(
      `/applications/by-appointment-id/${encodeURIComponent(appointmentId)}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get specialty by name
export const getSpecialtyByName = async (name) => {
  const candidates = String(name || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const c of candidates) {
    try {
      const response = await api.get(`/specialties/name/${encodeURIComponent(c)}`);
      if (response?.data?.specialty) return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status && status !== 404) {
        
      }
    }
  }

  if (candidates.length > 0) {
    return { specialty: { name: candidates[0] } };
  }
  return { specialty: { name: name || "" } };
};

// Update application prescription
export const updateApplicationPrescription = async (applicationId, text) => {
  try {
    const response = await api.put(
      `/applications/${encodeURIComponent(applicationId)}/prescription`,
      { text }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update application conclusion
export const updateApplicationConclusion = async (applicationId, text) => {
  try {
    const response = await api.put(
      `/applications/${encodeURIComponent(applicationId)}/conclusion`,
      { text }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Assign vendor to a single order
export const assignVendorToOrder = async (orderId, data) => {
  try {
    const response = await api.patch(`/orders/${orderId}/assign-vendor`, data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Bulk assign vendor to multiple orders
export const assignVendorToOrders = async (data) => {
  try {
    const response = await api.post("/orders/assign-vendor", data);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Add head doctor
export const addHeadDoctor = async (formData) => {
  try {
    const response = await api.post("/head-doctors", formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get all head doctors (filtered by branch name)
export const getHeadDoctors = async (branchName) => {
  try {
    const response = await api.get("/head-doctors", {
      params: { branch: branchName },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get head doctor by ID
export const getHeadDoctorById = async (id) => {
  try {
    const response = await api.get(`/head-doctors/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get head doctor by email
export const getHeadDoctorByEmail = async (email) => {
  try {
    const response = await api.get(
      `/head-doctors/by-email/${encodeURIComponent(email)}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update head doctor
export const updateHeadDoctor = async (id, formData) => {
  try {
    const response = await api.put(`/head-doctors/${id}`, formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Delete head doctor
export const deleteHeadDoctor = async (id) => {
  try {
    const response = await api.delete(`/head-doctors/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get all specialists (filtered by branch name)
export const getSpecialistsDoctor = async (branchName) => {
  try {
    const response = await api.get("/specialists-doctor", {
      params: { branch: branchName },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get specialist by ID
export const getSpecialistDoctorById = async (id) => {
  try {
    const response = await api.get(`/specialists-doctor/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get specialist by email
export const getSpecialistDoctorByEmail = async (email) => {
  try {
    const response = await api.get(
      `/specialists-doctor/by-email/${encodeURIComponent(email)}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update specialist
export const updateSpecialistDoctor = async (id, formData) => {
  try {
    const response = await api.put(`/specialists-doctor/${id}`, formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Delete specialist
export const deleteSpecialistDoctor = async (id) => {
  try {
    const response = await api.delete(`/specialists-doctor/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

export const addSpecialistDoctor = async (formData) => {
  try {
    formData.append("role", "specialist"); // flag in DB
    const response = await api.post("/specialists-doctor", formData); // could be its own endpoint `/specialists`
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get all head assistants (filtered by branch name)
export const getHeadAssistants = async (branchName) => {
  try {
    const response = await api.get("/head-assistants", {
      params: { branch: branchName },
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get head assistant by ID
export const getHeadAssistantById = async (id) => {
  try {
    const response = await api.get(`/head-assistants/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get head assistant profile image
export const getHeadAssistantProfileImage = async (fileId) => {
  try {
    const response = await api.get(`/head-assistants/profile-image/${fileId}`, {
      responseType: "blob",
    });
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Add head assistant
export const addHeadAssistant = async (formData) => {
  try {
    const response = await api.post("/head-assistants", formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Update head assistant
export const updateHeadAssistant = async (id, formData) => {
  try {
    const response = await api.put(`/head-assistants/${id}`, formData);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Delete head assistant
export const deleteHeadAssistant = async (id) => {
  try {
    const response = await api.delete(`/head-assistants/${id}`);
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Assign doctor to head assistant
export const assignDoctorToHeadAssistant = async (id, data) => {
  try {
    const response = await api.post(
      `/head-assistants/${id}/assign-doctor`,
      data
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Remove doctor from head assistant
export const removeDoctorFromHeadAssistant = async (id, doctorEmail) => {
  try {
    const response = await api.delete(
      `/head-assistants/${id}/assign-doctor/${encodeURIComponent(doctorEmail)}`
    );
    return response;
  } catch (error) {
    
    throw error;
  }
};

// Get head assistants by doctor email
export const getHeadAssistantsByDoctorEmail = async (
  doctorEmail,
  startDateTime,
  endDateTime
) => {
  try {
    const response = await api.get(
      `/head-assistants/doctors/${encodeURIComponent(
        doctorEmail
      )}/head-assistants`,
      {
        params: { startDateTime, endDateTime },
      }
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

export const getStocks = async (params = {}) => {
  const res = await api.get("/inventory/stocks", { params });
  return res.data;
};

export const updateStockQuantity = async (id, quantity) => {
  const res = await api.patch(`/inventory/stocks/${id}`, { quantity });
  return res.data;
};

export const deleteStock = async (id) => {
  const res = await api.delete(`/inventory/stocks/${id}`);
  return res.data;
};

export const getReorderSuggestions = async (params = {}) => {
  const res = await api.get("/inventory/stocks/reorder-suggestions", {
    params,
  });
  return res.data;
};

export const getPurchaseOrders = async (params = {}) => {
  const res = await api.get("/inventory/purchase-orders", { params });
  return res.data;
};

export const createPurchaseOrder = async (data) => {
  const res = await api.post("/inventory/purchase-orders", data);
  return res.data;
};

export const receivePurchaseOrder = async (id) => {
  const res = await api.put(`/inventory/purchase-orders/${id}/receive`);
  return res.data;
};

// Delete a purchase order
export const deletePurchaseOrder = async (id) => {
  const res = await api.delete(`/inventory/purchase-orders/${id}`);
  return res.data;
};

export const updatePurchaseOrderItemStatus = async (orderId, itemId, data) => {
  const res = await api.patch(
    `/inventory/purchase-orders/${orderId}/items/${itemId}/status`,
    data
  );
  return res.data;
};

// INVENTORY: SUPPLIERS

export const getSuppliers = async (params = {}) => {
  const res = await api.get("/inventory/suppliers", { params });
  return res.data;
};

export const createSupplier = async (data) => {
  const res = await api.post("/inventory/suppliers", data);
  return res.data;
};

export const updateSupplier = async (id, data) => {
  const res = await api.put(`/inventory/suppliers/${id}`, data);
  return res.data;
};

export const deleteSupplier = async (id) => {
  const res = await api.delete(`/inventory/suppliers/${id}`);
  return res.data;
};

// INVENTORY: ITEMS

export const getInventoryItems = async () => {
  const res = await api.get("/inventory/items");
  return res.data;
};

export const createInventoryItem = async (data) => {
  const res = await api.post("/inventory/items", data);
  return res.data;
};

export const updateInventoryItem = async (id, data) => {
  const res = await api.put(`/inventory/items/${id}`, data);
  return res.data;
};

export const deleteInventoryItem = async (id) => {
  const res = await api.delete(`/inventory/items/${id}`);
  return res.data;
};

export const getSupplierItems = async (params = {}) => {
  const res = await api.get("/inventory/supplier-items", { params });
  return res.data;
};

export const createSupplierItem = async (data) => {
  const res = await api.post("/inventory/supplier-items", data);
  return res.data;
};

export const updateSupplierItem = async (id, data) => {
  const res = await api.put(`/inventory/supplier-items/${id}`, data);
  return res.data;
};

export const deleteSupplierItem = async (id) => {
  const res = await api.delete(`/inventory/supplier-items/${id}`);
  return res.data;
};

export const createPurchaseOrderWithPDF = async (orderData) => {
  try {
    const res = await api.post(
      "/inventory/purchase-orders/with-pdf",
      orderData
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getAnalyticsSummary = async (type, params = {}) =>
  api.get(`/${type}/analytics/summary`, { params }).then((res) => res.data);

export const getRevenueTrend = async (type, params = {}) =>
  api
    .get(`/${type}/analytics/revenue-trend`, { params })
    .then((res) => res.data);

export const getDoctorPerformance = async (type, params = {}) =>
  api
    .get(`/${type}/analytics/doctor-performance`, { params })
    .then((res) => res.data);

export const getVerificationStats = async (type, params = {}) =>
  api
    .get(`/${type}/analytics/verification-stats`, { params })
    .then((res) => res.data);

export const getSpecialtiesData = async (type, params = {}) =>
  api.get(`/${type}/analytics/specialties`, { params }).then((res) => res.data);

export const getServiceGrowth = async (type, params = {}) =>
  api
    .get(`/${type}/analytics/service-growth`, { params })
    .then((res) => res.data);

// === Max Messenger APIs ===
export const getMaxChats = async () => {
  try {
    const response = await api.get("/max/chats", {
      params: {
        profile_id: import.meta.env.VITE_MAX_PROFILE_ID || "8370586e-3dfd",
      },
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status === 403 || status === 401 || status >= 500) {
      // Don't show toast for every polling request
      return { chats: [] }; // Return empty data instead of throwing
    }
    
    return { chats: [] }; // Always return gracefully
  }
};

export const filterMaxChats = async (client_name) => {
  try {
    const response = await api.get("/max/chats/filter", {
      params: {
        client_name,
        profile_id: import.meta.env.VITE_MAX_PROFILE_ID || "8370586e-3dfd",
      },
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status === 403 || status === 401 || status >= 500) {
      return { chats: [] }; // Return empty data instead of throwing
    }
    
    return { chats: [] }; // Always return gracefully
  }
};

export const getMaxMessages = async (chat_id) => {
  try {
    const response = await api.get("/max/chat/messages", {
      params: { chat_id },
    });
    return response.data; // Expect [{ id, body, fromMe, type, time, ... }]
  } catch (error) {
    const status = error.response?.status;
    if (status === 403 || status === 401 || status >= 500) {
      return []; // Return empty messages instead of throwing
    }
    
    return []; // Always return gracefully
  }
};

export const sendMaxMessage = async (to, message) => {
  try {
    const response = await api.post("/max/send", { to, message });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status === 403 || status === 401 || status >= 500) {
      toast.error("Unable to send message - Max Messenger service unavailable");
      return null; // Return null instead of throwing
    }
    
    toast.error("Failed to send message");
    return null;
  }
};

export const sendMaxFile = async (to, file_name, file_data, file_type) => {
  try {
    const response = await api.post("/max/document/send", {
      to,
      file_name,
      file_data,
      file_type,
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status === 403 || status === 401 || status >= 500) {
      toast.error("Unable to send file - Max Messenger service unavailable");
      return null; // Return null instead of throwing
    }
    
    toast.error("Failed to send file");
    return null;
  }
};

export const checkMaxContact = async (phone) => {
  try {
    const response = await api.get("/max/check-contact", {
      params: { phone }
    });
    return response.data;
  } catch (error) {
    
    // Return exists: true as fallback to not block users
    return { exists: true, phone };
  }
};

export const markMaxChatAsRead = async (chat_id) => {
  try {
    const response = await api.post("/max/chat/read", { chat_id });
    return response.data;
  } catch (error) {
    
    // Silently fail - this is not critical
    return null;
  }
};

export const getProjects = async (email, role) => {
  const response = await api.get(`/projects`, {
    params: { email, role },
  });
  return response.data.projects;
};

export const createProject = async (data) => {
  const response = await api.post(`/projects`, data);
  return response.data.project;
};

export const updateProject = async (id, data) => {
  const response = await api.put(`/projects/${id}`, data);
  return response.data.project;
};

export const deleteProject = async (id) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

// TASK APIs
export const getTasksByProject = async (projectId) => {
  const response = await api.get(`/tasks/${projectId}`);
  return response.data.tasks;
};

export const createTask = async (data) => {
  const response = await api.post(`/tasks`, data);
  return response.data.task;
};

export const updateTask = async (id, data) => {
  const response = await api.put(`/tasks/${id}`, data);
  return response.data.task;
};

export const deleteTask = async (id) => {
  const response = await api.delete(`/tasks/${id}`);
  return response.data;
};

export const reorderTask = async (data) => {
  const response = await api.put(`/tasks/reorder/move`, data);
  return response.data;
};

export const getEmployees = async (projectId) => {
  if (projectId) {
    return api.get(`/employees?projectId=${projectId}`);
  }
  return api.get("/employees");
};

// Add multiple members to a project
export const addMembersToProject = async (projectId, emails) => {
  return api.post(`/projects/${projectId}/add-members`, {
    emails,
  });
};

export const getProjectMembers = async (projectId) => {
  return api.get(`/projects/${projectId}/members`);
};

// Stock Request
export const getStockRequests = async () => {
  const res = await api.get("/inventory/stock-requests");
  return res.data;
};

export const getStockRequestDetails = async (id) => {
  if (!id) {
    throw new Error("Request ID is required");
  }

  const res = await api.get(`/inventory/stock-requests/${id}`);
  return res.data;
};

export const getAssistantStockRequest = async (id) => {
  if (!id) {
    throw new Error("Request ID is required");
  }

  const res = await api.get(
    `/inventory/stock-requests/assistant/request/${id}`
  );
  return res.data;
};

export const getStockRequestsByAssistant = async (assistantEmail) => {
  if (!assistantEmail) {
    throw new Error("Assistant email is required");
  }

  const res = await api.get(
    `/inventory/stock-requests/assistant/${assistantEmail}`
  );
  return res.data;
};

export const sendStockRequest = async (assistantEmail, data) => {
  if (!assistantEmail || !data) {
    throw new Error("assistantEmail, formdata are required");
  }

  const res = await api.post("/inventory/stock-requests", {
    fromAssistantEmail: assistantEmail,
    ...data,
  });
  return res.data;
};

export const deleteStockRequest = async (id) => {
  if (!id) {
    throw new Error("Request ID is required");
  }

  const res = await api.delete(`/inventory/stock-requests/${id}`);
  return res.data;
};

export const updateStockRequestItemStatus = async (requestId, itemId, data) => {
  const res = await api.patch(
    `/inventory/stock-requests/${requestId}/items/${itemId}/status`,
    data
  );
  return res.data;
};

// Send a message
export const sendChatMessage = async (messageData) => {
  const res = await api.post(`/chat-messages/send`, messageData);
  return res.data;
};

// Get all messages between two users
export const getMessagesBetweenUsers = async (user1, user2) => {
  const res = await api.get(`/chat-messages/between/${user1}/${user2}`);
  return res.data.messages || [];
};

// Get all messages for a user
export const getUserMessages = async (email) => {
  const res = await api.get(`/chat-messages/user/${email}`);
  return res.data.messages || [];
};

// Mark messages as read
export const markMessagesAsRead = async (receiverEmail, senderEmail) => {
  const res = await api.put(`/chat-messages/mark-read`, {
    receiverEmail,
    senderEmail,
  });
  return res.data;
};

// Upload file
export const uploadChatFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post(`/chat-messages/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getChatMessageFile = async (fileId) => {
  return api.get(`/chat-messages/file/${fileId}`, { responseType: "blob" });
};

// Get all managers (filtered by branch name)
export const getManagersData = async (branchName) => {
  try {
    const res = await api.get("/auth/managers-data", {
      params: { branch: branchName },
    });
    return res.data;
  } catch (error) {
    throw error;
  }
};

// GET all assistants (both head & regular)
export const getAssistantsData = async () => {
  try {
    const res = await api.get("/assistants/getAssistants");
    return res.data; // Expected: { assistants: [...] }
  } catch (err) {
    throw err.response?.data || { message: "Error fetching assistants" };
  }
};

// Get unread counts (received)
export const getUnreadCounts = async (email) => {
  const res = await api.get(`/chat-messages/unread/${email}`);
  return res.data || {};
};

export const getHeadAssistantByEmail = (email) => {
  return api.get(`/head-assistants/email/${email}`);
};

export const getHeadAssistantAvailability = (email, startDate, endDate) => {
  return api.get(`/head-assistants/availability/${email}`, {
    params: { startDate, endDate },
  });
};

export const postHeadAssistantAvailability = (email, availability) => {
  return api.post(`/head-assistants/availability/${email}`, availability);
};

export const deleteHeadAssistantAvailability = (id, email) => {
  return api.delete(`/head-assistants/availability/${id}`, {
    data: { email },
  });
};

export const getCommonNotifications = () => {
  return api
    .get("/notifications/common")
    .then((response) => {
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }
      return Promise.reject({
        status: response.status,
        message: response.data?.message || "Unexpected response from server",
      });
    })
    .catch((error) => {
      let errorDetails = {
        status: error.response?.status || 0,
        message: "Failed to fetch notifications",
      };

      if (error.response) {
        errorDetails = {
          ...errorDetails,
          message:
            error.response.data?.message || "Server responded with an error",
          data: error.response.data,
        };
      } else if (error.request) {
        errorDetails = {
          ...errorDetails,
          message:
            "No response received from server. Please check your network connection.",
        };
      } else {
        errorDetails = {
          ...errorDetails,
          message: error.message || "Error setting up request",
        };
      }

      return Promise.reject(errorDetails);
    });
};

export const getPersonalNotifications = (email) => {
  return api
    .get(`/notifications/personal?email=${email}`, {
      headers: {},
    })
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      throw error;
    });
};

export const markNotificationAsRead = (notificationId, role) => {
  return api.patch(
    `/notifications/${notificationId}/read`,
    { role },
    {
      headers: {},
    }
  );
};

// Doctor profile apis

// Get all doctors profiles with pagination and filters
export const getAllDoctorsProfiles = async (filters = {}) => {
  const res = await api.get(`/doctors-profile`, { params: filters });
  return res.data;
};

// Get all doctors profiles with pagination and filters
export const getDoctorsProfileData = async (filters = {}) => {
  const res = await api.get(`/doctors-profile/get-doctors`, {
    params: filters,
  });
  return res.data;
};

// Get doctor profile by ID
export const getDoctorProfileById = async (id) => {
  const res = await api.get(`/doctors-profile/${id}`);
  return res.data;
};

// Get doctor profile by email
export const getDoctorProfileByEmail = async (email) => {
  const res = await api.get(`/doctors-profile/email/${email}`);
  return res.data;
};

// Create new doctor profile with file upload support - USING AXIOS
export const createDoctorProfile = async (formData, config = {}) => {
  try {
    const res = await api.post("/doctors-profile", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...config.headers,
      },
      ...config,
    });
    return res.data;
  } catch (error) {
    throw error;
  }
};
// Update doctor profile with file upload support
export const updateDoctorProfile = async (id, updateData, config = {}) => {
  const res = await api.patch(`/doctors-profile/${id}`, updateData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...config.headers,
    },
    ...config,
  });
  return res.data;
};

// Delete doctor profile
export const deleteDoctorProfile = async (id) => {
  const res = await api.delete(`/doctors-profile/${id}`);
  return res.data;
};

// Update doctors display order
export const updateDoctorsOrder = async (doctorIds) => {
  const res = await api.post(`/doctors-profile/update-order`, { doctorIds });
  return res.data;
};

// Send doctor credentials - Create user account and email credentials
export const sendDoctorCredentials = async (doctorId) => {
  const res = await api.post(`/doctors-profile/${doctorId}/send-credentials`);
  return res.data;
};

// Check if doctor has a user account
export const checkDoctorHasAccount = async (email) => {
  const res = await api.get(`/doctors-profile/check-account/${email}`);
  return res.data;
};

// Add review to doctor profile
export const addDoctorProfileReview = async (id, reviewData) => {
  const res = await api.post(`/doctors-profile/${id}/reviews`, reviewData);
  return res.data;
};

// Get doctor profiles by specialty
export const getDoctorProfilesBySpecialty = async (specialty, filters = {}) => {
  const res = await api.get(`/doctors-profile/specialty/${specialty}`, {
    params: filters,
  });
  return res.data;
};

// Get featured doctor profiles
export const getFeaturedDoctorProfiles = async (limit = 6) => {
  const res = await api.get(`/doctors-profile/featured`, { params: { limit } });
  return res.data;
};

// Get doctor profile image by fileId
export const getDoctorsProfileImage = async (fileId) => {
  const res = await api.get(`/doctors-profile/image/${fileId}`);
  return res.data;
};

// Upload service file
export const uploadServiceFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/services/upload", formData);
  return res.data;
};

export const getFile = async (fileId) => {
  try {
    const response = await api.get(`/services/file/${fileId}`, {
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Search doctor profiles
export const searchDoctorProfiles = async (searchTerm, filters = {}) => {
  const res = await api.get(`/doctors-profile`, {
    params: { search: searchTerm, ...filters },
  });
  return res.data;
};

// Create a new service
export const createService = async (data) => {
  const res = await api.post(`/services`, data);
  return res.data;
};

// Get all services
export const getAllServices = async (params = {}) => {
  const res = await api.get(`/services`, { params });
  return res.data;
};

// Get a single service by ID
export const getServiceById = async (id) => {
  const res = await api.get(`/services/${id}`);
  return res.data;
};

// Update a service
export const updateService = async (id, data) => {
  const res = await api.put(`/services/${id}`, data);
  return res.data;
};

// Delete a service
export const deleteService = async (id) => {
  const res = await api.delete(`/services/${id}`);
  return res.data;
};

// Create a new sub-service
export const createSubService = async (data) => {
  const res = await api.post(`/sub-services`, data);
  return res.data;
};

// Get all sub-services (optional serviceId filter)
export const getAllSubServices = async (params = {}) => {
  const res = await api.get(`/sub-services`, { params });
  return res.data;
};

// Get a single sub-service by ID
export const getSubServiceById = async (id) => {
  const res = await api.get(`/sub-services/${id}`);
  return res.data;
};

// Update a sub-service
export const updateSubService = async (id, data) => {
  const res = await api.put(`/sub-services/${id}`, data);
  return res.data;
};

// Delete a sub-service
export const deleteSubService = async (id) => {
  const res = await api.delete(`/sub-services/${id}`);
  return res.data;
};

// Get all content managers
export const getContentManagers = async () => {
  try {
    const response = await api.get("/content-managers");
    return response.data.contentManagers || [];
  } catch (error) {
    
    throw error;
  }
};

// Get content manager by ID
export const getContentManagerById = async (id) => {
  try {
    const response = await api.get(`/content-managers/${id}`);
    return response.data.contentManager;
  } catch (error) {
    
    throw error;
  }
};

// Get content manager by email
export const getContentManagerByEmail = async (email) => {
  try {
    const response = await api.get(
      `/content-managers/by-email/${encodeURIComponent(email)}`
    );
    return response.data.contentManager;
  } catch (error) {
    
    throw error;
  }
};

// Create content manager
export const createContentManager = async (formData) => {
  try {
    const response = await api.post("/content-managers", formData);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update content manager
export const updateContentManager = async (id, formData) => {
  try {
    const response = await api.put(`/content-managers/${id}`, formData);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete content manager
export const deleteContentManager = async (id) => {
  try {
    const response = await api.delete(`/content-managers/${id}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all vacancies
export const getVacancies = async (params = {}) => {
  try {
    const response = await api.get("/vacancies", { params });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get single vacancy
export const getVacancy = async (id) => {
  try {
    const response = await api.get(`/vacancies/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create vacancy
export const createVacancy = async (vacancyData) => {
  try {
    const response = await api.post("/vacancies", vacancyData);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update vacancy
export const updateVacancy = async (id, vacancyData) => {
  try {
    const response = await api.put(`/vacancies/${id}`, vacancyData);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Delete vacancy
export const deleteVacancy = async (id) => {
  try {
    const response = await api.delete(`/vacancies/${id}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Submit job application
export const submitApplication = async (vacancyId, applicationData) => {
  try {
    const response = await api.post(
      `/vacancies/${vacancyId}/apply`,
      applicationData
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get applications for a vacancy
export const getApplicationsByVacancy = async (vacancyId, params = {}) => {
  try {
    const response = await api.get(`/vacancies/${vacancyId}/applications`, {
      params,
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get all applications
export const getAllApplications = async (params = {}) => {
  try {
    const response = await api.get("/vacancies/applications/all", { params });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get single application
export const getJobApplication = async (applicationId) => {
  try {
    const response = await api.get(`/vacancies/applications/${applicationId}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Update application status
export const updateApplicationStatus = async (applicationId, statusData) => {
  try {
    const response = await api.put(
      `/vacancies/applications/${applicationId}/status`,
      statusData
    );
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Get vacancy statistics
export const getVacancyStats = async () => {
  try {
    const response = await api.get("/vacancies/stats/overview");
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// Download resume file
export const downloadResume = async (fileId) => {
  try {
    const response = await api.get(`/vacancies/resume/${fileId}`, {
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    
    throw error;
  }
};



export const getContactRequests = async (filters = {}) => {
  try {
    const params = new URLSearchParams();

    // Add filters to query params
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const queryString = params.toString();
    const url = `/vacancies/contact-requests${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};




export const getContactRequest = async (requestId) => {
  try {
    const response = await api.get(`/vacancies/contact-requests/${requestId}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};


export const updateContactRequest = async (requestId, updateData) => {
  try {
    const response = await api.put(`/vacancies/contact-requests/${requestId}`, updateData);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};


export const deleteContactRequest = async (requestId) => {
  try {
    const response = await api.delete(`/vacancies/contact-requests/${requestId}`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};

// ── Doctor Weekly Schedule ──
export const getDoctorWeeklySchedule = async (doctorEmail) => {
  try {
    const response = await api.get(`/doctor-availability/weekly-schedule/${doctorEmail}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const saveDoctorWeeklySchedule = async (doctorEmail, scheduleData) => {
  try {
    const response = await api.post(`/doctor-availability/weekly-schedule`, {
      doctorEmail,
      schedule: scheduleData,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ── Doctor Date Override ──
export const getDoctorDateOverride = async (doctorEmail, date) => {
  try {
    const response = await api.get(`/doctor-availability/date-override/${doctorEmail}/${date}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const saveDoctorDateOverride = async (doctorEmail, date, overrideData) => {
  try {
    const response = await api.post(`/doctor-availability/date-override`, {
      doctorEmail,
      date,
      ...overrideData,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteDoctorDateOverride = async (doctorEmail, date) => {
  try {
    const response = await api.delete(`/doctor-availability/date-override/${doctorEmail}/${date}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ── Doctor Break By ID ──
export const deleteDoctorBreakById = async (breakId) => {
  try {
    const response = await api.delete(`/doctor-availability/breaks/by-id/${breakId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ── Day Closure Status ──
export const getDayClosureStatus = async (doctorEmail, date) => {
  try {
    const response = await api.get(`/doctor-availability/day-closure/${doctorEmail}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const closeDaySchedule = async (doctorEmail, reason = '') => {
  try {
    const response = await api.post(`/doctor-availability/day-closure`, { doctorEmail, reason });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const reopenDaySchedule = async (doctorEmail) => {
  try {
    const response = await api.delete(`/doctor-availability/day-closure/${doctorEmail}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};


export const getContactRequestsByVacancy = async (vacancyId) => {
  try {
    const response = await api.get(`/vacancies/${vacancyId}/contact-requests`);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};


export const getContactRequestStats = async (vacancyId = null) => {
  try {
    const url = vacancyId
      ? `/vacancies/contact-requests/stats?vacancyId=${vacancyId}`
      : `/vacancies/contact-requests/stats`;

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    
    throw error;
  }
};





export const getReviews = async (params = {}) => {
  const response = await api.get("/reviews", { params });
  return response.data;
};

export const getReviewById = async (id) => {
  const response = await api.get(`/reviews/${id}`);
  return response.data;
};

// Create a new review
export const createReview = async (reviewData) => {
  const config =
    reviewData instanceof FormData
      ? {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
      : {};

  const response = await api.post('/reviews', reviewData, config);
  return response.data;
};


export const updateReview = async (id, reviewData) => {
  const config =
    reviewData instanceof FormData
      ? {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
      : {};

  const response = await api.put(`/reviews/${id}`, reviewData, config);
  return response.data;
};

export const deleteReview = async (id) => {
  const response = await api.delete(`/reviews/${id}`);
  return response.data;
};

// New function to get review file
export const getReviewFile = async (fileId) => {
  const response = await api.get(`/reviews/file/${fileId}`, {
    responseType: "blob", // Important for file downloads
  });
  return response.data;
};

export const getReviewFileUrl = (fileId) => {
  return `${api.defaults.baseURL}/reviews/file/${fileId}`;
};

export const getContactUsForm = async () => {
  const responce = await api.get("/contact-us");
  return responce.data;
};

export const updateContact = async (id, contactData) => {
  const responce = await api.put(`/contact-us/${id}`, contactData);
  return responce.data;
};

export const deleteContact = async (id) => {
  const responce = await api.delete(`/contact-us/${id}`);
  return responce.data;
};


export const getPatientCoordinationForms = async () => {
  const responce = await api.get("/patient-coordination-forms");
  return responce.data
}

export const updateCoordinationFormdata = async (id, coordinationFormData) => {
  const responce = await api.put(`/patient-coordination-forms/${id}`, coordinationFormData)
  return responce.data
}

export const deleteCoordinationFormdata = async (id, coordinationFormData) => {
  const responce = await api.delete(`/patient-coordination-forms/${id}`, coordinationFormData);
  return responce.data
}

// Complicated Cases Forms APIs
export const getComplicatedCasesForms = async () => {
  const response = await api.get("/complicated-cases-forms");
  return response.data;
};

export const getComplicatedCasesFormById = async (id) => {
  const response = await api.get(`/complicated-cases-forms/${id}`);
  return response.data;
};

export const submitComplicatedCasesForm = async (formData) => {
  const response = await api.post("/complicated-cases-forms", formData);
  return response.data;
};

export const updateComplicatedCasesForm = async (id, formData) => {
  const response = await api.put(`/complicated-cases-forms/${id}`, formData);
  return response.data;
};

export const deleteComplicatedCasesForm = async (id) => {
  const response = await api.delete(`/complicated-cases-forms/${id}`);
  return response.data;
};

export const uploadComplicatedCasesFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/complicated-cases-forms/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getComplicatedCasesFile = async (fileId) => {
  const response = await api.get(`/complicated-cases-forms/file/${fileId}`, {
    responseType: "blob",
  });
  return response.data;
};

export const deleteComplicatedCasesFile = async (fileId) => {
  const response = await api.delete(`/complicated-cases-forms/file/${fileId}`);
  return response.data;
};


// Public: Get published blogs (with pagination, filters and language support)
export const getPublicBlogs = async ({
  page = 1,
  limit = 10,
  tag,
  category,
  branch,
  type,
  lang = "en",
} = {}) => {
  try {
    const response = await api.get("/blogs/public", {
      params: { page, limit, tag, category, branch, type, lang },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Public: Get single published blog by ID
export const getPublicBlogById = async (id, lang = "en") => {
  try {
    const response = await api.get(`/blogs/public/${id}`, {
      params: { lang },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Admin: Get all blogs (drafts, published, archived – with filters)
export const getAllBlogs = async ({
  page = 1,
  limit = 10,
  status,
  tag,
  category,
  branch,
  type,
  lang = "en",
} = {}) => {
  try {
    const response = await api.get("/blogs", {
      params: { page, limit, status, tag, category, branch, type, lang },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Admin: Get single blog by ID (full data, including draft)
export const getBlogById = async (id) => {
  try {
    const response = await api.get(`/blogs/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Admin: Create new blog (supports image upload)
export const createBlog = async (formData) => {
  try {
    const response = await api.post("/blogs", formData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Admin: Update blog (supports image replace/delete)
export const updateBlog = async (id, formData) => {
  try {
    const response = await api.put(`/blogs/${id}`, formData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Admin: Delete blog (also deletes associated GridFS image)
export const deleteBlog = async (id) => {
  try {
    const response = await api.delete(`/blogs/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Admin: Update blogs order
export const updateBlogsOrder = async (orderedBlogIds) => {
  try {
    const response = await api.put('/blogs/reorder', { orderedBlogIds });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Public: Get blog image (used in <img src={blog.image} />)
export const getBlogImage = async (fileId) => {
  try {
    const response = await api.get(`/blogs/image/${fileId}`, {
      responseType: "blob",
    });
    return response; // blob response
  } catch (error) {
    throw error;
  }
};


export const submitContactViaPhone = async (contactData) => {
  const response = await api.post("/website/contact-via-phone", contactData);
  return response.data;
};

export const getContactViaPhoneRequests = async () => {
  const response = await api.get("/website/contact-via-phone");
  return response.data;
};

export const getContactViaPhoneRequest = async (id) => {
  const response = await api.get(`/website/contact-via-phone/${id}`);
  return response.data;
};

export const updateContactViaPhoneRequest = async (id, contactData) => {
  const response = await api.put(`/website/contact-via-phone/${id}`, contactData);
  return response.data;
};

export const deleteContactViaPhoneRequest = async (id) => {
  const response = await api.delete(`/website/contact-via-phone/${id}`);
  return response.data;
};

// ======================= SPECIALTY MASTER APIs =======================

// Get all specialties
export const getAllSpecialties = async () => {
  try {
    const response = await api.get('/specialty-master/specialties');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create specialty
export const createSpecialty = async (data) => {
  try {
    const response = await api.post('/specialty-master/specialties', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update specialty
export const updateSpecialtyMaster = async (id, data) => {
  try {
    const response = await api.put(`/specialty-master/specialties/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete specialty
export const deleteSpecialtyMaster = async (id) => {
  try {
    const response = await api.delete(`/specialty-master/specialties/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get all sub-specialities
export const getAllSubSpecialities = async () => {
  try {
    const response = await api.get('/specialty-master/sub-specialities');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create sub-speciality
export const createSubSpeciality = async (data) => {
  try {
    const response = await api.post('/specialty-master/sub-specialities', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update sub-speciality
export const updateSubSpeciality = async (id, data) => {
  try {
    const response = await api.put(`/specialty-master/sub-specialities/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete sub-speciality
export const deleteSubSpeciality = async (id) => {
  try {
    const response = await api.delete(`/specialty-master/sub-specialities/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Corporate Form Registrations (submissions)
export const getCorporateFormSubmissions = async (link) => {
  try {
    const response = await api.get(`/corporate-form-registrations/${link}/results`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Corporate Registration
export const getCorporateRegistrations = async () => {
  try {
    const response = await api.get("/corporate-register");
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createCorporateRegistration = async (data) => {
  try {
    const response = await api.post("/corporate-register", data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateCorporateRegistration = async (id, data) => {
  try {
    const response = await api.put(`/corporate-register/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteCorporateRegistration = async (id) => {
  try {
    const response = await api.delete(`/corporate-register/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};


// Board notes
export const getBoardNotes = async () => {
  try { return await api.get("/board"); } catch (e) { throw e; }
};
export const createBoardNote = async (data) => {
  try { return await api.post("/board", data); } catch (e) { throw e; }
};
export const updateBoardNote = async (id, data) => {
  try { return await api.patch(`/board/${id}`, data); } catch (e) { throw e; }
};
export const deleteBoardNote = async (id) => {
  try { return await api.delete(`/board/${id}`); } catch (e) { throw e; }
};



// Get Application Instrumental Analysis by ID
export const getApplicationInstrumentalAnalysisById = async (id) => {
  try {
    const response = await api.get(`/application-instrumental-analysis/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update Application Instrumental Analysis
export const updateApplicationInstrumentalAnalysis = async (id, data) => {
  try {
    const response = await api.put(`/application-instrumental-analysis/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete Application Instrumental Analysis
export const deleteApplicationInstrumentalAnalysis = async (id) => {
  try {
    const response = await api.delete(`/application-instrumental-analysis/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create Application Laboratory Test
export const createApplicationLaboratoryTest = async (data) => {
  try {
    const response = await api.post("/application-laboratory-test", data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get all Application Laboratory Tests
export const getAllApplicationLaboratoryTests = async (params = {}) => {
  try {
    const response = await api.get("/application-laboratory-test", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const uploadApplicationLaboratoryTestFile = async (id, file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/application-laboratory-test/${id}/upload-file`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const removeApplicationLaboratoryTestFile = async (id, fileId) => {
  try {
    const path = `/application-laboratory-test/${id}/file${fileId ? `/${fileId}` : ""}`;
    const response = await api.delete(path);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const fetchApplicationLaboratoryTestFile = async (id, fileId) => {
  try {
    const path = `/application-laboratory-test/${id}/file${fileId ? `/${fileId}` : ""}`;
    const response = await api.get(path, { responseType: "blob" });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addApplicationLaboratoryTestNote = async (id, data) => {
  try {
    const response = await api.patch(`/application-laboratory-test/${id}/note`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateApplicationLaboratoryTestNote = async (id, noteId, data) => {
  try {
    const response = await api.patch(`/application-laboratory-test/${id}/note/${noteId}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteApplicationLaboratoryTestNote = async (id, noteId) => {
  try {
    const path = noteId ? `/application-laboratory-test/${id}/note/${noteId}` : `/application-laboratory-test/${id}/note`;
    const response = await api.delete(path);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get Application Laboratory Test by ID
export const getApplicationLaboratoryTestById = async (id) => {
  try {
    const response = await api.get(`/application-laboratory-test/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update Application Laboratory Test
export const updateApplicationLaboratoryTest = async (id, data) => {
  try {
    const response = await api.put(`/application-laboratory-test/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete Application Laboratory Test
export const deleteApplicationLaboratoryTest = async (id) => {
  try {
    const response = await api.delete(`/application-laboratory-test/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};



// Create Application Instrumental Analysis
export const createApplicationInstrumentalAnalysis = async (data) => {
  try {
    const response = await api.post("/application-instrumental-analysis", data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const uploadApplicationInstrumentalAnalysisFile = async (id, file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/application-instrumental-analysis/${id}/upload-file`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const removeApplicationInstrumentalAnalysisFile = async (id, fileId) => {
  try {
    const path = `/application-instrumental-analysis/${id}/file${fileId ? `/${fileId}` : ""}`;
    const response = await api.delete(path);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const fetchApplicationInstrumentalAnalysisFile = async (id, fileId) => {
  try {
    const path = `/application-instrumental-analysis/${id}/file${fileId ? `/${fileId}` : ""}`;
    const response = await api.get(path, { responseType: "blob" });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addApplicationInstrumentalAnalysisNote = async (id, data) => {
  try {
    const response = await api.patch(`/application-instrumental-analysis/${id}/note`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateApplicationInstrumentalAnalysisNote = async (id, noteId, data) => {
  try {
    const response = await api.patch(`/application-instrumental-analysis/${id}/note/${noteId}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteApplicationInstrumentalAnalysisNote = async (id, noteId) => {
  try {
    const path = noteId ? `/application-instrumental-analysis/${id}/note/${noteId}` : `/application-instrumental-analysis/${id}/note`;
    const response = await api.delete(path);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get all Application Instrumental Analysis
export const getAllApplicationInstrumentalAnalysis = async (params = {}) => {
  try {
    const response = await api.get("/application-instrumental-analysis", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/* ---------------- Service Manager ---------------- */

// Categories
export const getAllServiceCategories = async (params = {}) => {
  try {
    const response = await api.get("/service-manager/categories", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Backward-compatible category list helper
export const getAllCategories = async (params = {}) => getAllServiceCategories(params);

export const getServiceCategoryById = async (id) => {
  try {
    const response = await api.get(`/service-manager/categories/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getServiceCategoryBreadcrumb = async (id) => {
  try {
    const response = await api.get(`/service-manager/categories/${id}/breadcrumb`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createServiceCategory = async (data) => {
  try {
    const response = await api.post("/service-manager/categories", data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateServiceCategory = async (id, data) => {
  try {
    const response = await api.put(`/service-manager/categories/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteServiceCategory = async (id) => {
  try {
    const response = await api.delete(`/service-manager/categories/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const moveServiceCategory = async (id, parent = null) => {
  try {
    const response = await api.patch(`/service-manager/categories/${id}/move`, { parent });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getServiceCategoryFolderContents = async (params = {}) => {
  try {
    const response = await api.get("/service-manager/folder", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const exportServiceCategories = async (params = {}) => {
  try {
    const response = await api.get("/service-manager/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const importServiceCategories = async (rows) => {
  try {
    const response = await api.post("/service-manager/import", { rows });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Positions
export const getAllServicePositions = async (params = {}) => {
  try {
    const response = await api.get("/service-manager/positions/positions", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getServicePositionById = async (id) => {
  try {
    const response = await api.get(`/service-manager/positions/positions/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createServicePosition = async (data) => {
  try {
    const response = await api.post("/service-manager/positions/positions", data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateServicePosition = async (id, data) => {
  try {
    const response = await api.put(`/service-manager/positions/positions/${id}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteServicePosition = async (id) => {
  try {
    const response = await api.delete(`/service-manager/positions/positions/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const moveServicePosition = async (id, category = null) => {
  try {
    const response = await api.patch(`/service-manager/positions/positions/${id}/move`, {
      category,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getServicePositionFolderContents = async (params = {}) => {
  try {
    const response = await api.get("/service-manager/positions/folder", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/* ── Application Section (morphologicalResearch / proceduresAndManipulations) ── */
export const getApplicationSection = async (applicationId, section) => {
  const response = await api.get(`/application-section/${encodeURIComponent(applicationId)}/${section}`);
  return response.data;
};

export const uploadApplicationSectionFile = async (applicationId, section, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/application-section/${encodeURIComponent(applicationId)}/${section}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getApplicationSectionFile = async (applicationId, section, fileId) => {
  const response = await api.get(`/application-section/${encodeURIComponent(applicationId)}/${section}/file/${fileId}`, {
    responseType: "blob",
  });
  return response.data;
};

export const removeApplicationSectionFile = async (applicationId, section, fileId) => {
  const response = await api.delete(`/application-section/${encodeURIComponent(applicationId)}/${section}/file/${fileId}`);
  return response.data;
};

export const updateApplicationSectionComment = async (applicationId, section, value) => {
  const response = await api.patch(`/application-section/${encodeURIComponent(applicationId)}/${section}/comment`, { value });
  return response.data;
};

export const exportServicePositions = async (params = {}) => {
  try {
    const response = await api.get("/service-manager/positions/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const importServicePositions = async (rows) => {
  try {
    const response = await api.post("/service-manager/positions/import", { rows });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/* ── Application Service Positions ────────────────────────────────────── */

// Get all service positions added to an application
export const getApplicationServicePositions = async (applicationId) => {
  try {
    const response = await api.get(`/service-manager/positions/application/${encodeURIComponent(applicationId)}/positions`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Add a service position to an application
export const addApplicationServicePosition = async (applicationId, positionId) => {
  try {
    const response = await api.post(
      `/service-manager/positions/application/${encodeURIComponent(applicationId)}/positions`,
      { positionId }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Remove a service position from an application
export const removeApplicationServicePosition = async (applicationId, positionId) => {
  try {
    const response = await api.delete(
      `/service-manager/positions/application/${encodeURIComponent(applicationId)}/positions/${encodeURIComponent(positionId)}`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;
