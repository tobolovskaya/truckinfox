import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getDocument } from '../../lib/firestore-helpers';

jest.mock('../../lib/firestore-helpers', () => ({
  getDocument: jest.fn(),
}));

describe('useCurrentUser', () => {
  const mockUserProfile = {
    full_name: 'Test User',
    user_type: 'carrier',
    avatar_url: 'https://example.com/avatar.png',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null user when userId is not provided', async () => {
    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.currentUser).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    expect(getDocument).not.toHaveBeenCalled();
  });

  it('should fetch user profile when userId is provided', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockUserProfile);

    const { result } = renderHook(() => useCurrentUser('user123'));

    await waitFor(() => {
      expect(result.current.currentUser).toEqual(mockUserProfile);
      expect(result.current.loading).toBe(false);
    });

    expect(getDocument).toHaveBeenCalledWith('users', 'user123');
  });

  it('should handle loading state', async () => {
    let resolveDocument: ((_value: typeof mockUserProfile) => void) | undefined;
    const pendingDocument = new Promise<typeof mockUserProfile>(resolve => {
      resolveDocument = resolve;
    });
    (getDocument as jest.Mock).mockReturnValue(pendingDocument);

    const { result } = renderHook(() => useCurrentUser('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveDocument?.(mockUserProfile);
      await pendingDocument;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle profile fetch errors gracefully', async () => {
    (getDocument as jest.Mock).mockRejectedValue(new Error('Firestore error'));

    const { result } = renderHook(() => useCurrentUser('user123'));

    await waitFor(() => {
      expect(result.current.currentUser).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });
});
