import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthApiError, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  errorCode?: string;
}

type PostgrestLikeError = {
  code?: string;
  message?: string;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (_email: string, _password: string) => Promise<AuthResult<AppUser>>;
  signUp: (_userData: SignUpData) => Promise<AuthResult<AppUser>>;
  signOut: () => Promise<AuthResult>;
  signOutAllDevices: () => Promise<AuthResult>;
}

type AppUser = SupabaseUser & {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
};

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

const mapSupabaseUser = (user: SupabaseUser): AppUser => ({
  ...user,
  uid: user.id,
  displayName:
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) || null,
  phoneNumber:
    (typeof user.user_metadata?.phone === 'string' && user.user_metadata.phone) || user.phone || null,
  photoURL:
    (typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url) || null,
});

const getAuthErrorMessage = (error: unknown): { message: string; code?: string } => {
  if (error instanceof AuthApiError) {
    switch (error.code) {
      case 'invalid_credentials':
      case 'email_not_confirmed':
        return { message: 'Невірний email або пароль.', code: error.code };
      case 'user_not_found':
        return { message: 'Користувача не знайдено. Спочатку зареєструйтесь.', code: error.code };
      case 'invalid_email':
        return { message: 'Невірний формат email.', code: error.code };
      case 'over_request_rate_limit':
      case 'too_many_requests':
        return { message: 'Забагато спроб. Спробуйте пізніше.', code: error.code };
      default:
        return { message: error.message, code: error.code };
    }
  }

  if (typeof error === 'object' && error !== null) {
    const postgrestError = error as PostgrestLikeError;

    if (
      postgrestError.code === 'PGRST205' &&
      typeof postgrestError.message === 'string' &&
      postgrestError.message.includes("public.profiles")
    ) {
      return {
        message:
          'Database is not initialized for this Supabase project (missing public.profiles). Apply migrations and try again.',
        code: 'profiles_table_missing',
      };
    }

    if (typeof postgrestError.message === 'string') {
      return {
        message: postgrestError.message,
        code: postgrestError.code,
      };
    }
  }

  return { message: error instanceof Error ? error.message : 'An unexpected error occurred' };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Supabase getSession error:', error);
      }

      if (isMounted) {
        setUser(data.session?.user ? mapSupabaseUser(data.session.user) : null);
        setLoading(false);
      }
    };

    initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult<AppUser>> => {
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Не вдалося увійти. Спробуйте ще раз.',
        };
      }

      return {
        success: true,
        data: mapSupabaseUser(data.user),
      };
    } catch (error) {
      if (error instanceof AuthApiError && ['invalid_credentials', 'email_not_confirmed'].includes(error.code || '')) {
        console.warn('Sign in rejected:', error.message);
      } else {
        console.error('Sign in error:', error);
      }
      const errorInfo = getAuthErrorMessage(error);
      return {
        success: false,
        error: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }
  };

  const signUp = async (userData: SignUpData): Promise<AuthResult<AppUser>> => {
    try {
      // Validate all input before making API call
      const validationError = validateSignUpData(userData);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const normalizedEmail = userData.email.trim().toLowerCase();
      const fullName = userData.fullName.trim();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: userData.password,
        options: {
          data: {
            full_name: fullName,
            phone: userData.phone.trim(),
            user_type: userData.userType,
            company_name: userData.companyName?.trim() || null,
            org_number: userData.orgNumber?.trim() || null,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Не вдалося створити акаунт. Спробуйте ще раз.',
        };
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: userData.phone.trim(),
        user_type: userData.userType,
        company_name: userData.companyName?.trim() || null,
        org_number: userData.orgNumber?.trim() || null,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        if (
          profileError.code === 'PGRST205' &&
          typeof profileError.message === 'string' &&
          profileError.message.includes("public.profiles")
        ) {
          return {
            success: false,
            error:
              'Database is not initialized for this Supabase project (missing public.profiles). Apply migrations and try again.',
            errorCode: 'profiles_table_missing',
          };
        }

        throw profileError;
      }

      return {
        success: true,
        data: mapSupabaseUser(data.user),
      };
    } catch (error) {
      const errorInfo = getAuthErrorMessage(error);

      if (errorInfo.code === 'profiles_table_missing') {
        console.warn('Sign up blocked:', errorInfo.message);
      } else {
        console.error('Sign up error:', error);
      }

      return {
        success: false,
        error: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }
  };

  const signOut = async (): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
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
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        throw error;
      }
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signOutAllDevices,
      }}
    >
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
