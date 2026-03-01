import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RequestDetailsScreen from '../../app/request-details/[id]';
import { useLocalSearchParams } from 'expo-router';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: jest.fn(),
    success: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../utils/haptics', () => ({
  triggerHapticFeedback: {
    light: jest.fn(),
    medium: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/analytics', () => ({
  trackBidSubmitted: jest.fn(),
  trackBidAccepted: jest.fn(),
  trackCargoRequestDeleted: jest.fn(),
}));

jest.mock('../../components/SuccessAnimation', () => ({
  SuccessAnimation: () => null,
}));

jest.mock('../../components/LazyImage', () => ({
  LazyImage: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('../../components/Avatar', () => {
  return () => {
    const { View } = require('react-native');
    return <View />;
  };
});

jest.mock('../../components/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('../../components/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const { FlatList } = require('react-native');
  return { KeyboardAwareFlatList: FlatList };
});

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
  };
});

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

type CargoRequestRow = {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight_kg: number;
  from_address: string;
  to_address: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  pickup_date: string;
  delivery_date: string;
  price: number;
  price_type: string;
  status: string;
  customer_id: string;
  images: string[];
};

const buildSupabaseMock = (requestRow: CargoRequestRow) => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'cargo_requests') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: requestRow, error: null }),
          }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                full_name: 'Yevheniia',
                user_type: 'customer',
                rating: 4.8,
                phone: '',
                avatar_url: '',
              },
              error: null,
            }),
          }),
          in: async () => ({ data: [], error: null }),
        }),
      };
    }

    if (table === 'bids') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  });
};

describe('Request details images layout smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders single image full-width layout for one image', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'request-single' });

    buildSupabaseMock({
      id: 'request-single',
      title: 'volvo xc',
      description: 'desc',
      cargo_type: 'automotive',
      weight_kg: 5000,
      from_address: 'Narvik, Norge',
      to_address: 'Bodø, Norge',
      from_lat: 68.4385,
      from_lng: 17.4273,
      to_lat: 67.2804,
      to_lng: 14.4049,
      pickup_date: '2026-02-24',
      delivery_date: '2026-02-25',
      price: 1000,
      price_type: 'fixed',
      status: 'active',
      customer_id: 'user-1',
      images: ['https://example.com/image-1.jpg'],
    });

    const { getByTestId, queryByTestId } = render(<RequestDetailsScreen />);

    await waitFor(() => {
      expect(getByTestId('request-image-single')).toBeTruthy();
    });

    expect(queryByTestId('request-images-scroll')).toBeNull();
  });

  it('renders horizontal image scroll layout for multiple images', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'request-multi' });

    buildSupabaseMock({
      id: 'request-multi',
      title: 'volvo xc',
      description: 'desc',
      cargo_type: 'automotive',
      weight_kg: 5000,
      from_address: 'Narvik, Norge',
      to_address: 'Bodø, Norge',
      from_lat: 68.4385,
      from_lng: 17.4273,
      to_lat: 67.2804,
      to_lng: 14.4049,
      pickup_date: '2026-02-24',
      delivery_date: '2026-02-25',
      price: 1000,
      price_type: 'fixed',
      status: 'active',
      customer_id: 'user-1',
      images: ['https://example.com/image-1.jpg', 'https://example.com/image-2.jpg'],
    });

    const { getByTestId, queryByTestId } = render(<RequestDetailsScreen />);

    await waitFor(() => {
      expect(getByTestId('request-images-scroll')).toBeTruthy();
    });

    expect(queryByTestId('request-image-single')).toBeNull();
  });
});
