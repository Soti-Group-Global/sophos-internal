import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Get corporate registration info by link (to display company name, discount etc.)
export const getCorporateByLink = async (link) => {
  const res = await api.get(`/corporate-register/form/${link}`);
  return res.data;
};

// Submit employee registration form
export const submitCorporateForm = async (link, data) => {
  const res = await api.post(`/corporate-form-registrations/${link}`, data);
  return res.data;
};

// Get results by link (requires password validation on this side)
export const getResultsByLink = async (link) => {
  const res = await api.get(`/corporate-form-registrations/${link}/results`);
  return res.data;
};

export default api;
