import { createClient, RedisClientType } from "redis";

let redis: RedisClientType | null = null;
let connecting = false;

export async function getRedis(): Promise<RedisClientType> {
  if (redis && redis.isReady) return redis;
  if (!redis) {
    redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" }) as RedisClientType;
  }
  if (!connecting && !redis.isReady) {
    connecting = true;
    await redis.connect().catch(console.error);
    connecting = false;
  }
  return redis;
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const r = await getRedis();
    const cached = await r.get(key);
    if (cached) return JSON.parse(cached) as T;
    const data = await fetcher();
    await r.setEx(key, ttlSeconds, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error('[REDIS ERROR]', (e as Error).message);
    return fetcher();
  }
}

export async function invalidatePattern(pattern: string) {
  try {
    const r = await getRedis();
    const keys = await r.keys(pattern);
    if (keys.length > 0) await r.del(keys);
  } catch { /* silent fail */ }
}