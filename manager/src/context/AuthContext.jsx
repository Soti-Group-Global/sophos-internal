import { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refreshToken") || null
  );
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Validate token on initial load
  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          setIsLoading(false);
        } catch (error) {
          logout();
        }
      } else {
        setIsLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = (newToken, userData, newRefreshToken, shouldNavigate = true) => {
    setToken(newToken);
    setUser(userData);
    if (newRefreshToken) setRefreshToken(newRefreshToken);

    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);
    
    if (shouldNavigate) {
      navigate("/applications");
    }
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    navigate("/manager-signin");
  };

  return (
    <AuthContext.Provider
      value={{ token, refreshToken, user, login, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
