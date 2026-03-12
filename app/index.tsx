import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// Match the splash screen background so there is no jarring white flash
// between the native splash and the React Native content.
const SPLASH_BG = '#FF7043';

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabGroup = segments[0] === '(tabs)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && !inTabGroup) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: SPLASH_BG,
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return null;
}
