// src/utils/api.js (Assistant)
import axios from "axios";
import { jwtDecode } from "jwt-decode";

let authContext = null;
export const setAuthContext = (ctx) => {
  authContext = ctx;
};

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BASE_URL}/api`,
  withCredentials: true,
});

// === Refresh Handling State ===
let refreshPromise = null; // single in-flight promise; deduplicates concurrent calls

/**
 * Sends one /auth/refresh HTTP call and updates localStorage + axios defaults.
 * Uses a raw axios instance to bypass our own request/response interceptors.
 */
async function sendRefreshRequest(rt) {
  const { data } = await axios.post(
    `${import.meta.env.VITE_BASE_URL}/api/auth/refresh`,
    { refreshToken: rt }
  );

  const newToken   = data.accessToken;
  const newRefresh = data.refreshToken;
  if (!newToken) throw new Error("Refresh failed: no new access token");

  localStorage.setItem("accessToken", newToken);
  if (newRefresh) localStorage.setItem("refreshToken", newRefresh);

  api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

  if (authContext?.updateToken) {
    authContext.updateToken(newToken, newRefresh);
  }

  return newToken;
}

/**
 * Central refresh function.
 * Only one HTTP call is made even when called by many concurrent callers
 * (all await the same `refreshPromise`).
 */
async function doRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = localStorage.getItem("refreshToken");
    if (!rt) throw new Error("No refresh token");
    return await sendRefreshRequest(rt);
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// === Cross-tab Token Sync ===
// When another tab successfully refreshes and writes new tokens to localStorage,
// the `storage` event fires in every OTHER tab.  Pick up the update immediately
// so stale headers never cause a 401 → 403 loop.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "accessToken" && e.newValue) {
      api.defaults.headers.common["Authorization"] = `Bearer ${e.newValue}`;
      // Notify React state without triggering a new refresh cycle.
      if (authContext?.updateToken) {
        authContext.updateToken(e.newValue, localStorage.getItem("refreshToken"));
      }
    }
  });
}

// === Request Interceptor ===
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("[REQUEST ERROR]", error);
    return Promise.reject(error);
  }
);

// === Response Interceptor ===
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for auth endpoints
    if (
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/signup") ||
      originalRequest?.url?.includes("/auth/assistant-signin") ||
      originalRequest?.url?.includes("/auth/assistant-logout") ||
      originalRequest?.url?.includes("/auth/reset") ||
      originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/auth/forgot-password") ||
      originalRequest?.url?.includes("/auth/verify-reset-token")
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await doRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        authContext?.logout?.(true);
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// === Silent Refresh Scheduler ===
let refreshTimer = null;

/**
 * Check if the current access token is expired or about to expire.
 * Returns true if it should be refreshed.
 */
function isTokenExpiringSoon(bufferMs = 60_000) {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return true;
    const { exp } = jwtDecode(token);
    return exp * 1000 - Date.now() < bufferMs;
  } catch {
    return true;
  }
}

export function scheduleTokenRefresh(token) {
  try {
    const { exp } = jwtDecode(token);
    const expiresAt = exp * 1000;
    const now = Date.now();
    // Refresh 60 seconds before expiry (gives plenty of buffer for 15-min tokens)
    const refreshAt = expiresAt - 60 * 1000;
    const delay = refreshAt - now;

    if (refreshTimer) clearTimeout(refreshTimer);

    const runRefresh = async () => {
      try {
        await doRefresh();
      } catch (err) {
        console.warn("[SILENT_REFRESH] Failed:", err.message);
        authContext?.logout?.(true);
      }
    };

    if (delay > 0) {
      refreshTimer = setTimeout(runRefresh, delay);
    } else {
      // Token already expired or expiring within the buffer — refresh immediately
      runRefresh();
    }

    return refreshTimer;
  } catch (err) {
    console.warn("[SILENT_REFRESH] Schedule error:", err.message);
    return null;
  }
}

export function stopTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// === Visibility Change Handler ===
// When user returns to a backgrounded tab, check if the token needs refreshing.
// Browser timer throttling can cause setTimeout to miss the refresh window.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const hasSession = localStorage.getItem("hadSession") === "true";
      if (hasSession && isTokenExpiringSoon(60_000)) {
        doRefresh().catch(() => {
          // If refresh fails here, the 401 interceptor will handle it
          // when the next API call is made
        });
      }
    }
  });
}

// Safe Fetch
export const safeFetch = async (...args) => {
  if (!navigator.onLine) {
    throw new Error("You are offline. Please check your connection.");
  }
  return fetch(...args);
};

// Assistant login
export const assistantSignin = async (data) => {
  try {
    const response = await api.post("/auth/assistant-signin", data);
    return response.data;
  } catch (error) {
    console.error(
      "Assistant Signin Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Get email from token
export const getEmailFromToken = () => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      return null;
    }

    const decoded = jwtDecode(token);
    return decoded.email || null;
  } catch (err) {
    console.error("Error decoding token:", err);
    return null;
  }
};

// Get current assistant (token-based)
export const getAssistant = async () => {
  try {
    const response = await api.get("/assistants/me");
    return response;
  } catch (error) {
    console.error(
      "Get Assistant Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Update Assistant Profile
export const updateAssistant = async (data) => {
  try {
    const response = await api.put("/assistants/me", data, {
      headers: {},
    });
    return response;
  } catch (error) {
    console.error(
      "Update Assistant Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Upload Assistant Profile Image
export const uploadAssistantProfileImage = async (formData) => {
  try {
    const response = await api.post(
      "/assistants/upload/profile-image",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response;
  } catch (error) {
    console.error(
      "Upload Assistant Image Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Get image by fileId
export const getAssitantImage = async (profileFileId) => {
  try {
    const response = await api.get(`/assistants/image-by-id/${profileFileId}`, {
      responseType: "blob",
      headers: {},
    });
    return response.data;
  } catch (error) {
    console.error(
      "Get Assistant Image Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Get current doctor (token-based)
export const getDoctor = async () => {
  try {
    const response = await api.get("/doctors/me", {
      headers: {},
    });
    return response;
  } catch (error) {
    console.error("Get Doctor Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getDoctors = async (assistantEmail) => {
  try {
    const response = await api.get(`/doctors`, {
      params: { assistantEmail },
      headers: {},
    });
    return response.data; // returns just the data
  } catch (error) {
    console.error("Get Doctors Error:", error.response?.data || error.message);
    throw error;
  }
};

// utils/api.js
export const getDoctorNameByEmail = async (email) => {
  try {
    const response = await api.get(
      `/doctors/name/${encodeURIComponent(email)}`,
      {
        headers: {},
      }
    );

    const doctorData = {
      firstName: response.data.firstName,
      middleName: response.data.middleName,
      lastName: response.data.lastName,
      fullName: response.data.fullName, // {en, ru}
    };

    return doctorData;
  } catch (error) {
    const fallback = {
      fullName: email.split("@")[0], // Fallback to email prefix
    };

    return fallback;
  }
};

// Update current doctor (token-based)
export const updateDoctor = async (data) => {
  try {
    const response = await api.put("/doctors/me", data, {
      headers: {},
    });
    return response;
  } catch (error) {
    console.error(
      "Update Doctor Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Upload profile image
export const uploadProfileImage = async (formData) => {
  try {
    const response = await api.post("/doctors/upload/profile-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
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
      headers: {},
    });
    return response.data;
  } catch (err) {
    console.error("Get image failed:", err);
    throw err;
  }
};

// Post availability (save a new slot)
export const postAvailability = async (data) => {
  try {
    const email = getEmailFromToken();
    if (!email) {
      throw new Error("Email not found in token");
    }

    const payload = {
      ...data,
      email,
    };

    const response = await api.post("/doctors/availability", payload, {
      headers: {},
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
export const getAvailability = async (start, end) => {
  try {
    const response = await api.get("/doctors/availability", {
      params: { start, end },
      headers: {},
    });
    return response.data; // Return the list of availability slots
  } catch (error) {
    console.error(
      "Get Availability Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const deleteAvailability = async (id) => {
  try {
    const email = getEmailFromToken();
    if (!email) {
      throw new Error("Email not found in token");
    }

    const response = await api.delete(`/doctors/availability/${id}`, {
      params: { email },
      headers: {},
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
      headers: {},
    });
    return res.data; // expect res.data.messages exists
  } catch (err) {
    console.error("Get messages error:", err.response?.data || err.message);
    throw err;
  }
};

// Send a new message
export const sendMessage = async (data) => {
  try {
    const res = await api.post("/doctors/messages", data, {
      headers: {},
    });
    return res.data; // updated messages or confirmation
  } catch (err) {
    console.error("Send message error:", err.response?.data || err.message);
    throw err;
  }
};

export const deleteMessage = async (messageId) => {
  try {
    const res = await api.delete(`/doctors/messages/${messageId}`, {
      headers: {},
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
      headers: {
        "Content-Type": "multipart/form-data",
      },
    };

    const res = await api.post("/doctors/messages/upload", formData, config);
    return res.data;
  } catch (err) {
    console.error("File upload error:", err.response?.data || err.message);
    throw err;
  }
};

export const getPatientsByDoctor = async (
  assistantEmail,
  page = 1,
  limit = 20,
  search = ""
) => {
  try {
    const response = await api.get(`/patients`, {
      params: { assistantEmail, page, limit, search },
      headers: {},
    });
    return response.data; // Return the payload directly
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
        headers: {},
      }
    );
    return res.data; // axios response data
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

// Alias used by AppointmentDetailsPage — returns full axios response so `.data` is the application object
export const getApplication = async (applicationId) => {
  return api.get(
    `/applications/by-application-id/${encodeURIComponent(applicationId)}`
  );
};

// Fetch all applications for a patient by email (used by appointment detail sidebar)
export const getApplicationsByPatient = async (patientEmail, limit = 50) => {
  const res = await api.get(
    `/applications/by-patient-email/${encodeURIComponent(patientEmail)}`,
    { params: { limit } }
  );
  return res.data;
};

// Update top-level fields on an application (e.g. appointmentStatus)
export const updateApplication = async (applicationId, data) => {
  const res = await api.patch(
    `/applications/by-application-id/${encodeURIComponent(applicationId)}`,
    data
  );
  return res.data;
};

// Save the full historyForm object on an application
export const updateHistoryForm = async (applicationId, historyForm) => {
  const res = await api.put(
    `/applications/by-application-id/${encodeURIComponent(applicationId)}/history-form`,
    { historyForm }
  );
  return res.data;
};

// Verify (or un-verify) a single history field — doctor only
export const verifyHistoryField = async (applicationId, fieldKey, isVerified, doctorEmail) => {
  const res = await api.patch(
    `/applications/by-application-id/${encodeURIComponent(applicationId)}/history-form/verify`,
    { fieldKey, isVerified, doctorEmail }
  );
  return res.data;
};

// Partially update a patient by their MongoDB _id
export const patchPatient = async (patientId, data) => {
  const res = await api.patch(`/patients/${encodeURIComponent(patientId)}`, data);
  return res.data;
};

// History templates CRUD
export const getHistoryTemplates = async () => {
  const res = await api.get("/history-templates");
  return res.data;
};

export const createHistoryTemplate = async (data) => {
  const res = await api.post("/history-templates", data);
  return res.data;
};

export const updateHistoryTemplate = async (id, data) => {
  const res = await api.put(`/history-templates/${id}`, data);
  return res.data;
};

export const deleteHistoryTemplate = async (id) => {
  const res = await api.delete(`/history-templates/${id}`);
  return res.data;
};

export const joinMeetingByUser = async ({
  applicationId,
  roomId,
  role,
  userEmail,
  name,
  profilePic,
} = {}) => {
  try {
    const res = await api.post(
      "/meetings/join-by-user",
      {
        applicationId,
        roomId,
        role,
        userEmail,
        name,
        profilePic,
      },
      { headers: {} }
    );
    return res.data;
  } catch (error) {
    console.error(
      "Join Meeting Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getMedicalHistoryByEmail = async (email) => {
  try {
    const res = await api.get(
      `/applications/medical-history/by-email/${encodeURIComponent(email)}`,
      {
        headers: {},
      }
    );
    return res.data; // Axios stores the response body in res.data
  } catch (error) {
    // Handle network/server errors
    throw {
      status: error.response?.status || 500,
      data: error.response?.data || null,
      message: error.message || "Unknown error",
    };
  }
};

export const updateAppointment = async (appointmentId, updatedData) => {
  try {
    const res = await api.put(
      `/applications/${encodeURIComponent(appointmentId)}`,
      updatedData,
      {
        headers: {},
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
        headers: {},
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
  const response = await api.put(
    `/applications/${encodedId}/comments`,
    { comments },
    {
      headers: {},
    }
  );
  return response.data;
};

// In your api.js file
export const deleteAppointmentComment = async (appointmentId, commentId) => {
  const response = await api.delete(
    `/applications/${encodeURIComponent(appointmentId)}/comments/${commentId}`,
    {
      headers: {},
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
      headers: {},
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
      headers: {},
    }
  );
  return response.data;
};

export const getMedicalHistoryByAppointmentId = async (appointmentId) => {
  const res = await api.get(
    `/applications/by-application-id/${encodeURIComponent(appointmentId)}`,
    {
      headers: {},
    }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch medical history");
  }
  return await res.json();
};

export const getAppointmentsByDoctor = async (
  assistantEmail,
  page = 1,
  limit = 21,
  status = "all",
  search = "",
  doctorEmail = "",
  patientEmail = ""
) => {
  try {
    const params = { page, limit, status, search };

    if (doctorEmail && doctorEmail !== "all") {
      params.doctorEmail = doctorEmail;
    }

    if (patientEmail) {
      params.patientEmail = patientEmail;
    }

    const response = await api.get(
      `/applications/assistant/${assistantEmail}`,
      {
        params,
        headers: {},
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "API request failed");
    }

    return {
      appointments: response.data.data.appointments,
      totalCount: response.data.data.totalCount,
    };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const getAppointmentsForCalendar = async (assistantEmail, startDate, endDate) => {
  try {
    const response = await api.get(`/applications/assistant/${assistantEmail}`, {
      params: { startDate, endDate, limit: 500, page: 1, status: "all" },
    });
    if (!response.data.success) throw new Error(response.data.message || "API request failed");
    return response.data.data.appointments || [];
  } catch (error) {
    console.error("Calendar API Error:", error);
    throw error;
  }
};

export const getDocument = async (documentFileId) => {
  try {
    const response = await api.get(
      `/applications/appointments/media/${documentFileId}`,
      {
        responseType: "blob",
        headers: {},
      }
    );
    return response.data; // This will be the Blob
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
    headers: {},
  });
};

export const getAllPatients = async () => {
  try {
    const response = await api.get("/patients/all", {
      headers: {},
    });
    return response.data;
  } catch (error) {
    console.error(
      "Get All Patients Error:",
      error.response?.data || error.message
    );

    // For demo purposes, return sample data if API fails
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
      {
        headers: {},
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Create Patient Error:",
      error.response?.data || error.message
    );

    // Check if it's a duplicate email error
    if (error.response?.status === 409) {
      throw new Error("A patient with this email already exists.");
    }

    throw error;
  }
};

// Get all available tests
export const getAvailableTests = async () => {
  try {
    const response = await api.get("/specialties/all-tests", {
      headers: {},
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching available tests:", error);
    throw error;
  }
};

// Add a single test to an appointment
export const addTestToAppointment = async (appointmentId, test) => {
  try {
    const response = await api.put(
      `/applications/appointments/${encodeURIComponent(
        appointmentId
      )}/add-test`,
      {
        test,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding test to appointment:", error);
    throw error;
  }
};

// Add multiple tests to an appointment
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
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding multiple tests to appointment:", error);
    throw error;
  }
};

// Update a test result
export const updateTestResult = async (appointmentId, testName, result) => {
  try {
    const response = await api.put(
      `/applications/appointments/${appointmentId}/update-test-result`,
      {
        testName,
        result,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating test result:", error);
    throw error;
  }
};

export const getAssistantDoctors = async (email) => {
  try {
    const res = await api.get("/assistants/doctors", {
      params: { email },
      headers: {},
    });
    // returns only the doctors array
    return res.data;
  } catch (error) {
    console.error(
      "Get Assistant Doctors Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const sendAccessRequest = async ({
  assistantEmail,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  if (!assistantEmail || !doctorEmail || !startDateTime || !endDateTime) {
    throw new Error(
      "assistantEmail, doctorEmail, startDateTime, and endDateTime are required"
    );
  }

  try {
    const res = await api.post("/assistants/access-requests", {
      assistantEmail,
      doctorEmail,
      startDateTime,
      endDateTime,
    });
    return res.data; // e.g. { ok: true } or created request object
  } catch (error) {
    console.error(
      "Send Access Request Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getDoctorsLite = async () => {
  try {
    const response = await api.get("/doctors/lite", {
      headers: {},
    });
    // Handle different response formats: could be array directly or wrapped
    console.log("[getDoctorsLite] full response:", response);
    console.log("[getDoctorsLite] response.data:", response.data);
    console.log("[getDoctorsLite] response.status:", response.status);
    const data = response.data;
    const result = Array.isArray(data) ? data : (data?.doctors || data?.data || []);
    console.log("[getDoctorsLite] parsed result length:", result.length, "first item:", result[0]);
    return result;
  } catch (error) {
    console.error("Get Doctors Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get applications for doctor (in appointments)
export const getDoctorEarlyDetectionApplications = (doctorEmail) =>
  api.get(`/early-detection/doctor`, {
    params: { doctorEmail },
    headers: {},
  });

// Get EarlyDetectionBooking records where doctors[] contains this email
export const getEarlyDetectionBookingsByDoctor = (email) =>
  api.get(`/early-detection-bookings/by-doctor`, { params: { email } });

export const addEarlyDetectionAppointmentComment = async (
  applicationId,
  comments
) => {
  const encodedId = encodeURIComponent(applicationId);
  const response = await api.put(`/early-detection/${encodedId}/comments`, {
    comments,
  });
  return response.data;
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
  });
};

export const updateEarlyDetectionAppointmentPrescription = async (
  applicationId,
  payload
) => {
  const response = await api.put(
    `/early-detection/${encodeURIComponent(applicationId)}/prescription`,
    payload
  );
  return response.data;
};

export const updateEarlyDetectionAppointmentConclusion = async (
  applicationId,
  payload
) => {
  const response = await api.put(
    `/early-detection/${encodeURIComponent(applicationId)}/conclusion`,
    payload
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
      commentUpdate
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

export const deleteEarlyDetectionAppointmentComment = async (
  applicationId,
  commentId
) => {
  const response = await api.delete(
    `/early-detection/${encodeURIComponent(
      applicationId
    )}/comments/${commentId}`
  );
  return response.data;
};

// Add multiple tests to an Early Detection application
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
          applicationId: applicationId, // pass appId as appointmentId
          vendorName: test.vendorName || null,
        })),
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding multiple tests to early detection:", error);
    throw error;
  }
};

// Get patient details by email (used in EarlyDetectionPatientDetails)
export const getPatientByEmail = async (email) => {
  try {
    const encodedEmail = encodeURIComponent(email);
    const res = await api.get(`/patients/email/${encodedEmail}`, {
      headers: {},
    });
    // Backend may wrap the patient in { patient: {...} } or return the patient directly.
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
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};

export const getCommonNotifications = () => {
  return api
    .get("/notifications/common", {
      headers: {},
    })
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
      headers: {},
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
  return api.patch(`/notifications/${notificationId}/read`, { role });
};

// Save follow-up for an appointment
export const saveFollowUp = async (
  applicationId,
  { needed, comment, booked }
) => {
  return await api.put(
    `/applications/${encodeURIComponent(applicationId)}/follow-up`,
    {
      needed,
      comment,
      booked,
    }
  );
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
    .get(`/applications/appointments/media/${docId}`, {
      responseType: "blob",
    })
    .then((response) => {
      const contentType =
        response.headers["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      return { success: true };
    })
    .catch((error) => {
      console.error("Error viewing document:", error);
      throw error;
    });
};

// Download document function
export const downloadDocument = (docId, filename = "document") => {
  return api
    .get(`/applications/appointments/media/${docId}?download=true`, {
      responseType: "blob",
    })
    .then((response) => {
      const contentType =
        response.headers["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    })
    .catch((error) => {
      console.error("Error downloading document:", error);
      throw error;
    });
};

export const viewResultDocument = (resultFileId) => {
  return api
    .get(`/applications/results/${resultFileId}`, {
      responseType: "blob",
    })
    .then((response) => {
      const contentType =
        response.headers["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      return { success: true };
    })
    .catch((error) => {
      console.error("Error viewing document:", error);
      throw error;
    });
};

// Download document function
export const downloadResultDocument = (resultFileId, filename = "document") => {
  return api
    .get(`/applications/results/${resultFileId}?download=true`, {
      responseType: "blob",
    })
    .then((response) => {
      const contentType =
        response.headers["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    })
    .catch((error) => {
      console.error("Error downloading document:", error);
      throw error;
    });
};

// Schedule Management Required Funcitons

// Get all assistants
export const getAllAssistants = async () => {
  try {
    const res = await api.get('/assistants/all', {
      headers: {
      }
    });
    return res.data?.data || [];
  } catch (error) {
    console.error("Error fetching assistants:", error);
    throw error;
  }
};

// Grant access
export const grantAccess = async ({
  assistantEmail,
  accessId,
  startDateTime,
  endDateTime,
}) => {
  return api.patch('/assistants/grant-access', {
    assistantEmail,
    accessId,
    startDateTime,
    endDateTime,
  }, {
    headers: {
    }
  });
};

// Revoke access
export const revokeAccess = async ({
  assistantEmail,
  accessId,
  startDateTime,
  endDateTime,
}) => {
  return api.patch('/assistants/revoke-access', {
    assistantEmail,
    accessId,
    startDateTime,
    endDateTime,
  }, {
    headers: {
    }
  });
};

// Update access time
export const updateAccessTime = async ({
  assistantEmail,
  accessId,
  startDateTime,
  endDateTime,
}) => {
  try {
    const response = await api.patch('/assistants/update-access-time', {
      assistantEmail,
      accessId,
      startDateTime,
      endDateTime,
    }, {
      headers: {
      }
    });
    return response.data;
  } catch (error) {
    console.error("Update Access Time Error:", error);
    throw error;
  }
};

export const grantAssistantAccess = async ({
  assistantEmail,
  doctorEmail,
  startDateTime,
  endDateTime,
}) => {
  if (!assistantEmail || !doctorEmail || !startDateTime || !endDateTime) {
    throw new Error(
      "assistantEmail, doctorEmail, startDateTime, and endDateTime are required"
    );
  }

  try {
    const res = await api.post("/assistants/grant-assistant-access", {
      assistantEmail,
      doctorEmail,
      startDateTime,
      endDateTime,
    });
    return res.data; // e.g. { ok: true } or created request object
  } catch (error) {
    console.error(
      "Grant Assistant Access Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getApplicationsCalendar = async ({
    start,
    end,
    status = "all",
    followup = "all",
    doctorEmail = "all"
  }
) => {
  try {
    const params = { start, end, status, followup, doctorEmail };

    const response = await api.get(
      `/applications/calendar`,
      {
        params,
        headers: {},
      }
    );

    return response;
  } catch (error) {
    console.error("Get Applications Error:", error);
    throw error;
  }
};


export const getStocks = async () => {
  const res = await api.get("/inventory/stocks");
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


export const getReorderSuggestions = async () => {
  const res = await api.get("/inventory/stocks/reorder-suggestions");
  return res.data;
};


export const getPurchaseOrders = async () => {
  const res = await api.get("/inventory/purchase-orders");
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
  const res = await api.patch(`/inventory/purchase-orders/${orderId}/items/${itemId}/status`, data);
  return res.data;
};


/* ===============================
    INVENTORY: SUPPLIERS
=============================== */


export const getSuppliers = async () => {
  const res = await api.get("/inventory/suppliers");
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


/* ===============================
   INVENTORY: ITEMS
=============================== */

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


export const getSupplierItems = async () => {
  const res = await api.get("/inventory/supplier-items");
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
    const res = await api.post('/inventory/purchase-orders/with-pdf', orderData);
    return res.data;
  } catch (error) {
    console.error('Error creating order with PDF:', error);
    throw error;
  }
};

// Stock Request
export const getStockRequests = async () => {
  const res = await api.get("/inventory/stock-requests");
  return res.data;
};

export const getStockRequestDetails = async (id) => {
  if(!id) {
    throw new Error(
      "Request ID is required"
    );
  }

  const res = await api.get(`/inventory/stock-requests/${id}`);
  return res.data;
}

export const getAssistantStockRequest = async (id) => {
  if(!id) {
    throw new Error(
      "Request ID is required"
    );
  }

  const res = await api.get(`/inventory/stock-requests/assistant/request/${id}`);
  return res.data;
}

export const getStockRequestsByAssistant = async (assistantEmail) => {
  if(!assistantEmail) {
    throw new Error(
      "Assistant email is required"
    );
  }

  const res = await api.get(`/inventory/stock-requests/assistant/${assistantEmail}`);
  return res.data;
}

export const sendStockRequest = async (assistantEmail, data) => {
  if (!assistantEmail || !data) {
    throw new Error(
      "assistantEmail, formdata are required"
    );
  }

  const res = await api.post("/inventory/stock-requests", {"fromAssistantEmail": assistantEmail, ...data });
  return res.data;
}

export const deleteStockRequest = async (id) => {
  if (!id) {
    throw new Error(
      "Request ID is required"
    );
  }

  const res = await api.delete(`/inventory/stock-requests/${id}`);
  return res.data;
}

export const updateStockRequestItemStatus = async (requestId, itemId, data) => {
  const res = await api.patch(`/inventory/stock-requests/${requestId}/items/${itemId}/status`, data);
  return res.data;
}

// Tasks 

// PROJECT APIs
export const getProjects = async (email) => {
  // Include role (required by backend) — prefer token payload, fallback to localStorage
  let role = null;
  try {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const decoded = jwtDecode(token);
      role = decoded?.role || null;
    }
  } catch (e) {
    // ignore
  }
  if (!role) role = localStorage.getItem("role") || null;

  const params = { ...(email ? { email } : {}), role };
  const response = await api.get(`/projects`, { params });
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

export const getEmployees = async(projectId) => {
  if (projectId) {
    return api.get(`/employees?projectId=${projectId}`);
  }
  return api.get("/employees");
};

export const getProjectMembers = async (projectId) => {
  return api.get(`/projects/${projectId}/members`);
};

// Head Assistant Schedule
// Post availability (save a new slot)
export const postAssistantAvailability = async (data) => {
  try {
    const email = getEmailFromToken();
    if (!email) {
      throw new Error("Email not found in token");
    }

    const payload = {
      ...data,
      email,
    };

    const response = await api.post("/assistants/availability", payload, {
      headers: {},
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
export const getAssistantAvailability = async (start, end) => {
  try {
    const response = await api.get("/assistants/availability", {
      params: { start, end },
      headers: {},
    });
    return response.data; // Return the list of availability slots
  } catch (error) {
    console.error(
      "Get Availability Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const deleteAssistantAvailability = async (id) => {
  try {
    const email = getEmailFromToken();
    if (!email) {
      throw new Error("Email not found in token");
    }

    const response = await api.delete(`/assistants/availability/${id}`, {
      params: { email },
      headers: {},
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

// Messages

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

export const getManagersData = async () => {
  const res = await api.get("/managers");
  return res.data;
};

// GET all assistants (both head & regular)
export const getAssistantsData = async () => {
  try {
    const res = await api.get("/assistants/getAssistants");
    return res.data; // Expected: { assistants: [...] }
  } catch (err) {
    console.error("Error fetching assistants:", err);
    throw err.response?.data || { message: "Error fetching assistants" };
  }
};

export const getDoctorsData = async () => {
  try {
    const response = await api.get(`/doctors/messages/allDoctors`, {
      headers: {},
    });
    return response.data; // returns just the data
  } catch (error) {
    console.error("Get Doctors Error:", error.response?.data || error.message);
    throw error;
  }
};

// Get unread counts (received)
export const getUnreadCounts = async (email) => {
  const res = await api.get(`/chat-messages/unread/${email}`);
  return res.data.unread || {};
};

// Applications upload functions
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
    console.error("File Upload Error:", error.response?.data || error.message);
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

// ─── Telemedicine (BBB) ────────────────────────────────────────────────
export const telemedicineCreateRoom = async (applicationId) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/create`);
  return res.data;
};

export const telemedicineJoinRoom = async (applicationId) => {
  const res = await api.post(`/telemedicine/${encodeURIComponent(applicationId)}/join`);
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

// ─── Early Detection Booking Details compatibility exports ─────────────
const isAccessAllowed = (status) => {
  const normalized = String(status || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  if (!normalized) return true;
  return ["accepted", "access granted", "granted", "approved", "active"].includes(normalized);
};

export const getEarlyDetectionBookings = async () => {
  const email = getEmailFromToken();
  if (!email) return { data: [] };

  try {
    const access = await getAssistantDoctors(email).catch(() => []);
    const accessEntries = (Array.isArray(access) ? access : []).filter((d) => isAccessAllowed(d?.status));
    const doctorEmails = [...new Set(accessEntries.map((d) => d?.doctorEmail).filter(Boolean))];

    // Assistant / head assistant flow: aggregate by accessible doctors
    if (doctorEmails.length > 0) {
      const responses = await Promise.all(
        doctorEmails.map((doctorEmail) => getEarlyDetectionBookingsByDoctor(doctorEmail))
      );
      const merged = responses.flatMap((r) => (Array.isArray(r?.data) ? r.data : []));
      const uniqueById = Array.from(new Map(merged.map((b) => [String(b?._id || b?.applicationId), b])).values());
      return { data: uniqueById };
    }

    // Doctor fallback: use token email directly
    const res = await getEarlyDetectionBookingsByDoctor(email);
    return { data: Array.isArray(res?.data) ? res.data : [] };
  } catch (error) {
    console.error("Get Early Detection Bookings Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getEarlyDetectionDoctors = async () => {
  const email = getEmailFromToken();
  if (!email) return { data: [] };

  try {
    const access = await getAssistantDoctors(email);
    const data = (Array.isArray(access) ? access : []).map((d) => ({
      email: d?.doctorEmail || d?.email,
      name: d?.name,
      status: d?.status,
      startDateTime: d?.startDateTime,
      endDateTime: d?.endDateTime,
    }));
    return { data };
  } catch (error) {
    console.error("Get Early Detection Doctors Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getEarlyDetectionBookingById = async (bookingId) => {
  const res = await api.get(`/early-detection-bookings/${encodeURIComponent(bookingId)}`);
  return res.data;
};

export const updateEarlyDetectionBooking = async (bookingId, payload) =>
  api.patch(`/early-detection-bookings/${encodeURIComponent(bookingId)}`, payload);

export const addEarlyDetectionBookingNote = async (bookingId, payload) => {
  const res = await api.post(`/early-detection-bookings/${encodeURIComponent(bookingId)}/notes`, payload);
  return res.data;
};

export const updateEarlyDetectionBookingNote = async (bookingId, noteId, payload) => {
  const res = await api.patch(`/early-detection-bookings/${encodeURIComponent(bookingId)}/notes/${encodeURIComponent(noteId)}`, payload);
  return res.data;
};

export const deleteEarlyDetectionBookingNote = async (bookingId, noteId) => {
  const res = await api.delete(`/early-detection-bookings/${encodeURIComponent(bookingId)}/notes/${encodeURIComponent(noteId)}`);
  return res.data;
};

export const generateEDPaymentLink = async (bookingId) =>
  api.post(`/early-detection-bookings/${encodeURIComponent(bookingId)}/payments/generate-link`);

export const updateEarlyDetectionPaymentStatus = async (bookingId, payload) =>
  api.patch(`/early-detection-bookings/${encodeURIComponent(bookingId)}/payments/status`, payload);

export const getEarlyDetectionManagedTests = async (section) => {
  try {
    return await api.get(`/early-detection-bookings/managed-tests`, { params: { section } });
  } catch (error) {
    // Backend route may not exist in some environments yet.
    // Return empty list so booking details page remains usable.
    if (error?.response?.status === 404) {
      return { data: [] };
    }
    throw error;
  }
};

export const getEarlyDetectionTemplates = async (fieldKey) => {
  const res = await api.get(`/early-detection/templates`, {
    params: fieldKey ? { fieldKey } : {},
  });
  return res.data;
};

export const createEarlyDetectionTemplate = async (data) => {
  const res = await api.post(`/early-detection/templates`, data);
  return res.data;
};

export const updateEarlyDetectionTemplate = async (id, data) => {
  const res = await api.put(`/early-detection/templates/${encodeURIComponent(id)}`, data);
  return res.data;
};

export const deleteEarlyDetectionTemplate = async (id) => {
  const res = await api.delete(`/early-detection/templates/${encodeURIComponent(id)}`);
  return res.data;
};

export const getEarlyDetectionReport = async (bookingId) => {
  const res = await api.get(`/early-detection/report/${encodeURIComponent(bookingId)}`);
  return res.data;
};

export const saveEarlyDetectionReport = async (bookingId, payload) => {
  const res = await api.put(`/early-detection/report/${encodeURIComponent(bookingId)}`, payload);
  return res.data;
};

export const createEarlyDetectionManagedTest = async (section, payload) =>
  api.post(`/early-detection-bookings/managed-tests`, { section, ...payload });

export const updateEarlyDetectionManagedTest = async (section, testId, payload) =>
  api.patch(`/early-detection-bookings/managed-tests/${encodeURIComponent(testId)}`, { section, ...payload });

export const deleteEarlyDetectionManagedTest = async (section, testId) =>
  api.delete(`/early-detection-bookings/managed-tests/${encodeURIComponent(testId)}`, { params: { section } });

export const getDoctorAppointmentsByDate = async (doctorEmail, date) =>
  api.get(`/calendar/doctor-appointments`, { params: { doctorEmail, date } });

export const getDoctorBreaks = async (doctorEmail, date) =>
  api.get(`/calendar/doctor-breaks`, { params: { doctorEmail, date } });

export const getDoctorLeaves = async (params) =>
  api.get(`/calendar/doctor-leaves`, { params });

export const uploadEarlyDetectionScheduleFile = async (bookingId, { section, itemId, customName, file }) => {
  const formData = new FormData();
  if (section) formData.append("section", section);
  if (itemId) formData.append("itemId", itemId);
  if (customName) formData.append("customName", customName);
  if (file) formData.append("file", file);
  return api.post(`/early-detection-bookings/${encodeURIComponent(bookingId)}/schedule/files`, formData);
};

export const getEarlyDetectionScheduleFileUrl = (fileId, download = false) => {
  const qs = download ? "?download=1" : "";
  return `${api.defaults.baseURL}/early-detection-bookings/schedule/files/${encodeURIComponent(fileId)}${qs}`;
};

export const saveEarlyDetectionSpecialistHistoryForm = async (bookingId, specialistIndex, payload) =>
  api.put(
    `/early-detection-bookings/${encodeURIComponent(bookingId)}/schedule/specialist/${encodeURIComponent(specialistIndex)}/history-form`,
    payload
  );

export default api;
