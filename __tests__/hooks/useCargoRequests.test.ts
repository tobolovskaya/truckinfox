import { renderHook, waitFor } from '@testing-library/react-native';
import { useCargoRequests } from '../../hooks/useCargoRequests';
import * as firebaseFirestore from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

describe('useCargoRequests', () => {
  const mockCargoRequests = [
    {
      id: '1',
      cargo_type: 'automotive',
      status: 'open',
      created_at: new Date(),
      pickup_location: { lat: 59.9, lng: 10.7 },
      delivery_location: { lat: 60.3, lng: 5.3 },
      weight: 5000,
      customerId: 'user1',
    },
    {
      id: '2',
      cargo_type: 'general',
      status: 'open',
      created_at: new Date(),
      pickup_location: { lat: 59.9, lng: 10.7 },
      delivery_location: { lat: 60.3, lng: 5.3 },
      weight: 2000,
      customerId: 'user1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const mockUnsubscribe = jest.fn();
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(
      (query, callback) => {
        const mockSnapshot = {
          docs: mockCargoRequests.map(req => ({
            id: req.id,
            data: () => req,
          })),
          empty: false,
        };
        callback(mockSnapshot);
        return mockUnsubscribe;
      }
    );
  });

  it('should fetch cargo requests on mount', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: {},
        sortBy: 'newest',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firebaseFirestore.onSnapshot).toHaveBeenCalled();
  });

  it('should filter requests by cargo type', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { cargo_type: 'automotive' },
        sortBy: 'newest',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should apply cargo_type filter in Firebase query
    expect(firebaseFirestore.where).toHaveBeenCalledWith('cargo_type', '==', 'automotive');
  });

  it('should handle loading state correctly', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: {},
        sortBy: 'newest',
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle errors gracefully', async () => {
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(
      (query, callback, errorCallback) => {
        if (errorCallback) {
          errorCallback(new Error('Firestore error'));
        }
        return jest.fn();
      }
    );

    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: {},
        sortBy: 'newest',
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });

  it('should sort requests by newest first', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: {},
        sortBy: 'newest',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firebaseFirestore.orderBy).toHaveBeenCalledWith('created_at', 'desc');
  });

  it('should unsubscribe on unmount', async () => {
    const mockUnsubscribe = jest.fn();
    (firebaseFirestore.onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: {},
        sortBy: 'newest',
      })
    );

    unmount();

    // Unsubscribe should be called on cleanup
    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
