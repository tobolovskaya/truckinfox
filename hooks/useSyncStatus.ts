import { useCallback, useEffect, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import {
  syncOfflineQueue,
  getPendingOfflineOperations,
  hasPendingOfflineOperations,
  getSyncStatus,
  OfflineQueueItem,
} from '../lib/offlineSync';

export interface UseSyncStatusResult {
  /**
   * Whether sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Number of pending offline operations
   */
  pendingCount: number;

  /**
   * List of pending operations
   */
  pendingOperations: OfflineQueueItem[];

  /**
   * Sync status: 'synced' | 'pending' | 'syncing'
   */
  syncStatus: 'synced' | 'pending' | 'syncing';

  /**
   * Last sync error
   */
  lastError: Error | null;

  /**
   * Manually trigger sync
   */
  syncNow: () => Promise<void>;
}

/**
 * Hook to monitor offline sync status
 * Automatically syncs when connection restored
 */
export const useSyncStatus = (): UseSyncStatusResult => {
  const { isConnected } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Update pending count from queue
  const updatePendingCount = useCallback((): void => {
    const hasPending = hasPendingOfflineOperations();
    const count = hasPending ? getPendingOfflineOperations().length : 0;
    setPendingCount(count);
  }, []);

  // Sync when connection restored
  useEffect(() => {
    if (!isConnected || isSyncing || pendingCount === 0) {
      return;
    }

    const performSync = async (): Promise<void> => {
      setIsSyncing(true);
      setLastError(null);

      try {
        const result = await syncOfflineQueue();

        if (result.failed > 0) {
          const error = new Error(`Sync failed: ${result.failed} operations failed`);
          setLastError(error);
          console.warn('⚠️ Sync completed with errors:', result.errors);
        } else {
          console.log('✅ All offline operations synced successfully');
        }

        updatePendingCount();
      } catch (error) {
        const syncError = error instanceof Error ? error : new Error('Unknown sync error');
        setLastError(syncError);
        console.error('❌ Sync failed:', syncError);
      } finally {
        setIsSyncing(false);
      }
    };

    performSync();
  }, [isConnected, isSyncing, pendingCount, updatePendingCount]);

  // Update pending count periodically
  useEffect(() => {
    updatePendingCount();

    const interval = setInterval(() => {
      updatePendingCount();
    }, 5000);

    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Manual sync handler
  const syncNow = async (): Promise<void> => {
    if (isSyncing || !isConnected) {
      return;
    }

    setIsSyncing(true);
    setLastError(null);

    try {
      const result = await syncOfflineQueue();

      if (result.failed > 0) {
        const error = new Error(`Sync failed: ${result.failed} operations failed`);
        setLastError(error);
      }

      updatePendingCount();
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error('Unknown sync error');
      setLastError(syncError);
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingOperations = getPendingOfflineOperations();
  const { status: syncStatus } = getSyncStatus();

  return {
    isSyncing,
    pendingCount,
    pendingOperations,
    syncStatus,
    lastError,
    syncNow,
  };
};
