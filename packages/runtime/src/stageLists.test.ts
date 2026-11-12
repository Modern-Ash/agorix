import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  lists: [
    { id: "shared", name: "Shared", initialItems: ["start"], visible: true, scope: "stage" },
    { id: "local", name: "Local", initialItems: [], visible: true },
  ],
  scripts: [
    {
      id: "first-script",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "listAdd", listId: "shared", value: { type: "textLiteral", value: "next" } },
      ],
    },
    {
      id: "second-script",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "listAdd",
          listId: "local",
          value: {
            type: "listItem",
            listId: "shared",
            index: { type: "numericLiteral", value: 2 },
          },
        },
        { type: "hideList", listId: "shared" },
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
      scripts: ["first-script"],
    },
    {
      id: "second",
      name: "Second",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["second-script"],
    },
  ],
  stage: { actorOrder: ["first", "second"] },
};

describe("Stage-owned lists", () => {
  it("shares items and watcher visibility in batch and restores a snapshot", () => {
    const result = runMultiActorProgram(program, creative);
    expect(result.stage.lists?.shared).toEqual({ items: ["start", "next"], visible: false });
    expect(result.actors[1]?.world.lists?.local?.items).toEqual(["next"]);
    expect(result.actors[0]?.world.lists?.local?.items).toEqual([]);
    expect(
      runMultiActorProgram(program, creative, { initialStage: result.stage }).stage.lists?.shared
        ?.items,
    ).toEqual(["start", "next", "next"]);
  });

  it("shares the same items in live play", () => {
    const live = createLiveRuntime(program, creative, { paceSeconds: 0 });
    live.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(live.result().stage.lists?.shared).toEqual({ items: ["start", "next"], visible: false });
    expect(live.result().actors[1]?.world.lists?.local?.items).toEqual(["next"]);
  });

  it("rejects unsupported scope and too many initial items", () => {
    expect(() =>
      validateProgram({
        ...program,
        lists: [{ ...program.lists![0]!, scope: "global" as "stage" }],
      }),
    ).toThrow();
    expect(() =>
      validateProgram({
        ...program,
        lists: [{ ...program.lists![0]!, initialItems: Array(101).fill(1) }],
      }),
    ).toThrow();
  });
});
