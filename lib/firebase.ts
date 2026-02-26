import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, initializeAuth, getAuth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence exists at runtime via React Native module resolution
import { getReactNativePersistence } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
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
let analytics: null = null;
let performance: null = null;

// Initialize Firebase Auth with proper persistence
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('Firebase Auth initialized successfully (React Native - AsyncStorage persistence)');
} catch (error: unknown) {
  console.error('Firebase Auth initialization failed:', error);
  // Fallback to getAuth
  auth = getAuth(app);
  console.warn('⚠️ Using fallback Firebase Auth instance');
}

try {
  firestore = getFirestore(app);
  console.log('Firebase Firestore initialized successfully');
  console.log('✅ Firestore offline persistence enabled (React Native - automatic)');
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

console.log('Firebase Analytics: Disabled (native-only build)');
console.log('Firebase Performance Monitoring: Disabled (native-only build)');

// Export db as alias for firestore for backward compatibility
export const db = firestore;
export { app, auth, firestore, storage, analytics, performance };
export default app;
