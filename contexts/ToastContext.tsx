import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toast';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  show: (_message: string, _type?: ToastType, _duration?: number) => void;
  success: (_message: string, _duration?: number) => void;
  error: (_message: string, _duration?: number) => void;
  info: (_message: string, _duration?: number) => void;
  warning: (_message: string, _duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36);
    const newToast: ToastMessage = { id, message, type, duration };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration + animation time
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 500);
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => {
      show(message, 'success', duration);
    },
    [show]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      show(message, 'error', duration);
    },
    [show]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      show(message, 'info', duration);
    },
    [show]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      show(message, 'warning', duration);
    },
    [show]
  );

  const handleHide = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          visible={true}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onHide={() => handleHide(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
