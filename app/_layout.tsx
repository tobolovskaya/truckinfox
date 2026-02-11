import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { I18nProvider } from '../contexts/I18nContext';
import { ToastProvider } from '../contexts/ToastContext';
import { NotificationBannerProvider } from '../contexts/NotificationBannerContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import Toast from '../components/Toast';
import NotificationBanner from '../components/NotificationBanner';
import NetworkStatusBar from '../components/NetworkStatusBar';
import { colors } from '../theme';
import '../lib/i18n';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider>
          <AuthProvider>
            <I18nProvider>
              <ToastProvider>
                <NotificationBannerProvider>
                  <NetworkStatusBar />
                  <Toast />
                  <NotificationBanner />
                  <Stack
                    screenOptions={{
                      headerStyle: {
                        backgroundColor: colors.primary,
                      },
                      headerTintColor: colors.background,
                      headerTitleStyle: {
                        fontWeight: 'bold',
                      },
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                    <Stack.Screen name="auth/register" options={{ headerShown: false }} />
                    <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
                    <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
                    <Stack.Screen name="request-details/[id]" options={{ title: 'Request Details' }} />
                  </Stack>
                </NotificationBannerProvider>
              </ToastProvider>
            </I18nProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
