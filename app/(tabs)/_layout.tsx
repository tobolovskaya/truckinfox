import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTabletLayout, CONTENT_MAX_WIDTH } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import { CreateFAB } from '../../components/CreateFAB';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Tab bar heights (must match tabBarStyle below)
const TAB_BAR_HEIGHT_PHONE = 62;
const TAB_BAR_HEIGHT_TABLET = 72;

export default function TabLayout() {
  const { t } = useTranslation();
  const { isTablet } = useTabletLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabBarHeight = isTablet ? TAB_BAR_HEIGHT_TABLET : TAB_BAR_HEIGHT_PHONE;
  // Total height including safe area bottom inset
  const tabBarTotalHeight = tabBarHeight + insets.bottom;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.text.tertiary,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border.light,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingBottom: isTablet ? 10 : 6,
            paddingTop: isTablet ? 10 : 6,
            ...(isTablet && {
              maxWidth: CONTENT_MAX_WIDTH,
              alignSelf: 'center',
              width: '100%',
              borderTopWidth: 0,
              borderWidth: 1,
              borderColor: colors.border.light,
              borderRadius: 16,
              marginBottom: 8,
            }),
          },
          tabBarIconStyle: { marginTop: -4 },
          tabBarLabelStyle: {
            fontSize: isTablet ? 15 : 14,
            fontWeight: '600',
            marginBottom: isTablet ? 6 : 4,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="home"
          options={{
            title: t('home'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: t('messages'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        {/* Center FAB slot — invisible placeholder keeps spacing symmetric */}
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            tabBarIcon: () => <View />,
            tabBarLabel: () => null,
            tabBarButton: () => (
              // Empty slot so the tab bar keeps a centered gap for the FAB
              <View style={styles.fabSlot} pointerEvents="none" />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: t('ordersTab'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('profile'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        {/* Map and Notifications are accessible via Home header buttons */}
        <Tabs.Screen name="map" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      {/* FAB rendered outside Tabs so it floats above the tab bar */}
      <CreateFAB
        tabBarHeight={tabBarTotalHeight}
        onPress={() => router.push('/(tabs)/create')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabSlot: {
    flex: 1,
  },
});
