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

  // Assistant login
  const login = async (accessToken, refreshTokenValue, assistantData) => {
    setToken(accessToken);
    setRefreshToken(refreshTokenValue);
    setUser(assistantData);
    setProfileCompleted(assistantData.profileCompleted || false);

    // Keep only non-sensitive data in localStorage
    localStorage.setItem("hadSession", "true");
    localStorage.setItem("user", JSON.stringify(assistantData));

    // Store token in axios defaults (in-memory, not localStorage)
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

    // start silent refresh
    refreshTimer.current = scheduleTokenRefresh(accessToken);

    navigate("/appointments");
  };

  // Assistant logout
  const logout = async (redirect = true) => {
    try {
      await api.post("/auth/assistant-logout");
    } catch (err) {
      console.warn("[AUTH] Assistant logout API error:", err.message);
    } finally {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      setProfileCompleted(false);

      localStorage.removeItem("hadSession");
      localStorage.removeItem("user");

      // Clean up legacy / orphaned keys
      localStorage.removeItem("email");
      localStorage.removeItem("formattedName");
      localStorage.removeItem("language");
      localStorage.removeItem("role");
      localStorage.removeItem("selectedLanguage");
      localStorage.removeItem("userData");
      localStorage.removeItem("assistantPassword");

      delete api.defaults.headers.common["Authorization"];
      stopTokenRefresh();

      if (redirect) navigate("/");
    }
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    setProfileCompleted(updatedUserData.profileCompleted || false);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
  };

  // Allow interceptors to update tokens in memory
  const updateToken = (newAccess, newRefresh) => {
    setToken(newAccess);
    if (newRefresh) setRefreshToken(newRefresh);

    api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;

    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = scheduleTokenRefresh(newAccess);
  };

  // Restore session on app load via httpOnly cookie
  useEffect(() => {
    const init = async () => {
      const hadSession = localStorage.getItem("hadSession") === "true";
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");

      if (hadSession && savedUser) {
        try {
          const data = await restoreSession();
          setToken(data.accessToken);
          if (data.refreshToken) setRefreshToken(data.refreshToken);
          setUser(savedUser);
          setProfileCompleted(savedUser.profileCompleted || false);
          refreshTimer.current = scheduleTokenRefresh(data.accessToken);
        } catch {
          // Refresh cookie expired — clear session
          localStorage.removeItem("hadSession");
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
