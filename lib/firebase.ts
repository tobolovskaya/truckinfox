import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, initializeAuth, getAuth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence exists at runtime via React Native module resolution
import { getReactNativePersistence } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
} from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Analytics, getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { FirebasePerformance, getPerformance } from 'firebase/performance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Validate Firebase configuration
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;

if (!isConfigValid) {
  console.warn('⚠️ Firebase configuration incomplete. Check your .env file.');
  console.warn('Missing:', {
    apiKey: !firebaseConfig.apiKey,
    projectId: !firebaseConfig.projectId,
    appId: !firebaseConfig.appId,
  });
}

// Initialize Firebase app
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize services with error handling
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;
let performance: FirebasePerformance | null = null;

// Initialize Firebase Auth with proper persistence
try {
  if (Platform.OS === 'web') {
    // Web uses browser persistence automatically
    auth = getAuth(app);
    console.log('Firebase Auth initialized successfully (web - browser persistence)');
  } else {
    // React Native requires explicit AsyncStorage persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log('Firebase Auth initialized successfully (React Native - AsyncStorage persistence)');
  }
} catch (error: unknown) {
  console.error('Firebase Auth initialization failed:', error);
  // Fallback to getAuth
  auth = getAuth(app);
  console.warn('⚠️ Using fallback Firebase Auth instance');
}

try {
  firestore = getFirestore(app);
  console.log('Firebase Firestore initialized successfully');

  // 🔌 Enable offline persistence for Firestore
  // Caches data locally for offline access
  if (Platform.OS === 'web') {
    // Web: Use IndexedDB for multi-tab support
    enableMultiTabIndexedDbPersistence(firestore)
      .then(() => {
        console.log('✅ Firestore offline persistence enabled (web - multi-tab)');
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, fall back to single-tab
          enableIndexedDbPersistence(firestore)
            .then(() => {
              console.log('✅ Firestore offline persistence enabled (web - single-tab)');
            })
            .catch((singleTabErr) => {
              console.warn('⚠️ Firestore offline persistence not available:', singleTabErr.message);
            });
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Browser does not support IndexedDB for offline persistence');
        } else {
          console.warn('⚠️ Firestore offline persistence error:', err);
        }
      });
  } else {
    // React Native: Persistence enabled automatically via SDK
    console.log('✅ Firestore offline persistence enabled (React Native - automatic)');
  }
} catch (error) {
  console.error('Firebase Firestore initialization failed:', error);
  // Don't throw - assign anyway to prevent crashes
  firestore = getFirestore(app);
  console.warn('⚠️ Using fallback Firestore instance');
}

try {
  storage = getStorage(app);
  console.log('Firebase Storage initialized successfully');
} catch (error) {
  console.error('Firebase Storage initialization failed:', error);
  // Don't throw - assign anyway to prevent crashes
  storage = getStorage(app);
  console.warn('⚠️ Using fallback Storage instance');
}

// Initialize Analytics (web only) - Native platforms not supported
if (Platform.OS === 'web') {
  isAnalyticsSupported()
    .then(supported => {
      if (supported) {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics initialized successfully');
      } else {
        console.log('Firebase Analytics not supported in this web environment');
      }
    })
    .catch(error => {
      console.warn('Firebase Analytics check failed:', error);
    });
} else {
  console.log('Firebase Analytics: Skipping initialization (React Native platform)');
  analytics = null;
}

// Initialize Performance Monitoring (web only) - Native platforms not supported
if (Platform.OS === 'web') {
  try {
    performance = getPerformance(app);
    console.log('Firebase Performance Monitoring initialized successfully');
  } catch (error) {
    console.warn('Firebase Performance Monitoring not available:', error);
    performance = null;
  }
} else {
  console.log('Firebase Performance Monitoring: Skipping initialization (React Native platform)');
  performance = null;
}

// Export db as alias for firestore for backward compatibility
export const db = firestore;
export { app, auth, firestore, storage, analytics, performance };
export default app;
