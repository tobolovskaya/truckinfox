import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
  toast: ToastConfig | null;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    setToast(null);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  const showToast = useCallback(
    (config: ToastConfig) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      setToast(config);

      // Auto-hide after duration (default 3 seconds)
      const duration = config.duration || 3000;
      const newTimeoutId = setTimeout(() => {
        hideToast();
      }, duration);

      setTimeoutId(newTimeoutId);
    },
    [timeoutId, hideToast]
  );

  const value: ToastContextType = {
    showToast,
    hideToast,
    toast,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export default ToastContext;
