import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize Firebase Auth with AsyncStorage persistence
// Note: initializeAuth must be called before getAuth for persistence to work
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('Firebase Auth initialized successfully with AsyncStorage persistence');
} catch (error: unknown) {
  // If auth is already initialized, get the existing instance
  const firebaseError = error as { code?: string };
  if (firebaseError?.code === 'auth/already-initialized') {
    console.log('Firebase Auth: Using existing instance (caught error)');
    auth = getAuth(app);
  } else {
    console.error('Firebase Auth initialization failed:', error);
    // Don't throw - create a fallback to allow app to run
    auth = getAuth(app);
    console.warn('⚠️ Using fallback Firebase Auth instance');
  }
}

try {
  firestore = getFirestore(app);
  console.log('Firebase Firestore initialized successfully');
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

// Export db as alias for firestore for backward compatibility
export const db = firestore;
export { app, auth, firestore, storage };
export default app;
