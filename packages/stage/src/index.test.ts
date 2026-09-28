import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeObservation } from "@agorix/runtime";
import {
  PACKAGE_NAME,
  applyStageCommand,
  createStageRenderAdapter,
  createStageSession,
  executionStepsFromRuntimeObservations,
  learnerTraceFromExecutionSteps,
  createStageState,
  framesFromRuntimeObservations,
  moveStage,
  resetStageSession,
  touchingStageGoal,
  turnStage,
  type StageRenderFrame,
} from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("stage", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/stage");
  });

  it("moves and turns the sprite deterministically", () => {
    const initial = createStageState({
      sprite: { x: 0, y: 0, heading: 0, radius: 0 },
      goal: { x: 0, y: 0, radius: 0 },
    });

    const movedEast = moveStage(initial, 10);
    const turned = turnStage(movedEast, 90);
    const movedNorth = moveStage(turned, 5);

    expect(movedEast.sprite).toEqual({ x: 10, y: 0, heading: 0, radius: 0 });
    expect(turned.sprite).toEqual({ x: 10, y: 0, heading: 90, radius: 0 });
    expect(movedNorth.sprite).toEqual({ x: 10, y: 5, heading: 90, radius: 0 });
    expect(initial.sprite).toEqual({ x: 0, y: 0, heading: 0, radius: 0 });
  });

  it("detects touching-goal collisions deterministically", () => {
    expect(
      touchingStageGoal(
        createStageState({
          sprite: { x: 0, y: 0, radius: 5 },
          goal: { x: 8, y: 0, radius: 3 },
        }),
      ),
    ).toBe(true);
    expect(
      touchingStageGoal(
        createStageState({
          sprite: { x: 0, y: 0, radius: 5 },
          goal: { x: 8.0000000004, y: 0, radius: 3 },
        }),
      ),
    ).toBe(true);
    expect(
      touchingStageGoal(
        createStageState({
          sprite: { x: 0, y: 0, radius: 5 },
          goal: { x: 8.01, y: 0, radius: 3 },
        }),
      ),
    ).toBe(false);
  });

  it("keeps an immutable initial state and resets exactly", () => {
    const session = createStageSession({
      sprite: { x: 1, y: 2, heading: 45, radius: 7 },
      goal: { x: 99, y: 3, radius: 11 },
      viewport: { width: 640, height: 360 },
    });
    const moved = applyStageCommand(session, { type: "move", steps: 25 });
    const reset = resetStageSession(moved);

    expect(moved.current).not.toEqual(session.initial);
    expect(reset.current).toEqual(session.initial);
    expect(reset.current).not.toBe(session.initial);
  });

  it("applies commands only through the stage session contract", () => {
    const session = createStageSession({ sprite: { heading: 0 } });
    const afterMove = applyStageCommand(session, { type: "move", steps: 10 });
    const afterTurn = applyStageCommand(afterMove, { type: "turn", degrees: -90 });
    const reset = applyStageCommand(afterTurn, { type: "reset" });

    expect(afterMove.current.sprite.x).toBe(10);
    expect(afterTurn.current.sprite.heading).toBe(270);
    expect(reset.current).toEqual(session.initial);
  });

  it("renders frozen frames so adapters cannot mutate domain state", () => {
    const rendered: StageRenderFrame[] = [];
    const adapter = createStageRenderAdapter({
      render(frame) {
        rendered.push(frame);
        expect(() => ((frame.state.sprite as { x: number }).x = 99)).toThrow(TypeError);
      },
    });
    const state = createStageState({ sprite: { x: 1 }, goal: { x: 100 } });

    const frame = adapter.renderState(state, {
      highlightedNodeId: "scripts[0]/statements[0]",
      running: true,
    });

    expect(rendered).toHaveLength(1);
    expect(frame).toEqual(rendered[0]);
    expect(state.sprite.x).toBe(1);
    expect(frame.highlightedNodeId).toBe("scripts[0]/statements[0]");
    expect(frame.running).toBe(true);
  });

  it("turns runtime observations into visual frames for execution highlighting", () => {
    const observations: RuntimeObservation[] = [
      {
        kind: "statement-start",
        step: 1,
        nodeId: "scripts[0]/statements[0]",
        statementType: "move",
        world: { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 10, y: 0 } },
      },
      {
        kind: "statement-end",
        step: 1,
        nodeId: "scripts[0]/statements[0]",
        statementType: "move",
        world: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 10, y: 0 } },
      },
      {
        kind: "run-complete",
        step: 1,
        nodeId: "$",
        outcome: "completed",
        world: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 10, y: 0 } },
      },
    ];

    const frames = framesFromRuntimeObservations(observations);

    expect(frames.map((frame) => frame.highlightedNodeId)).toEqual([
      "scripts[0]/statements[0]",
      "scripts[0]/statements[0]",
      undefined,
    ]);
    expect(frames.map((frame) => frame.running)).toEqual([true, true, false]);
    expect(frames[1]?.reachedGoal).toBe(true);
  });

  it("creates deterministic child-readable execution steps from runtime observations", () => {
    const observations: RuntimeObservation[] = [
      {
        kind: "statement-start",
        step: 1,
        nodeId: "scripts[0]/statements[0]",
        statementType: "repeat",
        world: { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
      {
        kind: "statement-start",
        step: 1,
        nodeId: "scripts[0]/statements[0]/body[0]",
        statementType: "move",
        world: { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
      {
        kind: "statement-end",
        step: 1,
        nodeId: "scripts[0]/statements[0]/body[0]",
        statementType: "move",
        world: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
      {
        kind: "statement-start",
        step: 2,
        nodeId: "scripts[0]/statements[1]",
        statementType: "if",
        world: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
      {
        kind: "statement-end",
        step: 2,
        nodeId: "scripts[0]/statements[1]",
        statementType: "if",
        world: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
      {
        kind: "statement-end",
        step: 3,
        nodeId: "scripts[0]/statements[0]",
        statementType: "repeat",
        world: { sprite: { x: 20, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
      {
        kind: "run-complete",
        step: 3,
        nodeId: "$",
        outcome: "completed",
        world: { sprite: { x: 20, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
    ];

    const first = executionStepsFromRuntimeObservations(observations);
    const second = executionStepsFromRuntimeObservations(structuredClone(observations));

    expect(first.map((step) => step.timing)).toEqual([
      "enter-repeat",
      "before-statement",
      "after-statement",
      "evaluate-condition",
      "complete-condition",
      "complete-repeat",
      "complete",
    ]);
    expect(first.map((step) => step.nodeId ?? "$")).toEqual(
      second.map((step) => step.nodeId ?? "$"),
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first[2]?.frame.highlightedNodeId).toBe("scripts[0]/statements[0]/body[0]");
    expect(first.at(-1)?.frame.running).toBe(false);
  });

  it("creates child-readable learner traces without provider or prompt data", () => {
    const observations: RuntimeObservation[] = [
      {
        kind: "statement-start",
        step: 1,
        nodeId: "scripts[0]/statements[0]",
        statementType: "move",
        world: { sprite: { x: 20, y: 0, heading: 0 }, goal: { x: 100, y: 0 } },
      },
      {
        kind: "statement-end",
        step: 1,
        nodeId: "scripts[0]/statements[0]",
        statementType: "move",
        world: { sprite: { x: 30, y: 0, heading: 0 }, goal: { x: 100, y: 0 } },
      },
      {
        kind: "statement-start",
        step: 2,
        nodeId: "scripts[0]/statements[1]",
        statementType: "if",
        world: { sprite: { x: 30, y: 0, heading: 0 }, goal: { x: 100, y: 0 } },
      },
      {
        kind: "statement-end",
        step: 2,
        nodeId: "scripts[0]/statements[1]",
        statementType: "if",
        world: { sprite: { x: 30, y: 0, heading: 0 }, goal: { x: 100, y: 0 } },
      },
      {
        kind: "run-complete",
        step: 2,
        nodeId: "$",
        outcome: "completed",
        world: { sprite: { x: 30, y: 0, heading: 0 }, goal: { x: 100, y: 0 } },
      },
    ];

    const steps = executionStepsFromRuntimeObservations(observations);
    const beginner = learnerTraceFromExecutionSteps(steps, "beginner");
    const studio = learnerTraceFromExecutionSteps(steps, "studio");

    expect(beginner[1]?.summary).toBe("Nova moved right; x: 20 -> 30");
    expect(beginner[3]?.conditionResult).toBe(false);
    expect(studio[1]?.summary).toContain("before: x=20 y=0 heading=0");
    expect(studio[1]?.summary).toContain("after: x=30 y=0 heading=0");
    expect(studio[1]?.nodeId).toBe(beginner[1]?.nodeId);
    expect(JSON.stringify(beginner)).not.toMatch(/provider|prompt|stack|email|token/i);
  });

  it("keeps Phaser out of the stage domain package", () => {
    const sourceFiles = ["index.ts", "model.ts", "rendering.ts"];
    for (const file of sourceFiles) {
      const source = readFileSync(join(here, file), "utf8");
      expect(source).not.toMatch(/from ["']phaser["']|import\("phaser"\)/i);
    }
  });
});
