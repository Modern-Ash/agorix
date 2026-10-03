import { describe, expect, it } from "vitest";
import type { RuntimeObservation } from "@agorix/runtime";
import { deriveStageFeedback, framesFromRuntimeObservations, resolveStageMotion } from "./index.js";

function observation(step: number, x: number, nodeId: string, kind: RuntimeObservation["kind"]) {
  return {
    step,
    kind,
    nodeId,
    statementType: nodeId === "$" ? undefined : "move",
    world: { sprite: { x, y: 0, heading: 0 }, goal: { x: 100, y: 0 } },
    ...(kind === "run-complete" ? { outcome: "completed" } : {}),
  } as unknown as RuntimeObservation;
}

const frames = framesFromRuntimeObservations([
  observation(0, 0, "n0", "statement-start"),
  observation(1, 100, "n0", "statement-end"),
  observation(2, 100, "$", "run-complete"),
]);

describe("deriveStageFeedback", () => {
  it("is idle with no frames", () => {
    const feedback = deriveStageFeedback({ frames: [], index: 0, status: "idle", stepping: false });
    expect(feedback).toMatchObject({ phase: "idle", reachedGoal: false, total: 0, trail: [] });
    expect(feedback.position).toBeUndefined();
  });

  it("keeps the active block and World in sync while stepping", () => {
    const first = deriveStageFeedback({ frames, index: 0, status: "stopped", stepping: true });
    expect(first).toMatchObject({ phase: "stepping", activeNodeId: "n0", position: 1, total: 3 });
    expect(first.reachedGoal).toBe(false);
    expect(first.trail).toEqual([{ x: 0, y: 0 }]);
    const second = deriveStageFeedback({ frames, index: 1, status: "stopped", stepping: true });
    expect(second.reachedGoal).toBe(true);
    expect(second.trail).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it("derives success and retry from host status plus runtime reachedGoal only", () => {
    const success = deriveStageFeedback({ frames, index: 2, status: "complete", stepping: false });
    expect(success).toMatchObject({ phase: "success", reachedGoal: true });
    expect(success.activeNodeId).toBeUndefined();
    const retry = deriveStageFeedback({ frames, index: 0, status: "retry", stepping: false });
    expect(retry).toMatchObject({ phase: "retry", reachedGoal: false });
  });

  it("maps running, stopped and error", () => {
    const base = { frames, index: 1, stepping: false } as const;
    expect(deriveStageFeedback({ ...base, status: "running" }).phase).toBe("running");
    expect(deriveStageFeedback({ ...base, status: "stopped" }).phase).toBe("stopped");
    expect(deriveStageFeedback({ ...base, status: "error" }).phase).toBe("error");
  });

  it("is deterministic", () => {
    const input = { frames, index: 1, status: "stopped", stepping: true } as const;
    expect(deriveStageFeedback(input)).toEqual(deriveStageFeedback(input));
  });
});

describe("resolveStageMotion", () => {
  it("disables glide, pulse and ambient motion when reduced", () => {
    expect(resolveStageMotion(true)).toEqual({ glideMs: 0, pulseGoal: false, ambient: false });
    expect(resolveStageMotion(false).glideMs).toBeGreaterThan(0);
  });
});
