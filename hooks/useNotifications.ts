/**
 * React hook for managing notifications
 *
 * Provides real-time notifications and unread count for the current user.
 */

import { useState, useEffect } from 'react';
import {
  subscribeToNotifications,
  subscribeToUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from '../utils/notifications';
import { useAuth } from '../contexts/AuthContext';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (_notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;
}

/**
 * Hook to manage user notifications with real-time updates
 *
 * @param maxNotifications - Maximum number of notifications to retrieve
 * @returns Notifications state and actions
 *
 * @example
 * function NotificationsScreen() {
 *   const { notifications, unreadCount, markAsRead } = useNotifications();
 *
 *   return (
 *     <View>
 *       <Text>Unread: {unreadCount}</Text>
 *       {notifications.map(notif => (
 *         <TouchableOpacity
 *           key={notif.id}
 *           onPress={() => markAsRead(notif.id)}
 *         >
 *           <Text>{notif.title}</Text>
 *         </TouchableOpacity>
 *       ))}
 *     </View>
 *   );
 * }
 */
export function useNotifications(maxNotifications: number = 50): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to notifications
    const unsubscribeNotifications = subscribeToNotifications(
      user.uid,
      newNotifications => {
        setNotifications(newNotifications);
        setLoading(false);
      },
      maxNotifications
    );

    // Subscribe to unread count
    const unsubscribeUnreadCount = subscribeToUnreadCount(user.uid, count => {
      setUnreadCount(count);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeNotifications();
      unsubscribeUnreadCount();
    };
  }, [user?.uid, maxNotifications, refreshKey]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError(err as Error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError(err as Error);
    }
  };

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    refresh,
  };
}

/**
 * Hook to only track unread count (lighter weight than full notifications)
 *
 * @returns Unread count and loading state
 *
 * @example
 * function TabBar() {
 *   const { unreadCount } = useUnreadCount();
 *
 *   return (
 *     <Tab.Screen
 *       name="Notifications"
 *       options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
 *     />
 *   );
 * }
 */
export function useUnreadCount(): { unreadCount: number; loading: boolean } {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToUnreadCount(user.uid, count => {
      setUnreadCount(count);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  return { unreadCount, loading };
}
