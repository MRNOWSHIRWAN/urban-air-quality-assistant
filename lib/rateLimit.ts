// Simple in-memory per-key rate limiter. On serverless platforms this limits
// per instance, not globally - it is a first layer, not a guarantee.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimitOk(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (v.reset < now) buckets.delete(k);
    }
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
