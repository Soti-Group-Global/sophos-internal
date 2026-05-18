const IS_PROD = process.env.NODE_ENV === "production";

// Use a dedicated env var for the Secure flag so HTTP-only LAN deployments
// (e.g. http://192.168.x.x) still work even when NODE_ENV=production.
// Set HTTPS_ENABLED=true in .env only when the server is behind HTTPS.
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === "true";

// Separate cookie names prevent cross-interface contamination on localhost,
// where all ports share the same cookie domain.
const STAFF_REFRESH_COOKIE = "staff_refresh_token";     // doctor + assistant
const MANAGER_REFRESH_COOKIE = "manager_refresh_token"; // manager roles

// Kept for any legacy callers / migration fallback.
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const _setRefreshCookie = (res, name, value) => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: HTTPS_ENABLED,                         // false on plain-HTTP deployments
    sameSite: HTTPS_ENABLED ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,              // 7 days
    path: "/api/auth",
  });
};

const setStaffAuthCookies = (res, _accessToken, refreshToken) => {
  _setRefreshCookie(res, STAFF_REFRESH_COOKIE, refreshToken);
};

const setManagerAuthCookies = (res, _accessToken, refreshToken) => {
  _setRefreshCookie(res, MANAGER_REFRESH_COOKIE, refreshToken);
};

// Legacy shim — routes not yet split still call setAuthCookies.
const setAuthCookies = (res, accessToken, refreshToken) => {
  setStaffAuthCookies(res, accessToken, refreshToken);
};

const clearStaffAuthCookies = (res) => {
  res.clearCookie(STAFF_REFRESH_COOKIE, { path: "/api/auth" });
};

const clearManagerAuthCookies = (res) => {
  res.clearCookie(MANAGER_REFRESH_COOKIE, { path: "/api/auth" });
};

const clearAuthCookies = (res) => {
  clearStaffAuthCookies(res);
};

module.exports = {
  setAuthCookies,
  setStaffAuthCookies,
  setManagerAuthCookies,
  clearAuthCookies,
  clearStaffAuthCookies,
  clearManagerAuthCookies,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  STAFF_REFRESH_COOKIE,
  MANAGER_REFRESH_COOKIE,
};
