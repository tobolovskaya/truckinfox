import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../lib/sharedStyles';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const NetworkStatusBar = () => {
  const { isConnected, isInternetReachable } = useNetworkStatus();

  if (isConnected && isInternetReachable) {
    return null;
  }

  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline-outline" size={16} color="white" />
      <Text style={styles.offlineText}>
        {!isConnected ? 'No internet connection' : 'Limited connectivity'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  offlineText: {
    color: 'white',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
