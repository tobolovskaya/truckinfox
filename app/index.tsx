import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../lib/sharedStyles';

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabGroup = segments[0] === '(tabs)';

    if (!user && !inAuthGroup) {
      // User is not signed in and not in auth group, redirect to login
      router.replace('/(auth)/login');
    } else if (user && !inTabGroup) {
      // User is signed in and not in tab group, redirect to home
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments, router]);

  // Show loading indicator while checking auth state
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return null;
}
