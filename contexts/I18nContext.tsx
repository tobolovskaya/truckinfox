import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  i18n,
  initI18n,
  getDeviceLanguage,
  getSafeLanguage,
  type SupportedLanguage,
} from '../lib/i18n';

interface I18nContextType {
  changeLanguage: (language: string) => void;
  currentLanguage: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeI18n = async () => {
      try {
        // Initialize i18n (with double-init protection)
        await initI18n();

        // Load saved language preference
        const savedLanguage = await AsyncStorage.getItem('language');

        let languageToUse: SupportedLanguage;
        if (savedLanguage) {
          // Use saved language if it's supported
          languageToUse = getSafeLanguage(savedLanguage);
        } else {
          // Use device language
          languageToUse = getDeviceLanguage();
        }

        await i18n.changeLanguage(languageToUse);
        setCurrentLanguage(languageToUse);
      } catch (error) {
        console.error('Error initializing i18n:', error);
        // Fallback to English on error
        await i18n.changeLanguage('en');
        setCurrentLanguage('en');
      } finally {
        setIsReady(true);
      }
    };

    initializeI18n();
  }, []);

  const changeLanguage = async (language: string) => {
    try {
      // Ensure language is supported
      const safeLanguage = getSafeLanguage(language);

      // Save to storage
      await AsyncStorage.setItem('language', safeLanguage);

      // Change i18n language
      await i18n.changeLanguage(safeLanguage);

      // Update state
      setCurrentLanguage(safeLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  // Don't render children until i18n is ready
  if (!isReady) {
    return null; // Or a loading spinner
  }

  return (
    <I18nContext.Provider value={{ changeLanguage, currentLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
