# Push Notifications Setup for TruckinFox

This guide explains how to set up push notifications for the TruckinFox mobile application using Firebase Cloud Messaging (FCM) and Expo.

## Prerequisites

- Firebase project set up
- Expo account
- Apple Developer account (for iOS)
- Google Cloud Console access (for Android)

## iOS Setup

### 1. Apple Push Notification Service (APNs) Key

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to Certificates, Identifiers & Profiles
3. Select Keys and create a new key
4. Enable Apple Push Notifications service (APNs)
5. Download the `.p8` key file

### 2. Configure Firebase

1. Go to Firebase Console
2. Navigate to Project Settings > Cloud Messaging
3. Under iOS app configuration, upload your APNs authentication key
4. Enter your Team ID and Key ID

### 3. Update app.json

Ensure your `app.json` includes:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.truckinfox.app",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#FF7043"
        }
      ]
    ]
  }
}
```

## Android Setup

### 1. Firebase Cloud Messaging

1. Go to Firebase Console
2. Download `google-services.json`
3. Place it in the root of your project

### 2. Update app.json

Ensure your `app.json` includes:

```json
{
  "expo": {
    "android": {
      "package": "com.truckinfox.app",
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

## Implementation

### 1. Request Permissions

```typescript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  
  if (status !== 'granted') {
    alert('Push notification permissions not granted');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  
  // Store token in Firestore
  await firestore.doc(`users/${userId}`).update({
    fcmToken: token.data
  });
}
```

### 2. Handle Notifications

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### 3. Listen for Notifications

```typescript
useEffect(() => {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    // Navigate to relevant screen
  });

  return () => {
    subscription.remove();
    responseSubscription.remove();
  };
}, []);
```

## Testing

### 1. Using Expo Go

During development, test notifications using:

```bash
npx expo start
```

### 2. Using EAS Build

For production testing:

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

### 3. Firebase Console

Test notifications directly from Firebase Console:
1. Go to Cloud Messaging
2. Send test message
3. Enter FCM token

## Cloud Functions

The app uses Cloud Functions to send notifications:

```typescript
export const onNewBid = functions.firestore
  .document('bids/{bidId}')
  .onCreate(async (snap, context) => {
    // Send notification when new bid is placed
  });
```

## Troubleshooting

### iOS Issues

- Ensure APNs certificate is valid
- Check bundle identifier matches
- Verify provisioning profile includes push notifications

### Android Issues

- Verify `google-services.json` is in root
- Check package name matches
- Ensure Firebase project has Cloud Messaging enabled

### Common Issues

- **Token not generated**: Check permissions
- **Notifications not received**: Verify FCM token is stored
- **Background notifications not working**: Check notification handler configuration

## Security

- Never commit `google-services.json` or `GoogleService-Info.plist` to public repositories
- Store FCM tokens securely
- Implement proper authentication before sending notifications

## References

- [Expo Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
