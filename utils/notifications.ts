/**
 * Client-side notification utilities
 *
 * This file contains helper functions for managing notifications
 * in the React Native app.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_bid' | 'bid_accepted' | 'payment_success' | 'order_status_change';
  title: string;
  body: string;
  related_id: string;
  related_type: 'cargo_request' | 'order';
  read: boolean;
  created_at: Timestamp;
  read_at?: Timestamp;
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
  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
    limit(maxNotifications)
  );

  return onSnapshot(
    notificationsQuery,
    snapshot => {
      const notifications: Notification[] = [];

      snapshot.forEach(doc => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as Notification);
      });

      onUpdate(notifications);
    },
    error => {
      console.error('Error subscribing to notifications:', error);
    }
  );
}

/**
 * Get unread notification count for a user
 *
 * @param userId - The user's ID
 * @returns Number of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const unreadQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(unreadQuery);
    return snapshot.size;
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
  const unreadQuery = query(
    collection(db, 'notifications'),
    where('user_id', '==', userId),
    where('read', '==', false)
  );

  return onSnapshot(
    unreadQuery,
    snapshot => {
      onUpdate(snapshot.size);
    },
    error => {
      console.error('Error subscribing to unread count:', error);
    }
  );
}

/**
 * Mark a notification as read
 *
 * @param notificationId - The notification ID
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);

    await updateDoc(notificationRef, {
      read: true,
      read_at: serverTimestamp(),
    });

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
    const functions = getFunctions();
    const markAllRead = httpsCallable<void, { success: boolean; count: number }>(
      functions,
      'markAllNotificationsRead'
    );

    const result = await markAllRead();
    console.log(`Marked ${result.data.count} notifications as read`);

    return result.data.count;
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
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    const oldNotificationsQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('created_at', '<', cutoffTimestamp)
    );

    const snapshot = await getDocs(oldNotificationsQuery);

    if (snapshot.empty) {
      return 0;
    }

    // Note: For large deletions, consider using a Cloud Function
    // This client-side approach works for small batches
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log(`Deleted ${snapshot.size} old notifications`);
    return snapshot.size;
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
  params: Record<string, any>;
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
export function formatNotificationTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
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
