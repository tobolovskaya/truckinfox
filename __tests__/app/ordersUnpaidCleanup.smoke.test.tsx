import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OrdersScreen from '../../app/(tabs)/orders';

const mockPush = jest.fn();
const mockFrom = jest.fn();
let mockOrdersRows: Array<Record<string, unknown>> = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}));

jest.mock('../../hooks/useNotifications', () => ({
  useUnreadCount: () => ({ unreadCount: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'no' },
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        order: 'Bestilling',
        amount: 'Beløp',
        status: 'Status',
        date: 'Dato',
        pending: 'Venter',
        initiated: 'Startet',
        failed: 'Mislyktes',
        paid: 'Betalt',
        orders: 'Bestillinger',
        notifications: 'Varsler',
      };
      return dictionary[key] ?? key;
    },
  }),
}));

jest.mock('../../components/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('../../components/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('../../assets/empty-orders.svg', () => () => null);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('Orders unpaid cleanup smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const orphanUnpaidId = 'orphanunpaid-order-id';
    const paidId = 'paidorder-123456789';

    mockOrdersRows = [
      {
        id: orphanUnpaidId,
        request_id: null,
        bid_id: null,
        customer_id: 'user-1',
        carrier_id: 'carrier-1',
        total_amount: 1100,
        status: 'active',
        payment_status: 'pending',
        created_at: '2026-03-01T10:00:00.000Z',
      },
      {
        id: paidId,
        request_id: null,
        bid_id: null,
        customer_id: 'user-1',
        carrier_id: 'carrier-1',
        total_amount: 2200,
        status: 'active',
        payment_status: 'paid',
        created_at: '2026-03-01T11:00:00.000Z',
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            or: () => ({
              order: async () => ({
                data: mockOrdersRows,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'cargo_requests') {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    });
  });

  it('hides orphan unpaid orders from list while keeping other orders visible', async () => {
    const { queryByText, getByText } = render(<OrdersScreen />);

    await waitFor(() => {
      expect(getByText(/#paidorde/i)).toBeTruthy();
    });

    expect(queryByText(/#orphanun/i)).toBeNull();
  });

  it('hides orphan initiated/failed orders while keeping paid order visible', async () => {
    mockOrdersRows = [
      {
        id: 'orphaninit-order-id',
        request_id: null,
        bid_id: null,
        customer_id: 'user-1',
        carrier_id: 'carrier-1',
        total_amount: 1000,
        status: 'active',
        payment_status: 'initiated',
        created_at: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'orphanfail-order-id',
        request_id: null,
        bid_id: null,
        customer_id: 'user-1',
        carrier_id: 'carrier-1',
        total_amount: 900,
        status: 'active',
        payment_status: 'failed',
        created_at: '2026-03-01T10:30:00.000Z',
      },
      {
        id: 'paidordr2-123456',
        request_id: null,
        bid_id: null,
        customer_id: 'user-1',
        carrier_id: 'carrier-1',
        total_amount: 2300,
        status: 'active',
        payment_status: 'paid',
        created_at: '2026-03-01T11:00:00.000Z',
      },
    ];

    const { queryByText, getByText } = render(<OrdersScreen />);

    await waitFor(() => {
      expect(getByText(/#paidordr/i)).toBeTruthy();
    });

    expect(queryByText(/#orphanin/i)).toBeNull();
    expect(queryByText(/#orphanfa/i)).toBeNull();
  });
});
