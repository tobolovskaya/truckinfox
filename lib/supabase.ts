import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const rawSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

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
const supabaseUrl = isValidHttpUrl(normalizedSupabaseUrl)
  ? normalizedSupabaseUrl || LOCAL_SUPABASE_URL
  : LOCAL_SUPABASE_URL;
const supabaseAnonKey = rawSupabaseAnonKey || 'invalid';

export const isSupabaseConfigured = Boolean(rawSupabaseAnonKey && isValidHttpUrl(normalizedSupabaseUrl));

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase env is missing or invalid. Set EXPO_PUBLIC_SUPABASE_URL (http/https) and EXPO_PUBLIC_SUPABASE_ANON_KEY. Falling back to local URL.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
