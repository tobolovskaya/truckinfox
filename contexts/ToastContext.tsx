import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

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
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    setToast(null);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (config: ToastConfig) => {
      // Clear existing timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      setToast(config);

      // Auto-hide after duration (default 3 seconds)
      const duration = config.duration || 3000;
      timeoutIdRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [hideToast]
  );

  const value: ToastContextType = {
    showToast,
    hideToast,
    toast,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export default ToastContext;
