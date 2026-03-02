/**
 * Escrow Management Utilities
 *
 * Client-side utilities for managing escrow payments and fund releases.
 * These functions interact with Supabase Edge Functions to securely
 * handle escrow operations.
 */
import { supabase } from '../lib/supabase';

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
    const { data, error } = await supabase.functions.invoke<ReleaseFundsResponse>(
      'release-funds-to-carrier',
      {
        body: { orderId },
      }
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Empty response from release-funds-to-carrier function');
    }

    return data;
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
    const { data: escrowRow, error: escrowError } = await supabase
      .from('escrow_payments')
      .select('id,status,total_amount,platform_fee,carrier_amount,created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (escrowError) {
      throw escrowError;
    }

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!escrowRow) {
      return {
        found: false,
        order_status: orderRow?.status,
      };
    }

    return {
      found: true,
      escrow: {
        id: escrowRow.id,
        status: escrowRow.status,
        total_amount: Number(escrowRow.total_amount || 0),
        platform_fee: Number(escrowRow.platform_fee || 0),
        carrier_amount: Number(escrowRow.carrier_amount || 0),
        created_at: escrowRow.created_at,
        completed_at: null,
      },
      order_status: orderRow?.status,
    } as EscrowStatusResponse;
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
  released: 'Funds Released',
  refunded: 'Payment Refunded',
  failed: 'Payment Failed',
  expired: 'Payment Expired',
};

/**
 * Escrow Status Colors
 * Visual indicators for different escrow statuses
 */
export const ESCROW_STATUS_COLORS: { [key: string]: string } = {
  initiated: '#FFC107', // Warning yellow
  paid: '#2196F3', // Primary blue
  released: '#4CAF50', // Success green
  refunded: '#F44336', // Error red
  failed: '#F44336', // Error red
  expired: '#9E9E9E', // Neutral gray
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
  const normalizedOrderStatus = String(orderStatus || '')
    .trim()
    .toLowerCase();
  const normalizedEscrowStatus = String(escrowStatus || '')
    .trim()
    .toLowerCase();
  return normalizedOrderStatus === 'delivered' && normalizedEscrowStatus === 'paid';
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
