import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// Import translation resources
import en from '../locales/en/translation.json';
import no from '../locales/no/translation.json';

const resources = {
  en: {
    translation: en,
  },
  no: {
    translation: no,
  },
};

// Initialize i18n
const initI18n = async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: 'no', // Norwegian (Bokmål) as primary language
      fallbackLng: 'en', // English as fallback
      supportedLngs: ['no', 'en'],
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
  }
  return i18n;
};

// Initialize immediately
initI18n().catch(console.error);

// Supported languages
export const SUPPORTED_LANGUAGES = ['no', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Get device language with fallback
export const getDeviceLanguage = (): SupportedLanguage => {
  const deviceLang = Localization.getLocales()[0]?.languageCode || 'no';
  // Check if device language is supported
  if (SUPPORTED_LANGUAGES.includes(deviceLang as SupportedLanguage)) {
    return deviceLang as SupportedLanguage;
  }
  return 'no'; // Default fallback to Norwegian
};

export default i18n;
