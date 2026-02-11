import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

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
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const hideBanner = useCallback(() => {
    setBanner(null);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const showBanner = useCallback(
    (bannerConfig: Omit<NotificationBanner, 'id'>) => {
      // Clear existing timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      const newBanner: NotificationBanner = {
        ...bannerConfig,
        id: Date.now().toString(),
      };

      setBanner(newBanner);

      // Auto-hide after 5 seconds
      timeoutIdRef.current = setTimeout(() => {
        hideBanner();
      }, 5000);
    },
    [hideBanner]
  );

  const value: NotificationBannerContextType = {
    showBanner,
    hideBanner,
    banner,
  };

  return (
    <NotificationBannerContext.Provider value={value}>
      {children}
    </NotificationBannerContext.Provider>
  );
};

export default NotificationBannerContext;
