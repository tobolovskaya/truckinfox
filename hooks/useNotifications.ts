import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  mapNotificationRow,
  type Notification,
  type NotificationRow,
} from '../utils/notifications';
import { useAuth } from '../contexts/AuthContext';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (_notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => void;
}

/** Hook to manage user notifications with real-time updates */
export function useNotifications(maxNotifications: number = 50): UseNotificationsResult {
  const { user } = useAuth();
  const uid = user?.uid;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', uid, maxNotifications],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid!)
        .order('created_at', { ascending: false })
        .limit(maxNotifications);
      if (error) throw error;
      return (data || []).map(row => mapNotificationRow(row as NotificationRow));
    },
    enabled: Boolean(uid),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => { queryClient.invalidateQueries({ queryKey: ['notifications', uid] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [uid, queryClient]);

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    queryClient.invalidateQueries({ queryKey: ['notifications', uid] });
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    queryClient.invalidateQueries({ queryKey: ['notifications', uid] });
  };

  return {
    notifications,
    unreadCount,
    loading: query.isLoading,
    error: query.error as Error | null,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    refetch: query.refetch,
  };
}

/** Hook to only track unread count (lighter weight than full notifications) */
export function useUnreadCount(): { unreadCount: number; loading: boolean } {
  const { user } = useAuth();
  const uid = user?.uid;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', 'unread-count', uid],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid!)
        .eq('read', false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(uid),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications-unread:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => { queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', uid] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [uid, queryClient]);

  return { unreadCount: query.data ?? 0, loading: query.isLoading };
}
