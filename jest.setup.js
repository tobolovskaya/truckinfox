import '@testing-library/jest-native/extend-expect';

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
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
}));

// Mock environment variables for testing
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-places-key';
