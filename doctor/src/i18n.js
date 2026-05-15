import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import ru from "./locales/ru.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en,
        history_tab: en.history_tab,
        appointment_details_general: en.appointment_details_general,
        appointment_details_page: en.appointment_details_page,
        followups_tab: en.followups_tab,
      },
      ru: {
        translation: ru,
        history_tab: ru.history_tab,
        appointment_details_general: ru.appointment_details_general,
        appointment_details_page: ru.appointment_details_page,
        followups_tab: ru.followups_tab,
      },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "ru"], // Add this!
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
