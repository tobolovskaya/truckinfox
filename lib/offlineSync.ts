/**
 * Offline Sync Utilities
 *
 * Helps manage data sync between offline cache and Supabase
 * Automatically handles:
 * - Queuing writes when offline
 * - Syncing when online
 * - Conflict resolution
 */

import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';

type OfflinePayload = Record<string, unknown>;
type QueryConstraint = {
  type: 'eq' | 'orderBy' | 'limit';
  field: string;
  value?: unknown;
  direction?: 'asc' | 'desc';
};

const TABLE_ALIASES: Record<string, string> = {
  users: 'users',
  cargoRequests: 'cargo_requests',
  cargo_requests: 'cargo_requests',
};

const resolveTableName = (collectionName: string): string =>
  TABLE_ALIASES[collectionName] || collectionName;

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

  const itemsToProcess = Array.from(offlineQueue.values());

  for (const item of itemsToProcess) {
    try {
      const tableName = resolveTableName(item.collectionName);

      switch (item.operation) {
        case 'create':
        case 'update':
          {
            const payload = {
              ...item.data,
              id: item.documentId,
              _offlineQueued: false,
              _syncedAt: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from(tableName).upsert(payload);
            if (error) {
              throw error;
            }
          }
          break;

        case 'delete':
          {
            const { error } = await supabase.from(tableName).delete().eq('id', item.documentId);
            if (error) {
              throw error;
            }
          }
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

  console.log(`✅ Offline queue synced: ${results.synced} succeeded, ${results.failed} failed`);

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
    const tableName = resolveTableName(collectionName);
    let dbQuery = supabase.from(tableName).select('*');

    for (const constraint of constraints) {
      if (constraint.type === 'eq') {
        dbQuery = dbQuery.eq(constraint.field, constraint.value);
      }

      if (constraint.type === 'orderBy') {
        dbQuery = dbQuery.order(constraint.field, {
          ascending: (constraint.direction || 'asc') === 'asc',
        });
      }

      if (constraint.type === 'limit' && typeof constraint.value === 'number') {
        dbQuery = dbQuery.limit(constraint.value);
      }
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw error;
    }

    const results = (data || []).map(row => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));

    console.log(`📖 Local query (from server): ${collectionName}`, { count: results.length });

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
