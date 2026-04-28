import { createContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthContext, scheduleTokenRefresh, stopTokenRefresh  } from "../utils/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("accessToken"));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [profileCompleted, setProfileCompleted] = useState(user?.profileCompleted || false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // store timer reference
  const refreshTimer = useRef(null);

  // Assistant login
  const login = async (accessToken, refreshToken, assistantData) => {

    setToken(accessToken);
    setRefreshToken(refreshToken);
    setUser(assistantData);
    setProfileCompleted(assistantData.profileCompleted || false);

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("hadSession", "true");
    localStorage.setItem("user", JSON.stringify(assistantData));

    // start silent refresh
    refreshTimer.current = scheduleTokenRefresh(accessToken);

    navigate("/appointments");
  };

  //  Assistant logout
const logout = async (redirect = true) => {
  try {
    // Always read the latest refresh token from localStorage, not from
    // React state, because this function may be captured by a stale closure
    // inside the api.js auth context.
    const currentRefreshToken = localStorage.getItem("refreshToken");
    if (currentRefreshToken) {
      await api.post("/auth/assistant-logout", null, {
        headers: { Authorization: `Bearer ${currentRefreshToken}` },
      });
    }
  } catch (err) {
    console.warn("[AUTH] Assistant logout API error:", err.message);
  } finally {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setProfileCompleted(false);

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("hadSession");
    localStorage.removeItem("user");

    // Clean up legacy / orphaned keys
    localStorage.removeItem("email");
    localStorage.removeItem("formattedName");
    localStorage.removeItem("language");
    localStorage.removeItem("role");
    localStorage.removeItem("selectedLanguage");
    localStorage.removeItem("userData");
    localStorage.removeItem("token");
    localStorage.removeItem("assistantPassword");

    stopTokenRefresh(); // clear silent refresh

    if (redirect) navigate("/");
  }
};

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    setProfileCompleted(updatedUserData.profileCompleted || false);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
  };

  // Restore session
  useEffect(() => {
    const storedToken = localStorage.getItem("accessToken");
    const storedRefresh = localStorage.getItem("refreshToken");
    const hadSession = localStorage.getItem("hadSession") === "true";
    const savedUser = JSON.parse(localStorage.getItem("user") || "null");

    if (hadSession && storedToken && storedRefresh && savedUser) {
      setToken(storedToken);
      setRefreshToken(storedRefresh);
      setUser(savedUser);
      setProfileCompleted(savedUser.profileCompleted || false);

      // restart silent refresh
      refreshTimer.current = scheduleTokenRefresh(storedToken);
    } else {
    }

    setIsLoading(false);
    setAuthContext({ logout, login, updateToken });
  }, []);

  const updateToken = (newAccess, newRefresh) => {
    setToken(newAccess);
    if (newRefresh) setRefreshToken(newRefresh);

    localStorage.setItem("accessToken", newAccess);
    if (newRefresh) localStorage.setItem("refreshToken", newRefresh);

    // restart silent refresh
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = scheduleTokenRefresh(newAccess);
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
