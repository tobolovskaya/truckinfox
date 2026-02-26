/**
 * Google Places API Proxy Cloud Function
 *
 * This Cloud Function acts as a secure proxy for Google Places API calls.
 * The API key is stored server-side and not exposed to the client.
 *
 * Usage:
 * 1. Add GOOGLE_PLACES_API_KEY environment variable in Firebase Console
 * 2. Deploy: firebase deploy --only functions
 * 3. Client calls this function instead of Google API directly
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * 🔄 Retry helper for external API calls with exponential backoff
 * Prevents failures due to temporary network issues
 *
 * @param fn Async function to retry
 * @param retries Number of retries (default: 2)
 * @param delayMs Initial delay in milliseconds (default: 1000)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1000): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) break;

      const delay = delayMs * Math.pow(2, attempt);
      console.log(`🔄 Retry attempt ${attempt + 1}/${retries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Validates that the user is authenticated before allowing API access
 */
const validateUserAuth = (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use Places API'
    );
  }
};

/**
 * Checks if user is within reasonable rate limits
 * Prevents brute force or accidental abuse
 */
const checkRateLimit = async (userId: string): Promise<boolean> => {
  const now = Date.now();
  const oneHourAgo = now - 3600000; // 1 hour in milliseconds

  const db = admin.firestore();
  const rateLimitRef = db.collection('_ratelimits').doc(userId);
  const rateLimit = await rateLimitRef.get();

  if (!rateLimit.exists) {
    // First request in history, allow
    await rateLimitRef.set({
      requests: [now],
      updatedAt: now,
    });
    return true;
  }

  const data = rateLimit.data();
  const requests = (data?.requests || ([] as number[])).filter((t: number) => t > oneHourAgo);

  // Allow max 100 requests per hour per user
  if (requests.length >= 100) {
    return false;
  }

  // Log the new request
  await rateLimitRef.update({
    requests: [...requests, now],
    updatedAt: now,
  });

  return true;
};

/**
 * Sanitizes input to prevent injection attacks
 */
const sanitizeInput = (input: string): string => {
  // Remove special characters that could break the API query
  return input
    .replace(/[<>"'`]/g, '')
    .trim()
    .substring(0, 255); // Limit input length
};

/**
 * Places Autocomplete Proxy
 *
 * POST Data:
 * {
 *   input: string,        // Search query (e.g., "Oslo")
 *   components?: string   // Restrict to country (e.g., "country:no")
 * }
 */
export const placesAutocomplete = functions.https.onCall(async (data, context) => {
  try {
    // Validate authentication
    validateUserAuth(context);

    // Check rate limits
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const isWithinLimit = await checkRateLimit(context.auth.uid);
    if (!isWithinLimit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many requests. Please try again later.'
      );
    }

    // Validate input
    if (!data.input || typeof data.input !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing or invalid "input" parameter'
      );
    }

    const input = sanitizeInput(data.input);

    if (input.length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Input must be at least 2 characters'
      );
    }

    // Check if API key is configured
    if (!GOOGLE_PLACES_API_KEY) {
      throw new functions.https.HttpsError(
        'internal',
        'API not configured. Please contact support.'
      );
    }

    // Call Google Places API (server-side, key is protected)
    // 🔄 Use withRetry for automatic retry on network failures
    const response = await withRetry(() =>
      axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        params: {
          input,
          components: data.components || 'country:no',
          language: 'no',
          key: GOOGLE_PLACES_API_KEY,
        },
        timeout: 5000,
      })
    );

    // Return only safe data to client
    return {
      predictions: response.data.predictions || [],
      status: response.data.status,
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      console.error('Groups API error:', {
        status: error.response?.status,
        message: error.message,
      });

      throw new functions.https.HttpsError('internal', 'Failed to fetch place suggestions');
    }

    console.error('Unexpected error in placesAutocomplete:', error);
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred');
  }
});

/**
 * Place Details Proxy
 *
 * Retrieves detailed information about a specific place
 *
 * POST Data:
 * {
 *   place_id: string      // Google Places place_id
 * }
 */
export const placeDetails = functions.https.onCall(async (data, context) => {
  try {
    validateUserAuth(context);

    if (!data.place_id || typeof data.place_id !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing or invalid "place_id" parameter'
      );
    }

    // Allow offline_* place IDs (our Norwegian cities fallback)
    if (data.place_id.startsWith('offline_')) {
      return {
        status: 'OFFLINE',
        result: {
          name: data.place_id.replace('offline_', ''),
          geometry: {
            location: { lat: 0, lng: 0 }, // Mocked for offline mode
          },
        },
      };
    }

    if (!GOOGLE_PLACES_API_KEY) {
      throw new functions.https.HttpsError('internal', 'API not configured');
    }

    const response = await withRetry(() =>
      axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
          place_id: data.place_id,
          key: GOOGLE_PLACES_API_KEY,
          language: 'no',
        },
        timeout: 5000,
      })
    );

    // Return sanitized details
    const result = response.data.result || {};
    return {
      status: response.data.status,
      result: {
        name: result.name,
        formatted_address: result.formatted_address,
        geometry: result.geometry,
        address_components: result.address_components,
      },
    };
  } catch (error) {
    console.error('Place details error:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to fetch place details');
  }
});

/**
 * Validation function for testing the setup
 * Returns ok if Cloud Function can access the API key
 */
export const healthCheck = functions.https.onCall(async (_data, context) => {
  validateUserAuth(context);

  return {
    status: 'ok',
    hasApiKey: !!GOOGLE_PLACES_API_KEY,
    timestamp: new Date().toISOString(),
  };
});
