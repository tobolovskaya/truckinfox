import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Strict TypeScript interfaces for auth data
export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  userType: 'customer' | 'carrier';
  companyName?: string;
  orgNumber?: string;
}

export interface AuthResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult<User>>;
  signUp: (userData: SignUpData) => Promise<AuthResult<User>>;
  signOut: () => Promise<AuthResult>;
  signOutAllDevices: () => Promise<AuthResult>;
}

// Input validation helpers
const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email format';
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
};

const validateSignUpData = (userData: SignUpData): string | null => {
  const emailError = validateEmail(userData.email);
  if (emailError) return emailError;

  const passwordError = validatePassword(userData.password);
  if (passwordError) return passwordError;

  if (!userData.fullName || userData.fullName.trim().length < 2) {
    return 'Full name must be at least 2 characters';
  }

  if (!userData.phone || userData.phone.trim().length < 8) {
    return 'Valid phone number is required';
  }

  if (!['customer', 'carrier'].includes(userData.userType)) {
    return 'User type must be either customer or carrier';
  }

  return null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Користувача не знайдено. Спочатку зареєструйтесь.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Невірний email або пароль.';
      case 'auth/invalid-email':
        return 'Невірний формат email.';
      case 'auth/user-disabled':
        return 'Акаунт вимкнено. Зверніться до підтримки.';
      case 'auth/too-many-requests':
        return 'Забагато спроб. Спробуйте пізніше.';
      case 'auth/configuration-not-found':
        return 'Налаштування Firebase Auth не знайдено. Увімкніть Email/Password у Firebase Console.';
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : 'An unexpected error occurred';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult<User>> => {
    try {
      // Validate input before making API call
      const emailError = validateEmail(email);
      if (emailError) {
        return { success: false, error: emailError };
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return { success: false, error: passwordError };
      }

      // Attempt sign in
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      return {
        success: true,
        data: userCredential.user,
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: getAuthErrorMessage(error),
      };
    }
  };

  const signUp = async (userData: SignUpData): Promise<AuthResult<User>> => {
    try {
      // Validate all input before making API call
      const validationError = validateSignUpData(userData);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Attempt sign up
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email.trim().toLowerCase(),
        userData.password
      );

      // Update user profile with display name
      await updateProfile(userCredential.user, {
        displayName: userData.fullName.trim(),
      });

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: userData.email.trim().toLowerCase(),
        full_name: userData.fullName.trim(),
        phone: userData.phone.trim(),
        user_type: userData.userType,
        company_name: userData.companyName?.trim() || null,
        org_number: userData.orgNumber?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: userCredential.user,
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: getAuthErrorMessage(error),
      };
    }
  };

  const signOut = async (): Promise<AuthResult> => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  };

  const signOutAllDevices = async (): Promise<AuthResult> => {
    try {
      // Firebase doesn't have a direct "sign out all devices" method
      // To implement this, you would need to:
      // 1. Store session tokens in Firestore
      // 2. Revoke all tokens on sign out
      // For now, we'll just sign out the current device
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Sign out all devices failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      signOutAllDevices,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}