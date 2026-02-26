/**
 * Order Cleanup Utilities
 *
 * These utilities help manage abandoned payment sessions and orphaned orders.
 * Use these functions in Cloud Functions or scheduled tasks to maintain database health.
 */

import { supabase } from '../lib/supabase';

const DELETE_BATCH_SIZE = 200;

type PendingOrderRow = {
  id: string;
  created_at: string;
};

function toIsoBeforeMinutes(minutes: number): string {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - minutes);
  return cutoff.toISOString();
}

function toIsoBeforeHours(hours: number): string {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  return cutoff.toISOString();
}

async function deleteOrdersByIds(orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) {
    return 0;
  }

  let deleted = 0;

  for (let index = 0; index < orderIds.length; index += DELETE_BATCH_SIZE) {
    const batch = orderIds.slice(index, index + DELETE_BATCH_SIZE);
    const { error } = await supabase.from('orders').delete().in('id', batch);

    if (error) {
      throw error;
    }

    deleted += batch.length;
  }

  return deleted;
}

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
    const cutoffIso = toIsoBeforeMinutes(maxAgeMinutes);
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_status', 'pending')
      .lt('created_at', cutoffIso);

    if (error) {
      throw error;
    }

    const orderIds = (data || []).map(row => row.id);

    if (orderIds.length === 0) {
      console.log('No abandoned orders found');
      return 0;
    }

    const totalDeleted = await deleteOrdersByIds(orderIds);

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
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('request_id', requestId)
      .eq('payment_status', 'pending');

    if (error) {
      throw error;
    }

    const orderIds = (data || []).map(row => row.id);

    if (orderIds.length === 0) {
      return 0;
    }

    const deleted = await deleteOrdersByIds(orderIds);
    console.log(`Cleaned up ${deleted} pending order(s) for request ${requestId}`);
    return deleted;
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
    const thirtyMinutesAgoIso = toIsoBeforeMinutes(30);

    const { count: totalCount, error: totalError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'pending');

    if (totalError) {
      throw totalError;
    }

    const { count: oldCount, error: oldError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'pending')
      .lt('created_at', thirtyMinutesAgoIso);

    if (oldError) {
      throw oldError;
    }

    const total = totalCount || 0;
    const oldOrders = oldCount || 0;
    const recentOrders = Math.max(total - oldOrders, 0);

    return {
      total,
      oldOrders,
      recentOrders,
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
    const cutoffIso = toIsoBeforeHours(24);

    console.log(`Cleaning up unpaid orders older than: ${cutoffIso}`);

    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_status', 'pending')
      .lt('created_at', cutoffIso);

    if (error) {
      throw error;
    }

    const orderIds = (data || []).map(row => row.id);

    if (orderIds.length === 0) {
      console.log('No unpaid orders to clean up');
      return 0;
    }

    console.log(`Found ${orderIds.length} unpaid order(s) to delete`);

    const totalDeleted = await deleteOrdersByIds(orderIds);

    console.log(`✅ Successfully deleted ${totalDeleted} unpaid order(s)`);
    return totalDeleted;
  } catch (error) {
    console.error('❌ Error cleaning up unpaid orders:', error);
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
    const cutoffIso = toIsoBeforeHours(maxAgeHours);

    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_status', 'pending')
      .lt('created_at', cutoffIso);

    if (error) {
      throw error;
    }

    const orderIds = (data || []).map(row => row.id);

    if (orderIds.length === 0) {
      return 0;
    }

    const totalDeleted = await deleteOrdersByIds(orderIds);

    console.log(`Cleaned up ${totalDeleted} orders older than ${maxAgeHours} hours`);
    return totalDeleted;
  } catch (error) {
    console.error('Error cleaning up orders by age:', error);
    throw error;
  }
}
