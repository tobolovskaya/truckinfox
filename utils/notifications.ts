/**
 * Client-side notification utilities
 *
 * This file contains helper functions for managing notifications
 * in the React Native app.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type NotificationTimestamp = string | Date | { toDate: () => Date };

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_bid' | 'bid_accepted' | 'payment_success' | 'order_status_change';
  title: string;
  body: string;
  related_id: string;
  related_type: 'cargo_request' | 'order';
  read: boolean;
  created_at: NotificationTimestamp;
  read_at?: NotificationTimestamp;
  // Additional data
  bid_id?: string;
  bid_amount?: number;
  carrier_id?: string;
  carrier_name?: string;
  customer_id?: string;
  customer_name?: string;
  order_status?: string;
  amount?: number;
}

type NotificationRow = {
  id: string;
  user_id: string;
  type: Notification['type'];
  title: string;
  body: string;
  related_id: string | null;
  related_type: Notification['related_type'] | null;
  read: boolean;
  created_at: string;
  read_at: string | null;
  data: Record<string, unknown> | null;
};

function mapNotificationRow(row: NotificationRow): Notification {
  const data = row.data || {};

  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    related_id: row.related_id || '',
    related_type: (row.related_type || 'order') as Notification['related_type'],
    read: row.read,
    created_at: row.created_at,
    read_at: row.read_at || undefined,
    bid_id: typeof data.bid_id === 'string' ? data.bid_id : undefined,
    bid_amount: typeof data.bid_amount === 'number' ? data.bid_amount : undefined,
    carrier_id: typeof data.carrier_id === 'string' ? data.carrier_id : undefined,
    carrier_name: typeof data.carrier_name === 'string' ? data.carrier_name : undefined,
    customer_id: typeof data.customer_id === 'string' ? data.customer_id : undefined,
    customer_name: typeof data.customer_name === 'string' ? data.customer_name : undefined,
    order_status: typeof data.order_status === 'string' ? data.order_status : undefined,
    amount: typeof data.amount === 'number' ? data.amount : undefined,
  };
}

/**
 * Subscribe to real-time notifications for a user
 *
 * @param userId - The user's ID
 * @param onUpdate - Callback function called when notifications change
 * @param maxNotifications - Maximum number of notifications to retrieve (default: 50)
 * @returns Unsubscribe function
 *
 * @example
 * const unsubscribe = subscribeToNotifications(userId, (notifications) => {
 *   setNotifications(notifications);
 * });
 *
 * // Later, when component unmounts:
 * unsubscribe();
 */
export function subscribeToNotifications(
  userId: string,
  onUpdate: (_notifications: Notification[]) => void,
  maxNotifications: number = 50
): () => void {
  let channel: RealtimeChannel | null = null;
  let isActive = true;

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(maxNotifications);

      if (error) {
        throw error;
      }

      if (!isActive) {
        return;
      }

      const notifications = (data || []).map(row => mapNotificationRow(row as NotificationRow));
      onUpdate(notifications);
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    }
  };

  fetchNotifications();

  channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      fetchNotifications
    )
    .subscribe();

  return () => {
    isActive = false;
    channel?.unsubscribe();
  };
}

/**
 * Get unread notification count for a user
 *
 * @param userId - The user's ID
 * @returns Number of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}

/**
 * Subscribe to unread notification count
 *
 * @param userId - The user's ID
 * @param onUpdate - Callback function called when count changes
 * @returns Unsubscribe function
 */
export function subscribeToUnreadCount(
  userId: string,
  onUpdate: (_count: number) => void
): () => void {
  let channel: RealtimeChannel | null = null;
  let isActive = true;

  const updateCount = async () => {
    try {
      const count = await getUnreadNotificationCount(userId);
      if (isActive) {
        onUpdate(count);
      }
    } catch (error) {
      console.error('Error subscribing to unread count:', error);
    }
  };

  updateCount();

  channel = supabase
    .channel(`notifications-unread:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      updateCount
    )
    .subscribe();

  return () => {
    isActive = false;
    channel?.unsubscribe();
  };
}

/**
 * Mark a notification as read
 *
 * @param notificationId - The notification ID
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      throw error;
    }

    console.log(`Marked notification ${notificationId} as read`);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read (using Cloud Function for efficiency)
 *
 * @param userId - The user's ID
 * @returns Number of notifications marked as read
 */
export async function markAllNotificationsAsRead(): Promise<number> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return 0;
    }

    const { data: unreadRows, error: fetchError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('read', false);

    if (fetchError) {
      throw fetchError;
    }

    const unreadCount = unreadRows?.length || 0;

    if (unreadCount === 0) {
      return 0;
    }

    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('read', false);

    if (updateError) {
      throw updateError;
    }

    console.log(`Marked ${unreadCount} notifications as read`);
    return unreadCount;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete old notifications (older than specified days)
 *
 * This is a client-side utility for users to clean up their notifications.
 * Use with caution as it permanently deletes data.
 *
 * @param userId - The user's ID
 * @param olderThanDays - Delete notifications older than this many days
 * @returns Number of notifications deleted
 */
export async function deleteOldNotifications(
  userId: string,
  olderThanDays: number = 30
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString();

    const { data: oldRows, error: oldRowsError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .lt('created_at', cutoffIso);

    if (oldRowsError) {
      throw oldRowsError;
    }

    if (!oldRows || oldRows.length === 0) {
      return 0;
    }

    const ids = oldRows.map(row => row.id);
    const { error: deleteError } = await supabase.from('notifications').delete().in('id', ids);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Deleted ${ids.length} old notifications`);
    return ids.length;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
}

/**
 * Get notification navigation info
 *
 * Helper function to determine where to navigate when user taps a notification.
 *
 * @param notification - The notification object
 * @returns Navigation route and params
 */
export function getNotificationNavigation(notification: Notification): {
  screen: string;
  params: Record<string, unknown>;
} {
  switch (notification.type) {
    case 'new_bid':
      return {
        screen: 'request-details',
        params: { id: notification.related_id },
      };

    case 'bid_accepted':
      return {
        screen: 'request-details',
        params: { id: notification.related_id },
      };

    case 'payment_success':
      return {
        screen: 'order-status',
        params: { orderId: notification.related_id },
      };

    case 'order_status_change':
      return {
        screen: 'order-status',
        params: { orderId: notification.related_id },
      };

    default:
      return {
        screen: 'home',
        params: {},
      };
  }
}

/**
 * Format notification timestamp for display
 *
 * @param timestamp - Firestore timestamp
 * @returns Formatted string like "2 hours ago" or "Yesterday"
 */
export function formatNotificationTime(timestamp: NotificationTimestamp): string {
  const date =
    typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as string | number | Date);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}
