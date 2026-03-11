import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/sharedStyles';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Listen for the auth state to resolve after OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === 'SIGNED_OUT') {
        subscription.unsubscribe();
        router.replace('/(tabs)/home');
      }
    });

    // Fallback timeout in case auth state never fires (10s)
    const fallback = setTimeout(() => {
      subscription.unsubscribe();
      router.replace('/(tabs)/home');
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
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
