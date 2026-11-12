import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  STAGE_ACTOR_ID,
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [
    { id: "shared", name: "Shared", initialValue: 2, visible: true, scope: "stage" },
    { id: "seen", name: "Seen", initialValue: 0, visible: true },
  ],
  scripts: [
    {
      id: "a",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "changeVariable",
          variableId: "shared",
          delta: { type: "numericLiteral", value: 3 },
        },
      ],
    },
    {
      id: "b",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "setVariable",
          variableId: "seen",
          value: {
            type: "actorProperty",
            actorId: STAGE_ACTOR_ID,
            property: "variable",
            variableId: "shared",
          },
        },
        { type: "hideVariable", variableId: "shared" },
      ],
    },
  ],
};
const creative: ProjectCreativeState = {
  actors: [
    {
      id: "first",
      name: "First",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["a"],
    },
    {
      id: "second",
      name: "Second",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["b"],
    },
  ],
  stage: { actorOrder: ["first", "second"] },
};

describe("Stage-owned number variables", () => {
  it("shares executed values and visibility across actors in the batch runner", () => {
    const result = runMultiActorProgram(program, creative);
    expect(result.stage.variables?.shared).toEqual({ value: 5, visible: false });
    expect(result.actors[1]?.world.variables?.seen?.value).toBe(5);
    expect(result.actors[0]?.world.variables?.seen?.value).toBe(0);
    expect(
      runMultiActorProgram(program, creative, { initialStage: result.stage }).stage.variables
        ?.shared?.value,
    ).toBe(8);
  });

  it("shares the same value in live play", () => {
    const live = createLiveRuntime(program, creative, { paceSeconds: 0 });
    live.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(live.result().stage.variables?.shared).toEqual({ value: 5, visible: false });
    expect(live.result().actors[1]?.world.variables?.seen?.value).toBe(5);
  });

  it("rejects a local variable as a Stage property and unsupported scopes", () => {
    expect(() =>
      validateProgram({ ...program, variables: [{ ...program.variables![0]!, scope: "global" }] }),
    ).toThrow();
    expect(() =>
      validateProgram({
        ...program,
        variables: [{ ...program.variables![0]!, scope: undefined }, program.variables![1]!],
      }),
    ).toThrow();
  });
});
