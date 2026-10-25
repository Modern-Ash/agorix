/**
 * Bounded, process-local admission control for a future adult-only Ori review route.
 * The caller must derive the principal from a verified server-side session.
 * No raw session token, child data, IP or request body is retained.
 */
export interface OriReviewRateLimiter {
  readonly allow: (principal: string) => boolean;
}
export function createOriReviewRateLimiter(
  maxRequests = 6,
  windowMs = 60_000,
  maxPrincipals = 256,
  now: () => number = Date.now,
): OriReviewRateLimiter {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 100)
    throw new RangeError("Invalid request limit");
  if (!Number.isSafeInteger(windowMs) || windowMs < 1_000 || windowMs > 3_600_000)
    throw new RangeError("Invalid time window");
  if (!Number.isSafeInteger(maxPrincipals) || maxPrincipals < 1 || maxPrincipals > 10_000)
    throw new RangeError("Invalid principal capacity");

  const buckets = new Map<string, { since: number; count: number }>();
  return Object.freeze({
    allow(principal: string): boolean {
      if (typeof principal !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(principal))
        return false;
      const stamp = now();
      if (!Number.isSafeInteger(stamp) || stamp < 0) return false;
      const previous = buckets.get(principal);
      if (previous && stamp < previous.since) return false;
      if (previous && stamp - previous.since < windowMs) {
        if (previous.count >= maxRequests) return false;
        previous.count++;
        return true;
      }
      // Remove expired buckets before considering new principals.
      for (const [key, bucket] of buckets) {
        if (stamp >= bucket.since && stamp - bucket.since >= windowMs) buckets.delete(key);
      }
      if (!buckets.has(principal) && buckets.size >= maxPrincipals) return false;
      buckets.set(principal, { since: stamp, count: 1 });
      return true;
    },
  });
}
