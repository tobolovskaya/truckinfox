import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  full_name: string;
  avatar_url?: string;
  user_type?: string;
  phone?: string;
  country_code?: string;
  is_verified?: boolean;
  company_name?: string | null;
}

export function useCurrentUser(userId?: string) {
  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, user_type, phone, country_code, is_verified, company_name')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as CurrentUser | null;
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  return {
    currentUser: query.data ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
