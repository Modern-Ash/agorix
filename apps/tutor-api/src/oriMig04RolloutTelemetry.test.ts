import { describe, expect, it } from "vitest";
import { createOriMig04RolloutTelemetry } from "./oriMig04RolloutTelemetry.js";

describe("MIG-04 privacy-preserving rollout telemetry", () => {
  it("records bounded outcomes and latency without learner identifiers", () => {
    const metrics = createOriMig04RolloutTelemetry();
    metrics.record("pilot", "success", 10);
    metrics.record("pilot", "fallback", 40);
    metrics.record("pilot", "error", 20);
    metrics.record("disabled", "blocked", 0);
    const snapshot = metrics.snapshot();
    expect(snapshot.attempts).toBe(4);
    expect(snapshot.outcomes.fallback).toBe(1);
    expect(snapshot.p50Ms).toBe(10);
    expect(snapshot.p95Ms).toBe(40);
    expect(snapshot.rolloutAuthorized).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain("student");
  });
  it("ignores invalid timing and does not claim rollout readiness", () => {
    const metrics = createOriMig04RolloutTelemetry();
    metrics.record("pilot", "success", Number.NaN);
    metrics.record("pilot", "success", -1);
    expect(metrics.snapshot().attempts).toBe(0);
    expect(metrics.snapshot().rolloutAuthorized).toBe(false);
  });
});
