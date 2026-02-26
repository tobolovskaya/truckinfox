# Apple Sign In Setup Guide (Deprecated)

> ⚠️ **Deprecated**: Apple Sign In is no longer part of the active authentication flow.
>
> - Current supported authentication: **email/password** only.
> - This document is archived for historical troubleshooting context.
> - Do not follow these steps for current deployment.

## Issue: `auth/operation-not-allowed`

This error occurs when Apple Sign In is **not enabled** in your Firebase Authentication configuration.

## Steps to Enable Apple Sign In

### 1. Go to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project: **truckinfox-8d5b2**
3. Navigate to **Authentication** → **Sign-in method**

### 2. Enable Apple Provider

1. Find **Apple** in the list of providers
2. If disabled (greyed out), click on it
3. Toggle **Enable** switch to ON
4. Click **Save**

### 3. Configure Apple Service

If prompted, you need to set up Apple as an OAuth provider:

1. Click **Apple** provider
2. Under **OAuth 2.0 client IDs**, you'll see a Google Cloud client ID
3. You may need to register your app in [Apple Developer Console](https://developer.apple.com)
   - Sign in with your Apple Developer account
   - Register a new App ID (bundle identifier: `com.truckinfox.app`)
   - Create a Service ID for the app
   - Configure OAuth for the Service ID
   - Download the configuration and add it to Firebase

### 4. Verify Configuration

After enabling:

- Test Apple Sign In on a physical iOS device (not simulator)
- You should see the Apple sign-in prompt
- Account creation should succeed

---

## Troubleshooting

### Still getting `auth/operation-not-allowed`?

- [ ] Verify Apple provider is **actually enabled** (toggle is ON, not OFF)
- [ ] Wait 2-5 minutes for Firebase config to propagate
- [ ] Restart the dev server: `npx expo start -c`
- [ ] Clear app cache on device and reinstall

### "Apple Sign In not available on this device"

- [ ] Apple Sign In only works on **physical iOS devices**, not simulators
- [ ] Build locally with: `eas build --platform ios --profile development`
- [ ] Or test on a real device using Expo Go app (if signed with Apple account)

### Getting `ERR_CANCELED`

- This is expected when user cancels the sign-in flow
- The app should handle gracefully (already does in AuthContext)

---

## Code Changes

The [contexts/AuthContext.tsx](../contexts/AuthContext.tsx) now:

1. **Detects `auth/operation-not-allowed`** error
2. **Shows helpful user message**: "Apple Sign In is not enabled. Contact support or try another method."
3. **Doesn't crash** the app
4. Logs the raw error for debugging

---

## References

- [Firebase Apple Sign In Setup](https://firebase.google.com/docs/auth/ios/apple)
- [Apple Developer Console](https://developer.apple.com/account)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
