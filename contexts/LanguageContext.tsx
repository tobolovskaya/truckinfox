import { createContext, PropsWithChildren, useMemo, useState } from 'react';
import i18n from '../utils/i18n';

type LanguageContextValue = {
  language: string;
  setLanguage: (language: string) => void;
};

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => undefined,
});

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState('en');

  const setLanguage = (nextLanguage: string) => {
    i18n.changeLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  };

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
