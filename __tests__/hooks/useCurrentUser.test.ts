import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { useCurrentUser } from '../../hooks/useCurrentUser';

const mockMaybeSingle = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  },
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

    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('should fetch user profile when userId is provided', async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockUserProfile, error: null });

    const { result } = renderHook(() => useCurrentUser('user123'));

    await waitFor(() => {
      expect(result.current.currentUser).toEqual(mockUserProfile);
      expect(result.current.loading).toBe(false);
    });

    expect(mockMaybeSingle).toHaveBeenCalled();
  });

  it('should handle loading state', async () => {
    let resolveDocument: ((_value: { data: typeof mockUserProfile; error: null }) => void) | undefined;
    const pendingDocument = new Promise<{ data: typeof mockUserProfile; error: null }>(resolve => {
      resolveDocument = resolve;
    });
    mockMaybeSingle.mockReturnValue(pendingDocument);

    const { result } = renderHook(() => useCurrentUser('user123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveDocument?.({ data: mockUserProfile, error: null });
      await pendingDocument;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle profile fetch errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockMaybeSingle.mockRejectedValue(new Error('Supabase error'));

    const { result } = renderHook(() => useCurrentUser('user123'));

    await waitFor(() => {
      expect(result.current.currentUser).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    consoleErrorSpy.mockRestore();
  });
});
