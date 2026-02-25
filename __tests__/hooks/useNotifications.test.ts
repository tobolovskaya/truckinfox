import { renderHook, waitFor } from '@testing-library/react-native';
import { useNotifications } from '../../hooks/useNotifications';
import * as firebaseFirestore from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

describe('useNotifications', () => {
  const mockNotifications = [
    {
      id: 'notif1',
      userId: 'user123',
      type: 'new_bid',
      title: 'New Bid Received',
      body: 'You have a new bid of 5000 NOK',
      read: false,
      createdAt: new Date(),
      data: { bidId: 'bid1', requestId: 'req1' },
    },
    {
      id: 'notif2',
      userId: 'user123',
      type: 'bid_accepted',
      title: 'Bid Accepted! 🎉',
      body: 'Congratulations! Your bid has been accepted.',
      read: true,
      createdAt: new Date(),
      data: { bidId: 'bid2', requestId: 'req2' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const mockUnsubscribe = jest.fn();
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(
      (query, callback) => {
        const mockSnapshot = {
          docs: mockNotifications.map(notif => ({
            id: notif.id,
            data: () => notif,
          })),
          empty: false,
        };
        callback(mockSnapshot);
        return mockUnsubscribe;
      }
    );
  });

  it('should fetch user notifications on mount', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firebaseFirestore.onSnapshot).toHaveBeenCalled();
  });

  it('should filter by current user', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firebaseFirestore.where).toHaveBeenCalledWith('userId', '==', 'user123');
  });

  it('should sort notifications by newest first', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firebaseFirestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  it('should provide unread notification count', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.unreadCount).toBe(1); // Only notif1 is unread
  });

  it('should mark notification as read', async () => {
    (firebaseFirestore.updateDoc as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.markAsRead('notif1');

    expect(firebaseFirestore.updateDoc).toHaveBeenCalled();
  });

  it('should delete notification', async () => {
    (firebaseFirestore.deleteDoc as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.deleteNotification('notif1');

    expect(firebaseFirestore.deleteDoc).toHaveBeenCalled();
  });

  it('should mark all notifications as read', async () => {
    (firebaseFirestore.updateDoc as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.markAllAsRead();

    // Should be called for unread notifications
    expect(firebaseFirestore.updateDoc).toHaveBeenCalled();
  });

  it('should handle notification by type', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newBidNotifications = result.current.notifications.filter(
      n => n.type === 'new_bid'
    );
    expect(newBidNotifications).toHaveLength(1);
    expect(newBidNotifications[0].title).toBe('New Bid Received');
  });

  it('should clear all notifications', async () => {
    (firebaseFirestore.deleteDoc as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.clearAll();

    // Should delete all notifications
    expect(firebaseFirestore.deleteDoc).toHaveBeenCalled();
  });

  it('should handle loading state', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

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

    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const mockUnsubscribe = jest.fn();
    (firebaseFirestore.onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useNotifications('user123'));

    unmount();

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  it('should group notifications by type', async () => {
    const { result } = renderHook(() => useNotifications('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const groupedByType = result.current.groupNotificationsByType();

    expect(groupedByType.new_bid).toHaveLength(1);
    expect(groupedByType.bid_accepted).toHaveLength(1);
  });
});
