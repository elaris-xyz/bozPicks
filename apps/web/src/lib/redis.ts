import Redis from 'ioredis';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

function createRedis() {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    reconnectOnError: () => true,
  });
  // Prevent unhandled error crashes on transient disconnects
  client.on('error', (err: Error) => {
    if (!err.message.includes('ECONNRESET') && !err.message.includes('ECONNREFUSED')) {
      console.error('[redis]', err.message);
    }
  });
  return client;
}

export const redis = globalThis._redis ?? createRedis();
if (process.env.NODE_ENV !== 'production') globalThis._redis = redis;
