import { createContext, useContext, type ReactNode } from 'react';
import { useKV } from '@github/spark/hooks';
import type { User } from '@/types';

interface AuthContextType {
  currentUser: User | null;
  isCustomer: boolean;
  isCarrier: boolean;
  signUp: (userData: Partial<User>) => void;
  signOut: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useKV<User | null>('currentUser', null);

  const signUp = (userData: Partial<User>) => {
    const newUser: User = {
      id: `user_${Date.now()}`,
      role: userData.role || 'customer',
      name: userData.name || '',
      email: userData.email || '',
      phone: userData.phone || '',
      city: userData.city || '',
      createdAt: new Date().toISOString(),
      rating: 5,
      reviewCount: 0,
      ...userData,
    };
    setCurrentUser(newUser);
  };

  const signOut = () => {
    setCurrentUser(null);
  };

  const updateProfile = (updates: Partial<User>) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, ...updates });
  };

  const isCustomer = currentUser?.role === 'customer';
  const isCarrier = currentUser?.role === 'carrier';

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser ?? null,
        isCustomer,
        isCarrier,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
