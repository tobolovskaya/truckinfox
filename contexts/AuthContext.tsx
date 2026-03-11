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
  retryAfterSeconds?: number;
  mfaFactorId?: string;
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
  /** Role from JWT app_metadata (set by custom_access_token_hook). Falls back to
   *  user_metadata for existing sessions issued before the hook was deployed. */
  userType: 'customer' | 'carrier' | null;
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

  if (!userData.phone || userData.phone.trim().length < 7) {
    return 'Valid phone number is required';
  }

  if (!['customer', 'carrier'].includes(userData.userType)) {
    return 'User type must be either customer or carrier';
  }

  return null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const resolveUserType = (user: SupabaseUser): 'customer' | 'carrier' | null => {
  // Prefer app_metadata (stamped by custom_access_token_hook — admin-only, tamper-proof)
  const fromAppMeta = user.app_metadata?.user_type;
  if (fromAppMeta === 'customer' || fromAppMeta === 'carrier') return fromAppMeta;
  // Fallback: user_metadata (set at signup, present on sessions pre-dating the hook)
  const fromUserMeta = user.user_metadata?.user_type;
  if (fromUserMeta === 'customer' || fromUserMeta === 'carrier') return fromUserMeta;
  return null;
};

const mapSupabaseUser = (user: SupabaseUser): AppUser => ({
  ...user,
  uid: user.id,
  displayName:
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) || null,
  phoneNumber:
    (typeof user.user_metadata?.phone === 'string' && user.user_metadata.phone) ||
    user.phone ||
    null,
  photoURL:
    (typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url) || null,
  userType: resolveUserType(user),
});

const parseRetryAfterSeconds = (message: string): number | undefined => {
  const match = message.match(/(\d+)\s*(second|seconds|sec|s)\b/i);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
};

const getAuthErrorMessage = (
  error: unknown
): { message: string; code?: string; retryAfterSeconds?: number } => {
  if (error instanceof AuthApiError) {
    const normalizedMessage = error.message.toLowerCase();

    if (
      normalizedMessage.includes('user already registered') ||
      normalizedMessage.includes('already registered') ||
      normalizedMessage.includes('already exists')
    ) {
      return {
        message:
          'Denne e-posten er allerede registrert. Logg inn eller bekreft e-posten hvis kontoen er ny.',
        code: 'user_already_exists',
      };
    }

    if (normalizedMessage.includes('email rate limit exceeded')) {
      return {
        message:
          'For mange registreringsforsøk akkurat nå. Vent litt og prøv igjen, eller logg inn hvis kontoen allerede finnes.',
        code: 'signup_rate_limited',
        retryAfterSeconds: parseRetryAfterSeconds(error.message),
      };
    }

    switch (error.code) {
      case 'invalid_credentials':
        return { message: 'Невірний email або пароль.', code: error.code };
      case 'email_not_confirmed':
        return {
          message:
            'E-posten er ikke bekreftet ennå. Sjekk innboksen din og bekreft kontoen før innlogging.',
          code: error.code,
        };
      case 'user_not_found':
        return { message: 'Користувача не знайдено. Спочатку зареєструйтесь.', code: error.code };
      case 'invalid_email':
        return { message: 'Невірний формат email.', code: error.code };
      case 'over_email_send_rate_limit':
      case 'over_sms_send_rate_limit':
        return {
          message:
            'For mange registreringsforsøk akkurat nå. Vent litt og prøv igjen, eller logg inn hvis kontoen allerede finnes.',
          code: 'signup_rate_limited',
          retryAfterSeconds: parseRetryAfterSeconds(error.message),
        };
      case 'over_request_rate_limit':
      case 'too_many_requests':
        return {
          message: 'Забагато спроб. Спробуйте пізніше.',
          code: error.code,
          retryAfterSeconds: parseRetryAfterSeconds(error.message),
        };
      default:
        return { message: error.message, code: error.code };
    }
  }

  if (typeof error === 'object' && error !== null) {
    const postgrestError = error as PostgrestLikeError;

    if (
      postgrestError.code === 'PGRST205' &&
      typeof postgrestError.message === 'string' &&
      postgrestError.message.includes('public.profiles')
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

      // Check if MFA challenge is required (user has TOTP enrolled)
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactor = factorsData?.totp?.[0];
        if (totpFactor) {
          return {
            success: false,
            errorCode: 'mfa_required',
            mfaFactorId: totpFactor.id,
          };
        }
      }

      return {
        success: true,
        data: mapSupabaseUser(data.user),
      };
    } catch (error) {
      const errorInfo = getAuthErrorMessage(error);

      if (!['invalid_credentials', 'email_not_confirmed'].includes(errorInfo.code || '')) {
        console.error('Sign in error:', error);
      }

      return {
        success: false,
        error: errorInfo.message,
        errorCode: errorInfo.code,
        retryAfterSeconds: errorInfo.retryAfterSeconds,
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

      if (!data.session) {
        return {
          success: false,
          error: 'Konto opprettet. Sjekk e-posten din og bekreft kontoen før innlogging.',
          errorCode: 'email_confirmation_required',
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
        if (profileError.code === '42501') {
          return {
            success: false,
            error:
              'Kontoen ble opprettet, men profilen kunne ikke lagres på grunn av tilgangsregler. Logg inn på nytt etter e-postbekreftelse.',
            errorCode: 'profiles_rls_blocked',
          };
        }

        if (
          profileError.code === 'PGRST205' &&
          typeof profileError.message === 'string' &&
          profileError.message.includes('public.profiles')
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

      if (
        ![
          'profiles_table_missing',
          'signup_rate_limited',
          'email_confirmation_required',
          'user_already_exists',
        ].includes(errorInfo.code || '')
      ) {
        console.error('Sign up error:', error);
      }

      return {
        success: false,
        error: errorInfo.message,
        errorCode: errorInfo.code,
        retryAfterSeconds: errorInfo.retryAfterSeconds,
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
