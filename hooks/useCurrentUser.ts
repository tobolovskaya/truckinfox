import { useState, useCallback, useEffect } from 'react';
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      if (!userId) {
        setCurrentUser(null);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, user_type, phone, country_code, is_verified, company_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setCurrentUser(data as CurrentUser | null);
    } catch (error) {
      console.error('Error fetching current user:', error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return {
    currentUser,
    loading,
    refetch: fetchCurrentUser,
  };
}
