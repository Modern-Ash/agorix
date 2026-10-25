import { describe, expect, it } from "vitest";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";

describe("Ori adult review rate limiter", () => {
  it("allows only the configured number of requests per window", () => {
    const limiter = createOriReviewRateLimiter(3, 1000, () => 5000);
    expect([1, 2, 3, 4, 5].map(() => limiter.allow("operator"))).toEqual([
      true, true, true, false, false,
    ]);
  });
  it("recovers capacity after a complete window", () => {
    let time = 1000;
    const limiter = createOriReviewRateLimiter(1, 1000, () => time);
    expect(limiter.allow("operator")).toBe(true);
    expect(limiter.allow("operator")).toBe(false);
    time = 2000;
    expect(limiter.allow("operator")).toBe(true);
  });
  it("isolates independent principals", () => {
    const limiter = createOriReviewRateLimiter(1, 1000, () => 1000);
    expect(limiter.allow("adultA")).toBe(true);
    expect(limiter.allow("adultA")).toBe(false);
    expect(limiter.allow("adultB")).toBe(true);
  });
  it.each(["", "a b", "x".repeat(65), "adult@example.com", "../admin"])(
    "denies invalid principal %s",
    (principal) => {
      expect(createOriReviewRateLimiter().allow(principal)).toBe(false);
    },
  );
  it.each([0, -1, 101, 1.5, Number.NaN])("rejects invalid request limit %s", (limit) => {
    expect(() => createOriReviewRateLimiter(limit)).toThrow();
  });
  it.each([0, 999, 3_600_001, 1.5])("rejects invalid window %s", (window) => {
    expect(() => createOriReviewRateLimiter(1, window)).toThrow();
  });
  it("fails closed on invalid clock values", () => {
    expect(createOriReviewRateLimiter(1, 1000, () => Number.NaN).allow("operator")).toBe(false);
  });
  it("clears state explicitly", () => {
    const limiter = createOriReviewRateLimiter(1, 1000, () => 1000);
    expect(limiter.allow("operator")).toBe(true);
    limiter.clear();
    expect(limiter.allow("operator")).toBe(true);
  });
});
