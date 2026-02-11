import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';

// Validate environment variables
const redisRestUrl = process.env.EXPO_PUBLIC_REDIS_REST_URL;
const redisRestToken = process.env.EXPO_PUBLIC_REDIS_REST_TOKEN;
const redisUrl = process.env.EXPO_PUBLIC_REDIS_URL || process.env.REDIS_URL;
const redisHost = process.env.EXPO_PUBLIC_REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.EXPO_PUBLIC_REDIS_PORT || '6379', 10);
const redisPassword = process.env.EXPO_PUBLIC_REDIS_PASSWORD;

// Export for use in other files
export { redisRestUrl, redisRestToken, redisUrl, redisHost, redisPort, redisPassword };

// Create Redis client (supports both REST API and TCP)
let redis: Redis | null = null;
let upstashRedis: UpstashRedis | null = null;
let useRestApi = false;

export const getRedisClient = (): Redis => {
  if (redis) {
    return redis;
  }

  try {
    // Prefer REST API for Expo/mobile apps
    if (redisRestUrl && redisRestToken) {
      console.log('✅ Using Upstash Redis REST API');
      useRestApi = true;
      upstashRedis = new UpstashRedis({
        url: redisRestUrl,
        token: redisRestToken,
      });
      // Return a mock Redis object since we're using REST
      return {} as Redis;
    } else if (redisUrl) {
      // Use URL if provided (e.g., Redis Cloud, Upstash TCP)
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    } else {
      // Use host/port configuration
      redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    }

    if (redis) {
      redis.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
      });

      redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });
    }

    return redis!;
  } catch (error) {
    console.error('❌ Failed to initialize Redis client:', error);
    throw error;
  }
};

// Helper functions for common Redis operations

// Cache with expiration (in seconds)
export const cacheSet = async (
  key: string,
  value: any,
  expirationInSeconds: number = 3600
): Promise<void> => {
  const serializedValue = JSON.stringify(value);
  
  if (useRestApi && upstashRedis) {
    await upstashRedis.set(key, serializedValue, { ex: expirationInSeconds });
  } else {
    const client = getRedisClient();
    await client.connect();
    await client.setex(key, expirationInSeconds, serializedValue);
  }
};

// Get cached value
export const cacheGet = async <T = any>(key: string): Promise<T | null> => {
  let value: string | null = null;
  
  if (useRestApi && upstashRedis) {
    value = await upstashRedis.get<string>(key);
  } else {
    const client = getRedisClient();
    await client.connect();
    value = await client.get(key);
  }
  
  if (!value) return null;
  return JSON.parse(value) as T;
};

// Delete cached value
export const cacheDelete = async (key: string): Promise<void> => {
  if (useRestApi && upstashRedis) {
    await upstashRedis.del(key);
  } else {
    const client = getRedisClient();
    await client.connect();
    await client.del(key);
  }
};

// Delete multiple cached values by pattern
export const cacheDeletePattern = async (pattern: string): Promise<void> => {
  if (useRestApi && upstashRedis) {
    const keys = await upstashRedis.keys(pattern);
    if (keys.length > 0) {
      await upstashRedis.del(...keys);
    }
  } else {
    const client = getRedisClient();
    await client.connect();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
};

// Check if key exists
export const cacheExists = async (key: string): Promise<boolean> => {
  if (useRestApi && upstashRedis) {
    const exists = await upstashRedis.exists(key);
    return exists === 1;
  } else {
    const client = getRedisClient();
    await client.connect();
    const exists = await client.exists(key);
    return exists === 1;
  }
};

// Set expiration for existing key
export const cacheExpire = async (
  key: string,
  expirationInSeconds: number
): Promise<void> => {
  if (useRestApi && upstashRedis) {
    await upstashRedis.expire(key, expirationInSeconds);
  } else {
    const client = getRedisClient();
    await client.connect();
    await client.expire(key, expirationInSeconds);
  }
};

// Get time to live for key
export const cacheTTL = async (key: string): Promise<number> => {
  if (useRestApi && upstashRedis) {
    return await upstashRedis.ttl(key);
  } else {
    const client = getRedisClient();
    await client.connect();
    return await client.ttl(key);
  }
};

export default getRedisClient;