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
        appointment_details_page: en.appointment_details_page,
        appointment_details_general: en.appointment_details_general,
        history_tab: en.history_tab,
        rich_text_editor: en.rich_text_editor,
        telemedicine_tab: en.telemedicine_tab,
      },
      ru: {
        translation: ru,
        appointment_details_page: ru.appointment_details_page,
        appointment_details_general: ru.appointment_details_general,
        history_tab: ru.history_tab,
        rich_text_editor: ru.rich_text_editor,
        telemedicine_tab: ru.telemedicine_tab,
      },
    },
    fallbackLng: "ru",
    supportedLngs: ["en", "ru"],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
