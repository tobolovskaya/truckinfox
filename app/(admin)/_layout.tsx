import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { colors } from '../../lib/sharedStyles';

export default function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { currentUser, loading: currentUserLoading } = useCurrentUser(user?.uid);

  if (authLoading || currentUserLoading) {
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

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (currentUser?.user_type !== 'admin') {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
