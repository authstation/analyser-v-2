import { cacheConfig, redisConfig } from "@/config/index.js";
import { redisClientIfReady } from "@/framework/redis/client.js";

function cacheKey(key: string) {
  return `${cacheConfig.keyPrefix}:${key}`;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number; // timestamp in ms; 0 means no expiry
}

const memoryStore = new Map<string, CacheEntry>();

function getFromMemory<T>(key: string, fallback: T | null = null): T | null {
  const fullKey = cacheKey(key);
  const entry = memoryStore.get(fullKey);
  if (!entry) return fallback;
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    memoryStore.delete(fullKey);
    return fallback;
  }
  return entry.value as T;
}

function putToMemory(key: string, value: unknown, ttlSeconds = cacheConfig.ttlSeconds): void {
  const fullKey = cacheKey(key);
  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
  memoryStore.set(fullKey, { value, expiresAt });
}

function removeFromMemory(key: string): void {
  const fullKey = cacheKey(key);
  memoryStore.delete(fullKey);
}

function removePatternFromMemory(pattern: string): void {
  const fullPrefix = cacheKey(pattern);
  const regex = new RegExp("^" + fullPrefix.replace(/\*/g, ".*"));
  for (const k of memoryStore.keys()) {
    if (regex.test(k)) {
      memoryStore.delete(k);
    }
  }
}

interface SwrEntry<T> {
  __swr: true;
  v: T;
  freshUntil: number;
}

/**
 * Why: Tracks in-flight stale-while-revalidate refreshes so a burst of requests
 *      for the same stale key triggers exactly one background recompute.
 * When: `rememberSWR` observes an expired-but-present value.
 * Where: Framework cache internals.
 */
const swrInflight = new Set<string>();

const SWR_GRACE_SECONDS = 60 * 60; // keep stale values around for 1h by default

/** Recompute a single SWR key in the background, deduplicated per key. */
async function refreshSwr<T>(key: string, ttl: number, staleSeconds: number, callback: () => Promise<T>): Promise<void> {
  const fullKey = cacheKey(key);
  if (swrInflight.has(fullKey)) return;
  swrInflight.add(fullKey);
  try {
    const fresh = await callback();
    await cache.put(key, { __swr: true, v: fresh, freshUntil: Date.now() + ttl * 1000 } satisfies SwrEntry<T>, ttl + staleSeconds);
  } catch {
    // Swallow revalidation errors: the stale value stays served until the next attempt.
  } finally {
    swrInflight.delete(fullKey);
  }
}

/**
 * Why: Provides Redis-backed cache helpers with robust in-memory fallback behavior.
 * When: Controllers/jobs need fast computed data caching with or without active Redis.
 * Where: Application module code via facade.
 * How: Uses namespaced Redis keys when ready, with resilient in-memory TTL store.
 */
export const cache = {
  /**
   * Why: Reads cached value by key.
   * When: A feature wants fast lookup before recomputing.
   * Where: Controllers/jobs/services using shared cache.
   * How: Tries Redis first if connected, then in-memory cache store.
   */
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    const client = redisClientIfReady();
    if (client) {
      try {
        const value = await client.get(cacheKey(key));
        if (value) return JSON.parse(value) as T;
      } catch {
        // Fallback to memory on redis error
      }
    }
    return getFromMemory<T>(key, fallback);
  },

  /**
   * Why: Stores value in cache with TTL.
   * When: Data should be reused for a period.
   * Where: Application code caching expensive results.
   * How: Writes to memory and Redis with EX seconds.
   */
  async put(key: string, value: unknown, ttl = cacheConfig.ttlSeconds): Promise<boolean> {
    putToMemory(key, value, ttl);
    const client = redisClientIfReady();
    if (client) {
      try {
        await client.set(cacheKey(key), JSON.stringify(value), "EX", ttl);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },

  /**
   * Why: Deletes a cached value by key.
   * When: Cached data becomes stale or must be invalidated.
   * Where: Write/update flows that change source data.
   * How: Removes from memory and namespaced Redis cache key.
   */
  async forget(key: string): Promise<boolean> {
    removeFromMemory(key);
    const client = redisClientIfReady();
    if (client) {
      try {
        await client.del(cacheKey(key));
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },

  /**
   * Why: Deletes cached values matching pattern (e.g. "return-data:*").
   * When: Bulk data imported and related caches must be purged.
   * Where: Import / update controllers.
   * How: Scans and deletes matching keys from memory and Redis.
   */
  async forgetPattern(pattern: string): Promise<boolean> {
    removePatternFromMemory(pattern);
    const client = redisClientIfReady();
    if (client) {
      try {
        const fullPattern = cacheKey(pattern);
        // SCAN instead of KEYS: KEYS blocks the whole Redis server for as long
        // as it takes to walk the keyspace, which stalls every other client
        // (queues, sessions, other caches) during a bulk import invalidation.
        const stream = client.scanStream({ match: fullPattern, count: 200 });
        for await (const keys of stream) {
          if (keys.length > 0) await client.del(...keys);
        }
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },

  /**
   * Why: Returns cached value or computes/stores a fresh one.
   * When: A feature needs cache-aside behavior.
   * Where: Read paths with potentially expensive callbacks.
   * How: Attempts get first, then executes callback and put.
   */
  async remember<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;

    const fresh = await callback();
    await cache.put(key, fresh, ttl);
    return fresh;
  },

  /**
   * Why: Heavy BI endpoints (dashboard analytics, filter options) are expensive
   *      to recompute, and the classic cache-aside `remember` makes every cold
   *      or just-expired request wait for the full recompute.
   * When: Read paths that can tolerate a briefly-stale response.
   * Where: Dashboard/analytics controllers.
   * How: Stores `{ v, freshUntil }` with a TTL that outlives the freshness
   *      window. Within the window the value is returned directly; once stale
   *      the stale value is served immediately and a single background refresh
   *      (deduped per key) recomputes and replaces it.
   */
  async rememberSWR<T>(
    key: string,
    ttl: number,
    callback: () => Promise<T>,
    options: { staleSeconds?: number } = {}
  ): Promise<T> {
    const staleSeconds = options.staleSeconds ?? SWR_GRACE_SECONDS;
    const cached = await cache.get<SwrEntry<T>>(key);
    if (cached && cached.__swr === true) {
      if (cached.freshUntil > Date.now()) return cached.v;
      // Stale: serve immediately and refresh out-of-band (deduplicated).
      void refreshSwr(key, ttl, staleSeconds, callback);
      return cached.v;
    }

    const fresh = await callback();
    await cache.put(key, { __swr: true, v: fresh, freshUntil: Date.now() + ttl * 1000 } satisfies SwrEntry<T>, ttl + staleSeconds);
    return fresh;
  },

  /**
   * Why: Indicates whether cache backend is usable (always true with in-memory fallback).
   */
  isAvailable(): boolean {
    return true;
  },

  /**
   * Why: Indicates whether Redis cache backend is currently usable.
   */
  isRedisAvailable(): boolean {
    return redisConfig.enabled && redisClientIfReady() !== null;
  }
};

