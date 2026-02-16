/**
 * Batch Fetch Utilities
 *
 * Optimized functions for fetching multiple documents from Firestore
 * to avoid N+1 query problems.
 */

import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
export async function batchFetchUsers(userIds: string[]): Promise<Map<string, any>> {
  const cache = new Map<string, any>();

  if (userIds.length === 0) {
    return cache;
  }

  // Remove duplicates
  const uniqueIds = [...new Set(userIds)];

  // Firestore 'in' query supports max 10 items
  const chunks = chunkArray(uniqueIds, 10);

  try {
    for (const chunk of chunks) {
      const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));

      const snapshot = await getDocs(usersQuery);
      snapshot.docs.forEach(doc => {
        cache.set(doc.id, { id: doc.id, ...doc.data() });
      });
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
export async function batchFetchRequests(requestIds: string[]): Promise<Map<string, any>> {
  const cache = new Map<string, any>();

  if (requestIds.length === 0) {
    return cache;
  }

  // Remove duplicates
  const uniqueIds = [...new Set(requestIds)];

  // Firestore 'in' query supports max 10 items
  const chunks = chunkArray(uniqueIds, 10);

  try {
    for (const chunk of chunks) {
      const requestsQuery = query(collection(db, 'cargo_requests'), where('__name__', 'in', chunk));

      const snapshot = await getDocs(requestsQuery);
      snapshot.docs.forEach(doc => {
        cache.set(doc.id, { id: doc.id, ...doc.data() });
      });
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
export async function batchFetchOrders(orderIds: string[]): Promise<Map<string, any>> {
  const cache = new Map<string, any>();

  if (orderIds.length === 0) {
    return cache;
  }

  const uniqueIds = [...new Set(orderIds)];
  const chunks = chunkArray(uniqueIds, 10);

  try {
    for (const chunk of chunks) {
      const ordersQuery = query(collection(db, 'orders'), where('__name__', 'in', chunk));

      const snapshot = await getDocs(ordersQuery);
      snapshot.docs.forEach(doc => {
        cache.set(doc.id, { id: doc.id, ...doc.data() });
      });
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
export async function batchFetchBids(bidIds: string[]): Promise<Map<string, any>> {
  const cache = new Map<string, any>();

  if (bidIds.length === 0) {
    return cache;
  }

  const uniqueIds = [...new Set(bidIds)];
  const chunks = chunkArray(uniqueIds, 10);

  try {
    for (const chunk of chunks) {
      const bidsQuery = query(collection(db, 'bids'), where('__name__', 'in', chunk));

      const snapshot = await getDocs(bidsQuery);
      snapshot.docs.forEach(doc => {
        cache.set(doc.id, { id: doc.id, ...doc.data() });
      });
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
): Promise<Map<string, DocumentData>> {
  const cache = new Map<string, DocumentData>();

  if (documentIds.length === 0) {
    return cache;
  }

  const uniqueIds = [...new Set(documentIds)];
  const chunks = chunkArray(uniqueIds, 10);

  try {
    for (const chunk of chunks) {
      const documentsQuery = query(collection(db, collectionName), where('__name__', 'in', chunk));

      const snapshot = await getDocs(documentsQuery);
      snapshot.docs.forEach(doc => {
        cache.set(doc.id, { id: doc.id, ...doc.data() });
      });
    }
  } catch (error) {
    console.error(`Error batch fetching ${collectionName}:`, error);
  }

  return cache;
}
