import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from '../../app/(tabs)/home';

jest.mock('react-native/Libraries/Lists/VirtualizedList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return React.forwardRef(
    (props: { children?: React.ReactNode }, ref: React.ForwardedRef<unknown>) => {
      const { children, ...rest } = props;
      return React.createElement(View, { ...rest, ref }, children);
    }
  );
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', displayName: 'Test User' } }),
}));

jest.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ currentUser: { full_name: 'Test User', avatar_url: '' } }),
}));

jest.mock('../../hooks/useCargoRequests', () => ({
  useCargoRequests: () => ({
    requests: [],
    loading: false,
    refreshing: false,
    refresh: jest.fn(),
    fetchMoreRequests: jest.fn(),
    hasMore: false,
    loadingMore: false,
  }),
}));

jest.mock('../../hooks/useNotifications', () => ({
  useUnreadCount: () => ({ unreadCount: 0 }),
}));

jest.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ count: 0, error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: jest.fn() }),
      }),
      subscribe: () => ({ unsubscribe: jest.fn() }),
      unsubscribe: jest.fn(),
    }),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../components/home/HomeHeader', () => ({
  HomeHeader: () => null,
}));

jest.mock('../../components/home/HomeTabBar', () => ({
  HomeTabBar: () => null,
}));

jest.mock('../../components/home/HomeSearchBar', () => ({
  HomeSearchBar: () => null,
}));

jest.mock('../../components/home/HomeFilterSheet', () => ({
  HomeFilterSheet: () => null,
}));

jest.mock('../../components/home/HomeActiveFilters', () => ({
  HomeActiveFilters: () => null,
}));

jest.mock('../../components/home/RequestCard', () => ({
  RequestCard: () => null,
}));

jest.mock('../../components/SkeletonLoader', () => ({
  SkeletonLoader: () => null,
}));

jest.mock('../../assets/empty-cargo.svg', () => () => null);

describe('Home filters persistence migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('migrates legacy key to home_filters once on load', async () => {
    const legacyValue = JSON.stringify({
      activeTab: 'my',
      searchQuery: 'oslo',
      sortBy: 'newest',
      selectedCargoType: 'automotive',
    });

    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key: string) => {
      if (key === 'home_filters') {
        return null;
      }
      if (key === '@home_marketplace_filters') {
        return legacyValue;
      }
      return null;
    });

    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
    const removeItemSpy = jest.spyOn(AsyncStorage, 'removeItem');

    render(<HomeScreen />);

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith('home_filters', legacyValue);
      expect(removeItemSpy).toHaveBeenCalledWith('@home_marketplace_filters');
    });
  });
});
