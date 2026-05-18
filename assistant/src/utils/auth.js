import api from "./api";

// Get the token from in-memory axios defaults (never from localStorage)
export const getToken = () => {
  const header = api.defaults.headers.common["Authorization"];
  return header ? header.replace("Bearer ", "") : null;
};

// Check if token is expired (assumes JWT)
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const [, payloadBase64] = token.split(".");
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);

    const now = Date.now() / 1000;
    return payload.exp < now;
  } catch (err) {
    console.error("Token check failed:", err);
    return true;
  }
};
