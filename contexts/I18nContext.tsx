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
  changeLanguage: (_language: string) => void;
  currentLanguage: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<string>('no');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeI18n = async () => {
      try {
        await initI18n();
        const savedLanguage = await AsyncStorage.getItem('language');

        let languageToUse: SupportedLanguage;
        if (savedLanguage) {
          languageToUse = getSafeLanguage(savedLanguage);
        } else {
          languageToUse = getDeviceLanguage();
        }

        await i18n.changeLanguage(languageToUse);
        setCurrentLanguage(languageToUse);
      } catch (error) {
        console.error('Error initializing i18n:', error);
        await i18n.changeLanguage('no');
        setCurrentLanguage('no');
      } finally {
        setIsReady(true);
      }
    };

    initializeI18n();
  }, []);

  const changeLanguage = async (language: string) => {
    try {
      const safeLanguage = getSafeLanguage(language);
      await AsyncStorage.setItem('language', safeLanguage);
      await i18n.changeLanguage(safeLanguage);
      setCurrentLanguage(safeLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  if (!isReady) {
    return null;
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
