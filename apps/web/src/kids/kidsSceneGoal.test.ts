import { describe, expect, it } from "vitest";
import type { MultiActorRunResult } from "@agorix/runtime";
import {
  describeSceneGoal,
  sceneGoalChoices,
  sceneGoalKey,
  sceneGoalMet,
  sceneGoalValid,
} from "./kidsSceneGoal.js";

const actor = (id: string, x: number, y: number, visible = true) => ({
  id,
  name: id,
  visible,
  size: 100,
  world: { sprite: { x, y } },
});
const run = (...frames: ReturnType<typeof actor>[][]) =>
  ({ frames: frames.map((actors) => ({ actors })) }) as unknown as MultiActorRunResult;

const NOVA = "actor:studio-1-nova";
const LUMA = "actor:studio-2-luma";

describe("scene goals", () => {
  it("is met when a step puts the seeker within reach of the target", () => {
    const goal = { kind: "touchActor", actorId: NOVA, targetId: LUMA } as const;
    expect(sceneGoalMet(goal, run([actor(NOVA, 40, 40), actor(LUMA, 200, 40)]))).toBe(false);
    expect(
      sceneGoalMet(
        goal,
        run(
          [actor(NOVA, 40, 40), actor(LUMA, 200, 40)],
          [actor(NOVA, 190, 40), actor(LUMA, 200, 40)],
        ),
      ),
    ).toBe(true);
  });

  it("does not count a hidden character", () => {
    const goal = { kind: "touchActor", actorId: NOVA, targetId: LUMA } as const;
    expect(sceneGoalMet(goal, run([actor(NOVA, 100, 40), actor(LUMA, 100, 40, false)]))).toBe(
      false,
    );
  });

  it("reaches the edge on any side of the stage", () => {
    const goal = { kind: "reachEdge", actorId: NOVA } as const;
    expect(sceneGoalMet(goal, run([actor(NOVA, 160, 10)]))).toBe(false);
    expect(sceneGoalMet(goal, run([actor(NOVA, 310, 10)]))).toBe(true);
    expect(sceneGoalMet(goal, run([actor(NOVA, 160, 115)]))).toBe(true);
  });

  it("preserves a migrated cell goal and judges it from runtime frames", () => {
    const goal = { kind: "reachCell", actorId: NOVA, cx: 4, cy: 2 } as const;
    expect(sceneGoalMet(goal, run([actor(NOVA, 120, 80)]))).toBe(false);
    expect(sceneGoalMet(goal, run([actor(NOVA, 120, 80)], [actor(NOVA, 160, 80)]))).toBe(true);
    expect(sceneGoalValid(goal, [NOVA])).toBe(true);
    expect(sceneGoalKey(goal)).toBe(`cell:${NOVA}:4:2`);
    expect(describeSceneGoal(goal, () => "Nova", "es")).toContain("columna 5, fila 3");
    const jump = {
      frames: [],
      trace: [
        {
          actorId: NOVA,
          worldBefore: { sprite: { x: 0, y: 80 } },
          worldAfter: { sprite: { x: 200, y: 80 } },
        },
      ],
    } as unknown as MultiActorRunResult;
    expect(sceneGoalMet(goal, jump)).toBe(true);
    const afterTurn = { ...goal, afterTurn: true } as const;
    expect(sceneGoalMet(afterTurn, jump)).toBe(false);
    expect(
      sceneGoalMet(afterTurn, {
        frames: [],
        trace: [
          {
            actorId: NOVA,
            statementType: "turn",
            worldBefore: { sprite: { x: 0, y: 80 } },
            worldAfter: { sprite: { x: 0, y: 80 } },
          },
          jump.trace[0],
        ],
      } as unknown as MultiActorRunResult),
    ).toBe(true);
  });

  it("is not met with no steps, even if the layout already satisfies it", () => {
    const goal = { kind: "reachEdge", actorId: NOVA } as const;
    expect(sceneGoalMet(goal, { frames: [] } as unknown as MultiActorRunResult)).toBe(false);
  });

  it("checks that the characters still exist and lists every pair once per direction", () => {
    expect(sceneGoalValid({ kind: "reachEdge", actorId: NOVA }, [LUMA])).toBe(false);
    expect(
      sceneGoalValid({ kind: "touchActor", actorId: NOVA, targetId: LUMA }, [NOVA, LUMA]),
    ).toBe(true);
    const choices = sceneGoalChoices([NOVA, LUMA]);
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map(sceneGoalKey)).size).toBe(4);
    expect(sceneGoalChoices([NOVA])).toEqual([{ kind: "reachEdge", actorId: NOVA }]);
  });

  it("describes a goal in both languages", () => {
    const name = (id: string) => (id === NOVA ? "Nova" : "Luma");
    const goal = { kind: "touchActor", actorId: NOVA, targetId: LUMA } as const;
    expect(describeSceneGoal(goal, name, "es")).toBe("Nova toca a Luma");
    expect(describeSceneGoal(goal, name, "en")).toBe("Nova touches Luma");
  });
});
