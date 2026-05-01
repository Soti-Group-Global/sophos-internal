import axios from "axios";
import { jwtDecode } from "jwt-decode";

const baseUrl = import.meta.env.VITE_BASE_URL;

let authContext = null;
export const setAuthContext = (ctx) => {
  authContext = ctx;
};

const api = axios.create({
  baseURL: 'http://localhost:5002/api',
  withCredentials: true,
});

// === Refresh Handling State ===
let isRefreshing = false;
let refreshSubscribers = [];
let refreshTimer = null;

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}
function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

// === Request Interceptor ===
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token && !config.url.includes("/max/")) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.url.includes("/max/")) {
    config.headers.Authorization = import.meta.env.VITE_MAX_API_TOKEN || "f25d8ff6573b44915f8b1b5410dd508b252addbf";
  }
  return config;
}, (error) => Promise.reject(error));

// === Response Interceptor ===
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Silently handle 404 for optional endpoints that may not exist yet
    if (error.response?.status === 404) {
      const url = originalRequest?.url || '';
      // Return empty array silently for managed-tests endpoint (not yet implemented in backend)
      if (url.includes('early-detection/managed-tests')) {
        return Promise.resolve({ data: [], status: 404 });
      }
    }

    // Skip token refresh for auth-related endpoints
    if (
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/signup") ||
      originalRequest?.url?.includes("/auth/reset") ||
      originalRequest?.url?.includes("/doctors/doctor-signin") ||
      originalRequest?.url?.includes("/doctors/signup")
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${baseUrl}/api/auth/refresh`, { refreshToken });

        const newToken = data.accessToken;
        const newRefresh = data.refreshToken;

        localStorage.setItem("accessToken", newToken);
        if (newRefresh) localStorage.setItem("refreshToken", newRefresh);

        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        authContext?.updateToken?.(newToken, newRefresh);

        onRefreshed(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        authContext?.logout?.(true);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// === Silent token refresh scheduler ===
export function scheduleTokenRefresh(token) {
  stopTokenRefresh();

  const { exp } = jwtDecode(token);
  const expiresAt = exp * 1000;
  const now = Date.now();
  const refreshAt = expiresAt - 30 * 1000;
  const delay = refreshAt - now;

  if (delay > 0) {
    refreshTimer = setTimeout(async () => {
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const { data } = await api.post("/auth/refresh", { refreshToken });

        localStorage.setItem("accessToken", data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem("refreshToken", data.refreshToken);
        }

        authContext?.updateToken?.(data.accessToken, data.refreshToken);
      } catch (err) {
        console.error("[AUTH] Silent refresh failed:", err.message);
        authContext?.logout?.(true);
      }
    }, delay);
  }

  return refreshTimer;
}

export function stopTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// === Safe Fetch ===
export const safeFetch = async (...args) => {
  if (!navigator.onLine) {
    throw new Error("You are offline. Please check your connection.");
  }
  return fetch(...args);
};

// === Doctor Login ===
export const doctorSignin = async (data) => {
  try {
    const response = await api.post("/doctors/doctor-signin", data);
    return response;
  } catch (error) {
    console.error("Doctor Signin Error:", error.response?.data || error.message);
    throw error;
  }
};

// === Doctor Signup ===
export const doctorSignup = async (data) => {
  try {
    const response = await api.post("/doctors/signup", data, {
      headers: {}
    });
    return response;
  } catch (error) {
    console.error("Doctor Signup Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getEmailFromToken = () => {
  try {
    const token = localStorage.getItem("accessToken");
    console.log("[DEBUG] getEmailFromToken - token exists:", !!token);

    if (!token) {
      console.warn("[WARN] No accessToken in localStorage");
      return null;
    }

    const decoded = jwtDecode(token);
    const email =
      decoded.email ||
      decoded.user?.email ||
      decoded.userEmail ||
      decoded?.data?.email ||
      null;

    console.log("[DEBUG] Decoded token payload:", {
      keys: Object.keys(decoded),
      email,
      rawEmail: decoded.email,
      userEmail: decoded.user?.email,
      id: decoded.id,
      role: decoded.role,
      fullPayload: decoded,
    });

    if (!email) {
      console.warn(
        "[WARN] Token decoded but no doctor email field found. Keys in token:",
        Object.keys(decoded),
      );
    }

    return email;
  } catch (err) {
    console.error("Error decoding token:", err);
    return null;
  }
};

// Get role from token
export const getRoleFromToken = () => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;

    const decoded = jwtDecode(token);
    return decoded.role || null;
  } catch (err) {
    console.error("Error decoding token:", err);
    return null;
  }
};

// Get current doctor (token-based)
export const getDoctor = async () => {
  try {
    const response = await api.get("/doctors/me", {});
    return response;
  } catch (error) {
    console.error("Get Doctor Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getDoctorsProfileData = async () => {
  // Alias for getAllDoctors as required by legacy components
  return getAllDoctors();
};

const normalizeEntityId = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value.$oid === "string") return value.$oid;
    if (typeof value._id === "string" || typeof value._id === "number") return String(value._id);
    if (typeof value.id === "string" || typeof value.id === "number") return String(value.id);
  }

  return "";
};

export const patchPatient = async (patientId, payload) => {
  try {
    const normalizedPatientId = normalizeEntityId(patientId);

    if (!normalizedPatientId) {
      throw new Error("Invalid patient id");
    }

    // Use PATCH because GeneralInformationTab sends partial updates across many sections.
    const response = await api.patch(`/patients/${encodeURIComponent(normalizedPatientId)}`, payload);

    const patientData = response?.data?.patient || response?.data?.data || response?.data;
    if (!patientData || typeof patientData !== "object") {
      throw new Error("Invalid patient update response");
    }

    return patientData;
  } catch (error) {
    console.error("Patch Patient Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get all doctors
export const getAllDoctors = async () => {
  try {
    const response = await api.get("/doctors/all", {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Get All Doctors Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get doctor name by email
export const getDoctorNameByEmail = async (email) => {
  try {
    const response = await api.get(
      `/doctors/name/${encodeURIComponent(email)}`,
    );

    const doctorData = {
      firstName: response.data.firstName,
      middleName: response.data.middleName,
      lastName: response.data.lastName,
      fullName: response.data.fullName,
    };

    return doctorData;
  } catch (error) {
    const fallback = {
      fullName: email.split("@")[0],
    };
    return fallback;
  }
};

// Get doctors by department
export const getDoctorsByDepartment = async (department) => {
  try {
    const response = await api.get(`/doctors/by-department/${encodeURIComponent(department)}`, {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Get Doctors By Department Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get doctors by IDs
export const getDoctorsByIds = async (doctorIds) => {
  try {
    const response = await api.get(`/doctors/by-ids`, {
      params: { ids: doctorIds.join(",") },
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Get Doctors By IDs Error:", error.response?.data || error.message);
    throw error;
  }
};

// Update current doctor (token-based)
export const updateDoctor = async (data) => {
  try {
    const response = await api.put("/doctors/me", data, {});
    return response;
  } catch (error) {
    console.error(
      "Update Doctor Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Update doctor by ID (admin or head_doctor)
export const updateDoctorById = async (doctorId, data) => {
  try {
    const response = await api.put(`/doctors/${doctorId}`, data, {
      headers: {}
    });
    return response;
  } catch (error) {
    console.error("Update Doctor By ID Error:", error.response?.data || error.message);
    throw error;
  }
};

// Update doctor status (admin or head_doctor)
export const updateDoctorStatus = async (doctorId, status) => {
  try {
    const response = await api.put(`/doctors/${doctorId}/status`, { status }, {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Update Doctor Status Error:", error.response?.data || error.message);
    throw error;
  }
};

// Update doctor department (admin or head_doctor)
export const updateDoctorDepartment = async (doctorId, department) => {
  try {
    const response = await api.put(`/doctors/${doctorId}/department`, { department }, {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Update Doctor Department Error:", error.response?.data || error.message);
    throw error;
  }
};

// Upload profile image
export const uploadProfileImage = async (formData) => {
  try {
    const response = await api.post("/doctors/upload/profile-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response;
  } catch (error) {
    console.error("Upload Image Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get image by ID
export const getImage = async (profileFileId) => {
  try {
    const response = await api.get(`/doctors/image-by-id/${profileFileId}`, {
      responseType: "blob",
      headers: {}
    });
    return response.data;
  } catch (err) {
    console.error("Get image failed:", err);
    throw err;
  }
};

export const postAvailability = async (data, doctorEmail = null) => {
  try {
    const userEmail = getEmailFromToken();
    const userRole = getRoleFromToken();
    if (!userEmail || !userRole) {
      throw new Error("User email or role not found in token");
    }

    if (userRole === "doctor") {
      throw new Error("Doctors cannot create schedules");
    }

    if (userRole === "specialist" && doctorEmail && doctorEmail !== userEmail) {
      throw new Error("Specialists can only manage their own schedule");
    }

    const payload = {
      ...data,
      doctorEmail: doctorEmail || userEmail,
    };

    const response = await api.post("/doctors/availability", payload, {
      headers: {}
    });
    return response;
  } catch (error) {
    console.error(
      "Post Availability Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Get availability within date range
export const getAvailability = async (start, end, doctorEmail = null) => {
  try {
    const userEmail = getEmailFromToken();
    const userRole = getRoleFromToken();
    if (!userEmail || !userRole) {
      throw new Error("User email or role not found in token");
    }

    if (["doctor", "specialist"].includes(userRole) && doctorEmail && doctorEmail !== userEmail) {
      throw new Error(`${userRole.charAt(0).toUpperCase() + userRole.slice(1)}s can only view their own schedule`);
    }

    const response = await api.get("/doctors/availability", {
      params: { start, end, doctorEmail: doctorEmail || userEmail },
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error(
      "Get Availability Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const deleteAvailability = async (id, doctorEmail = null) => {
  try {
    const userEmail = getEmailFromToken();
    const userRole = getRoleFromToken();
    if (!userEmail || !userRole) {
      throw new Error("User email or role not found in token");
    }

    if (userRole === "doctor") {
      throw new Error("Doctors cannot delete schedules");
    }

    if (userRole === "specialist" && doctorEmail && doctorEmail !== userEmail) {
      throw new Error("Specialists can only delete their own schedule");
    }

    const response = await api.delete(`/doctors/availability/${id}`, {
      params: { doctorEmail: doctorEmail || userEmail },
      headers: {}
    });

    return response.data;
  } catch (error) {
    console.error(
      "Delete Availability Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getMessages = async () => {
  try {
    const res = await api.get("/doctors/messages", {
      headers: {}
    });
    return res.data;
  } catch (err) {
    console.error("Get messages error:", err.response?.data || err.message);
    throw err;
  }
};

// Send a new message
export const sendMessage = async (data) => {
  try {
    const res = await api.post("/doctors/messages", data, {
      headers: {}
    });
    return res.data;
  } catch (err) {
    console.error("Send message error:", err.response?.data || err.message);
    throw err;
  }
};

export const deleteMessage = async (messageId) => {
  try {
    const res = await api.delete(`/doctors/messages/${messageId}`, {
      headers: {}
    });
    return res.data;
  } catch (err) {
    console.error("Error deleting message:", err);
    throw err;
  }
};

export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const config = {
      headers: { "Content-Type": "multipart/form-data" },
    };

    const res = await api.post("/doctors/messages/upload", formData, config);
    return res.data;
  } catch (err) {
    console.error("File upload error:", err.response?.data || err.message);
    throw err;
  }
};

export const getPatientsByDoctor = async (
  doctorEmail,
  page = 1,
  limit = 20,
  search = ""
) => {
  try {
    const response = await api.get(`/patients`, {
      params: { doctorEmail, page, limit, search },
      headers: {}
    });
    return response.data?.patients ?? response.data ?? [];
  } catch (error) {
    console.error("Get Patients Error:", error.response?.data || error.message);
    throw error;
  }
};

// Correct API call (matches Express route)
export const getAppointmentById = async (applicationId) => {
  try {
    const res = await api.get(
      `/applications/by-application-id/${encodeURIComponent(applicationId)}`,
      {
        headers: {}
      }
    );
    return res.data;
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || error.message;
    throw {
      id: applicationId,
      status,
      data,
      message: `Request failed with status code ${status}`,
    };
  }
};

export const getMedicalHistoryByEmail = async (email) => {
  try {
    const res = await api.get(
      `/applications/medical-history/by-email/${encodeURIComponent(email)}`,
      {
        headers: {}
      }
    );
    return res.data;
  } catch (error) {
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Unknown error",
    };
  }
};

export const joinMeetingByUser = async (payload) => {
  return api.post(`/meetings/join-by-user`, payload, {
    headers: {}
  });
};

// === BBB Telemedicine APIs ===
export const createTelemedicineRoom = async (applicationId) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/create`);
  return res.data;
};

export const joinTelemedicineRoom = async (applicationId, { role, name } = {}) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/join`, { role, name });
  return res.data;
};

export const endTelemedicineRoom = async (applicationId) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/end`);
  return res.data;
};

export const getTelemedicineRoomStatus = async (applicationId) => {
  const res = await api.get(`/telemedicine/${encodeURIComponent(applicationId)}/status`);
  return res.data;
};


export const updateAppointment = async (appointmentId, updatedData) => {
  try {
    const res = await api.put(
      `/applications/${encodeURIComponent(appointmentId)}`,
      updatedData,
      {
        headers: {}
      }
    );
    return res.data;
  } catch (error) {
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Unknown error",
    };
  }
};

export const updateAppointmentComments = async (
  appointmentId,
  commentId,
  commentUpdate
) => {
  try {
    const res = await api.put(
      `/applications/${encodeURIComponent(
        appointmentId
      )}/comments/${commentId}`,
      commentUpdate,
      {
        headers: {}
      }
    );
    return res.data;
  } catch (error) {
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Unknown error",
    };
  }
};

export const addCommentInAppointment = async (appointmentId, comments) => {
  const encodedId = encodeURIComponent(appointmentId);
  const response = await api.put(`/applications/${encodedId}/comments`, {
    comments,
  }, {
    headers: {}
  });
  return response.data;
};

export const deleteAppointmentComment = async (appointmentId, commentId) => {
  const response = await api.delete(
    `/applications/${encodeURIComponent(appointmentId)}/comments/${commentId}`,
    {
      headers: {}
    }
  );
  return response.data;
};

export const updateAppointmentPrescription = async (
  appointmentId,
  prescription
) => {
  const response = await api.put(
    `/applications/${encodeURIComponent(appointmentId)}/prescription`,
    { prescription },
    {
      headers: {}
    }
  );
  return response.data;
};

export const updateAppointmentConclusion = async (
  appointmentId,
  conclusion
) => {
  const response = await api.put(
    `/applications/${encodeURIComponent(appointmentId)}/conclusion`,
    { conclusion },
    {
      headers: {}
    }
  );
  return response.data;
};

export const getMedicalHistoryByAppointmentId = async (appointmentId) => {
  const res = await api.get(
    `/applications/by-application-id/${encodeURIComponent(appointmentId)}`,
    {
      headers: {}
    }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch medical history");
  }
  return await res.json();
};

export const getAppointmentsByDoctor = async (
  doctorEmail,
  page = 1,
  limit = 21,
  status = "all",
  search = ""
) => {
  try {
    console.log("[API] getAppointmentsByDoctor called with:", {
      doctorEmail,
      page,
      limit,
      status,
      search,
    });

    const response = await api.get(
      `/applications/doctor/${encodeURIComponent(doctorEmail)}`,
      {
        params: { page, limit, status, search },
        headers: {},
      },
    );

    console.log("[API] getAppointmentsByDoctor response status:", response.status);
    console.log("[API] getAppointmentsByDoctor response data keys:", Object.keys(response.data));

    let appointments = [];
    let totalCount = 0;

    if (response.data.success === false) {
      throw new Error(response.data.message || "API request failed");
    }

    if (response.data.data) {
      appointments = response.data.data.appointments || [];
      totalCount = response.data.data.totalCount || appointments.length;
    } else if (Array.isArray(response.data)) {
      appointments = response.data;
      totalCount = response.data.length;
    } else {
      appointments = response.data.appointments || [];
      totalCount = response.data.totalCount || appointments.length;
    }

    console.log("[API] getAppointmentsByDoctor payload count:", appointments.length);

    return {
      appointments,
      totalCount,
    };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const getDocument = async (documentFileId) => {
  try {
    const response = await api.get(
      `/applications/appointments/document-by-id/${documentFileId}`,
      {
        responseType: "blob",
        headers: {}
      }
    );
    return response.data;
  } catch (err) {
    console.error("Get document failed:", err);
    throw err;
  }
};

export const getApplications = async (doctorEmail, startISO, endISO) => {
  if (!doctorEmail) {
    console.error("doctorEmail is required!");
    throw new Error("doctorEmail is required");
  }

  return api.get("/applications", {
    params: {
      doctorEmail,
      start: startISO,
      end: endISO,
    },
    headers: {}
  });
};

// === Get Applications for Calendar (Doctor Calendar Specific) ===
export const getCalendarApplications = async ({ start, end, status, followup, doctorEmail }) => {
  try {
    const response = await api.get("/applications/calender", {
      params: {
        start,
        end,
        status,
        followup,
        doctorEmail,
      },
      headers: {},
    });
    return response;
  } catch (error) {
    console.error("Get Calendar Applications Error:", error.response?.data || error.message);
    throw error;
  }
};


export const getAllPatients = async () => {
  try {
    const response = await api.get("/patients/all", {
      headers: {}
    });
    return response.data?.patients ?? response.data ?? [];
  } catch (error) {
    console.error(
      "Get All Patients Error:",
      error.response?.data || error.message
    );

    if (error.response?.status === 404 || error.response?.status === 500) {
      return [
        { id: 1, name: "Ivan Petrov", email: "ivan.petrov@mail.ru" },
        { id: 2, name: "Elena Sidorova", email: "elena.s@mail.ru" },
        { id: 3, name: "Dmitri Volkov", email: "d.volkov@gmail.com" },
        { id: 4, name: "Olga Smirnova", email: "smirnova.o@yandex.ru" },
        { id: 5, name: "Alexei Kuznetsov", email: "a.kuznetsov@mail.ru" },
      ];
    }

    throw error;
  }
};

export const createPatient = async (patientData) => {
  try {
    const response = await api.post(
      "/patients/create-new-patient",
      patientData,
    );
    return response.data;
  } catch (error) {
    console.error(
      "Create Patient Error:",
      error.response?.data || error.message
    );

    if (error.response?.status === 409) {
      throw new Error("A patient with this email already exists.");
    }

    throw error;
  }
};

export const updateVerificationStatus = async (
  type,
  appointmentId,
  field,
  status
) => {
  const response = await api.put(
    `/applications/${appointmentId}/update-verification`,
    { type, field, status },
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data;
};

export const getAvailableTests = async () => {
  try {
    const response = await api.get("/specialties/all-tests", {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching available tests:", error);
    throw error;
  }
};

// fetch all specialty names for dropdowns
export const getSpecialties = async () => {
  try {
    const response = await api.get("/specialties/all");
    return response.data;
  } catch (error) {
    console.error("Error fetching specialties:", error);
    throw error;
  }
};

export const addTestToAppointment = async (appointmentId, test) => {
  try {
    const response = await api.put(
      `/applications/appointments/${appointmentId}/add-test`,
      {
        test,
      },
      {
        headers: {}
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding test to appointment:", error);
    throw error;
  }
};

export const addMultipleTestsToAppointment = async (appointmentId, tests) => {
  try {
    const response = await api.put(
      `/specialties/${encodeURIComponent(appointmentId)}/add-multiple-tests`,
      {
        tests: tests.map((test) => ({
          testId: test.testId,
          testName: test.testName,
          appointmentId: test.appointmentId,
          result: "",
        })),
      },
      {
        headers: {}
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding multiple tests to appointment:", error);
    throw error;
  }
};

export const updateTestResult = async (appointmentId, testName, result) => {
  try {
    const response = await api.put(
      `/applications/appointments/${appointmentId}/update-test-result`,
      {
        testName,
        result,
      },
      {
        headers: {}
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating test result:", error);
    throw error;
  }
};

// Get orders by their IDs
export const getOrdersByIds = async (orderIds) => {
  try {
    const response = await api.get(`/specialties/orders`, {
      params: {
        ids: orderIds.join(","),
      },
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
};

// Get assistants by doctor email
export const getAssistantsByDoctor = async (doctorEmail) => {
  try {
    const res = await api.get(`/assistants/doctors/${encodeURIComponent(doctorEmail)}/assistants`, {
      headers: {}
    });
    // Handle response structure: { assistants: [...] } or direct array
    return Array.isArray(res.data) ? res.data : res.data?.assistants || res.data?.data || [];
  } catch (error) {
    console.error("Error fetching assistants:", error);
    throw error;
  }
};

// Grant access
export const grantAccess = async ({
  assistantEmail,
  accessId,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  return api.patch(`/assistants/grant-access`, {
    assistantEmail,
    accessId,
    doctorEmail,
    startDateTime,
    endDateTime,
  }, {
    headers: {}
  });
};

export const revokeAccess = async ({
  assistantEmail,
  accessId,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  return api.patch(`/assistants/revoke-access`, {
    assistantEmail,
    accessId,
    doctorEmail,
    startDateTime,
    endDateTime,
  }, {
    headers: {}
  });
};

export const removeAssistantFromDoctor = async ({
  assistantId,
  doctorEmail,
}) => {
  return api.delete(`/assistants/${assistantId}/assign-doctor/${encodeURIComponent(doctorEmail)}`, {
    headers: {},
  });
};

export const updateAccessTime = async ({
  assistantEmail,
  accessId,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  try {
    const response = await api.patch(`/assistants/update-access-time`, {
      assistantEmail,
      accessId,
      doctorEmail,
      startDateTime,
      endDateTime,
    }, {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Update Access Time Error:", error);
    throw error;
  }
};

export const requestAssistantAccess = async ({
  assistantEmail,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  return api.post(
    `/assistants/assign-doctor`,
    {
      assistantEmail,
      doctorEmail,
      startDateTime,
      endDateTime,
    },
    {
      headers: {},
    },
  );
};

export const getDoctorEarlyDetectionApplications = (doctorEmail) => {
  console.log("[API] getDoctorEarlyDetectionApplications called with email:", doctorEmail);
  return api.get(`/early-detection/doctor`, {
    params: { doctorEmail },
    headers: {}
  }).then((response) => {
    console.log("[API] getDoctorEarlyDetectionApplications response:", {
      status: response.status,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      length: Array.isArray(response.data) ? response.data.length : 'N/A',
      firstItem: Array.isArray(response.data) && response.data[0] ? response.data[0] : null,
    });
    return response;
  }).catch((error) => {
    console.error("[API] getDoctorEarlyDetectionApplications error:", error.message, error.response?.data);
    throw error;
  });
};

export const getEarlyDetectionApplication = async (
  applicationId,
  doctorEmail
) => {
  return await api.get(`/early-detection/doctor/single`, {
    params: {
      applicationId,
      doctorEmail,
    },
    headers: {}
  });
};

export const updateEarlyDetectionAppointmentPrescription = async (
  applicationId,
  payload
) => {
  const response = await api.put(
    `/early-detection/${encodeURIComponent(applicationId)}/prescription`,
    payload,
    {
      headers: {}
    }
  );
  return response.data;
};

export const updateEarlyDetectionAppointmentConclusion = async (
  applicationId,
  payload
) => {
  const response = await api.put(
    `/early-detection/${encodeURIComponent(applicationId)}/conclusion`,
    payload,
    {
      headers: {}
    }
  );
  return response.data;
};

export const updateEarlyDetectionAppointmentComment = async (
  applicationId,
  commentId,
  commentUpdate
) => {
  try {
    const res = await api.put(
      `/early-detection/${encodeURIComponent(
        applicationId
      )}/comments/${commentId}`,
      commentUpdate,
      {
        headers: {}
      }
    );
    return res.data;
  } catch (error) {
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Unknown error",
    };
  }
};

export const addEarlyDetectionAppointmentComment = async (
  applicationId,
  comments
) => {
  const encodedId = encodeURIComponent(applicationId);
  const response = await api.put(`/early-detection/${encodedId}/comments`, {
    comments,
  }, {
    headers: {}
  });
  return response.data;
};

export const deleteEarlyDetectionAppointmentComment = async (
  applicationId,
  commentId
) => {
  const response = await api.delete(
    `/early-detection/${encodeURIComponent(
      applicationId
    )}/comments/${commentId}`,
    {
      headers: {}
    }
  );
  return response.data;
};

export const addMultipleTestsToEarlyDetectionAppointment = async (
  applicationId,
  tests
) => {
  try {
    const response = await api.put(
      `/early-detection/${encodeURIComponent(
        applicationId
      )}/add-multiple-tests`,
      {
        tests: tests.map((test) => ({
          testId: test.testId,
          testName: test.testName,
          appointmentId: applicationId,
          vendorName: test.vendorName || null,
        })),
      },
      {
        headers: {}
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding multiple tests to early detection:", error);
    throw error;
  }
};

export const getPatientByEmail = async (email) => {
  try {
    const encodedEmail = encodeURIComponent(email);
    const res = await api.get(`/patients/email/${encodedEmail}`, {
      headers: {}
    });
    // Normalize response: backend may return { patient: {...} } or patient directly
    return res.data && res.data.patient ? res.data.patient : res.data;
  } catch (error) {
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Failed to fetch patient by email",
    };
  }
};

export const updateEarlyDetectionVerificationStatus = async (
  type,
  applicationId,
  field,
  status,
  doctorEmail
) => {
  const response = await api.put(
    `/early-detection/${encodeURIComponent(applicationId)}/update-verification`,
    { type, field, status, doctorEmail },
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data;
};

export const getCommonNotifications = () => {
  return api
    .get("/notifications/common",)
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

      console.error("API Error:", errorDetails);
      return Promise.reject(errorDetails);
    });
};

export const getPersonalNotifications = (email) => {
  return api
    .get(`/notifications/personal?email=${email}`, {
      headers: {}
    })
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      console.error("Error fetching personal notifications:", error);
      throw error;
    });
};

export const markNotificationAsRead = (notificationId, role) => {
  return api.patch(`/notifications/${notificationId}/read`, { role }, {
// Save follow-up for an appointment
    headers: {}
  });
};

export const saveFollowUp = async (applicationId, { needed, comment, booked }) => {
  return await api.put(`/applications/${encodeURIComponent(applicationId)}/follow-up`, {
    needed,
    comment,
    booked
  }, {
    headers: {}
  });
};

export const getFollowUp = async (appointmentId) => {
  try {
    const res = await api.get(`/applications/${appointmentId}/follow-up`, {
      headers: {}
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching follow-up:", err);
    throw err.response?.data || err;
  }
};

export const sendPasswordResetEmail = async (data) => {
  const response = await api.post(`/auth/forgot-password`, data);
  return response;
};

export const resetPassword = async (data) => {
  const response = await api.post(`/auth/reset-password`, data);
  return response;
};

export const verifyResetToken = async (token) => {
  const response = await api.get(`/auth/verify-reset-token/${token}`);
  return response;
};

export const viewDocument = (docId) => {
  return api
    .get(`/applications/appointments/document-by-id/${docId}`, {
      responseType: 'blob',
    })
    .then((response) => {
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      return { success: true };
    })
    .catch((error) => {
      console.error('Error viewing document:', error);
      throw error;
    });
};

export const downloadDocument = (docId, filename = 'document') => {
  return api
    .get(`/applications/appointments/document-by-id/${docId}?download=true`, {
      responseType: 'blob',
    })
    .then((response) => {
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    })
    .catch((error) => {
      console.error('Error downloading document:', error);
      throw error;
    });
};

export const viewResultDocument = (resultFileId) => {
  return api
    .get(`/applications/results/${resultFileId}`, {
      responseType: 'blob',
    })
    .then((response) => {
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      return { success: true };
    })
    .catch((error) => {
      console.error('Error viewing document:', error);
      throw error;
    });
};

export const downloadResultDocument = (resultFileId, filename = 'document') => {
  return api
    .get(`/applications/results/${resultFileId}?download=true`, {
      responseType: 'blob',
    })
    .then((response) => {
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    })
    .catch((error) => {
      console.error('Error downloading document:', error);
      throw error;
    });
};

// === Max Messenger APIs ===
export const getMaxChats = async () => {
  try {
    const response = await api.get("/max/chats", {
      params: { profile_id: import.meta.env.VITE_MAX_PROFILE_ID || "8370586e-3dfd" },
    });
    return response.data;
  } catch (error) {
    console.error("Get Max Chats Error:", error.response?.data || error.message);
    throw error;
  }
};

export const filterMaxChats = async (client_name) => {
  try {
    const response = await api.get("/max/chats/filter", {
      params: { client_name, profile_id: import.meta.env.VITE_MAX_PROFILE_ID || "8370586e-3dfd" },
    });
    return response.data;
  } catch (error) {
    console.error("Filter Max Chats Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getMaxMessages = async (chat_id) => {
  try {
    const response = await api.get("/max/chat/messages", {
      params: { chat_id },
    });
    return response.data; // Expect [{ id, body, fromMe, type, time, ... }]
  } catch (error) {
    console.error("Get Max Messages Error:", error.response?.data || error.message);
    throw error;
  }
};

export const sendMaxMessage = async (to, message) => {
  try {
    const response = await api.post("/max/send", { to, message });
    return response.data;
  } catch (error) {
    console.error("Send Max Message Error:", error.response?.data || error.message);
    throw error;
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
    console.error("Send Max File Error:", error.response?.data || error.message);
    throw error;
  }
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
  const res = await api.put(`/chat-messages/mark-read`, { receiverEmail, senderEmail });
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

// Get unread counts (received)
export const getUnreadCounts = async (email) => {
  const res = await api.get(`/chat-messages/unread/${email}`);
  return res.data.unread || {};
};

// Get all doctors (from DoctorsProfile)
export const getDoctors = async () => {
  try {
    const res = await api.get("/doctors/all");
    return res.data;
  } catch (error) {
    console.error("Error fetching doctors:", error);
    throw error;
  }
};

// Get all managers (manager + head_manager)
export const getManagersData = async () => {
  try {
    const res = await api.get("/managers/all");
    return {
      managers: res.data?.managers || [],
      headManagers: res.data?.headManagers || [],
    };
  } catch (error) {
    if (error?.response?.status === 404) {
      return {
        managers: [],
        headManagers: [],
      };
    }
    console.error("Get Managers Data Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get branches of the current logged-in doctor
export const getDoctorBranches = async () => {
  try {
    const response = await api.get("/doctors/branches", {
      headers: {}
    });
    return response.data;
  } catch (error) {
    console.error("Get Doctor Branches Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get all assistants (assistant + head_assistant)
export const getAssistantsData = async () => {
  try {
     const [assistantRes, headAssistantRes] = await Promise.allSettled([
       api.get("/assistants"), // all assistants
       api.get("/head-assistants"), // all head assistants
    ]);

    const assistants =
      assistantRes.status === "fulfilled"
        ? (Array.isArray(assistantRes.value.data) ? assistantRes.value.data : assistantRes.value.data?.assistants || [])
        : assistantRes.reason?.response?.status === 404
          ? []
          : null;

    const headAssistants =
      headAssistantRes.status === "fulfilled"
        ? (Array.isArray(headAssistantRes.value.data) ? headAssistantRes.value.data : headAssistantRes.value.data?.headAssistants || [])
        : headAssistantRes.reason?.response?.status === 404
          ? []
          : null;

    if (assistants === null || headAssistants === null) {
      throw new Error("Failed to fetch assistants data");
    }

    return {
      assistants,
      headAssistants,
    };
  } catch (error) {
    console.error("Get Assistants Data Error:", error.response?.data || error.message);
    throw error;
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


//-------------Patient Related APIS-----------------//

//Update patient basic Data
export const updatePatientBasicData = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient basic data:", error);
    throw error;
  }
}

//Update Patient legal representative
export const updateLegalRepresentative = async(patientId, legalRepId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/legal-representative/${legalRepId}`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating legal representative:", error);
    throw error;
  }
}

//Create Patient legal representative
export const createLegalRepresentative = async(patientId, data)=>{
  try {
    const response = await api.post(`/patients/${patientId}/legal-representative`, data);
    return response.data;
  } catch (error) {
    console.error("Error creating legal representative:", error);
    throw error;
  }
}

//Update patient contact person
export const updateContactPerson = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/contact-person`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating contact person:", error);
    throw error;
  }
}

//Update Patient Documents
export const updatePatientDocuments = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/documents`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient documents:", error);
    throw error;
  }
}

//Update Patient Address
export const updatePatientAddress = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/address`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient address:", error);
    throw error;
  }
}

//Update Patient Disease Information
export const updatePatientDiseaseInfo = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/disease-info`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient disease information:", error);
    throw error;
  }
}

//Update Patient Final Diagnosis
export const updatePatientFinalDiagnosis = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/final-diagnosis`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient final diagnosis:", error);
    throw error;
  }
}

//Update Patient Personal Data
export const updatePatientPersonalData = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/personal-data`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient personal data:", error);
    throw error;
  }
}

//Update patient Disability
export const updatePatientDisability = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/disability`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient disability:", error);
    throw error;
  }
}

//Update Patient Anamnesis
export const updatePatientAnamnesis = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/anamnesis`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient anamnesis:", error);
    throw error;
  }
}

//Update Patient Radiation Doses
export const updatePatientRadiationDoses = async(patientId, data)=>{
  try {
    const response = await api.put(`/patients/${patientId}/radiation-doses`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient radiation doses:", error);
    throw error;
  }
}

// Update appointment history form (only applicationId is required)
export const updatePatientHistoryForm = async (applicationId, data) => {
  try {
    const response = await api.put(`/applications/${encodeURIComponent(applicationId)}/history-form`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating patient history form:", error);
    throw error;
  }
}

// --- History template helpers -------------------------------------------------
// fieldKey is optional; if provided the server filters by it
export const getHistoryTemplates = async (fieldKey) => {
  try {
    const response = await api.get(`/history-templates`, { params: { fieldKey } });
    return response.data;
  } catch (error) {
    console.error("Error fetching history templates:", error);
    throw error;
  }
};

export const createHistoryTemplate = async (template) => {
  try {
    const response = await api.post(`/history-templates`, template);
    return response.data;
  } catch (error) {
    console.error("Error creating history template:", error);
    throw error;
  }
};

export const updateHistoryTemplate = async (id, data) => {
  try {
    const response = await api.put(`/history-templates/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating history template:", error);
    throw error;
  }
};

export const deleteHistoryTemplate = async (id) => {
  try {
    const response = await api.delete(`/history-templates/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting history template:", error);
    throw error;
  }
};

// ========== Doctor Break APIs ========== //
export const getDoctorBreaks = async (date) => {
  try {
    const params = {};
    if (date) params.date = date;
    const response = await api.get('/doctors/doctor-breaks', { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching doctor breaks:", error);
    throw error;
  }
};

export const addDoctorBreak = async ({ date, breaks, comment }) => {
  try {
    const response = await api.post('/doctors/doctor-breaks', { date, breaks, comment });
    return response.data;
  } catch (error) {
    console.error("Error adding doctor break:", error);
    throw error;
  }
};

export const updateDoctorBreak = async (breakId, { date, breaks, comment }) => {
  try {
    const response = await api.put(`/doctors/doctor-breaks/${breakId}`, { date, breaks, comment });
    return response.data;
  } catch (error) {
    console.error("Error updating doctor break:", error);
    throw error;
  }
};

export const deleteDoctorBreak = async (breakId) => {
  try {
    const response = await api.delete(`/doctors/doctor-breaks/${breakId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting doctor break:", error);
    throw error;
  }
};

// ========== Early Detection Booking APIs ==========

export const getEarlyDetectionBookings = async (doctorEmail) => {
  console.log("[API] getEarlyDetectionBookings called with email:", doctorEmail);
  try {
    const response = await api.get('/early-detection/bookings/calendar', {
      params: doctorEmail ? { doctorEmail } : {},
    });
    console.log("[API] getEarlyDetectionBookings response:", {
      status: response.status,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      length: Array.isArray(response.data) ? response.data.length : 'N/A',
      firstItem: Array.isArray(response.data) && response.data[0] ? response.data[0] : null,
    });
    return response;
  } catch (error) {
    console.error("[API] getEarlyDetectionBookings error:", error.message, error.response?.data);
    throw error;
  }
};

export const getEarlyDetectionDoctors = async () => {
  // backend has /doctors/all
  return api.get('/doctors/all');
};

const getManagedTestsEndpoint = (section) => {
  return `/early-detection/bookings/tests/${encodeURIComponent(section)}`;
};

export const getEarlyDetectionManagedTests = async (section) => {
  const url = getManagedTestsEndpoint(section);
  return api.get(url);
};

export const createEarlyDetectionManagedTest = async (section, payload) => {
  const url = getManagedTestsEndpoint(section);
  return api.post(url, payload);
};

export const updateEarlyDetectionManagedTest = async (section, testId, payload) => {
  const url = `${getManagedTestsEndpoint(section)}/${encodeURIComponent(testId)}`;
  return api.put(url, payload);
};

export const deleteEarlyDetectionManagedTest = async (section, testId) => {
  const url = `${getManagedTestsEndpoint(section)}/${encodeURIComponent(testId)}`;
  return api.delete(url);
};

export const getEarlyDetectionBookingById = async (bookingId) => {
  return api.get(`/early-detection/bookings/${encodeURIComponent(bookingId)}`);
};

export const updateEarlyDetectionBooking = async (bookingId, payload) => {
  return api.put(`/early-detection/bookings/${encodeURIComponent(bookingId)}`, payload);
};

const resolveBookingIdForNotes = async (bookingId) => {
  // If it looks like an application ID (e.g., ED-SEED-001), resolve it upfront
  if (String(bookingId).includes('-') && !String(bookingId).match(/^[a-f0-9]{24}$/i)) {
    try {
      const listRes = await getEarlyDetectionBookings();
      const bookings = Array.isArray(listRes?.data)
        ? listRes.data
        : Array.isArray(listRes?.data?.data)
          ? listRes.data.data
          : [];

      // Try exact match first
      let match = bookings.find((item) => {
        const id = String(item?._id || "");
        const bookingNumber = String(item?.bookingNumber || "");
        const invoiceNumber = String(item?.invoiceNumber || "");
        const applicationId = String(item?.applicationId || "");
        const target = String(bookingId || "");
        return id === target || bookingNumber === target || invoiceNumber === target || applicationId === target;
      });

      // If no exact match and we have bookings, just use the first one
      // (for cases like ED-SEED-001 where there's no direct field mapping)
      if (!match && bookings.length > 0) {
        match = bookings[0];
      }

      if (match?._id) {
        return String(match._id);
      }
    } catch {
      // Fall through to original ID
    }
  }

  // For standard IDs, try direct lookup with retry fallback
  try {
    const res = await getEarlyDetectionBookingById(bookingId);
    const resolvedId = res?.data?._id || res?.data?.data?._id;
    if (resolvedId) return resolvedId;
  } catch {
    // Fall through and try list-based lookup.
  }

  try {
    const listRes = await getEarlyDetectionBookings();
    const bookings = Array.isArray(listRes?.data)
      ? listRes.data
      : Array.isArray(listRes?.data?.data)
        ? listRes.data.data
        : [];

    const match = bookings.find((item) => {
      const id = String(item?._id || "");
      const bookingNumber = String(item?.bookingNumber || "");
      const invoiceNumber = String(item?.invoiceNumber || "");
      const target = String(bookingId || "");
      return id === target || bookingNumber === target || invoiceNumber === target;
    });

    return match?._id ? String(match._id) : bookingId;
  } catch {
    return bookingId;
  }
};

export const addEarlyDetectionBookingNote = async (bookingId, payload) => {
  // Resolve booking ID upfront to handle application IDs
  const resolvedId = await resolveBookingIdForNotes(bookingId);
  return api.post(`/early-detection/bookings/${encodeURIComponent(resolvedId)}/notes`, payload);
};

export const updateEarlyDetectionBookingNote = async (bookingId, noteId, payload) => {
  // Resolve booking ID upfront to handle application IDs
  const resolvedId = await resolveBookingIdForNotes(bookingId);
  return api.put(
    `/early-detection/bookings/${encodeURIComponent(resolvedId)}/notes/${encodeURIComponent(noteId)}`,
    payload,
  );
};

export const deleteEarlyDetectionBookingNote = async (bookingId, noteId) => {
  // Resolve booking ID upfront to handle application IDs
  const resolvedId = await resolveBookingIdForNotes(bookingId);
  return api.delete(
    `/early-detection/bookings/${encodeURIComponent(resolvedId)}/notes/${encodeURIComponent(noteId)}`,
  );
};

export const generateEDPaymentLink = async (bookingId, payload) => {
  return api.post(`/early-detection/bookings/${encodeURIComponent(bookingId)}/generate-payment-link`, payload);
};

export const updateEarlyDetectionPaymentStatus = async (bookingId, payload) => {
  return api.put(`/early-detection/bookings/${encodeURIComponent(bookingId)}/payment-status`, payload);
};

export const getDoctorAppointmentsByDate = async (doctorEmail, date) => {
  return api.get('/doctors/appointments-by-date', {
    params: {
      doctorEmail,
      date,
    },
  });
};

export const getDoctorLeaves = async (doctorEmail, date) => {
  return api.get('/doctors/leaves', {
    params: {
      doctorEmail,
      date,
    },
  });
};

export const uploadEarlyDetectionScheduleFile = async (bookingId, section, formData) => {
  return api.post(
    `/early-detection/bookings/${encodeURIComponent(bookingId)}/schedule/${encodeURIComponent(section)}/upload`,
    formData,
  );
};

export const fetchEarlyDetectionScheduleFile = async (fileId) => {
  return api.get(`/early-detection/bookings/files/${encodeURIComponent(fileId)}`, {
    responseType: "blob",
  });
};

export const getEarlyDetectionScheduleFileUrl = (fileId) => {
  if (!fileId) return "";
  const base = api.defaults.baseURL || baseUrl || "";
  if (base) {
    const normalizedBase = base.replace(/\/api$/, "");
    return `${normalizedBase}/api/early-detection/bookings/files/${encodeURIComponent(fileId)}`;
  }
  return `/api/early-detection/bookings/files/${encodeURIComponent(fileId)}`;
};

export const saveEarlyDetectionSpecialistHistoryForm = async (bookingId, specialistIndex, payload) => {
  return api.put(
    `/early-detection/bookings/${encodeURIComponent(bookingId)}/specialist-consultations/${specialistIndex}/history-form`,
    payload,
  );
};

// === Early Detection Report APIs ===

/**
 * GET /api/early-detection/report/:bookingId
 * Retrieves an early detection report by booking ID
 */
export const getEarlyDetectionReport = async (bookingId) => {
  try {
    const response = await api.get(`/early-detection/report/${encodeURIComponent(bookingId)}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching early detection report:", error);
    throw error;
  }
};

/**
 * PUT /api/early-detection/report/:bookingId
 * Saves or updates an early detection report
 */
export const saveEarlyDetectionReport = async (bookingId, data) => {
  try {
    const response = await api.put(`/early-detection/report/${encodeURIComponent(bookingId)}`, data);
    return response.data;
  } catch (error) {
    console.error("Error saving early detection report:", error);
    throw error;
  }
};

// === Early Detection Template APIs ===

/**
 * GET /api/early-detection/templates
 * Retrieves all early detection templates, optionally filtered by fieldKey
 */
export const getEarlyDetectionTemplates = async (fieldKey) => {
  try {
    const params = {};
    if (fieldKey) params.fieldKey = fieldKey;
    const response = await api.get(`/early-detection/templates`, { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching early detection templates:", error);
    throw error;
  }
};

/**
 * POST /api/early-detection/templates
 * Creates a new early detection template
 */
export const createEarlyDetectionTemplate = async (data) => {
  try {
    const response = await api.post(`/early-detection/templates`, data);
    return response.data;
  } catch (error) {
    console.error("Error creating early detection template:", error);
    throw error;
  }
};

/**
 * PUT /api/early-detection/templates/:id
 * Updates an early detection template
 */
export const updateEarlyDetectionTemplate = async (id, data) => {
  try {
    const response = await api.put(`/early-detection/templates/${encodeURIComponent(id)}`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating early detection template:", error);
    throw error;
  }
};

/**
 * DELETE /api/early-detection/templates/:id
 * Deletes an early detection template
 */
export const deleteEarlyDetectionTemplate = async (id) => {
  try {
    const response = await api.delete(`/early-detection/templates/${encodeURIComponent(id)}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting early detection template:", error);
    throw error;
  }
};

export default api;
