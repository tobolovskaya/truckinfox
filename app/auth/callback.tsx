import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/sharedStyles';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase automatically handles the session via the auth state change listener
    // Just redirect to home after a brief moment to allow session to be set
    const timer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
