export const getApptStatusClass = (status) => {
  const key = String(status || "").toLowerCase().trim();

  switch (key) {
    case "confirmed":
      return "status-confirmed";
    case "completed":
      return "status-completed";
    case "cancelled":
    case "canceled":
      return "status-cancelled";
    case "upcoming":
      return "status-upcoming";
    case "unconfirmed":
      return "status-unconfirmed";
    case "paid":
      return "status-confirmed";
    case "processing":
    case "pending":
    default:
      return "status-pending";
  }
};
