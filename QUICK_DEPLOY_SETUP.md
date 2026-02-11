# Quick Deploy Setup for TruckinFox

This guide provides step-by-step instructions to quickly deploy the TruckinFox application.

## Prerequisites

- Node.js 18+ installed
- Expo CLI installed: `npm install -g expo-cli`
- Firebase CLI installed: `npm install -g firebase-tools`
- EAS CLI installed: `npm install -g eas-cli`
- Git installed

## 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/tobolovskaya/truckinfox.git
cd truckinfox

# Install dependencies
npm install

# Install function dependencies
cd functions
npm install
cd ..
```

## 2. Firebase Setup

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "TruckinFox"
3. Enable Authentication (Email/Password and Phone)
4. Enable Firestore Database
5. Enable Firebase Storage
6. Enable Cloud Functions

### Configure Firebase

```bash
# Login to Firebase
firebase login

# Initialize Firebase (if not already initialized)
firebase init

# Select:
# - Firestore
# - Functions
# - Storage
# - Emulators

# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Deploy storage rules
firebase deploy --only storage

# Deploy Cloud Functions
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### Download Configuration Files

1. For iOS: Download `GoogleService-Info.plist`
2. For Android: Download `google-services.json`
3. Place them in the project root

## 3. Environment Variables

Create a `.env` file in the root:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

GOOGLE_MAPS_API_KEY=your_google_maps_key
VIPPS_CLIENT_ID=your_vipps_client_id
VIPPS_CLIENT_SECRET=your_vipps_secret
```

## 4. EAS Build Setup

```bash
# Login to Expo
eas login

# Configure EAS
eas build:configure

# Update eas.json with your project ID
```

## 5. Local Development

### Start Expo Development Server

```bash
npm start
```

### Run on Simulator/Emulator

```bash
# iOS
npm run ios

# Android
npm run android
```

### Run Firebase Emulators

```bash
firebase emulators:start
```

## 6. Build for Production

### iOS Build

```bash
# Development build
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production
```

### Android Build

```bash
# Development build
eas build --platform android --profile development

# Production build
eas build --platform android --profile production
```

## 7. Deploy to App Stores

### iOS App Store

1. Build with production profile
2. Download IPA file
3. Upload to App Store Connect using Transporter
4. Submit for review

### Google Play Store

1. Build with production profile (AAB)
2. Download AAB file
3. Upload to Google Play Console
4. Complete store listing
5. Submit for review

## 8. Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run lint
      - run: npm test
      - run: firebase deploy --only functions
```

## 9. Monitoring

### Firebase Console

- Monitor Firestore usage
- Check Cloud Functions logs
- Review Authentication activity

### Expo Dashboard

- View build status
- Monitor crash reports
- Check app usage statistics

## Troubleshooting

### Build Fails

```bash
# Clear cache
expo start -c

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Firebase Deployment Issues

```bash
# Check Firebase CLI version
firebase --version

# Update Firebase CLI
npm install -g firebase-tools@latest

# Re-authenticate
firebase logout
firebase login
```

### EAS Build Issues

```bash
# Check EAS CLI version
eas --version

# Update EAS CLI
npm install -g eas-cli@latest
```

## Quick Commands

```bash
# Start development
npm start

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check

# Deploy Firebase
firebase deploy

# Build iOS
eas build -p ios

# Build Android
eas build -p android
```

## Support

- Firebase: [firebase.google.com/support](https://firebase.google.com/support)
- Expo: [docs.expo.dev](https://docs.expo.dev)
- GitHub Issues: [github.com/tobolovskaya/truckinfox/issues](https://github.com/tobolovskaya/truckinfox/issues)
