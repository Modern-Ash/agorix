import { describe, expect, it } from "vitest";
import type { HostMessage } from "@agorix/studio-protocol";
import { advanceDebugSession } from "./debugSession.js";

type Frame = Extract<HostMessage, { type: "stageFrame" }>["frame"];

function frame(
  index: number,
  step: number,
  value: number,
  node = "scripts[0]/statements[0]",
): Frame {
  return {
    frameIndex: index,
    frameCount: 8,
    step,
    running: true,
    reachedGoal: false,
    highlightedNodeId: node,
    state: {
      sprite: { x: 0, y: 0, heading: 0, radius: 10 },
      goal: { x: 30, y: 0, radius: 10 },
      viewport: { width: 480, height: 320 },
      variables: [{ id: "score", label: "Score", value, visible: false }],
    },
  };
}

describe("visual debugger session", () => {
  it("pauses on a selected block and records only changed runtime values", () => {
    const breakpoints = new Set(["block:scripts_0_statements_0_"]);
    const initial = advanceDebugSession(undefined, frame(0, 0, 0), breakpoints);
    expect(initial.breakpointBlockId).toBe("block:scripts_0_statements_0_");
    expect(initial.snapshot.history.score).toEqual([{ frameIndex: 0, step: 0, value: 0 }]);
    const sameStep = advanceDebugSession(initial.snapshot, frame(1, 0, 2), breakpoints);
    expect(sameStep.breakpointBlockId).toBe("block:scripts_0_statements_0_");
    expect(sameStep.changedVariableIds).toEqual(["score"]);
    expect(sameStep.snapshot.history.score?.at(-1)).toEqual({ frameIndex: 1, step: 0, value: 2 });
    const unchanged = advanceDebugSession(sameStep.snapshot, frame(2, 0, 2), breakpoints);
    expect(unchanged.breakpointBlockId).toBeUndefined();
    const nextStep = advanceDebugSession(unchanged.snapshot, frame(3, 1, 2), breakpoints);
    expect(nextStep.breakpointBlockId).toBe("block:scripts_0_statements_0_");
    expect(nextStep.snapshot.history.score).toHaveLength(2);
  });

  it("ignores duplicate frames and resets history when a run starts over", () => {
    const none = new Set<string>();
    const initial = advanceDebugSession(undefined, frame(0, 0, 0), none).snapshot;
    const changed = advanceDebugSession(initial, frame(1, 0, 3), none).snapshot;
    expect(advanceDebugSession(changed, frame(1, 0, 3), none).changedVariableIds).toEqual([]);
    const reset = advanceDebugSession(changed, frame(0, 0, 0), none);
    expect(reset.changedVariableIds).toEqual([]);
    expect(reset.snapshot.history.score).toEqual([{ frameIndex: 0, step: 0, value: 0 }]);
    expect(reset.breakpointBlockId).toBeUndefined();
  });

  it("never pauses on an unselected block or fabricates absent variables", () => {
    const initial = advanceDebugSession(undefined, frame(0, 0, 0), new Set(["block:other"]));
    expect(initial.breakpointBlockId).toBeUndefined();
    const withoutVariables = {
      ...frame(1, 1, 1, "$"),
      state: { ...frame(1, 1, 1).state, variables: [] },
    };
    const next = advanceDebugSession(initial.snapshot, withoutVariables, new Set(["block:other"]));
    expect(next.changedVariableIds).toEqual([]);
    expect(next.snapshot.history).toEqual({});
  });
});
