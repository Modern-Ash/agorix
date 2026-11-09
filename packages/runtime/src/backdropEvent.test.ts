import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program = (backdropId: string): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "switcher",
      trigger: { type: "greenFlag" },
      statements: [{ type: "switchBackdrop", backdropId: "backdrop:forest" }],
    },
    {
      id: "listener",
      trigger: { type: "onBackdropSwitch", backdropId },
      statements: [{ type: "say", text: "cambió" }],
    },
  ],
});

const creative = {
  assets: [
    { id: "backdrop:forest", kind: "backdrop", name: "Forest", source: "builtin:forest" },
    { id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin:space" },
  ],
} as const;

describe("when the backdrop switches", () => {
  it("starts the script after the switch, in the batch runner", () => {
    const run = runMultiActorProgram(program("backdrop:forest"), creative);
    expect(run.activations.map((item) => item.scriptId)).toEqual(["switcher", "listener"]);
    expect(run.trace.some((entry) => entry.statementType === "say")).toBe(true);
  });
  it("does not start for another backdrop", () => {
    const run = runMultiActorProgram(program("backdrop:space"), creative);
    expect(run.activations.map((item) => item.scriptId)).toEqual(["switcher"]);
  });
  it("starts the script in the live runtime too", () => {
    const runtime = createLiveRuntime(program("backdrop:forest"), creative);
    runtime.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
    expect(runtime.result().trace.some((entry) => entry.statementType === "say")).toBe(true);
  });
});
