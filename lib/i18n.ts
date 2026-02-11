import 'intl-pluralrules'; // Fix for i18next pluralResolver

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// Import translations
import en from '../locales/en.json';
import no from '../locales/no.json';

// Namespace-based resources for better organization
const resources = {
  en: {
    translation: en,
    // Future namespaces can be added here:
    // common: enCommon,
    // errors: enErrors,
  },
  no: {
    translation: no,
    // Future namespaces:
    // common: noCommon,
    // errors: noErrors,
  },
} as const;

// Supported languages
export const SUPPORTED_LANGUAGES = ['no', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Get device language with fallback
export const getDeviceLanguage = (): SupportedLanguage => {
  const deviceLang = Localization.getLocales()[0]?.languageCode || 'no';
  // Check if device language is supported
  if (SUPPORTED_LANGUAGES.includes(deviceLang as SupportedLanguage)) {
    return deviceLang as SupportedLanguage;
  }
  return 'no'; // Default fallback to Norwegian
};

/**
 * Initialize i18next with proper configuration
 * Includes:
 * - Double initialization prevention
 * - Namespace support
 * - Missing key fallbacks
 * - Debug mode for development
 */
export const initI18n = async () => {
  // Prevent double initialization (important for hot-reload and tests)
  if (i18n.isInitialized) {
    console.log('i18n already initialized, skipping...');
    return i18n;
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: getDeviceLanguage(),
      fallbackLng: 'no',

      // Default namespace
      defaultNS: 'translation',

      // Fallback namespace if key not found
      fallbackNS: 'translation',

      // Interpolation settings
      interpolation: {
        escapeValue: false, // React already escapes
      },

      // Missing key handling
      saveMissing: false,
      missingKeyHandler: (lngs, ns, key, fallbackValue) => {
        if (__DEV__) {
          console.warn(
            `Missing translation key: "${key}" in namespace "${ns}" for languages: ${lngs.join(', ')}`
          );
        }
      },

      // Return key if translation missing (instead of empty string)
      returnNull: false,
      returnEmptyString: false,

      // Debug mode (only in development)
      debug: __DEV__,

      // React specific options
      react: {
        useSuspense: false, // Disable suspense for React Native
      },
    });

  return i18n;
};

// Export the i18n instance
export { i18n };

// Helper to check if a language is supported
export const isLanguageSupported = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

// Helper to get safe language (ensures it's supported)
export const getSafeLanguage = (lang: string): SupportedLanguage => {
  return isLanguageSupported(lang) ? lang : 'no';
};
