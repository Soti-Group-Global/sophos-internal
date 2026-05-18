// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthContext, scheduleTokenRefresh, stopTokenRefresh, restoreSession } from "../utils/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Tokens live in memory only — never in localStorage
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [profileCompleted, setProfileCompleted] = useState(user?.profileCompleted || false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshTimer = useRef(null);

  const startRefreshTimer = (accessToken) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = scheduleTokenRefresh(accessToken);
  };

  // === Login ===
  const login = async (accessToken, refreshTokenValue, doctorData) => {
    setToken(accessToken);
    setRefreshToken(refreshTokenValue);
    setUser(doctorData);
    setProfileCompleted(doctorData.profileCompleted || false);

    // Keep only non-sensitive data in localStorage
    localStorage.setItem("hadDoctorSession", "true");
    localStorage.setItem("user", JSON.stringify(doctorData));

    // Store token in axios defaults (in-memory, not localStorage)
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

    startRefreshTimer(accessToken);
  };

  // === Logout ===
  const logout = async (redirect = true) => {
    try {
      await api.post("/auth/doctor-logout");
    } catch (err) {
      // ignore
    } finally {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      setProfileCompleted(false);

      localStorage.removeItem("hadDoctorSession");
      localStorage.removeItem("user");

      delete api.defaults.headers.common["Authorization"];
      stopTokenRefresh();

      if (redirect) navigate("/");
    }
  };

  // === Update user profile ===
  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    setProfileCompleted(updatedUserData.profileCompleted || false);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
  };

  // === Allow interceptors to update tokens in memory ===
  const updateToken = (newAccess, newRefresh) => {
    setToken(newAccess);
    if (newRefresh) setRefreshToken(newRefresh);

    api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
    startRefreshTimer(newAccess);
  };

  // === Restore session on app load via httpOnly cookie ===
  useEffect(() => {
    const init = async () => {
      const hadSession = localStorage.getItem("hadDoctorSession") === "true";
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");

      if (hadSession && savedUser) {
        try {
          const data = await restoreSession();
          setToken(data.accessToken);
          if (data.refreshToken) setRefreshToken(data.refreshToken);
          setUser(savedUser);
          setProfileCompleted(savedUser.profileCompleted || false);
          startRefreshTimer(data.accessToken);
        } catch {
          // Refresh cookie expired — clear session
          localStorage.removeItem("hadDoctorSession");
          localStorage.removeItem("user");
        }
      }

      setIsLoading(false);
      setAuthContext({ logout, login, updateToken });
    };

    init();
  }, []);

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
