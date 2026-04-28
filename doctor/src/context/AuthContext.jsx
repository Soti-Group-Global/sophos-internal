// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthContext, scheduleTokenRefresh , stopTokenRefresh} from "../utils/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("accessToken") || null);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken") || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [profileCompleted, setProfileCompleted] = useState(user?.profileCompleted || false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // keep track of refresh timer so we can clear it on logout
  const refreshTimer = useRef(null);

  // Helper: schedule refresh safely
  const startRefreshTimer = (accessToken) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = scheduleTokenRefresh(accessToken);
  };

  // === Login ===
  const login = async (accessToken, refreshToken, doctorData) => {
    setToken(accessToken);
    setRefreshToken(refreshToken);
    setUser(doctorData);
    setProfileCompleted(doctorData.profileCompleted || false);

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("hadDoctorSession", "true");
    localStorage.setItem("user", JSON.stringify(doctorData));

    startRefreshTimer(accessToken);

    // don't auto-navigate here; let callers decide where to send the user
    // (previously navigated to "/analysis", which no longer exists and
    // caused a fallback redirect to "/calendar").
  };

  // === Logout ===
const logout = async (redirect = true) => {
  try {
    if (refreshToken) {
      await api.post("/auth/doctor-logout", null, {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });
    }
  } catch (err) {
  } // inside logout()
finally {
  setToken(null);
  setRefreshToken(null);
  setUser(null);
  setProfileCompleted(false);

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("hadDoctorSession");
  localStorage.removeItem("user");

  stopTokenRefresh(); // <— NEW, clears any scheduled refresh

  if (redirect) navigate("/");
}

};


  // === Update user profile ===
  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    setProfileCompleted(updatedUserData.profileCompleted || false);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
  };

  // === Restore session on app load ===
  useEffect(() => {
    const storedToken = localStorage.getItem("accessToken");
    const storedRefresh = localStorage.getItem("refreshToken");
    const hadSession = localStorage.getItem("hadDoctorSession") === "true";
    const savedUser = JSON.parse(localStorage.getItem("user") || "null");

    if (hadSession && storedToken && storedRefresh && savedUser) {
      setToken(storedToken);
      setRefreshToken(storedRefresh);
      setUser(savedUser);
      setProfileCompleted(savedUser.profileCompleted || false);

      startRefreshTimer(storedToken);
    } else {
    }

    setIsLoading(false);
    setAuthContext({ logout, login, updateToken });
  }, []);

  // === Allow interceptors to update tokens ===
  const updateToken = (newAccess, newRefresh) => {
    setToken(newAccess);
    if (newRefresh) setRefreshToken(newRefresh);

    localStorage.setItem("accessToken", newAccess);
    if (newRefresh) localStorage.setItem("refreshToken", newRefresh);

    startRefreshTimer(newAccess);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        refreshToken,
        user,
        profileCompleted,
        isLoading,
        login,
        logout,
        updateUser,
        updateToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
