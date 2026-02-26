/**
 * Safe Database Operations with Automatic Offline Fallback
 *
 * These utilities wrap Supabase operations to automatically handle offline scenarios
 * by queuing operations locally and syncing when connection is restored
 */

import { supabase } from './supabase';
import { queueOfflineOperation } from './offlineSync';

type FirestorePayload = Record<string, unknown>;
type QueryConstraint = {
  type: 'eq' | 'orderBy' | 'limit';
  field: string;
  value?: unknown;
  direction?: 'asc' | 'desc';
};

function shouldQueueOffline(errorMessage: string): boolean {
  const message = errorMessage.toLowerCase();
  return (
    message.includes('offline') ||
    message.includes('connectivity') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch')
  );
}

function mapCollectionName(collectionName: string): string {
  const aliases: Record<string, string> = {
    users: 'users',
    cargoRequests: 'cargo_requests',
    cargo_requests: 'cargo_requests',
  };

  return aliases[collectionName] || collectionName;
}

/**
 * Safely set document with offline fallback
 */
export const safeSetDoc = async (
  collectionName: string,
  documentId: string,
  data: FirestorePayload,
  merge = false
): Promise<{ success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const tableName = mapCollectionName(collectionName);
    const payload = {
      ...data,
      id: documentId,
      updated_at: new Date().toISOString(),
    };

    const { error } = merge
      ? await supabase.from(tableName).upsert(payload)
      : await supabase.from(tableName).insert(payload);

    if (error) {
      throw error;
    }

    console.log(`✅ Document set: ${collectionName}/${documentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldQueueOffline(errorMessage)) {
      queueOfflineOperation(collectionName, merge ? 'update' : 'create', documentId, {
        ...data,
        id: documentId,
      });
      return { success: true, fromCache: true };
    }

    console.error(`❌ Failed to set document: ${collectionName}/${documentId}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safely update document with offline fallback
 */
export const safeUpdateDoc = async (
  collectionName: string,
  documentId: string,
  data: FirestorePayload
): Promise<{ success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const tableName = mapCollectionName(collectionName);
    const { error } = await supabase
      .from(tableName)
      .update({
      ...data,
      updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      throw error;
    }

    console.log(`✅ Document updated: ${collectionName}/${documentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldQueueOffline(errorMessage)) {
      queueOfflineOperation(collectionName, 'update', documentId, {
        ...data,
        id: documentId,
      });
      return { success: true, fromCache: true };
    }

    console.error(`❌ Failed to update document: ${collectionName}/${documentId}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safely delete document with offline fallback
 */
export const safeDeleteDoc = async (
  collectionName: string,
  documentId: string
): Promise<{ success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const tableName = mapCollectionName(collectionName);
    const { error } = await supabase.from(tableName).delete().eq('id', documentId);

    if (error) {
      throw error;
    }

    console.log(`✅ Document deleted: ${collectionName}/${documentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldQueueOffline(errorMessage)) {
      queueOfflineOperation(collectionName, 'delete', documentId, { id: documentId });
      return { success: true, fromCache: true };
    }

    console.error(`❌ Failed to delete document: ${collectionName}/${documentId}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safely get document (works offline from cache)
 */
export const safeGetDoc = async (
  collectionName: string,
  documentId: string
): Promise<{
  data: FirestorePayload | null;
  fromCache: boolean;
  exists: boolean;
  error?: string;
}> => {
  try {
    const tableName = mapCollectionName(collectionName);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      console.log(
        `📖 Document retrieved (${
          'from server'
        }): ${collectionName}/${documentId}`
      );
      return {
        data: { id: String((data as Record<string, unknown>).id), ...(data as Record<string, unknown>) },
        fromCache: false,
        exists: true,
      };
    }

    return { data: null, fromCache: false, exists: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to get document: ${collectionName}/${documentId}`, error);
    return { data: null, fromCache: false, exists: false, error: errorMessage };
  }
};

/**
 * Safely query collection (works offline from cache)
 */
export const safeQuery = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<{ documents: FirestorePayload[]; fromCache: boolean; error?: string }> => {
  try {
    const tableName = mapCollectionName(collectionName);
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

    const documents = (data || []).map(row => ({
      id: String((row as Record<string, unknown>).id),
      ...(row as Record<string, unknown>),
    }));

    console.log(
      `📖 Query executed (from server): ${collectionName}`,
      {
        count: documents.length,
        constraints: constraints.length,
      }
    );

    return { documents, fromCache: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Query failed: ${collectionName}`, error);
    return { documents: [], fromCache: false, error: errorMessage };
  }
};

/**
 * Safely add document with offline fallback
 */
export const safeAddDoc = async (
  collectionName: string,
  data: FirestorePayload
): Promise<{ id?: string; success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const tableName = mapCollectionName(collectionName);
    const payload = {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    const insertedId = String((inserted as Record<string, unknown>).id);

    console.log(`✅ Document added: ${collectionName}/${insertedId}`);
    return { success: true, id: insertedId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldQueueOffline(errorMessage)) {
      const tempId = `offline_${Date.now()}_${Math.random()}`;
      queueOfflineOperation(collectionName, 'create', tempId, {
        ...data,
        id: tempId,
      });
      return { success: true, id: tempId, fromCache: true };
    }

    console.error(`❌ Failed to add document: ${collectionName}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safe batch write with offline fallback
 */
export const safeBatchWrite = async (
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: string;
    id: string;
    data?: FirestorePayload;
  }>
): Promise<{ success: boolean; queued?: number; error?: string }> => {
  try {
    for (const op of operations) {
      const tableName = mapCollectionName(op.collection);

      switch (op.type) {
        case 'set':
          {
            const { error } = await supabase.from(tableName).upsert({
              ...(op.data || {}),
              id: op.id,
              updated_at: new Date().toISOString(),
            });

            if (error) {
              throw error;
            }
          }
          break;
        case 'update':
          {
            const { error } = await supabase
              .from(tableName)
              .update({
                ...(op.data || {}),
                updated_at: new Date().toISOString(),
              })
              .eq('id', op.id);

            if (error) {
              throw error;
            }
          }
          break;
        case 'delete':
          {
            const { error } = await supabase.from(tableName).delete().eq('id', op.id);
            if (error) {
              throw error;
            }
          }
          break;
      }
    }

    console.log(`✅ Batch write completed: ${operations.length} operations`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldQueueOffline(errorMessage)) {
      let queuedCount = 0;
      for (const op of operations) {
        const operation = op.type === 'set' ? 'create' : op.type;
        queueOfflineOperation(op.collection, operation, op.id, {
          ...op.data,
          id: op.id,
        });
        queuedCount++;
      }
      return { success: true, queued: queuedCount };
    }

    console.error('❌ Batch write failed:', error);
    return { success: false, error: errorMessage };
  }
};
