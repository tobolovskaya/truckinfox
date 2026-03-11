import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/sharedStyles';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let settled = false;

    const settle = (session: import('@supabase/supabase-js').Session | null) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      clearTimeout(fallback);
      if (session) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/auth/login' as never);
      }
    };

    // Listen for auth state resolution after OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        settle(session);
      } else if (event === 'SIGNED_OUT') {
        settle(null);
      }
    });

    // Fallback: if auth state never fires, check session explicitly
    const fallback = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      settle(session);
    }, 10000);

    return () => {
      settled = true;
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
