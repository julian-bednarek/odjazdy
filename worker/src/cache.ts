// KV rather than the Cache API, which is a no-op on *.workers.dev.
const kvKey = (key: string) => `cache:${key}`;

export function cacheGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  return kv.get<T>(kvKey(key), "json");
}

export function cachePut(kv: KVNamespace, key: string, value: unknown, ttlS: number): Promise<void> {
  return kv.put(kvKey(key), JSON.stringify(value), { expirationTtl: ttlS });
}

export async function cached<T>(kv: KVNamespace, key: string, ttlS: number, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(kv, key);
  if (hit) return hit;
  const value = await load();
  // A full daily KV write quota must not cost us data we already have.
  await cachePut(kv, key, value, ttlS).catch(console.error);
  return value;
}
