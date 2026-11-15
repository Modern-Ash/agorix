import { describe, expect, it } from "vitest";
import { runMultiActorProgram, type MultiActorRunResult } from "@agorix/runtime";
import {
  describeSceneGoal,
  sceneGoalChoices,
  sceneGoalKey,
  sceneGoalMet,
  sceneGoalValid,
  variableGoalChoices,
} from "./kidsSceneGoal.js";
import { creativeForStudio, validateStudioProgram } from "./kidsStudioModel.js";

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
    expect(sceneGoalMet(goal, run([actor(NOVA, 160, 80)]))).toBe(false);
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

describe("a goal about a value", () => {
  const goal = { kind: "variableReaches", variableId: "studio-var-1", value: 5 } as const;
  const play = (statements: unknown[]) => {
    const program = validateStudioProgram({
      schema: "agorix/program/v1",
      variables: [{ id: "studio-var-1", name: "score", initialValue: 0, visible: true }],
      scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements }],
    } as never);
    return runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
  };
  const add = (delta: number) => ({
    type: "changeVariable",
    variableId: "studio-var-1",
    delta: { type: "numericLiteral", value: delta },
  });

  it("is met when the value reaches the number at some step, even if it goes down after", () => {
    expect(sceneGoalMet(goal, play([add(3)]))).toBe(false);
    expect(sceneGoalMet(goal, play([add(3), add(2)]))).toBe(true);
    expect(sceneGoalMet(goal, play([add(5), add(-5)]))).toBe(true);
  });

  it("is not met by a program that never runs a step", () => {
    expect(sceneGoalMet(goal, play([]))).toBe(false);
  });

  it("needs its variable to exist, and is offered for each variable", () => {
    expect(sceneGoalValid(goal, [NOVA], ["studio-var-1"])).toBe(true);
    expect(sceneGoalValid(goal, [NOVA], ["studio-var-2"])).toBe(false);
    expect(variableGoalChoices([{ id: "studio-var-1" }]).map(sceneGoalKey)).toEqual([
      "value:studio-var-1:3",
      "value:studio-var-1:5",
      "value:studio-var-1:10",
    ]);
  });

  it("is described with the variable's name in both languages", () => {
    const name = () => "?";
    expect(describeSceneGoal(goal, name, "es", () => "puntos")).toBe("puntos llega a 5");
    expect(describeSceneGoal(goal, name, "en", () => "points")).toBe("points reaches 5");
  });
});
