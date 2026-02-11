import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'en' | 'no';

interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (_key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const { i18n, t } = useTranslation();
  const [isReady, setIsReady] = useState(i18n.isInitialized);
  const [language, setLanguageState] = useState<Language>(
    (i18n.language?.split('-')[0] as Language) || 'no' // Default to Norwegian
  );

  useEffect(() => {
    if (!i18n.isInitialized) {
      const handleInitialized = () => {
        setIsReady(true);
        setLanguageState((i18n.language?.split('-')[0] as Language) || 'no');
      };

      i18n.on('initialized', handleInitialized);
      return () => {
        i18n.off('initialized', handleInitialized);
      };
    } else {
      setIsReady(true);
    }
  }, [i18n]);

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    setLanguageState(lang);
  };

  // Don't render children until i18n is ready
  if (!isReady) {
    return null;
  }

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export default I18nContext;
