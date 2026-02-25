import { renderHook, waitFor } from '@testing-library/react-native';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import * as firebaseAuth from 'firebase/auth';
import * as firebaseFirestore from 'firebase/firestore';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
}));

describe('useCurrentUser', () => {
  const mockUser = {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockUserProfile = {
    id: 'user123',
    user_type: 'carrier',
    full_name: 'Test User',
    email: 'test@example.com',
    verified: true,
    rating: 4.5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null user when not authenticated', async () => {
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation(
      (auth, callback) => {
        callback(null);
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it('should fetch authenticated user profile', async () => {
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation(
      (auth, callback) => {
        callback(mockUser);
        return jest.fn();
      }
    );

    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(
      (docRef, callback) => {
        const mockSnapshot = {
          exists: () => true,
          data: () => mockUserProfile,
        };
        callback(mockSnapshot);
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user).toBeDefined();
      expect(result.current.user?.uid).toBe('user123');
    });
  });

  it('should handle loading state', async () => {
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation(
      (auth, callback) => {
        setTimeout(() => callback(mockUser), 100);
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle profile data fetch errors', async () => {
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation(
      (auth, callback) => {
        callback(mockUser);
        return jest.fn();
      }
    );

    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(
      (docRef, callback, errorCallback) => {
        if (errorCallback) {
          errorCallback(new Error('Firestore error'));
        }
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const mockUnsubscribeAuth = jest.fn();
    const mockUnsubscribeProfile = jest.fn();

    (firebaseAuth.onAuthStateChanged as jest.Mock).mockReturnValue(mockUnsubscribeAuth);
    (firebaseFirestore.onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribeProfile);

    const { unmount } = renderHook(() => useCurrentUser());

    unmount();

    await waitFor(() => {
      expect(mockUnsubscribeAuth).toHaveBeenCalled();
    });
  });

  it('should have verified user profile', async () => {
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation(
      (auth, callback) => {
        callback(mockUser);
        return jest.fn();
      }
    );

    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(
      (docRef, callback) => {
        const mockSnapshot = {
          exists: () => true,
          data: () => mockUserProfile,
        };
        callback(mockSnapshot);
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user?.verified).toBe(true);
      expect(result.current.user?.rating).toBe(4.5);
    });
  });
});
