import 'react-native-reanimated';
import 'react-native-get-random-values';
import React from 'react';
import { LogBox, View } from 'react-native';
import { Stack } from 'expo-router';
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
