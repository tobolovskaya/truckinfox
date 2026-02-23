import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/sharedStyles';

export default function TabLayout() {
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
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarIconStyle: {
          marginTop: -4,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 4,
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
          title: 'Hjem',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Meldinger',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Opprett',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Ordrer',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* Hide other screens from tab bar */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
