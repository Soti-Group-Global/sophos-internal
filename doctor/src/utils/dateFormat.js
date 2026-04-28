// Helpers for consistent date/time display formatting across the app.

// Returns a string in YYYY-MM-DD format (ISO date), or empty string if invalid.
export function formatDateISO(dateInput) {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateOnlyMatch) return dateOnlyMatch[1];

    const isoLikeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoLikeMatch) return isoLikeMatch[1];
  }
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Returns a string in HH:mm (24h) format, or empty string if invalid.
export function formatTimeHHMM(timeInput) {
  if (!timeInput) return "";
  // If already in HH:mm format, return it cleanly.
  // For ISO strings, keep the original HH:mm part to avoid timezone shifts.
  if (typeof timeInput === "string") {
    const trimmed = timeInput.trim();
    const timeMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
    }

    const isoTimeMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}T([0-2]\d):([0-5]\d)/);
    if (isoTimeMatch) {
      return `${isoTimeMatch[1]}:${isoTimeMatch[2]}`;
    }
  }

  // Otherwise try parsing as a Date-like string
  const date = timeInput instanceof Date ? timeInput : new Date(timeInput);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Returns a string like "YYYY-MM-DD, HH:mm - HH:mm" if both start and end are provided.
// Falls back gracefully if some values are missing.
export function formatAppointmentDateTime(date, startTime, endTime) {
  const datePart = formatDateISO(date);
  const startPart = formatTimeHHMM(startTime);
  const endPart = formatTimeHHMM(endTime);
  if (!datePart && !startPart && !endPart) return "";

  if (datePart && startPart && endPart) {
    return `${datePart}, ${startPart} - ${endPart}`;
  }
  if (datePart && startPart) {
    return `${datePart}, ${startPart}`;
  }
  if (startPart && endPart) {
    return `${startPart} - ${endPart}`;
  }
  return datePart || startPart || endPart;
}
