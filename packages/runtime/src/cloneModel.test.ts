import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    { id: "main", trigger: { type: "greenFlag" }, statements: [{ type: "move", steps: 10 }] },
    {
      id: "copy",
      trigger: { type: "onCloneStart" },
      statements: [{ type: "move", steps: 50 }, { type: "deleteThisClone" }],
    },
  ],
};

describe("the copy hat and delete this clone, before copies run (#1311)", () => {
  it("validates and round-trips", () => {
    expect(validateProgram(program)).toEqual(program);
  });

  it("starts no copy script yet: only the character's own runs, in batch and live", () => {
    const batch = runMultiActorProgram(program);
    expect(batch.activations.map((item) => item.scriptId)).toEqual(["main"]);
    const live = createLiveRuntime(program);
    live.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(live.result().actors[0]!.world.sprite.x).toBe(10);
  });

  it("does nothing, and says so, when delete this clone runs on something that is not a copy", () => {
    const run = runProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [
          {
            id: "m",
            trigger: { type: "greenFlag" },
            statements: [{ type: "deleteThisClone" }, { type: "move", steps: 10 }],
          },
        ],
      },
      createWorldState(),
    );
    expect(run.world.sprite.x).toBe(10);
    expect(JSON.stringify(run)).toContain("not a clone");
  });
});
