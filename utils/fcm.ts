/**
 * Firebase Cloud Messaging (FCM) Utilities - Expo Version
 *
 * This file contains all FCM-related functionality for push notifications using Expo.
 *
 * Prerequisites:
 * - expo-notifications (already installed in package.json)
 * - Configure push notifications in app.json
 * - Set up Firebase Cloud Messaging in Firebase Console
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from user
 *
 * @returns Authorization status
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permission denied');
      return false;
    }

    console.log('✅ Notification permission granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Get Expo Push Token and save it to user document
 *
 * @param userId - User's ID
 * @returns Expo Push Token or null
 */
export async function getFCMTokenAndSave(userId: string): Promise<string | null> {
  try {
    // Check permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Cannot get push token without permission');
      return null;
    }

    // Get Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id', // Replace with your actual project ID
    });

    const token = tokenData.data;

    if (!token) {
      console.error('Failed to get push token');
      return null;
    }

    console.log('✅ Push Token obtained:', token.substring(0, 30) + '...');

    // Save token to user document
    if (userId) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        expo_push_token: token,
        push_token_updated_at: serverTimestamp(),
        platform: Platform.OS,
      });
      console.log('✅ Push token saved to Firestore');
    }

    return token;
  } catch (error) {
    console.error('❌ Error getting push token:', error);
    return null;
  }
}

/**
 * Listen for push token updates
 *
 * Expo Push Tokens can change, so we monitor for updates.
 *
 * @param userId - User's ID
 * @returns Cleanup function
 */
export function subscribeToTokenRefresh(userId: string): () => void {
  let isActive = true;

  const checkTokenPeriodically = async () => {
    if (!isActive) return;

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Replace with your actual project ID
      });

      const token = tokenData.data;
      console.log('🔄 Checked push token:', token.substring(0, 30) + '...');

      if (userId && token) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          expo_push_token: token,
          push_token_updated_at: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('❌ Error checking push token:', error);
    }

    // Check again in 24 hours
    if (isActive) {
      setTimeout(checkTokenPeriodically, 24 * 60 * 60 * 1000);
    }
  };

  // Start checking
  checkTokenPeriodically();

  // Return cleanup function
  return () => {
    isActive = false;
  };
}

/**
 * Handle foreground notifications
 *
 * When the app is open and active, notifications are handled here.
 *
 * @param callback - Function to call when notification is received
 * @returns Cleanup function
 */
export function onForegroundMessage(
  callback: (_notification: Notifications.Notification) => void
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(
    (notification: Notifications.Notification) => {
      console.log('📬 Foreground notification received:', notification);
      callback(notification);
    }
  );

  return () => subscription.remove();
}

/**
 * Handle notification taps
 *
 * Called when user taps on a notification.
 *
 * @param callback - Function to call when notification is tapped
 * @returns Cleanup function
 */
export function onNotificationTap(
  callback: (_response: Notifications.NotificationResponse) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response: Notifications.NotificationResponse) => {
      console.log('👉 Notification tapped:', response);
      callback(response);
    }
  );

  return () => subscription.remove();
}

/**
 * Handle notification tap when app was opened from notification
 *
 * This checks if the app was opened by tapping a notification.
 *
 * @param callback - Function to call with notification data
 */
export async function getInitialNotification(
  callback: (_response: Notifications.NotificationResponse | null) => void
): Promise<void> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();

    if (response) {
      console.log('📬 App opened from notification:', response);
      callback(response);
    } else {
      callback(null);
    }
  } catch (error) {
    console.error('Error getting initial notification:', error);
    callback(null);
  }
}

/**
 * Clear FCM token (e.g., on logout)
 *
 * @param userId - User's ID
 */
export async function clearFCMToken(userId: string): Promise<void> {
  try {
    if (userId) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        expo_push_token: null,
        push_token_updated_at: serverTimestamp(),
      });
      console.log('✅ Push token cleared from Firestore');
    }
  } catch (error) {
    console.error('❌ Error clearing push token:', error);
  }
}

/**
 * Check if notifications are enabled
 *
 * @returns true if notifications are authorized
 */
export async function isNotificationEnabled(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
}

/**
 * Get notification badge count
 *
 * @returns Current badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set notification badge count
 *
 * @param count - Badge count to set
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
    console.log(`✅ Badge count set to ${count}`);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

/**
 * Schedule a local notification
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Additional data
 * @param trigger - When to show the notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: trigger || null,
    });

    console.log('✅ Local notification scheduled:', id);
    return id;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 *
 * @param notificationId - ID of notification to cancel
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('✅ Notification cancelled:', notificationId);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

/**
 * Handle navigation from notification tap
 *
 * Helper function to navigate to the appropriate screen based on
 * notification data.
 *
 * @param data - Notification data object
 * @param navigate - Navigation function
 */
interface NotificationNavigationData {
  type?: string;
  order_id?: string;
  request_id?: string;
  screen?: string;
  [key: string]: unknown;
}

export function handleNotificationNavigation(
  data: NotificationNavigationData,
  navigate: (_screen: string, _params?: Record<string, unknown>) => void
): void {
  const { type, order_id, request_id, screen } = data;

  console.log('📍 Navigating from notification:', { type, screen });

  // Navigate based on screen specified in data
  if (screen === 'order-status' && order_id) {
    navigate('order-status/[orderId]', { orderId: order_id });
  } else if (screen === 'request-details' && request_id) {
    navigate('request-details/[id]', { id: request_id });
  } else if (type === 'new_bid' && request_id) {
    navigate('request-details/[id]', { id: request_id });
  } else if (type === 'bid_accepted' && request_id) {
    navigate('request-details/[id]', { id: request_id });
  } else if (type === 'payment_success' && order_id) {
    navigate('order-status/[orderId]', { orderId: order_id });
  } else if (type === 'order_status_change' && order_id) {
    navigate('order-status/[orderId]', { orderId: order_id });
  } else {
    // Default to notifications screen
    navigate('(tabs)/notifications');
  }
}

/**
 * Complete FCM setup for a user
 *
 * This is a convenience function that handles the complete setup:
 * 1. Request permission
 * 2. Get and save token
 * 3. Subscribe to token refresh
 * 4. Set up notification handlers
 *
 * @param userId - User's ID
 * @param onForeground - Callback for foreground notifications
 * @param onNavigate - Callback for navigation
 * @returns Cleanup function
 */
export async function setupFCM(
  userId: string,
  onForeground: (_notification: Notifications.Notification) => void,
  onNavigate: (_response: Notifications.NotificationResponse) => void
): Promise<() => void> {
  console.log('🔔 Setting up push notifications for user:', userId);

  // Request permission and get token
  const hasPermission = await requestNotificationPermission();

  if (hasPermission) {
    await getFCMTokenAndSave(userId);
  }

  // Subscribe to token refresh
  const unsubscribeTokenRefresh = subscribeToTokenRefresh(userId);

  // Handle foreground messages
  const unsubscribeForeground = onForegroundMessage(onForeground);

  // Handle notification tap
  const unsubscribeTap = onNotificationTap(onNavigate);

  // Check for initial notification
  getInitialNotification(response => {
    if (response) {
      onNavigate(response);
    }
  });

  console.log('✅ Push notification setup complete');

  // Return cleanup function
  return () => {
    console.log('🧹 Cleaning up push notification listeners');
    unsubscribeTokenRefresh();
    unsubscribeForeground();
    unsubscribeTap();
  };
}

/**
 * Cleanup FCM when user logs out
 *
 * @param userId - User's ID
 */
export async function cleanupFCM(userId: string): Promise<void> {
  console.log('🧹 Cleaning up FCM for user:', userId);
  await clearFCMToken(userId);
  await setBadgeCount(0);
  console.log('✅ FCM cleanup complete');
}
