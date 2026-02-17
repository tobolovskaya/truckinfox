/**
 * Order Cleanup Utilities
 *
 * These utilities help manage abandoned payment sessions and orphaned orders.
 * Use these functions in Cloud Functions or scheduled tasks to maintain database health.
 */

import { db } from '../lib/firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';

/**
 * Clean up orders that have been pending for more than the specified duration
 *
 * @param maxAgeMinutes - Maximum age in minutes for a pending order (default: 30 minutes)
 * @returns Number of orders cleaned up
 *
 * @example
 * // Clean up orders older than 30 minutes
 * const cleaned = await cleanupAbandonedOrders(30);
 *
 * // Clean up orders older than 1 hour
 * const cleaned = await cleanupAbandonedOrders(60);
 */
export async function cleanupAbandonedOrders(maxAgeMinutes: number = 30): Promise<number> {
  try {
    // Calculate the cutoff timestamp
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes);
    const cutoffTimestamp = Timestamp.fromDate(cutoffTime);

    // Query for old pending orders
    const abandonedOrdersQuery = query(
      collection(db, 'orders'),
      where('payment_status', '==', 'pending'),
      where('payment_initiated_at', '<', cutoffTimestamp)
    );

    const abandonedOrdersSnap = await getDocs(abandonedOrdersQuery);

    if (abandonedOrdersSnap.empty) {
      console.log('No abandoned orders found');
      return 0;
    }

    // Delete abandoned orders in batches (Firestore batch limit is 500)
    const batchSize = 500;
    let totalDeleted = 0;

    for (let i = 0; i < abandonedOrdersSnap.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = abandonedOrdersSnap.docs.slice(i, i + batchSize);

      batchDocs.forEach(orderDoc => {
        batch.delete(orderDoc.ref);
      });

      await batch.commit();
      totalDeleted += batchDocs.length;
    }

    console.log(`Cleaned up ${totalDeleted} abandoned order(s)`);
    return totalDeleted;
  } catch (error) {
    console.error('Error cleaning up abandoned orders:', error);
    throw error;
  }
}

/**
 * Clean up pending orders for a specific request
 *
 * @param requestId - The cargo request ID
 * @returns Number of orders cleaned up
 */
export async function cleanupRequestPendingOrders(requestId: string): Promise<number> {
  try {
    const pendingOrdersQuery = query(
      collection(db, 'orders'),
      where('request_id', '==', requestId),
      where('payment_status', '==', 'pending')
    );

    const pendingOrdersSnap = await getDocs(pendingOrdersQuery);

    if (pendingOrdersSnap.empty) {
      return 0;
    }

    const batch = writeBatch(db);
    pendingOrdersSnap.docs.forEach(orderDoc => {
      batch.delete(orderDoc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${pendingOrdersSnap.size} pending order(s) for request ${requestId}`);
    return pendingOrdersSnap.size;
  } catch (error) {
    console.error('Error cleaning up request pending orders:', error);
    throw error;
  }
}

/**
 * Get statistics about pending orders
 *
 * @returns Object with pending order statistics
 */
export async function getPendingOrderStats(): Promise<{
  total: number;
  oldOrders: number;
  recentOrders: number;
}> {
  try {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Get all pending orders
    const allPendingQuery = query(
      collection(db, 'orders'),
      where('payment_status', '==', 'pending')
    );
    const allPendingSnap = await getDocs(allPendingQuery);

    // Count old vs recent
    let oldCount = 0;
    let recentCount = 0;

    allPendingSnap.docs.forEach(doc => {
      const data = doc.data();
      const initiatedAt = data.payment_initiated_at?.toDate() || data.created_at?.toDate();

      if (initiatedAt && initiatedAt < thirtyMinutesAgo) {
        oldCount++;
      } else {
        recentCount++;
      }
    });

    return {
      total: allPendingSnap.size,
      oldOrders: oldCount,
      recentOrders: recentCount,
    };
  } catch (error) {
    console.error('Error getting pending order stats:', error);
    throw error;
  }
}

/**
 * Clean up unpaid orders older than 24 hours
 *
 * This is more aggressive cleanup for truly abandoned orders.
 * Recommended to run daily as a background task.
 *
 * @returns Number of orders cleaned up
 *
 * @example
 * // Run daily cleanup
 * const cleaned = await cleanupUnpaidOrders();
 * console.log(`Cleaned up ${cleaned} unpaid orders`);
 */
export async function cleanupUnpaidOrders(): Promise<number> {
  try {
    // Calculate cutoff time (24 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);
    const cutoffTimestamp = Timestamp.fromDate(cutoffTime);

    console.log(`Cleaning up unpaid orders older than: ${cutoffTime.toISOString()}`);

    // Query for unpaid orders older than 24 hours
    const unpaidQuery = query(
      collection(db, 'orders'),
      where('payment_status', '==', 'pending'),
      where('created_at', '<', cutoffTimestamp)
    );

    const unpaidSnap = await getDocs(unpaidQuery);

    if (unpaidSnap.empty) {
      console.log('No unpaid orders to clean up');
      return 0;
    }

    console.log(`Found ${unpaidSnap.size} unpaid order(s) to delete`);

    // Delete in batches (Firestore batch limit is 500)
    const batchSize = 500;
    let totalDeleted = 0;

    for (let i = 0; i < unpaidSnap.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = unpaidSnap.docs.slice(i, i + batchSize);

      batchDocs.forEach(orderDoc => {
        batch.delete(orderDoc.ref);
      });

      await batch.commit();
      totalDeleted += batchDocs.length;
    }

    console.log(`âœ… Successfully deleted ${totalDeleted} unpaid order(s)`);
    return totalDeleted;
  } catch (error) {
    console.error('âŒ Error cleaning up unpaid orders:', error);
    throw error;
  }
}

/**
 * Clean up orders with configurable age
 *
 * Generic cleanup function that can be used with any time period.
 *
 * @param maxAgeHours - Maximum age in hours for a pending order
 * @returns Number of orders cleaned up
 *
 * @example
 * // Clean up orders older than 48 hours
 * const cleaned = await cleanupOrdersByAge(48);
 *
 * // Clean up orders older than 1 week
 * const cleaned = await cleanupOrdersByAge(168);
 */
export async function cleanupOrdersByAge(maxAgeHours: number): Promise<number> {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    const cutoffTimestamp = Timestamp.fromDate(cutoffTime);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('payment_status', '==', 'pending'),
      where('created_at', '<', cutoffTimestamp)
    );

    const ordersSnap = await getDocs(ordersQuery);

    if (ordersSnap.empty) {
      return 0;
    }

    const batchSize = 500;
    let totalDeleted = 0;

    for (let i = 0; i < ordersSnap.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = ordersSnap.docs.slice(i, i + batchSize);

      batchDocs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += batchDocs.length;
    }

    console.log(`Cleaned up ${totalDeleted} orders older than ${maxAgeHours} hours`);
    return totalDeleted;
  } catch (error) {
    console.error('Error cleaning up orders by age:', error);
    throw error;
  }
}
