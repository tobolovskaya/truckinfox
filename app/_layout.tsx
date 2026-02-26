import 'react-native-reanimated';
import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { LogBox, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';
import { I18nProvider } from '../contexts/I18nContext';
import { ToastProvider } from '../contexts/ToastContext';
import { NotificationBannerProvider } from '../contexts/NotificationBannerContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NetworkStatusBar } from '../components/NetworkStatusBar';
import { theme } from '../theme/theme';
import { initializeOfflineSync } from '../lib/offlineSync';
import { initializeGlobalErrorTracking } from '../lib/errorTracking';
import { getInitialNotification, onNotificationTap } from '../utils/fcm';
import 'react-native-url-polyfill/auto';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

LogBox.ignoreLogs([
  'Animated: `useNativeDriver`',
  '"shadow*" style props are deprecated',
  'VirtualizedLists should never be nested',
]);

export default function RootLayout() {
  const router = useRouter();

  const handleNotificationNavigation = (data: {
    type?: string;
    order_id?: string;
    request_id?: string;
  }) => {
    const { type, order_id, request_id } = data;

    if (type === 'bid_accepted' && order_id) {
      router.push(`/order-status/${order_id}`);
    } else if (type === 'new_bid' && request_id) {
      router.push(`/request-details/${request_id}`);
    }
  };

  // Initialize offline-first sync on app startup
  useEffect(() => {
    const cleanupOfflineSync = initializeOfflineSync();
    const cleanupErrorTracking = initializeGlobalErrorTracking();

    return () => {
      cleanupErrorTracking();
      cleanupOfflineSync();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onNotificationTap(response => {
      const data = response.notification.request.content.data as {
        type?: string;
        order_id?: string;
        request_id?: string;
      };

      handleNotificationNavigation(data);
    });

    getInitialNotification(response => {
      if (!response) {
        return;
      }

      const data = response.notification.request.content.data as {
        type?: string;
        order_id?: string;
        request_id?: string;
      };

      handleNotificationNavigation(data);
    });

    return unsubscribe;
  }, [router]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider>
                <NotificationBannerProvider>
                  <PaperProvider theme={theme}>
                    <View style={{ flex: 1 }}>
                      <NetworkStatusBar />
                      <Stack screenOptions={{ headerShown: false }} />
                    </View>
                  </PaperProvider>
                </NotificationBannerProvider>
              </ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
