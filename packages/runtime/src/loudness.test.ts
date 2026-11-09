import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";
import { createLiveRuntime, LIVE_TICK_SECONDS, replayLiveRuntime } from "./liveRuntime.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});

const ifLoud = (): Statement => ({
  type: "if",
  condition: {
    type: "greaterThan",
    left: { type: "loudness" },
    right: { type: "numericLiteral", value: 30 },
  },
  then: [{ type: "move", steps: 10 }],
});

describe("loudness as a value", () => {
  it("is 0 when nothing measured it, so the condition is false", () => {
    expect(runProgram(program([ifLoud()]), createWorldState()).world.sprite.x).toBe(0);
  });

  it("uses the level the caller measured, kept to a whole number from 0 to 100", () => {
    const at = (loudness: number) =>
      runProgram(program([ifLoud()]), createWorldState(), { loudness }).world.sprite.x;
    expect(at(60)).toBe(10);
    expect(at(20)).toBe(0);
    expect(at(Number.NaN)).toBe(0);
    expect(at(-5)).toBe(0);
    expect(at(900)).toBe(10);
  });

  it("is sampled each tick, logged as a number only, and replayed without a microphone", () => {
    const p = program([
      { type: "wait", seconds: 0.2 },
      ifLoud(),
      { type: "wait", seconds: 0.1 },
      ifLoud(),
    ]);
    let level = 80;
    const live = createLiveRuntime(p, undefined, { loudness: () => level });
    live.fire({ type: "start" });
    for (let t = 0; t < 0.25; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    level = 5;
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    const log = live.inputLog();
    const logged = log.inputs.filter((input) => input.kind === "loudness");
    expect(logged.map((input) => (input.kind === "loudness" ? input.level : -1))).toEqual([80, 5]);
    // Only whole numbers 0 to 100: nothing of the sound itself is in the log.
    expect(JSON.stringify(log)).not.toMatch(/audio|sample|buffer/i);
    const replay = replayLiveRuntime(p, {}, log);
    expect(replay.result().actors[0]!.world.sprite).toEqual(live.result().actors[0]!.world.sprite);
    expect(live.result().actors[0]!.world.sprite.x).toBe(10);
  });
});
