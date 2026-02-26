/**
 * Request Validation Utilities
 * Handles deduplication, validation, and quality checks for cargo requests
 */

import { supabase } from '../lib/supabase';

type CargoRequestLite = {
  from_address?: string;
  to_address?: string;
};

/**
 * Check for duplicate requests within the last hour
 * Prevents users from accidentally creating identical transport requests
 *
 * Works both online and offline:
 * - Online: Checks cloud for recent requests
 * - Offline: Checks local cache for queued requests
 *
 * @param userId - User ID
 * @param fromAddress - Pickup location (normalized)
 * @param toAddress - Delivery location (normalized)
 * @returns Error message if duplicate found, null if OK
 *
 * @example
 * const error = await checkDuplicateRequest(userId, 'Oslo', 'Bergen');
 * if (error) {
 *   showError(error); // "You already have a similar request from the past hour"
 *   return;
 * }
 */
export async function checkDuplicateRequest(
  userId: string,
  fromAddress: string,
  toAddress: string,
  fuzzy: boolean = true
): Promise<string | null> {
  try {
    // Check for requests from the same user in the past hour (single query path)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const normalizedFrom = normalizeAddress(fromAddress);
    const normalizedTo = normalizeAddress(toAddress);

    const { data, error } = await supabase
      .from('cargo_requests')
      .select('from_address,to_address')
      .eq('user_id', userId)
      .gt('created_at', oneHourAgo);

    if (error) {
      return 'Failed to check for duplicates. Please try again.';
    }

    if (data && data.length > 0) {
      for (const doc of data) {
        const existingRequest = doc as CargoRequestLite;
        const existingFromRaw = existingRequest.from_address || '';
        const existingToRaw = existingRequest.to_address || '';
        const existingFrom = normalizeAddress(existingFromRaw);
        const existingTo = normalizeAddress(existingToRaw);

        // Strict exact matching
        if (!fuzzy) {
          if (existingFromRaw === fromAddress && existingToRaw === toAddress) {
            return 'You already have a similar request. Please check your active requests first.';
          }
          continue;
        }

        // Normalized exact match
        if (existingFrom === normalizedFrom && existingTo === normalizedTo) {
          return 'You already have a similar request. Please check your active requests first.';
        }

        // Similarity match for near-identical addresses
        const sameDirectionFromSimilarity = calculateSimilarity(normalizedFrom, existingFrom);
        const sameDirectionToSimilarity = calculateSimilarity(normalizedTo, existingTo);

        if (sameDirectionFromSimilarity > 0.8 && sameDirectionToSimilarity > 0.8) {
          return 'You already have a similar request. Please check your active requests first.';
        }

        // Reverse direction with high similarity
        const reverseFromSimilarity = calculateSimilarity(normalizedFrom, existingTo);
        const reverseToSimilarity = calculateSimilarity(normalizedTo, existingFrom);

        if (reverseFromSimilarity > 0.8 && reverseToSimilarity > 0.8) {
          return 'You recently created a similar request in the opposite direction.';
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return 'Failed to validate request. Please try again.';
  }
}

/**
 * Check for duplicate requests with fuzzy address matching
 * Useful for catching near-identical requests with minor address variations
 *
 * @param userId - User ID
 * @param fromAddress - Pickup location
 * @param toAddress - Delivery location
 * @returns Error message if duplicate found, null if OK
 *
 * @example
 * const error = await checkFuzzyDuplicateRequest(userId, 'Oslo', 'Bergen');
 * // Catches: "Oslo, Norway" + "Bergen" = duplicate!
 */
export async function checkFuzzyDuplicateRequest(
  userId: string,
  fromAddress: string,
  toAddress: string
): Promise<string | null> {
  return checkDuplicateRequest(userId, fromAddress, toAddress, true);
}

/**
 * Normalize address for comparison
 * Removes extra spaces, converts to lowercase, removes country suffix
 *
 * @param address - Raw address string
 * @returns Normalized address
 */
function normalizeAddress(address: string): string {
  return (
    address
      .toLowerCase()
      .trim()
      // Remove country suffixes
      .replace(/,?\s*(norway|norge|no)$/i, '')
      .replace(/\s+/g, ' ')
  );
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns value between 0 and 1 (1 = identical)
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score 0-1
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (number of operations needed)
 */
function getEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // Substitution
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j] + 1 // Deletion
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * Check request rate limiting (max requests per time period)
 * Prevents spam/abuse of request creation
 *
 * @param userId - User ID
 * @param maxRequests - Max requests allowed
 * @param timeWindowMs - Time window in milliseconds (default: 1 hour)
 * @returns Error message if limit exceeded, null if OK
 *
 * @example
 * const error = await checkRequestRateLimit(userId, 5, 3600000); // 5 per hour
 * if (error) {
 *   showError(error); // "You've created too many requests. Please wait 15 minutes."
 * }
 */
export async function checkRequestRateLimit(
  userId: string,
  maxRequests: number = 10,
  timeWindowMs: number = 3600000 // 1 hour
): Promise<string | null> {
  try {
    const windowStart = new Date(Date.now() - timeWindowMs).toISOString();

    const { data, error } = await supabase
      .from('cargo_requests')
      .select('id')
      .eq('user_id', userId)
      .gt('created_at', windowStart);

    if (error) {
      return 'Failed to check rate limit. Please try again.';
    }

    const requestCount = data?.length ?? 0;

    if (requestCount >= maxRequests) {
      const cooldownMinutes = Math.ceil(timeWindowMs / 60000);
      return `Rate limit exceeded. You can create up to ${maxRequests} requests per ${cooldownMinutes} minutes. Please wait before creating another.`;
    }

    return null;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return null; // Don't block on error
  }
}

/**
 * Validate request data quality
 * Ensures minimum data quality before creating request
 *
 * @param data - Request data to validate
 * @returns Array of validation errors (empty if valid)
 *
 * @example
 * const errors = validateRequestData(formData);
 * if (errors.length > 0) {
 *   showErrors(errors); // ["Title too short", "Price must be > 0"]
 *   return;
 * }
 */
export function validateRequestData(data: {
  title?: string;
  description?: string;
  from_address?: string;
  to_address?: string;
  cargo_type?: string;
  weight?: number | string;
  price?: number | string;
}): string[] {
  const errors: string[] = [];

  // Title validation
  if (!data.title || data.title.trim().length < 5) {
    errors.push('Title must be at least 5 characters');
  }
  if (!data.title || data.title.trim().length > 200) {
    errors.push('Title cannot exceed 200 characters');
  }

  // Description validation
  if (!data.description || data.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }
  if (!data.description || data.description.trim().length > 2000) {
    errors.push('Description cannot exceed 2000 characters');
  }

  // Address validation
  if (!data.from_address || data.from_address.trim().length < 2) {
    errors.push('Pickup location is required');
  }
  if (!data.to_address || data.to_address.trim().length < 2) {
    errors.push('Delivery location is required');
  }

  // Check for identical addresses
  if (
    data.from_address &&
    data.to_address &&
    normalizeAddress(data.from_address) === normalizeAddress(data.to_address)
  ) {
    errors.push('Pickup and delivery locations must be different');
  }

  // Cargo type validation
  if (!data.cargo_type) {
    errors.push('Cargo type is required');
  }

  // Weight validation (if provided)
  if (data.weight !== undefined && data.weight !== null && data.weight !== '') {
    const weight = Number(data.weight);
    if (Number.isNaN(weight) || weight <= 0) {
      errors.push('Weight must be a positive number');
    }
    if (weight > 100000) {
      errors.push('Weight cannot exceed 100,000 kg');
    }
  }

  // Price validation (if provided)
  if (data.price !== undefined && data.price !== null && data.price !== '') {
    const price = Number(data.price);
    if (Number.isNaN(price) || price < 0) {
      errors.push('Price must be a valid number');
    }
    if (price > 1000000) {
      errors.push('Price cannot exceed 1,000,000 NOK');
    }
  }

  return errors;
}

export interface DeduplicationReport {
  isDuplicate: boolean;
  error?: string;
  rateLimited?: boolean;
  validationErrors?: string[];
  offlineMode?: boolean;
}

/**
 * Complete request validation before creation
 * Checks duplicates, rate limits, and data quality in one call
 *
 * @param userId - User ID
 * @param requestData - Request data
 * @returns Comprehensive validation report
 *
 * @example
 * const report = await validateBeforeCreation(userId, formData);
 * if (!report.isDuplicate && !report.rateLimited) {
 *   // Safe to create request
 *   await createRequest(requestData);
 * } else {
 *   showValidationErrors(report);
 * }
 */
export async function validateBeforeCreation(
  userId: string,
  requestData: {
    title?: string;
    description?: string;
    from_address?: string;
    to_address?: string;
    cargo_type?: string;
    weight?: number | string;
    price?: number | string;
  }
): Promise<DeduplicationReport> {
  // Check data quality first (fast, synchronous)
  const validationErrors = validateRequestData(requestData);
  if (validationErrors.length > 0) {
    return {
      isDuplicate: false,
      validationErrors,
    };
  }

  // Check for duplicates
  const duplicateError = await checkDuplicateRequest(
    userId,
    requestData.from_address || '',
    requestData.to_address || ''
  );

  if (duplicateError) {
    return {
      isDuplicate: true,
      error: duplicateError,
      offlineMode: duplicateError.includes('offline'),
    };
  }

  // Check rate limit
  const rateLimitError = await checkRequestRateLimit(userId, 10, 3600000);

  if (rateLimitError) {
    return {
      isDuplicate: false,
      rateLimited: true,
      error: rateLimitError,
    };
  }

  // All checks passed
  return {
    isDuplicate: false,
  };
}
