import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import {
  LIVE_TICK_SECONDS,
  createLiveRuntime,
  createWorldState,
  replayLiveRuntime,
  runProgram,
} from "./index.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});

const afternoon: Statement = {
  type: "if",
  condition: {
    type: "greaterThan",
    left: { type: "currentTime", part: "hour" },
    right: { type: "numericLiteral", value: 11 },
  },
  then: [{ type: "move", steps: 10 }],
};

describe("current time", () => {
  it("reads the clock the caller captured, so the same clock gives the same run", () => {
    const run = (hour: number) =>
      runProgram(program([afternoon]), createWorldState(), { clock: { hour } }).world.sprite.x;
    expect(run(9)).toBe(0);
    expect(run(15)).toBe(10);
    expect(run(15)).toBe(10);
  });

  it("is 0 when the caller gave no clock or omits the part", () => {
    expect(runProgram(program([afternoon]), createWorldState()).world.sprite.x).toBe(0);
    expect(
      runProgram(program([afternoon]), createWorldState(), { clock: { minute: 30 } }).world.sprite
        .x,
    ).toBe(0);
  });

  it("is sampled live, logged as whole numbers, and replayed with no clock", () => {
    const p = program([{ type: "wait", seconds: 0.2 }, afternoon]);
    let hour = 15;
    const live = createLiveRuntime(p, undefined, { clock: () => ({ hour, minute: 7.9 }) });
    live.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    hour = 3;
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    const log = live.inputLog();
    const logged = log.inputs.filter((input) => input.kind === "clock");
    expect(logged).toHaveLength(2);
    expect(logged[0]).toMatchObject({ clock: { hour: 15, minute: 7 } });
    const replay = replayLiveRuntime(p, {}, log);
    expect(replay.result().actors[0]!.world.sprite).toEqual(live.result().actors[0]!.world.sprite);
    expect(live.result().actors[0]!.world.sprite.x).toBe(10);
  });

  it("rejects a part outside the closed list", () => {
    const bad = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "greenFlag" },
          statements: [
            {
              type: "if",
              condition: {
                type: "greaterThan",
                left: { type: "currentTime", part: "century" },
                right: { type: "numericLiteral", value: 1 },
              },
              then: [],
            },
          ],
        },
      ],
    };
    expect(() => validateProgram(bad)).toThrow();
  });
});
