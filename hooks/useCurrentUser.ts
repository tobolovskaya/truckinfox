import { useState, useCallback, useEffect } from 'react';
import { getDocument } from '../lib/firestore-helpers';

interface CurrentUser {
  full_name: string;
  avatar_url?: string;
  user_type?: string;
  phone?: string;
  country_code?: string;
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
      const data = await getDocument<CurrentUser>('users', userId);

      setCurrentUser(data);
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
