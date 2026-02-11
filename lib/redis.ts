import { createClient, RedisClientType } from 'redis';

/**
 * Redis client for caching and session management
 * This is optional and only used if Redis is configured
 */
let redisClient: RedisClientType | null = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const initializeRedis = async (): Promise<RedisClientType | null> => {
  try {
    if (!redisClient) {
      redisClient = createClient({
        url: REDIS_URL,
      });

      redisClient.on('error', (err) => {
        console.warn('Redis Client Error:', err);
      });

      await redisClient.connect();
      console.log('Redis connected successfully');
    }

    return redisClient;
  } catch (error) {
    console.warn('Redis connection failed, continuing without cache:', error);
    return null;
  }
};

export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

/**
 * Cache a value with an expiration time (in seconds)
 */
export const cacheSet = async (key: string, value: string, expirationSeconds = 3600) => {
  try {
    if (!redisClient) return;
    await redisClient.setEx(key, expirationSeconds, value);
  } catch (error) {
    console.warn('Redis set failed:', error);
  }
};

/**
 * Get a cached value
 */
export const cacheGet = async (key: string): Promise<string | null> => {
  try {
    if (!redisClient) return null;
    return await redisClient.get(key);
  } catch (error) {
    console.warn('Redis get failed:', error);
    return null;
  }
};

/**
 * Delete a cached value
 */
export const cacheDelete = async (key: string) => {
  try {
    if (!redisClient) return;
    await redisClient.del(key);
  } catch (error) {
    console.warn('Redis delete failed:', error);
  }
};

export default {
  initializeRedis,
  getRedisClient,
  cacheSet,
  cacheGet,
  cacheDelete,
};
