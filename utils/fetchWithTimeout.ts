/**
 * Fetch utilities with timeout and retry capabilities
 * Prevents hanging requests and provides better error handling
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (_attempt: number, _error: Error) => void;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Fetch with automatic timeout
 * Aborts request if it takes longer than specified timeout
 *
 * @param url URL to fetch
 * @param options Fetch options with optional timeout
 * @param timeoutMs Timeout in milliseconds (default: 10 seconds)
 * @returns Response object
 * @throws Error if request times out or fails
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    const normalizedError = normalizeError(error);

    if (normalizedError.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection');
    }
    throw normalizedError;
  }
}

/**
 * Fetch with timeout and automatic retry
 * Retries failed requests with exponential backoff
 *
 * @param url URL to fetch
 * @param options Fetch options including retry configuration
 * @returns Response object
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 10000, retries = 3, retryDelay = 1000, onRetry, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, timeout);

      // Check if response is ok
      if (!response.ok) {
        // Don't retry client errors (4xx) except 408 (timeout) and 429 (rate limit)
        if (response.status >= 400 && response.status < 500) {
          if (response.status !== 408 && response.status !== 429) {
            return response;
          }
        }

        // For server errors (5xx), retry
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          if (onRetry) {
            onRetry(attempt + 1, new Error(`HTTP ${response.status}`));
          }
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (error: unknown) {
      const normalizedError = normalizeError(error);
      lastError = normalizedError;

      // Don't retry if it's not a network error
      if (
        normalizedError.message !== 'Request timeout - please check your connection' &&
        !normalizedError.message.includes('Failed to fetch') &&
        !normalizedError.message.includes('Network request failed')
      ) {
        throw normalizedError;
      }

      // Retry if attempts remain
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        if (onRetry) {
          onRetry(attempt + 1, normalizedError);
        }
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * POST request with timeout and JSON parsing
 *
 * @param url URL to post to
 * @param data Data to send
 * @param options Additional options
 * @returns Parsed JSON response
 */
export async function postJSON<T = unknown>(
  url: string,
  data: unknown,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * GET request with timeout and JSON parsing
 *
 * @param url URL to fetch
 * @param options Additional options
 * @returns Parsed JSON response
 */
export async function getJSON<T = unknown>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    method: 'GET',
    ...options,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Check if network is available
 *
 * @returns true if network is available
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    // Try to fetch a small resource with short timeout
    await fetchWithTimeout(
      'https://www.google.com/favicon.ico',
      {
        method: 'HEAD',
        cache: 'no-cache',
      },
      3000
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified time
 *
 * @param ms Milliseconds to wait
 * @param message Error message
 * @returns Promise that rejects
 */
export function timeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

/**
 * Race a promise against a timeout
 *
 * @param promise Promise to race
 * @param ms Timeout in milliseconds
 * @param message Timeout error message
 * @returns Promise result or timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([promise, timeout(ms, message)]);
}

/**
 * Retry any async operation
 *
 * @param operation Async function to retry
 * @param options Retry options
 * @returns Operation result
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    onRetry?: (_attempt: number, _error: Error) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, onRetry } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      const normalizedError = normalizeError(error);
      lastError = normalizedError;

      if (attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt);
        if (onRetry) {
          onRetry(attempt + 1, normalizedError);
        }
        await sleep(waitTime);
        continue;
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Error types for better error handling
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RetryError extends Error {
  attempts: number;
  originalError: Error;

  constructor(message: string, attempts: number, originalError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.originalError = originalError;
  }
}
