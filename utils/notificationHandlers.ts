import { router } from 'expo-router';

type NotificationData = {
  type?: string;
  request_id?: string;
  order_id?: string;
  conversation_id?: string;
  sender_id?: string;
  [key: string]: unknown;
};

type NotificationContent = {
  data: NotificationData;
  badge?: number;
};

type NotificationRequest = {
  content: NotificationContent;
};

type NotificationPayload = {
  request: NotificationRequest;
};

type NotificationResponse = {
  notification: NotificationPayload;
};

/**
 * Handle notification tap navigation
 * Routes users to the appropriate screen based on notification type
 *
 * @param response - Notification response from Expo Notifications
 */
export function handleNotificationTap(response: NotificationResponse): void {
  try {
    const data = response.notification.request.content.data;
    const type = data.type;

    console.log('ðŸ“± Notification tapped:', type, data);

    switch (type) {
      case 'new_bid':
        // Navigate to cargo request details to view the new bid
        if (data.request_id) {
          router.push(`/request-details/${data.request_id}`);
        }
        break;

      case 'bid_accepted':
        // Navigate to order status page
        if (data.order_id) {
          router.push(`/order-status/${data.order_id}`);
        }
        break;

      case 'order_created':
        // Navigate to order status page
        if (data.order_id) {
          router.push(`/order-status/${data.order_id}`);
        }
        break;

      case 'new_message':
        // Navigate to chat conversation
        if (data.conversation_id) {
          router.push(`/chat/${data.conversation_id}`);
        } else if (data.sender_id) {
          // Fallback: navigate to chat with sender
          router.push(`/chat?userId=${data.sender_id}`);
        }
        break;

      case 'delivery_confirmed':
        // Navigate to order status page for delivery confirmation
        if (data.order_id) {
          router.push(`/order-status/${data.order_id}`);
        }
        break;

      case 'order_cancelled':
        // Navigate to order status page to see cancellation details
        if (data.order_id) {
          router.push(`/order-status/${data.order_id}`);
        }
        break;

      case 'payment_reminder':
        // Navigate to payment page
        if (data.order_id) {
          router.push(`/payment/${data.order_id}`);
        }
        break;

      case 'general':
      default:
        // Default: navigate to notifications tab
        router.push('/(tabs)/notifications');
        break;
    }
  } catch (error) {
    console.error('Error handling notification tap:', error);
    // Fallback: navigate to notifications tab
    router.push('/(tabs)/notifications');
  }
}

/**
 * Handle foreground notification
 * Shows an in-app banner or updates badge count
 *
 * @param notification - Notification object from Expo Notifications
 */
export function handleForegroundNotification(notification: NotificationPayload): void {
  try {
    console.log('ðŸ“¬ Foreground notification:', notification.request.content);

    // You can implement custom in-app banner here
    // For now, Expo will handle showing the notification

    // Optionally update badge count
    // setBadge(notification.request.content.badge);
  } catch (error) {
    console.error('Error handling foreground notification:', error);
  }
}

/**
 * Badge count management
 */
let badgeCount = 0;

export function incrementBadge(): void {
  badgeCount++;
  // Expo handles badge count automatically, but you can track it manually if needed
}

export function resetBadge(): void {
  badgeCount = 0;
  // Clear badge when user opens notifications screen
}

export function getBadgeCount(): number {
  return badgeCount;
}
