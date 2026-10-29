import { describe, expect, it } from "vitest";
import { createOriMig04CircuitBreaker } from "./oriMig04CircuitBreaker.js";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";
import { createOriMig04RolloutTelemetry } from "./oriMig04RolloutTelemetry.js";

describe("MIG-04 aggregate circuit breaker", () => {
  it("disables pilot after error threshold is exceeded", () => {
    const controller = createOriMig04RolloutController();
    controller.replaceFromHost({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["pilot"],
    });
    const breaker = createOriMig04CircuitBreaker({
      controller,
      telemetry: createOriMig04RolloutTelemetry(),
      minimumSamples: 3,
      maxErrorRate: 0.25,
      maxP95Ms: 5000,
    });
    breaker.observe("pilot", "success", 10);
    breaker.observe("pilot", "success", 10);
    expect(controller.decide("pilot").learnerVisible).toBe(true);
    breaker.observe("pilot", "error", 10);
    expect(breaker.snapshot().tripped).toBe(true);
    expect(controller.decide("pilot").learnerVisible).toBe(false);
  });
  it("disables pilot after high latency without leaking identifiers", () => {
    const controller = createOriMig04RolloutController();
    controller.replaceFromHost({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["pilot"],
    });
    const breaker = createOriMig04CircuitBreaker({
      controller,
      telemetry: createOriMig04RolloutTelemetry(),
      minimumSamples: 2,
      maxP95Ms: 100,
    });
    breaker.observe("pilot", "success", 50);
    breaker.observe("pilot", "success", 200);
    expect(breaker.snapshot().tripped).toBe(true);
    expect(controller.decide("pilot").fallbackToKids).toBe(true);
  });
});
