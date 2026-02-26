import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock global fetch
globalThis.fetch = jest.fn();

// Mock AbortController and AbortSignal if not available
if (!globalThis.AbortController) {
  globalThis.AbortController = class AbortController {
    signal = { aborted: false };
    abort() {
      this.signal.aborted = true;
    }
  };
}

if (!globalThis.AbortSignal) {
  globalThis.AbortSignal = class AbortSignal {
    aborted = false;
  };
}

// Mock expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: {
    Screen: 'Screen',
  },
  Tabs: {
    Screen: 'Screen',
  },
}));

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), {
  virtual: true,
});

// Mock Firebase modules
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'test-app' })),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  initializeAuth: jest.fn(() => ({ currentUser: null })),
  getReactNativePersistence: jest.fn(() => ({ type: 'LOCAL' })),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ app: { name: 'test-app' } })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  onSnapshot: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ seconds: 0, nanoseconds: 0 })),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
  writeBatch: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({ app: { name: 'test-app' } })),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));

// Mock environment variables for testing
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = 'test-app-id';
process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-places-key';
