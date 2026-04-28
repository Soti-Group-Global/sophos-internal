// utils/lang.js
export const tField = (field, lang) => {
  if (!field) return "";
  return field[lang] || field.en || Object.values(field)[0] || "";
};
