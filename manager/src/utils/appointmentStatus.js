/**
 * Centralized appointment status → CSS class mapping.
 *
 * Usage:
 *   import { getApptStatusClass, getApptDotClass } from "../utils/appointmentStatus";
 *   <span className={`appt-status-badge ${getApptStatusClass(status)}`}>{label}</span>
 *   <span className={`appt-status-dot ${getApptDotClass(status)}`} />
 */

const STATUS_MAP = {
  confirmed: "confirmed",
  completed: "completed",
  paid: "paid",
  upcoming: "upcoming",
  unconfirmed: "unconfirmed",
  pending: "pending",
  "pending-payment": "pending",
  "pending payment": "pending",
  "waiting for assign": "pending",
  cancelled: "cancelled",
  canceled: "cancelled",
  "no-show": "noshow",
  "no show": "noshow",
  noshow: "noshow",
  new: "default",
  "in process": "upcoming",
};

/**
 * Returns the badge modifier class, e.g. "appt-status--confirmed"
 */
export const getApptStatusClass = (status) => {
  if (!status) return "appt-status--default";
  const key = status.toLowerCase().trim();
  const mapped = STATUS_MAP[key] || "default";
  return `appt-status--${mapped}`;
};

/**
 * Returns the dot modifier class, e.g. "appt-status-dot--confirmed"
 */
export const getApptDotClass = (status) => {
  if (!status) return "appt-status-dot--default";
  const key = status.toLowerCase().trim();
  const mapped = STATUS_MAP[key] || "default";
  return `appt-status-dot--${mapped}`;
};

/**
 * Returns the raw CSS variable color for inline-style usage (calendar events etc.)
 */
export const getApptStatusColor = (status) => {
  if (!status) return "var(--appt-default-color)";
  const key = status.toLowerCase().trim();
  const mapped = STATUS_MAP[key] || "default";
  return `var(--appt-${mapped}-color)`;
};

/**
 * Returns the raw CSS variable bg for inline-style usage
 */
export const getApptStatusBg = (status) => {
  if (!status) return "var(--appt-default-bg)";
  const key = status.toLowerCase().trim();
  const mapped = STATUS_MAP[key] || "default";
  return `var(--appt-${mapped}-bg)`;
};

/**
 * Returns the dark text CSS variable — used as the "dark version" of a status color
 * e.g. upcoming → var(--appt-upcoming-text) = #92400e (dark amber)
 */
export const getApptStatusDark = (status) => {
  if (!status) return "var(--appt-default-text)";
  const key = status.toLowerCase().trim();
  const mapped = STATUS_MAP[key] || "default";
  return `var(--appt-${mapped}-text)`;
};
