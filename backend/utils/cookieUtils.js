const IS_PROD = process.env.NODE_ENV === "production";

// Separate cookie names prevent cross-interface contamination on localhost,
// where all ports share the same cookie domain.
const STAFF_REFRESH_COOKIE = "staff_refresh_token";   // doctor + assistant
const MANAGER_REFRESH_COOKIE = "manager_refresh_token"; // manager roles

// Kept for any legacy callers that haven't been updated yet.
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const _setRefreshCookie = (res, name, value) => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth",
  });
};

const setStaffAuthCookies = (res, _accessToken, refreshToken) => {
  _setRefreshCookie(res, STAFF_REFRESH_COOKIE, refreshToken);
};

const setManagerAuthCookies = (res, _accessToken, refreshToken) => {
  _setRefreshCookie(res, MANAGER_REFRESH_COOKIE, refreshToken);
};

// Legacy shim — routes that haven't been split yet still call setAuthCookies.
// Remove once all callers use the role-specific functions above.
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
