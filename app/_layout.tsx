import 'react-native-reanimated';
import 'react-native-get-random-values';
import React, { useCallback, useEffect, useState } from 'react';
import { LogBox, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as Notifications from 'expo-notifications';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { I18nProvider } from '../contexts/I18nContext';
import { ToastProvider } from '../contexts/ToastContext';
import { NotificationBannerProvider } from '../contexts/NotificationBannerContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NetworkStatusBar } from '../components/NetworkStatusBar';
import { ForceUpdateModal } from '../components/ForceUpdateModal';
import { supabase } from '../lib/supabase';
import { theme } from '../theme/theme';
import { initializeOfflineSync } from '../lib/offlineSync';
import { initializeGlobalErrorTracking } from '../lib/errorTracking';
import 'react-native-url-polyfill/auto';

// Keep splash visible until auth state is resolved
SplashScreen.preventAutoHideAsync().catch(() => {});

// 2.3: Warn developers if the EAS project ID is still the placeholder
if (__DEV__) {
  const easProjectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (easProjectId === 'your-eas-project-id-replace-before-deployment') {
    console.warn(
      '[TruckinFox] EAS Project ID is not set. Replace "your-eas-project-id-replace-before-deployment" ' +
      'in app.json with your real EAS project ID before submitting a build.'
    );
  }
}

/** Returns true if semver `a` is strictly less than `b` (major.minor.patch). */
function isVersionLessThan(a: string, b: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj < bMaj;
  if (aMin !== bMin) return aMin < bMin;
  return aPat < bPat;
}

function SplashHider() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);
  return null;
}

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
  const [forceUpdate, setForceUpdate] = useState(false);

  const handleNotificationNavigation = useCallback(
    (data: {
      type?: string;
      order_id?: string;
      request_id?: string;
      sender_id?: string;
    }) => {
      const { type, order_id, request_id, sender_id } = data;

      if (type === 'bid_accepted' && order_id) {
        router.push(`/order-status/${order_id}`);
      } else if (type === 'new_bid' && request_id) {
        router.push(`/request-details/${request_id}`);
      } else if (type === 'new_message' && request_id && sender_id) {
        router.push(`/chat/${request_id}/${sender_id}`);
      } else if (type === 'payment_success' && order_id) {
        router.push(`/order-status/${order_id}`);
      } else if (type === 'order_status_change' && order_id) {
        router.push(`/order-status/${order_id}`);
      }
    },
    [router]
  );

  // Check minimum required app version from remote config
  useEffect(() => {
    const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .single()
      .then(({ data }: { data: { value?: string } | null }) => {
        const minVersion = data?.value ?? '0.0.0';
        if (isVersionLessThan(currentVersion, minVersion)) {
          setForceUpdate(true);
        }
      });
  }, []);

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
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const initializeNotificationHandlers = async () => {
      const { onNotificationTap, getInitialNotification } =
        require('../utils/fcm') as typeof import('../utils/fcm');

      unsubscribe = onNotificationTap((response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as {
          type?: string;
          order_id?: string;
          request_id?: string;
          sender_id?: string;
        };

        handleNotificationNavigation(data);
      });

      await getInitialNotification((response: Notifications.NotificationResponse | null) => {
        if (!response) {
          return;
        }

        const data = response.notification.request.content.data as {
          type?: string;
          order_id?: string;
          request_id?: string;
          sender_id?: string;
        };

        handleNotificationNavigation(data);
      });
    };

    void initializeNotificationHandlers();

    return () => {
      unsubscribe?.();
    };
  }, [handleNotificationNavigation]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <AuthProvider>
              <SplashHider />
              <ToastProvider>
                <NotificationBannerProvider>
                  <PaperProvider theme={theme}>
                    <View style={{ flex: 1 }}>
                      <NetworkStatusBar />
                      <Stack screenOptions={{ headerShown: false }} />
                      <ForceUpdateModal visible={forceUpdate} />
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
