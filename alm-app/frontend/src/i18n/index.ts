import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { qualityEn } from "./locales/en/quality";
import { qualityTr } from "./locales/tr/quality";
import { reportsEn } from "./locales/en/reports";
import { reportsTr } from "./locales/tr/reports";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        quality: qualityEn,
        reports: reportsEn,
      },
      tr: {
        quality: qualityTr,
        reports: reportsTr,
      },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "tr"],
    /** Suppress default Locize promo line on every load (console.info). */
    showSupportNotice: false,
    interpolation: {
      escapeValue: false,
    },
    ns: ["quality", "reports"],
    defaultNS: "quality",
  });

export default i18n;

