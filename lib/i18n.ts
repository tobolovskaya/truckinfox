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

i18n
  .use(initReactI18next)
  .init({
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

export default i18n;
