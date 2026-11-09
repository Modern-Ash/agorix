import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program = (seconds: number): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    { id: "go", trigger: { type: "greenFlag" }, statements: [{ type: "move", steps: 10 }] },
    {
      id: "later",
      trigger: { type: "onTimerOver", seconds },
      statements: [{ type: "say", text: "ya pasó" }],
    },
  ],
});

describe("when the time passes", () => {
  it("starts the script after the green-flag scripts in the batch runner", () => {
    const run = runMultiActorProgram(program(3));
    expect(run.activations.map((item) => item.scriptId)).toEqual(["go", "later"]);
  });
  it("waits for the seconds in the live runtime, and keeps the run going until then", () => {
    const runtime = createLiveRuntime(program(2));
    runtime.fire({ type: "start" });
    const said = () => runtime.result().trace.some((entry) => entry.statementType === "say");
    for (let t = 0; t < 1.5; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
    expect(said()).toBe(false);
    expect(runtime.running).toBe(true);
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
    expect(said()).toBe(true);
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
    expect(runtime.running).toBe(false);
  });
});
