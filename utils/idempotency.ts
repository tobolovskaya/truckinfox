import { supabase } from '../lib/supabase';

type DocumentData = Record<string, unknown>;

type IdempotencyDoc = { id: string } & DocumentData;

/**
 * Idempotency utilities for preventing duplicate operations
 * Critical for payment systems and other sensitive operations
 */

/**
 * Generate a unique idempotency key
 *
 * @param prefix Operation type prefix (e.g., 'payment', 'refund', 'bid')
 * @param identifier Unique identifier (e.g., order_id, user_id)
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(prefix: string, identifier: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${identifier}_${timestamp}_${random}`;
}

/**
 * Check if an operation with this idempotency key already exists
 *
 * @param collectionName Firestore collection to check
 * @param idempotencyKey The idempotency key to search for
 * @returns Existing document data or null
 */
export async function checkIdempotency(
  collectionName: string,
  idempotencyKey: string
): Promise<IdempotencyDoc | null> {
  try {
    const { data, error } = await (supabase as any)
      .from(collectionName)
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        ...row,
      } as IdempotencyDoc;
    }

    return null;
  } catch (error) {
    console.error('Error checking idempotency:', error);
    return null;
  }
}

/**
 * Check if a payment already exists for an order
 * Prevents duplicate payment initiations
 *
 * @param orderId Order ID to check
 * @param statuses Payment statuses to check (default: initiated, paid, completed)
 * @returns Existing payment or null
 */
export async function checkExistingPayment(
  orderId: string,
  statuses: string[] = ['initiated', 'paid', 'completed']
): Promise<IdempotencyDoc | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('escrow_payments')
      .select('*')
      .eq('order_id', orderId)
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        ...row,
      } as IdempotencyDoc;
    }

    return null;
  } catch (error) {
    console.error('Error checking existing payment:', error);
    return null;
  }
}

/**
 * Validate idempotency key format
 *
 * @param key Idempotency key to validate
 * @returns true if valid format
 */
export function validateIdempotencyKey(key: string): boolean {
  // Format: prefix_identifier_timestamp_random
  const pattern = /^[a-z_]+_[a-zA-Z0-9-]+_\d+_[a-z0-9]+$/;
  return pattern.test(key);
}

/**
 * Extract metadata from idempotency key
 *
 * @param key Idempotency key
 * @returns Metadata object with prefix, identifier, timestamp
 */
export function parseIdempotencyKey(key: string): {
  prefix: string;
  identifier: string;
  timestamp: number;
  random: string;
} | null {
  try {
    const parts = key.split('_');
    if (parts.length < 4) return null;

    const random = parts.pop()!;
    const timestamp = parseInt(parts.pop()!, 10);
    const identifier = parts.pop()!;
    const prefix = parts.join('_');

    return { prefix, identifier, timestamp, random };
  } catch {
    return null;
  }
}

/**
 * Check if idempotency key is expired
 *
 * @param key Idempotency key
 * @param maxAgeMs Maximum age in milliseconds (default: 24 hours)
 * @returns true if expired
 */
export function isIdempotencyKeyExpired(
  key: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): boolean {
  const metadata = parseIdempotencyKey(key);
  if (!metadata) return true;

  const age = Date.now() - metadata.timestamp;
  return age > maxAgeMs;
}

/**
 * Idempotency wrapper for async operations
 * Automatically checks for existing operations and returns cached result
 *
 * @param key Idempotency key
 * @param collectionName Collection to check
 * @param operation Operation to perform if no duplicate found
 * @returns Operation result (new or cached)
 */
export async function withIdempotency<T>(
  key: string,
  collectionName: string,
  operation: () => Promise<T>
): Promise<{ result: T; cached: boolean }> {
  // Check for existing operation
  const existing = await checkIdempotency(collectionName, key);

  if (existing) {
    console.log('Idempotency: Using cached result', key);
    return { result: existing as T, cached: true };
  }

  // Perform new operation
  console.log('Idempotency: Performing new operation', key);
  const result = await operation();

  return { result, cached: false };
}

/**
 * Example usage:
 *
 * // Generate key
 * const key = generateIdempotencyKey('payment', orderId);
 *
 * // Check existing
 * const existing = await checkExistingPayment(orderId);
 * if (existing) {
 *   // Handle existing payment
 * }
 *
 * // With wrapper
 * const { result, cached } = await withIdempotency(
 *   key,
 *   'escrow_payments',
 *   async () => {
 *     return await createPayment(data);
 *   }
 * );
 *
 * if (cached) {
 *   console.log('Used existing payment:', result.id);
 * }
 */

/**
 * Store idempotency key for tracking
 * Useful for debugging and audit trails
 */
export interface IdempotencyRecord {
  key: string;
  operation: string;
  timestamp: number;
  result?: unknown;
  error?: string;
}

// In-memory cache for idempotency checks (optional optimization)
const idempotencyCache = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get from cache if available and not expired
 */
export function getCachedIdempotency<T = unknown>(key: string): T | null {
  const cached = idempotencyCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    idempotencyCache.delete(key);
    return null;
  }

  return cached.data as T;
}

/**
 * Store in cache
 */
export function setCachedIdempotency<T = unknown>(key: string, data: T): void {
  idempotencyCache.set(key, {
    timestamp: Date.now(),
    data,
  });
}

/**
 * Clear cache (useful for testing)
 */
export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}
