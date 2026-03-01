import React from 'react';
import { render } from '@testing-library/react-native';
import { RequestCard, type CargoRequest } from '../../components/home/RequestCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../components/LazyImage', () => ({
  LazyImage: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

describe('RequestCard smoke', () => {
  const baseRequest: CargoRequest = {
    id: 'request-1',
    title: 'volvo xc',
    cargo_type: 'automotive',
    status: 'active',
    price: 1000,
    price_type: 'fixed',
    weight: 5000,
    from_address: 'Narvik, Norge',
    to_address: 'Bodø, Norge',
    pickup_date: '2026-02-24',
    created_at: new Date().toISOString(),
  };

  it('does not show New quick badge for own request', () => {
    const request: CargoRequest = {
      ...baseRequest,
      customer_id: 'user-1',
    };

    const { queryByText } = render(
      <RequestCard
        request={request}
        onPress={jest.fn()}
        currentUserId="user-1"
        compact
        showFavorite={false}
      />
    );

    expect(queryByText('statusQuickYours')).toBeTruthy();
    expect(queryByText('statusQuickNew')).toBeNull();
  });

  it('shows New quick badge for non-own recent request', () => {
    const request: CargoRequest = {
      ...baseRequest,
      customer_id: 'another-user',
    };

    const { queryByText } = render(
      <RequestCard
        request={request}
        onPress={jest.fn()}
        currentUserId="user-1"
        compact
        showFavorite={false}
      />
    );

    expect(queryByText('statusQuickYours')).toBeNull();
    expect(queryByText('statusQuickNew')).toBeTruthy();
  });
});
