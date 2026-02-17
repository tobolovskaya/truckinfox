import React, { createContext, useContext, useState, useCallback } from 'react';
import { NotificationBanner } from '../components/NotificationBanner';

interface NotificationOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface NotificationBannerContextType {
  showNotification: (_options: NotificationOptions) => void;
}

const NotificationBannerContext = createContext<NotificationBannerContextType | undefined>(
  undefined
);

export const NotificationBannerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notification, setNotification] = useState<NotificationOptions | null>(null);

  const showNotification = useCallback((options: NotificationOptions) => {
    setNotification(options);
  }, []);

  const handleDismiss = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationBannerContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <NotificationBanner
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          action={notification.action}
          onDismiss={handleDismiss}
        />
      )}
    </NotificationBannerContext.Provider>
  );
};

export const useNotificationBanner = () => {
  const context = useContext(NotificationBannerContext);
  if (!context) {
    throw new Error('useNotificationBanner must be used within NotificationBannerProvider');
  }
  return context;
};
