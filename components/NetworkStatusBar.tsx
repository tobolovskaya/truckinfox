import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../lib/sharedStyles';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTranslation } from 'react-i18next';

export const NetworkStatusBar = () => {
  const { t } = useTranslation();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const { isSyncing, pendingCount } = useSyncStatus();

  // Show sync indicator if pending operations
  if (isSyncing || (pendingCount > 0 && !isConnected)) {
    return (
      <View style={styles.syncBanner}>
        <Ionicons name={isSyncing ? 'refresh' : 'cloud-offline'} size={16} color="white" />
        <Text style={styles.syncText}>
          {isSyncing
            ? t('networkSyncing', { count: pendingCount })
            : t('networkPendingUpdates', { count: pendingCount })}
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
          {!isConnected ? t('networkNoInternet') : t('networkLimitedConnectivity')}
        </Text>
        <Text style={styles.offlineSubtext}>{t('networkSyncWhenOnline')}</Text>
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
