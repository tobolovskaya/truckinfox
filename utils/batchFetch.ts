/**
 * Batch Fetch Utilities
 *
 * Optimized functions for fetching multiple rows from Supabase
 * to avoid N+1 query problems.
 */

import { supabase } from '../lib/supabase';

type DocumentData = Record<string, unknown>;

type BatchFetchedDocument = DocumentData & { id: string };

const TABLE_ALIASES: Record<string, string> = {
  users: 'users',
  cargoRequests: 'cargo_requests',
  cargo_requests: 'cargo_requests',
  orders: 'orders',
  bids: 'bids',
};

function resolveTableName(name: string): string {
  return TABLE_ALIASES[name] || name;
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch fetch users by IDs
 *
 * @param userIds - Array of user IDs to fetch
 * @returns Map of user ID to user data
 *
 * @example
 * const usersCache = await batchFetchUsers(['user1', 'user2', 'user3']);
 * const user = usersCache.get('user1');
 */
export async function batchFetchUsers(
  userIds: string[]
): Promise<Map<string, BatchFetchedDocument>> {
  const cache = new Map<string, BatchFetchedDocument>();

  if (userIds.length === 0) {
    return cache;
  }

  // Remove duplicates
  const uniqueIds = [...new Set(userIds)];

  try {
    const rows = await batchFetchByIds('users', uniqueIds);
    for (const row of rows) {
      cache.set(row.id, row);
    }
  } catch (error) {
    console.error('Error batch fetching users:', error);
  }

  return cache;
}

/**
 * Batch fetch cargo requests by IDs
 *
 * @param requestIds - Array of request IDs to fetch
 * @returns Map of request ID to request data
 *
 * @example
 * const requestsCache = await batchFetchRequests(['req1', 'req2']);
 * const request = requestsCache.get('req1');
 */
export async function batchFetchRequests(
  requestIds: string[]
): Promise<Map<string, BatchFetchedDocument>> {
  const cache = new Map<string, BatchFetchedDocument>();

  if (requestIds.length === 0) {
    return cache;
  }

  // Remove duplicates
  const uniqueIds = [...new Set(requestIds)];

  try {
    const rows = await batchFetchByIds('cargo_requests', uniqueIds);
    for (const row of rows) {
      cache.set(row.id, row);
    }
  } catch (error) {
    console.error('Error batch fetching cargo requests:', error);
  }

  return cache;
}

/**
 * Batch fetch orders by IDs
 *
 * @param orderIds - Array of order IDs to fetch
 * @returns Map of order ID to order data
 */
export async function batchFetchOrders(
  orderIds: string[]
): Promise<Map<string, BatchFetchedDocument>> {
  const cache = new Map<string, BatchFetchedDocument>();

  if (orderIds.length === 0) {
    return cache;
  }

  const uniqueIds = [...new Set(orderIds)];

  try {
    const rows = await batchFetchByIds('orders', uniqueIds);
    for (const row of rows) {
      cache.set(row.id, row);
    }
  } catch (error) {
    console.error('Error batch fetching orders:', error);
  }

  return cache;
}

/**
 * Batch fetch bids by IDs
 *
 * @param bidIds - Array of bid IDs to fetch
 * @returns Map of bid ID to bid data
 */
export async function batchFetchBids(bidIds: string[]): Promise<Map<string, BatchFetchedDocument>> {
  const cache = new Map<string, BatchFetchedDocument>();

  if (bidIds.length === 0) {
    return cache;
  }

  const uniqueIds = [...new Set(bidIds)];

  try {
    const rows = await batchFetchByIds('bids', uniqueIds);
    for (const row of rows) {
      cache.set(row.id, row);
    }
  } catch (error) {
    console.error('Error batch fetching bids:', error);
  }

  return cache;
}

/**
 * Generic batch fetch function for any collection
 *
 * @param collectionName - Firestore collection name
 * @param documentIds - Array of document IDs to fetch
 * @returns Map of document ID to document data
 */
export async function batchFetchDocuments(
  collectionName: string,
  documentIds: string[]
): Promise<Map<string, BatchFetchedDocument>> {
  const cache = new Map<string, BatchFetchedDocument>();

  if (documentIds.length === 0) {
    return cache;
  }

  const uniqueIds = [...new Set(documentIds)];

  try {
    const rows = await batchFetchByIds(collectionName, uniqueIds);
    for (const row of rows) {
      cache.set(row.id, row);
    }
  } catch (error) {
    console.error(`Error batch fetching ${collectionName}:`, error);
  }

  return cache;
}

async function batchFetchByIds(
  collectionName: string,
  ids: string[]
): Promise<BatchFetchedDocument[]> {
  const rows: BatchFetchedDocument[] = [];
  const tableName = resolveTableName(collectionName);
  const chunks = chunkArray(ids, 100);

  for (const chunk of chunks) {
    const { data, error } = await (supabase as any).from(tableName).select('*').in('id', chunk);

    if (error) {
      throw error;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunkRows = (data || []).map((row: any) => {
      const mapped = row as Record<string, unknown>;
      return {
        id: String(mapped.id),
        ...mapped,
      } as BatchFetchedDocument;
    });

    rows.push(...chunkRows);
  }

  return rows;
}
