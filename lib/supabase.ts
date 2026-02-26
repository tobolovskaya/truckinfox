import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const rawSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

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

const supabaseUrl = isValidHttpUrl(rawSupabaseUrl) ? rawSupabaseUrl : LOCAL_SUPABASE_URL;
const supabaseAnonKey = rawSupabaseAnonKey || 'invalid';

export const isSupabaseConfigured = Boolean(rawSupabaseAnonKey && isValidHttpUrl(rawSupabaseUrl));

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
