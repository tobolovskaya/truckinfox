import { app } from '../lib/firebase';
import { FunctionsError, getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Rate Limit Error
 * Custom error type for rate limit exceeded errors
 */
export class RateLimitError extends Error {
  retryAfter: number; // milliseconds
  resetAt: number; // timestamp

  constructor(message: string, retryAfter: number, resetAt: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.resetAt = resetAt;
  }
}

/**
 * Format milliseconds to human-readable time
 */
export function formatRetryTime(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);

  if (seconds < 60) {
    return `${seconds} sekund${seconds !== 1 ? 'er' : ''}`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minutt${minutes !== 1 ? 'er' : ''}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} time${hours !== 1 ? 'r' : ''}`;
}

/**
 * Call a Cloud Function with rate limit handling
 *
 * @param functionName Name of the Cloud Function
 * @param data Data to pass to the function
 * @returns Function result
 * @throws RateLimitError if rate limit exceeded
 */
export async function callFunction<T = unknown, R = unknown>(
  functionName: string,
  data: T
): Promise<R> {
  try {
    const callable = httpsCallable<T, R>(getFunctions(app), functionName);
    const result = await callable(data);
    return result.data as R;
  } catch (error: unknown) {
    const functionError = error as FunctionsError & {
      details?: { retryAfter?: number; resetAt?: number };
    };

    // Check if it's a rate limit error
    if (functionError.code === 'functions/resource-exhausted') {
      const retryAfter = functionError.details?.retryAfter || 60000;
      const resetAt = functionError.details?.resetAt || Date.now() + retryAfter;

      throw new RateLimitError(functionError.message, retryAfter, resetAt);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Safe function call with rate limit handling and user-friendly error messages
 *
 * @param functionName Name of the Cloud Function
 * @param data Data to pass to the function
 * @param onRateLimit Optional callback when rate limit is hit
 * @returns Function result or null if rate limited
 */
export async function safeFunctionCall<T = unknown, R = unknown>(
  functionName: string,
  data: T,
  onRateLimit?: (_error: RateLimitError) => void
): Promise<R | null> {
  try {
    return await callFunction<T, R>(functionName, data);
  } catch (error) {
    if (error instanceof RateLimitError) {
      if (onRateLimit) {
        onRateLimit(error);
      }
      return null;
    }
    throw error;
  }
}

/**
 * Example usage in components:
 *
 * // Basic usage
 * try {
 *   const result = await callFunction('createCargoRequest', { title: 'Test' });
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     Alert.alert(
 *       'Rate Limit',
 *       `Du har nÃ¥dd grensen. PrÃ¸v igjen om ${formatRetryTime(error.retryAfter)}`
 *     );
 *   }
 * }
 *
 * // With safe call
 * const result = await safeFunctionCall(
 *   'submitBid',
 *   { request_id: '123', price: 1000 },
 *   (error) => {
 *     Alert.alert('Rate Limit', error.message);
 *   }
 * );
 */

/**
 * Client-side rate limit prevention
 * Tracks local state to prevent unnecessary function calls
 */
class ClientRateLimiter {
  private limits: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Check if an action can be performed
   *
   * @param action Action name
   * @param maxCount Maximum allowed count
   * @param windowMs Time window in milliseconds
   * @returns true if allowed, false if rate limited
   */
  canPerform(action: string, maxCount: number, windowMs: number): boolean {
    const now = Date.now();
    const limit = this.limits.get(action);

    if (!limit || now > limit.resetAt) {
      // New window
      this.limits.set(action, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (limit.count >= maxCount) {
      return false;
    }

    // Increment count
    limit.count++;
    return true;
  }

  /**
   * Get time until rate limit resets
   *
   * @param action Action name
   * @returns Milliseconds until reset, or 0 if not rate limited
   */
  getResetTime(action: string): number {
    const limit = this.limits.get(action);
    if (!limit) return 0;

    const now = Date.now();
    if (now > limit.resetAt) return 0;

    return limit.resetAt - now;
  }

  /**
   * Reset a specific action's rate limit
   */
  reset(action: string): void {
    this.limits.delete(action);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.limits.clear();
  }
}

export const clientRateLimiter = new ClientRateLimiter();

/**
 * React Hook for rate limiting
 *
 * Usage:
 * const { canSubmit, timeUntilReset } = useRateLimit('submitBid', 10, 3600000);
 *
 * if (!canSubmit) {
 *   Alert.alert('Please wait', `You can submit again in ${formatRetryTime(timeUntilReset)}`);
 *   return;
 * }
 */
export function useRateLimit(action: string, maxCount: number, windowMs: number) {
  const canSubmit = clientRateLimiter.canPerform(action, maxCount, windowMs);
  const timeUntilReset = clientRateLimiter.getResetTime(action);

  return {
    canSubmit,
    timeUntilReset,
    reset: () => clientRateLimiter.reset(action),
  };
}
