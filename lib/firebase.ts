import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, initializeAuth } from 'firebase/auth';
// @ts-ignore - getReactNativePersistence may not be in type definitions
import { getReactNativePersistence } from 'firebase/auth/react-native';
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

try {
  // Initialize Firebase Auth with AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('Firebase Auth initialized successfully');
} catch (error) {
  console.error('Firebase Auth initialization failed:', error);
  throw new Error('Firebase Auth is required for this application');
}

try {
  firestore = getFirestore(app);
  console.log('Firebase Firestore initialized successfully');
} catch (error) {
  console.error('Firebase Firestore initialization failed:', error);
  throw new Error('Firebase Firestore is required for this application');
}

try {
  storage = getStorage(app);
  console.log('Firebase Storage initialized successfully');
} catch (error) {
  console.error('Firebase Storage initialization failed:', error);
  throw new Error('Firebase Storage is required for this application');
}

// Export db as alias for firestore for backward compatibility
export const db = firestore;
export { app, auth, firestore, storage };
export default app;
