import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTabletLayout, CONTENT_MAX_WIDTH } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import { useUnreadCount } from '../../hooks/useNotifications';

export default function TabLayout() {
  const { t } = useTranslation();
  const { isTablet } = useTabletLayout();
  const { unreadCount } = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border.light,
          borderTopWidth: 1,
          height: isTablet ? 72 : 62,
          paddingBottom: isTablet ? 10 : 6,
          paddingTop: isTablet ? 10 : 6,
          // On tablets, float the tab bar as a centered pill
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
        tabBarIconStyle: {
          marginTop: -4,
        },
        tabBarLabelStyle: {
          fontSize: isTablet ? 15 : 14,
          fontWeight: '600',
          marginBottom: isTablet ? 6 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hide index from tabs
        }}
      />
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
      <Tabs.Screen
        name="create"
        options={{
          title: t('create'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="add-circle" size={size} color={color} />
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
      <Tabs.Screen
        name="map"
        options={{
          title: t('map'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('notifications'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
      />
    </Tabs>
  );
}
