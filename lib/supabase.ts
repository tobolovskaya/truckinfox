import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const rawSupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

const normalizeSupabaseUrl = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.includes('localhost') || value.includes('127.0.0.1')) {
    return `http://${value}`;
  }

  return `https://${value}`;
};

const isValidHttpUrl = (value?: string): boolean => {
  if (!value) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizedSupabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const isCloudHost = (value?: string): boolean => {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  const host = new URL(value as string).hostname.toLowerCase();
  return host !== 'localhost' && host !== '127.0.0.1';
};

export const isSupabaseConfigured = Boolean(rawSupabaseAnonKey && isCloudHost(normalizedSupabaseUrl));

if (!isSupabaseConfigured) {
  throw new Error(
    'Supabase cloud config is missing or invalid. Set EXPO_PUBLIC_SUPABASE_URL to your cloud project URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_KEY).'
  );
}

export const supabase = createClient(normalizedSupabaseUrl as string, rawSupabaseAnonKey as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
