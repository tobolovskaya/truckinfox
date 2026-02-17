/**
 * Escrow Management Utilities
 *
 * Client-side utilities for managing escrow payments and fund releases.
 * These functions interact with Firebase Cloud Functions to securely
 * handle escrow operations.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

interface ReleaseFundsResponse {
  success: boolean;
  message: string;
  payoutId: string;
  amount: number;
  status: string;
}

interface EscrowStatusResponse {
  found: boolean;
  escrow?: {
    id: string;
    status: string;
    total_amount: number;
    platform_fee: number;
    carrier_amount: number;
    created_at: unknown;
    completed_at: unknown;
  };
  payout?: {
    id: string;
    status: string;
    amount: number;
    created_at: unknown;
  };
  order_status?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

// Get Firebase app instance
const app = getApp();

// Initialize Firebase Functions
const functions = getFunctions(app, 'europe-west1');

/**
 * Release escrow funds to carrier after delivery confirmation
 *
 * This function calls the Cloud Function to securely release funds
 * from escrow to the carrier. It should only be called after the
 * customer has confirmed successful delivery.
 *
 * @param orderId - The order ID to process
 * @returns Promise with result containing payout details
 *
 * @example
 * ```typescript
 * try {
 *   const result = await releaseFundsToCarrier('order123');
 *   console.log('Funds released:', result.payoutId);
 *   Alert.alert('Success', result.message);
 * } catch (error) {
 *   Alert.alert('Error', error.message);
 * }
 * ```
 */
export async function releaseFundsToCarrier(orderId: string): Promise<{
  success: boolean;
  message: string;
  payoutId: string;
  amount: number;
  status: string;
}> {
  try {
    const releaseFunds = httpsCallable<{ orderId: string }, ReleaseFundsResponse>(
      functions,
      'releaseFundsToCarrier'
    );
    const result = await releaseFunds({ orderId });

    return result.data;
  } catch (error: unknown) {
    console.error('Error releasing funds:', error);
    throw new Error(getErrorMessage(error, 'Failed to release funds to carrier'));
  }
}

/**
 * Get escrow payment status for an order
 *
 * Fetches detailed information about the escrow payment including
 * status, amounts, and any related payout information.
 *
 * @param orderId - The order ID to check
 * @returns Promise with escrow and payout details
 *
 * @example
 * ```typescript
 * const status = await getEscrowStatus('order123');
 * console.log('Escrow status:', status.escrow.status);
 * console.log('Payout status:', status.payout?.status);
 * ```
 */
export async function getEscrowStatus(orderId: string): Promise<{
  found: boolean;
  escrow?: {
    id: string;
    status: string;
    total_amount: number;
    platform_fee: number;
    carrier_amount: number;
    created_at: unknown;
    completed_at: unknown;
  };
  payout?: {
    id: string;
    status: string;
    amount: number;
    created_at: unknown;
  };
  order_status?: string;
}> {
  try {
    const getStatus = httpsCallable<{ orderId: string }, EscrowStatusResponse>(
      functions,
      'getEscrowStatus'
    );
    const result = await getStatus({ orderId });

    return result.data;
  } catch (error: unknown) {
    console.error('Error getting escrow status:', error);
    throw new Error(getErrorMessage(error, 'Failed to get escrow status'));
  }
}

/**
 * Escrow Status Display Names
 * Mapping of escrow statuses to human-readable names
 */
export const ESCROW_STATUS_NAMES: { [key: string]: string } = {
  initiated: 'Payment Initiated',
  paid: 'Payment Received',
  in_progress: 'Delivery In Progress',
  completed: 'Funds Released',
  refunded: 'Payment Refunded',
};

/**
 * Escrow Status Colors
 * Visual indicators for different escrow statuses
 */
export const ESCROW_STATUS_COLORS: { [key: string]: string } = {
  initiated: '#FFC107', // Warning yellow
  paid: '#2196F3', // Primary blue
  in_progress: '#FF8A65', // Secondary orange
  completed: '#4CAF50', // Success green
  refunded: '#F44336', // Error red
};

/**
 * Payout Status Display Names
 */
export const PAYOUT_STATUS_NAMES: { [key: string]: string } = {
  pending_transfer: 'Awaiting Transfer',
  processing: 'Transfer In Progress',
  completed: 'Transfer Completed',
  failed: 'Transfer Failed',
};

/**
 * Check if funds can be released for an order
 *
 * Validates that all conditions are met for releasing funds:
 * - Order must be delivered
 * - Escrow must be paid or in_progress
 * - Funds not already released
 *
 * @param orderStatus - Current order status
 * @param escrowStatus - Current escrow status
 * @returns Boolean indicating if funds can be released
 */
export function canReleaseFunds(orderStatus: string, escrowStatus: string): boolean {
  const validEscrowStatuses = ['paid', 'in_progress'];
  return orderStatus === 'delivered' && validEscrowStatuses.includes(escrowStatus);
}

/**
 * Format escrow amount for display
 *
 * @param amount - Amount in NOK
 * @returns Formatted string with currency
 */
export function formatEscrowAmount(amount: number): string {
  return `${amount.toLocaleString('no-NO')} NOK`;
}

/**
 * Calculate time elapsed since escrow creation
 *
 * @param createdAt - Timestamp when escrow was created
 * @returns Human-readable time elapsed
 */
export function getEscrowAge(createdAt: unknown): string {
  if (!createdAt) return 'Unknown';

  const created =
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate?: unknown }).toDate === 'function'
      ? ((createdAt as { toDate: () => Date }).toDate() as Date)
      : new Date(createdAt as string | number | Date);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
}
