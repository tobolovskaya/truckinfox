import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface NotificationBanner {
  id: string;
  title: string;
  body: string;
  data?: any;
}

interface NotificationBannerContextType {
  showBanner: (banner: Omit<NotificationBanner, 'id'>) => void;
  hideBanner: () => void;
  banner: NotificationBanner | null;
}

const NotificationBannerContext = createContext<NotificationBannerContextType | undefined>(
  undefined
);

export const useNotificationBanner = () => {
  const context = useContext(NotificationBannerContext);
  if (context === undefined) {
    throw new Error('useNotificationBanner must be used within a NotificationBannerProvider');
  }
  return context;
};

interface NotificationBannerProviderProps {
  children: ReactNode;
}

export const NotificationBannerProvider: React.FC<NotificationBannerProviderProps> = ({
  children,
}) => {
  const [banner, setBanner] = useState<NotificationBanner | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const hideBanner = useCallback(() => {
    setBanner(null);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  const showBanner = useCallback(
    (bannerConfig: Omit<NotificationBanner, 'id'>) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const newBanner: NotificationBanner = {
        ...bannerConfig,
        id: Date.now().toString(),
      };

      setBanner(newBanner);

      // Auto-hide after 5 seconds
      const newTimeoutId = setTimeout(() => {
        hideBanner();
      }, 5000);

      setTimeoutId(newTimeoutId);
    },
    [timeoutId, hideBanner]
  );

  const value: NotificationBannerContextType = {
    showBanner,
    hideBanner,
    banner,
  };

  return (
    <NotificationBannerContext.Provider value={value}>{children}</NotificationBannerContext.Provider>
  );
};

export default NotificationBannerContext;
