import { renderHook, waitFor } from '@testing-library/react-native';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeToNotifications,
  subscribeToUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../utils/notifications';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../utils/notifications', () => ({
  subscribeToNotifications: jest.fn(),
  subscribeToUnreadCount: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
}));

describe('useNotifications', () => {
  const mockNotifications = [
    {
      id: 'notif1',
      user_id: 'user123',
      type: 'new_bid',
      title: 'New Bid Received',
      body: 'You have a new bid of 5000 NOK',
      read: false,
      created_at: { toDate: () => new Date() },
      related_id: 'req1',
      related_type: 'cargo_request',
    },
    {
      id: 'notif2',
      user_id: 'user123',
      type: 'bid_accepted',
      title: 'Bid Accepted! 🎉',
      body: 'Congratulations! Your bid has been accepted.',
      read: true,
      created_at: { toDate: () => new Date() },
      related_id: 'req2',
      related_type: 'cargo_request',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user123' },
    });

    (subscribeToNotifications as jest.Mock).mockImplementation((userId, callback) => {
      callback(mockNotifications);
      return jest.fn();
    });

    (subscribeToUnreadCount as jest.Mock).mockImplementation((userId, callback) => {
      callback(1);
      return jest.fn();
    });

    (markNotificationAsRead as jest.Mock).mockResolvedValue(undefined);
    (markAllNotificationsAsRead as jest.Mock).mockResolvedValue(1);
  });

  it('should subscribe and expose user notifications', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(subscribeToNotifications).toHaveBeenCalledWith('user123', expect.any(Function), 50);
    expect(subscribeToUnreadCount).toHaveBeenCalledWith('user123', expect.any(Function));
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('should mark notification as read', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.markAsRead('notif1');
    expect(markNotificationAsRead).toHaveBeenCalledWith('notif1');
  });

  it('should mark all notifications as read', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.markAllAsRead();
    expect(markAllNotificationsAsRead).toHaveBeenCalled();
  });

  it('should handle action errors gracefully', async () => {
    const expectedError = new Error('mark failed');
    (markNotificationAsRead as jest.Mock).mockRejectedValueOnce(expectedError);

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.markAsRead('notif1');

    await waitFor(() => {
      expect(result.current.error).toEqual(expectedError);
    });
  });

  it('should reset state when user is not authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(subscribeToNotifications).not.toHaveBeenCalled();
    expect(subscribeToUnreadCount).not.toHaveBeenCalled();
  });

  it('should unsubscribe listeners on unmount', async () => {
    const unsubscribeNotifications = jest.fn();
    const unsubscribeUnread = jest.fn();
    (subscribeToNotifications as jest.Mock).mockReturnValue(unsubscribeNotifications);
    (subscribeToUnreadCount as jest.Mock).mockReturnValue(unsubscribeUnread);

    const { unmount } = renderHook(() => useNotifications());

    unmount();

    expect(unsubscribeNotifications).toHaveBeenCalled();
    expect(unsubscribeUnread).toHaveBeenCalled();
  });

  it('should refresh subscriptions when refresh is called', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    result.current.refresh();

    await waitFor(() => {
      expect(subscribeToNotifications).toHaveBeenCalledTimes(2);
    });
  });
});
