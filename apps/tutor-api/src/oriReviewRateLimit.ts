/**
 * Process-local fail-closed rate limiter for future adult-only Ori review.
 * Must be applied after authenticated session validation by the host.
 * No child data, session token, IP address or prompt is retained here.
 */
export interface OriReviewRateLimiter {
  readonly allow: (principalKey: string) => boolean;
  readonly clear: () => void;
}
export function createOriReviewRateLimiter(
  maxRequests = 6,
  windowMs = 60_000,
  now: () => number = Date.now,
): OriReviewRateLimiter {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 100)
    throw new RangeError("Invalid Ori review request limit");
  if (!Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > 3_600_000)
    throw new RangeError("Invalid Ori review rate window");
  const buckets = new Map<string, { count: number; since: number }>();
  return Object.freeze({
    allow(principalKey: string): boolean {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(principalKey)) return false;
      const stamp = now();
      if (!Number.isFinite(stamp)) return false;
      const previous = buckets.get(principalKey);
      if (!previous || stamp < previous.since || stamp - previous.since >= windowMs) {
        buckets.set(principalKey, { count: 1, since: stamp });
        return true;
      }
      if (previous.count >= maxRequests) return false;
      previous.count++;
      return true;
    },
    clear(): void {
      buckets.clear();
    },
  });
}
