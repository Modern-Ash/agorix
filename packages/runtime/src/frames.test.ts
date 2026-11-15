import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "./index.js";

// Rewinding in the studio shows an earlier frame; it only works if frame i is exactly the world
// after step i, and if running again gives the same frames.
const program = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "a",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "move", steps: 40 },
        { type: "turn", degrees: 90 },
        { type: "move", steps: 40 },
      ],
    },
  ],
} as never;

describe("run frames (rewind)", () => {
  it("has one frame per step, each ending where its step ended", () => {
    const run = runMultiActorProgram(program);
    expect(run.frames).toHaveLength(run.trace.length);
    run.frames.forEach((frame, index) => {
      expect(frame.actors[0]!.world.sprite).toEqual(run.trace[index]!.worldAfter.sprite);
    });
    expect(run.frames.at(-1)!.actors[0]!.world.sprite).toEqual(run.actors[0]!.world.sprite);
  });

  it("gives the same frames every time, so going back and forward lands on the same place", () => {
    expect(runMultiActorProgram(program).frames).toEqual(runMultiActorProgram(program).frames);
  });
});
