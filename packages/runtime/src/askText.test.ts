import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createLiveRuntime, replayLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  textVariables: [{ id: "w", name: "palabra", initialValue: "", visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "askText", promptId: "name", variableId: "w" },
        { type: "say", text: "Hola", append: { type: "textVariable", variableId: "w" } },
      ],
    },
  ],
};
const said = (run: ReturnType<typeof runMultiActorProgram>) =>
  run.actors[0]?.world.sprite.bubble?.text;

describe("ask for a typed word", () => {
  it("pauses the run until there is an answer, naming the question and nothing else", () => {
    const run = runMultiActorProgram(program);
    expect(run.outcome).toBe("stopped");
    expect(run.trace.map((entry) => entry.note)).toContain("askText: awaiting name");
    expect(said(run)).toBeUndefined();
  });
  it("keeps the typed word in the text variable, cleaned and cut", () => {
    const run = runMultiActorProgram(program, undefined, {
      answers: { name: "  Ana<b>!  " + "x".repeat(60) },
    });
    expect(run.actors[0]?.world.texts?.["w"]?.value).toHaveLength(40);
    expect(said(run)).toMatch(/^Hola Anab/);
    expect(said(run)).not.toMatch(/[<>!]/);
  });
  it("replays exactly from the input log, without the live answers", () => {
    const live = createLiveRuntime(program, {}, { answers: { name: "Luz" } });
    live.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(said(live.result())).toBe("Hola Luz");
    const replay = replayLiveRuntime(program, {}, live.inputLog());
    expect(said(replay.result())).toBe("Hola Luz");
  });
});
