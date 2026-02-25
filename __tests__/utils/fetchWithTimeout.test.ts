import { fetchWithTimeout, fetchWithRetry } from '../../utils/fetchWithTimeout';

// Mock fetch
global.fetch = jest.fn();

describe('Fetch Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fetchWithTimeout', () => {
    it('should successfully fetch data within timeout', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const response = await fetchWithTimeout('https://api.test.com/data', {}, 5000);

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/data',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should throw error on timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves
          })
      );

      const fetchPromise = fetchWithTimeout('https://api.test.com/data', {}, 100);

      jest.advanceTimersByTime(150);

      await expect(fetchPromise).rejects.toThrow('Request timeout');
    });

    it('should use default timeout of 10 seconds', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await fetchWithTimeout('https://api.test.com/data');

      // Verify fetch was called (timeout would have been 10000ms)
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchWithTimeout('https://api.test.com/data')).rejects.toThrow(
        'Network error'
      );
    });

    it('should pass through abort signal', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const abortController = new AbortController();
      await fetchWithTimeout('https://api.test.com/data', { signal: abortController.signal });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  describe('fetchWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'success' }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const response = await fetchWithRetry('https://api.test.com/data');

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error', async () => {
      const mockResponse = { ok: true, status: 200 };

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const response = await fetchWithRetry('https://api.test.com/data', {
        timeout: 1000,
        retries: 2,
        retryDelay: 10,
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx server errors', async () => {
      const errorResponse = { ok: false, status: 503 };
      const successResponse = { ok: true, status: 200 };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.test.com/data', {
        retries: 2,
        retryDelay: 10,
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx client errors', async () => {
      const errorResponse = { ok: false, status: 400 };

      (global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse);

      const response = await fetchWithRetry('https://api.test.com/data', {
        retries: 3,
      });

      expect(response.ok).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 408 (timeout) status', async () => {
      const timeoutResponse = { ok: false, status: 408 };
      const successResponse = { ok: true, status: 200 };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(timeoutResponse)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.test.com/data', {
        retries: 2,
        retryDelay: 10,
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 (rate limit) status', async () => {
      const rateLimitResponse = { ok: false, status: 429 };
      const successResponse = { ok: true, status: 200 };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.test.com/data', {
        retries: 2,
        retryDelay: 10,
      });

      expect(response.ok).toBe(true);
    });

    it('should use exponential backoff', async () => {
      const mockError = new Error('Network error');
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ ok: true, status: 200 });

      jest.useFakeTimers();
      const promise = fetchWithRetry('https://api.test.com/data', {
        retries: 2,
        retryDelay: 100,
      });

      // First retry after 100ms * 2^0 = 100ms
      jest.advanceTimersByTime(100);

      // Second retry after 100ms * 2^1 = 200ms
      jest.advanceTimersByTime(200);

      await promise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });

    it('should call onRetry callback on failure', async () => {
      const onRetry = jest.fn();
      const mockError = new Error('Network error');

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ ok: true, status: 200 });

      jest.useFakeTimers();
      const promise = fetchWithRetry('https://api.test.com/data', {
        retries: 1,
        retryDelay: 10,
        onRetry,
      });

      jest.advanceTimersByTime(10);
      await promise;

      expect(onRetry).toHaveBeenCalledWith(1, mockError);
      jest.useRealTimers();
    });

    it('should throw error after max retries exceeded', async () => {
      const mockError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(mockError);

      jest.useFakeTimers();

      const promise = fetchWithRetry('https://api.test.com/data', {
        retries: 1,
        retryDelay: 10,
      });

      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Network error');
      jest.useRealTimers();
    });

    it('should respect custom timeout per request', async () => {
      const mockResponse = { ok: true, status: 200 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await fetchWithRetry('https://api.test.com/data', {
        timeout: 30000,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
