import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { theme } from '../../theme/theme';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const TabIcon = ({ name, color, focused }: { name: string; color: string; focused: boolean }) => {
    // Get the appropriate icon name based on focus state
    const getIconName = (baseName: string, isFocused: boolean) => {
      if (isFocused) {
        // Use filled version for active state
        return baseName.replace('-outline', '');
      }
      // Use outline version for inactive state
      return baseName.includes('-outline') ? baseName : `${baseName}-outline`;
    };

    return (
      <View
        style={{
          backgroundColor: focused ? theme.colors.primary : 'transparent',
          paddingHorizontal: focused ? 16 : 10,
          paddingVertical: focused ? 6 : 6,
          borderRadius: focused ? 20 : 12,
          minWidth: focused ? 64 : 44,
          minHeight: focused ? 35 : 35,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons
          name={getIconName(name, focused) as any}
          size={24}
          color={focused ? 'white' : color}
        />
      </View>
    );
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: 110,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={95}
            tint="light"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
            }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Hjem',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Meldinger',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Opprett',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="add-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Bestillinger',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="receipt" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen
        name="map"
        options={{
          href: null, // Hide from tabs
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null, // Hide from tabs
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hide from tabs
        }}
      />
    </Tabs>
  );
}
