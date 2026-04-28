// Get the token from localStorage
export const getToken = () => {
  return localStorage.getItem("token");
};

// Check if token is expired (assumes JWT)
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const [, payloadBase64] = token.split(".");
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);

    // Compare exp to current time (in seconds)
    const now = Date.now() / 1000;
    return payload.exp < now;
  } catch (err) {
    console.error("Token check failed:", err);
    return true; // If malformed token
  }
};
