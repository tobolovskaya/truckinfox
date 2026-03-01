import React from 'react';
import { render } from '@testing-library/react-native';
import TabLayout from '../../app/(tabs)/_layout';

const capturedScreenProps: Array<{
  name: string;
  options?: {
    title?: string;
    href?: string | null;
  };
}> = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Tabs = ({ children }: { children: React.ReactNode }) => (
    <View testID="tabs-root">{children}</View>
  );

  const Screen = (props: {
    name: string;
    options?: {
      title?: string;
      href?: string | null;
    };
  }) => {
    capturedScreenProps.push(props);
    return <View testID={`tab-screen-${props.name}`} />;
  };

  Tabs.Screen = Screen;

  return {
    Tabs,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        home: 'Hjem',
        messages: 'Meldinger',
        create: 'Opprett',
        orders: 'Bestillinger',
        profile: 'Profil',
      };
      return dictionary[key] ?? key;
    },
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('TabLayout smoke', () => {
  beforeEach(() => {
    capturedScreenProps.length = 0;
  });

  it('renders tab screens with localized titles and hidden routes', () => {
    const { getByTestId } = render(<TabLayout />);

    expect(getByTestId('tabs-root')).toBeTruthy();
    expect(getByTestId('tab-screen-home')).toBeTruthy();
    expect(getByTestId('tab-screen-messages')).toBeTruthy();
    expect(getByTestId('tab-screen-create')).toBeTruthy();
    expect(getByTestId('tab-screen-orders')).toBeTruthy();
    expect(getByTestId('tab-screen-profile')).toBeTruthy();

    const screenByName = (name: string) => capturedScreenProps.find(screen => screen.name === name);

    expect(screenByName('home')?.options?.title).toBe('Hjem');
    expect(screenByName('messages')?.options?.title).toBe('Meldinger');
    expect(screenByName('create')?.options?.title).toBe('Opprett');
    expect(screenByName('orders')?.options?.title).toBe('Bestillinger');
    expect(screenByName('profile')?.options?.title).toBe('Profil');

    expect(screenByName('index')?.options?.href).toBeNull();
    expect(screenByName('notifications')?.options?.href).toBeNull();
    expect(screenByName('map')?.options?.href).toBeNull();
  });
});
