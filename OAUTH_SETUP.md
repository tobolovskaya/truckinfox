# OAuth Social Login Setup Guide (Deprecated)

> ⚠️ **Deprecated**: Social OAuth login (Google/Apple) has been removed from the active app authentication flow.
>
> - Current supported authentication: **email/password** only.
> - This document is kept for historical reference only.
> - Do not use this guide for current production setup.

This document describes the old Google/Apple Sign In setup that is no longer active in the app.

## 📦 Historical Implementation Notes

### Former state (before deprecation):

- **Apple Sign In** was available for iOS devices
- **Google Sign In** had partial/placeholder support

### Historical features:

- OAuth integration with Firebase Authentication
- Automatic user profile creation in Firestore
- Error handling and user cancellation support
- Analytics tracking for social logins
- Seamless routing after successful authentication

---

## 🍎 Apple Sign In Setup

### Prerequisites:

1. Apple Developer Account ($99/year)
2. App ID with "Sign in with Apple" capability enabled

### Steps:

#### 1. Enable Apple Sign In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`truckinfox`)
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Apple**
5. Click **Enable**
6. Click **Save**

#### 2. Configure Apple Developer Account

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers**
4. Find your App ID (`com.truckinfox.app`)
5. Enable **Sign in with Apple** capability
6. Click **Save**

#### 3. Configure Expo app.json

The app.json already includes `expo-apple-authentication` plugin support. No additional configuration needed.

#### 4. Test Apple Sign In

```bash
# Build iOS app with EAS
eas build --platform ios --profile development

# Or run on iOS Simulator (Note: Apple Sign In requires physical device for production)
npx expo run:ios
```

### Usage in App:

Users can tap the Apple icon on the login screen to sign in with their Apple ID. Only works on iOS devices.

---

## 🔐 Google Sign In Setup

### Prerequisites:

1. Firebase project with Authentication enabled
2. Google Cloud Platform project linked to Firebase

### Steps:

#### 1. Get OAuth Client IDs from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Google**
5. Click **Enable**
6. Click **Save**

#### 2. Get iOS OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **iOS**
6. Bundle ID: `com.truckinfox.app`
7. Click **Create**
8. Copy the **Client ID**

#### 3. Get Android OAuth Client ID

1. In Google Cloud Console, go to **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Android**
4. Package name: `com.truckinfox.app`
5. Get your app's SHA-1 fingerprint:

   ```bash
   # For development
   keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey
   # Password: android

   # For production (use your release keystore)
   keytool -keystore /path/to/release.keystore -list -v
   ```

6. Enter the SHA-1 fingerprint
7. Click **Create**
8. Copy the **Client ID**

#### 4. Add Client IDs to Environment Variables

Create or update `.env` file:

```env
# Firebase OAuth Configuration
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

**⚠️ Important:** Add `.env` to `.gitignore` to keep client IDs secure.

#### 5. Update AuthContext Implementation

In `contexts/AuthContext.tsx`, uncomment the Google Sign In implementation:

```typescript
const signInWithGoogle = async (): Promise<AuthResult<User>> => {
  try {
    const clientId = Platform.select({
      ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      default: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    });

    if (!clientId) {
      return { success: false, error: 'Google OAuth not configured' };
    }

    // TODO: Implement full Google OAuth flow
    // Use @react-native-google-signin/google-signin for native experience
  } catch (error) {
    // ... error handling
  }
};
```

#### 6. Alternative: Use Native Google Sign In SDK

For best user experience, install native Google Sign In:

```bash
npm install @react-native-google-signin/google-signin
npx expo prebuild
```

Update `contexts/AuthContext.tsx`:

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign In
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
});

const signInWithGoogle = async (): Promise<AuthResult<User>> => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    const credential = GoogleAuthProvider.credential(userInfo.idToken);
    const userCredential = await signInWithCredential(auth, credential);

    // Create user profile if first time
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    if (!userDoc.exists()) {
      // ... create profile
    }

    return { success: true, data: userCredential.user };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
};
```

---

## 🧪 Testing OAuth

### Test Apple Sign In:

1. Build app with EAS: `eas build --platform ios --profile development`
2. Install on physical iOS device
3. Tap Apple icon on login screen
4. Sign in with Apple ID
5. Verify user profile created in Firebase Console

### Test Google Sign In:

1. Configure OAuth client IDs (see steps above)
2. Update `.env` with client IDs
3. Build app: `eas build --platform ios --profile development`
4. Tap Google icon on login screen
5. Sign in with Google account
6. Verify user profile created in Firebase Console

---

## 🔒 Security Best Practices

1. **Never commit OAuth client IDs** to version control
2. **Use environment variables** for all sensitive credentials
3. **Enable SHA-256 fingerprints** for Android production builds
4. **Rotate OAuth secrets** periodically
5. **Monitor Firebase Authentication logs** for suspicious activity
6. **Implement rate limiting** on authentication endpoints
7. **Use HTTPS only** for OAuth redirect URIs

---

## 🐛 Troubleshooting

### Apple Sign In Issues:

**Error: "Apple Sign In not available"**

- Solution: Apple Sign In only works on physical iOS devices (not simulator for production)
- Ensure you're testing on iOS 13+ device

**Error: "Invalid client"**

- Solution: Verify App ID has "Sign in with Apple" capability enabled in Apple Developer Portal

### Google Sign In Issues:

**Error: "Sign in configuration issue"**

- Solution: Verify OAuth client IDs are correctly set in `.env`
- Check Firebase Console that Google authentication is enabled

**Error: "Network request failed"**

- Solution: Check internet connection
- Verify Firebase project is active and not suspended

**Error: "DEVELOPER_ERROR"**

- Solution: SHA-1 fingerprint doesn't match
- Regenerate SHA-1 and update in Google Cloud Console

---

## 📚 Additional Resources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Expo Auth Session](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google Sign In for React Native](https://github.com/react-native-google-signin/google-signin)
- [Apple Sign In Guidelines](https://developer.apple.com/sign-in-with-apple/)

---

## ✅ Checklist

- [x] Install OAuth dependencies (`expo-apple-authentication`, `expo-auth-session`)
- [x] Implement Apple Sign In (iOS only)
- [ ] Configure Google OAuth client IDs
- [ ] Test Apple Sign In on physical iOS device
- [ ] Test Google Sign In on iOS/Android
- [ ] Update IMPLEMENTATION_SUMMARY.md with OAuth status
- [ ] Add analytics tracking for social logins
- [ ] Document user experience in README

---

## 🚀 Future Enhancements

1. **Sign in with Microsoft** for enterprise users
2. **Sign in with Phone Number** (SMS verification)
3. **Biometric authentication** (Face ID, Touch ID)
4. **Multi-factor authentication** (2FA)
5. **Session management** across devices
6. **Social profile sync** (auto-import profile picture, name)

---

_Last updated: February 16, 2026_
