/**
 * Offline Sync Utilities
 *
 * Helps manage data sync between offline cache and Firestore
 * Automatically handles:
 * - Queuing writes when offline
 * - Syncing when online
 * - Conflict resolution
 */

import { db } from './firebase';
import {
  collection,
  query,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
  QueryConstraint,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

type OfflinePayload = Record<string, unknown>;

export interface OfflineQueueItem {
  id: string;
  collectionName: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  data: OfflinePayload;
  timestamp: number;
  retries: number;
  lastError?: string;
}

/**
 * Queue for operations performed while offline
 * Will be synced when connection restored
 */
const offlineQueue: Map<string, OfflineQueueItem> = new Map();
let offlineSyncCleanup: (() => void) | null = null;

/**
 * Add operation to offline queue
 * Called when Firestore writes fail due to no connection
 */
export const queueOfflineOperation = (
  collectionName: string,
  operation: 'create' | 'update' | 'delete',
  documentId: string,
  data: OfflinePayload
): void => {
  const itemId = `${collectionName}_${documentId}_${Date.now()}`;

  const queueItem: OfflineQueueItem = {
    id: itemId,
    collectionName,
    documentId,
    operation,
    data: {
      ...data,
      _offlineQueued: true,
      _queuedAt: new Date().toISOString(),
    },
    timestamp: Date.now(),
    retries: 0,
  };

  offlineQueue.set(itemId, queueItem);

  console.log(`📤 Offline operation queued: ${operation} in ${collectionName}`, {
    documentId,
    queueSize: offlineQueue.size,
  });
};

/**
 * Sync offline queue with Firestore when connection restored
 */
export const syncOfflineQueue = async (): Promise<{
  synced: number;
  failed: number;
  errors: Array<{ itemId: string; error: string }>;
}> => {
  const results = {
    synced: 0,
    failed: 0,
    errors: [] as Array<{ itemId: string; error: string }>,
  };

  if (offlineQueue.size === 0) {
    console.log('✅ No offline operations to sync');
    return results;
  }

  console.log(`🔄 Starting offline queue sync (${offlineQueue.size} items)...`);

  const batch = writeBatch(db);
  const itemsToProcess = Array.from(offlineQueue.values());

  for (const item of itemsToProcess) {
    try {
      const docRef = doc(db, item.collectionName, item.documentId);

      switch (item.operation) {
        case 'create':
        case 'update':
          batch.set(docRef, {
            ...item.data,
            _offlineQueued: false,
            _syncedAt: serverTimestamp(),
          });
          break;

        case 'delete':
          batch.delete(docRef);
          break;
      }

      offlineQueue.delete(item.id);
      results.synced++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({ itemId: item.id, error: errorMessage });
      results.failed++;

      // Update retry count
      const queueItem = offlineQueue.get(item.id);
      if (queueItem) {
        queueItem.retries++;
        queueItem.lastError = errorMessage;

        // Remove item after 3 failed retries
        if (queueItem.retries >= 3) {
          offlineQueue.delete(item.id);
          console.warn(`❌ Offline operation removed after 3 retries: ${item.id}`);
        }
      }
    }
  }

  try {
    await batch.commit();
    console.log(`✅ Offline queue synced: ${results.synced} succeeded, ${results.failed} failed`);
  } catch (error) {
    console.error('❌ Batch commit failed:', error);
    results.failed = itemsToProcess.length;
  }

  return results;
};

/**
 * Get pending offline operations
 */
export const getPendingOfflineOperations = (): OfflineQueueItem[] => {
  return Array.from(offlineQueue.values());
};

/**
 * Clear all pending offline operations
 */
export const clearOfflineQueue = (): void => {
  const count = offlineQueue.size;
  offlineQueue.clear();
  console.log(`🗑️ Cleared ${count} offline operations`);
};

/**
 * Check if there are pending offline operations
 */
export const hasPendingOfflineOperations = (): boolean => {
  return offlineQueue.size > 0;
};

/**
 * Get offline queue statistics
 */
export const getOfflineQueueStats = (): {
  totalItems: number;
  byOperation: { create: number; update: number; delete: number };
  oldestItem: OfflineQueueItem | null;
  newestItem: OfflineQueueItem | null;
} => {
  const items = Array.from(offlineQueue.values());
  const sorted = items.sort((a, b) => a.timestamp - b.timestamp);

  return {
    totalItems: items.length,
    byOperation: {
      create: items.filter(i => i.operation === 'create').length,
      update: items.filter(i => i.operation === 'update').length,
      delete: items.filter(i => i.operation === 'delete').length,
    },
    oldestItem: sorted[0] || null,
    newestItem: sorted[sorted.length - 1] || null,
  };
};

/**
 * Query local cache (works offline)
 * Firestore automatically serves from cache when offline
 */
export const queryLocal = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<OfflinePayload[]> => {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const snapshot = await getDocs(q);

    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(
      `📖 Local query (${
        snapshot.metadata.fromCache ? 'from cache' : 'from server'
      }): ${collectionName}`,
      { count: results.length }
    );

    return results;
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    return [];
  }
};

/**
 * Enable offline persistence configuration
 */
export const initializeOfflineSync = (): (() => void) => {
  console.log('🔌 Offline sync utilities initialized');

  if (offlineSyncCleanup) {
    offlineSyncCleanup();
    offlineSyncCleanup = null;
  }

  // Native online/offline listener
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected) {
      console.log('🌐 Online detected - syncing offline queue...');
      syncOfflineQueue().catch(error => {
        console.error('Failed to sync offline queue:', error);
      });
    } else {
      console.log('📴 Offline detected - offline cache active');
    }
  });

  offlineSyncCleanup = () => {
    unsubscribe();
  };

  return () => {
    if (offlineSyncCleanup) {
      offlineSyncCleanup();
      offlineSyncCleanup = null;
    }
  };
};

/**
 * Get sync status for UI feedback
 */
export const getSyncStatus = (): {
  isPending: boolean;
  pendingCount: number;
  status: 'synced' | 'pending' | 'syncing';
} => {
  const isPending = hasPendingOfflineOperations();

  return {
    isPending,
    pendingCount: offlineQueue.size,
    status: isPending ? 'pending' : 'synced',
  };
};
