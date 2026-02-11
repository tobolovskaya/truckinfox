import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { AuthProvider } from '../contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Index />
    </AuthProvider>
  );
}

function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    // Mark as mounted after a brief delay to ensure router is ready
    const mountTimer = setTimeout(() => {
      setIsMounted(true);
    }, 100);

    return () => clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    if (!loading && isMounted && !hasNavigated) {
      setHasNavigated(true);

      // Use setTimeout to ensure router is fully ready
      setTimeout(() => {
        try {
          if (user) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(auth)/login');
          }
        } catch (error) {
          console.warn('Navigation error:', error);
          // Retry navigation after a longer delay
          setTimeout(() => {
            try {
              if (user) {
                router.replace('/(tabs)');
              } else {
                router.replace('/(auth)/login');
              }
            } catch (retryError) {
              console.error('Failed to navigate after retry:', retryError);
            }
          }, 500);
        }
      }, 50);
    }
  }, [user, loading, router, isMounted, hasNavigated]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FF7043',
      }}
    >
      <ActivityIndicator size="large" color="white" />
    </View>
  );
}
