import { describe, expect, it } from "vitest";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";

describe("Ori review admission limiter", () => {
  it("enforces per-principal quota and isolates identities", () => {
    const limit = createOriReviewRateLimiter(2, 1000, 2, () => 1000);
    expect([limit.allow("adultA"), limit.allow("adultA"), limit.allow("adultA")]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limit.allow("adultB")).toBe(true);
  });
  it("recovers after expiry", () => {
    let time = 1000;
    const limit = createOriReviewRateLimiter(1, 1000, 1, () => time);
    expect(limit.allow("adultA")).toBe(true);
    expect(limit.allow("adultA")).toBe(false);
    time = 2000;
    expect(limit.allow("adultA")).toBe(true);
  });
  it("fails closed at principal capacity and admits after expiry", () => {
    let time = 1000;
    const limit = createOriReviewRateLimiter(1, 1000, 1, () => time);
    expect(limit.allow("adultA")).toBe(true);
    expect(limit.allow("adultB")).toBe(false);
    time = 2000;
    expect(limit.allow("adultB")).toBe(true);
  });
  it("rejects clock rollback without resetting quota", () => {
    let time = 2000;
    const limit = createOriReviewRateLimiter(1, 1000, 1, () => time);
    expect(limit.allow("adultA")).toBe(true);
    time = 1999;
    expect(limit.allow("adultA")).toBe(false);
  });
  it.each(["", "../bad", "a b", "x".repeat(65)])("rejects invalid principal %s", (key) => {
    expect(createOriReviewRateLimiter().allow(key)).toBe(false);
  });
  it("rejects nonfinite clock values", () => {
    expect(createOriReviewRateLimiter(1, 1000, 1, () => Number.NaN).allow("adultA")).toBe(false);
  });
  it.each([0, -1, 101, Number.NaN])("rejects invalid quota %s", (n) => {
    expect(() => createOriReviewRateLimiter(n)).toThrow();
  });
  it.each([0, 999, 3_600_001])("rejects invalid window %s", (n) => {
    expect(() => createOriReviewRateLimiter(1, n)).toThrow();
  });
  it.each([0, 10_001, 1.5])("rejects invalid capacity %s", (n) => {
    expect(() => createOriReviewRateLimiter(1, 1000, n)).toThrow();
  });
});
