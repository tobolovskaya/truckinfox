import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../lib/sharedStyles';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';

export const NetworkStatusBar = () => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const { isSyncing, pendingCount } = useSyncStatus();

  // Show sync indicator if pending operations
  if (isSyncing || (pendingCount > 0 && !isConnected)) {
    return (
      <View style={styles.syncBanner}>
        <Ionicons
          name={isSyncing ? 'refresh' : 'cloud-offline'}
          size={16}
          color="white"
          style={isSyncing ? { animation: 'spin' } : {}}
        />
        <Text style={styles.syncText}>
          {isSyncing
            ? `Syncing ${pendingCount} operation${pendingCount !== 1 ? 's' : ''}...`
            : `${pendingCount} pending update${pendingCount !== 1 ? 's' : ''}`}
        </Text>
      </View>
    );
  }

  // Show offline banner if no connection
  if (!isConnected || !isInternetReachable) {
    return (
      <View style={styles.offlineBanner}>
        <Ionicons name="cloud-offline-outline" size={16} color="white" />
        <Text style={styles.offlineText}>
          {!isConnected ? 'No internet connection' : 'Limited connectivity'}
        </Text>
        <Text style={styles.offlineSubtext}>Data will sync when online</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  offlineBanner: {
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  offlineText: {
    color: 'white',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  offlineSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.xs,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  syncText: {
    color: 'white',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
