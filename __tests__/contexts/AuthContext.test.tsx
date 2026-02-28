import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
    from: jest.fn(() => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
    })),
  },
}));

describe('AuthContext (Supabase Auth)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockOnAuthStateChange.mockImplementation(() => ({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    }));

    mockUpsert.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('allows user sign up and returns uid mapped from user.id', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'new@truckinfox.app',
          user_metadata: { full_name: 'New User' },
        },
        session: { access_token: 'token' },
      },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>> | undefined;

    await act(async () => {
      signUpResult = await result.current.signUp({
        email: 'new@truckinfox.app',
        password: 'password123',
        fullName: 'New User',
        phone: '+4799999999',
        userType: 'customer',
      });
    });

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@truckinfox.app',
        options: expect.objectContaining({
          data: expect.objectContaining({
            user_type: 'customer',
          }),
        }),
      })
    );

    expect(signUpResult?.success).toBe(true);
    expect(signUpResult?.data?.uid).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('allows user sign in and returns uid mapped from user.id', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'user@truckinfox.app',
          user_metadata: { full_name: 'Existing User' },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>> | undefined;

    await act(async () => {
      signInResult = await result.current.signIn('user@truckinfox.app', 'password123');
    });

    expect(signInResult?.success).toBe(true);
    expect(signInResult?.data?.uid).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('hydrates current user from Supabase session and exposes uid', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: '33333333-3333-4333-8333-333333333333',
            email: 'session@truckinfox.app',
            user_metadata: { full_name: 'Session User' },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.uid).toBe('33333333-3333-4333-8333-333333333333');
  });
});
