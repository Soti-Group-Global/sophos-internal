import { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Tokens live in memory only — never in localStorage
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const login = (newToken, userData, newRefreshToken, shouldNavigate = true) => {
    setToken(newToken);
    setUser(userData);
    if (newRefreshToken) setRefreshToken(newRefreshToken);

    // Keep only non-sensitive data in localStorage
    localStorage.setItem("hadManagerSession", "true");
    localStorage.setItem("user", JSON.stringify(userData));

    // Store token in axios defaults (in-memory, not localStorage)
    api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

    if (shouldNavigate) {
      navigate("/applications");
    }
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);

    localStorage.removeItem("hadManagerSession");
    localStorage.removeItem("user");

    delete api.defaults.headers.common["Authorization"];

    navigate("/manager-signin");
  };

  // Restore session on app load via httpOnly cookie
  useEffect(() => {
    const init = async () => {
      const hadSession = localStorage.getItem("hadManagerSession") === "true";
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");

      if (hadSession && savedUser) {
        try {
          const response = await fetch(`${import.meta.env.VITE_BASE_URL || "http://localhost:3003"}/api/auth/refresh-token`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });

          if (!response.ok) throw new Error("Refresh failed");

          const data = await response.json();
          const newToken = data.token || data.accessToken;

          setToken(newToken);
          setUser(savedUser);
          api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        } catch {
          // Refresh cookie expired — clear session
          localStorage.removeItem("hadManagerSession");
          localStorage.removeItem("user");
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, refreshToken, user, login, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
