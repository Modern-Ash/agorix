import { describe, expect, it } from "vitest";
import {
  createLiveRuntime,
  encodeRunInputs,
  LIVE_TICK_SECONDS,
  parseRunInputs,
  replayLiveRuntime,
  RunInputsFileError,
} from "./index.js";

const program = {
  schema: "agorix/program/v1",
  scripts: [
    { id: "a", trigger: { type: "greenFlag" }, statements: [{ type: "move", steps: 10 }] },
    {
      id: "b",
      trigger: { type: "onKeyPressed", key: "ArrowRight" },
      statements: [{ type: "move", steps: 25 }],
    },
  ],
} as never;

const creative = {
  actors: [
    {
      id: "actor:a",
      name: "A",
      x: 0,
      y: 0,
      direction: 90,
      size: 100,
      visible: true,
      scripts: ["a", "b"],
    },
  ],
} as never;

function recorded() {
  let pointer = { x: 10, y: 20, down: false };
  const live = createLiveRuntime(program, creative, {
    randomSeed: 7,
    pointer: () => pointer,
  });
  live.fire({ type: "start" });
  for (let tick = 0; tick < 30; tick += 1) {
    if (tick === 5) live.fire({ type: "keyPressed", key: "ArrowRight" });
    if (tick === 9) pointer = { x: 40, y: 20, down: true };
    live.advance(LIVE_TICK_SECONDS);
  }
  return live;
}

describe("run inputs file", () => {
  it("replays the same run exactly from the file", () => {
    const live = recorded();
    const file = encodeRunInputs(live.inputLog(), { programHash: "h1" });
    const parsed = parseRunInputs(file);
    expect(parsed.programHash).toBe("h1");
    expect(parsed.log).toEqual(live.inputLog());
    const replay = replayLiveRuntime(program, creative, parsed.log);
    expect(replay.result().trace).toEqual(live.result().trace);
    expect(replay.result().actors).toEqual(live.result().actors);
  });

  it("leaves typed answers out unless they are asked for", () => {
    const log = {
      version: 1 as const,
      ticks: 2,
      inputs: [{ tick: 1, kind: "answers" as const, answers: { q1: "my secret word" } }],
    };
    const bare = encodeRunInputs(log);
    expect(bare).not.toContain("secret");
    expect(parseRunInputs(bare)).toMatchObject({ answersIncluded: false, log: { inputs: [] } });
    const full = encodeRunInputs(log, { includeAnswers: true });
    expect(parseRunInputs(full).log.inputs).toEqual(log.inputs);
  });

  it("refuses a file that is not what it says it is", () => {
    const good = JSON.parse(encodeRunInputs(recorded().inputLog()));
    const bad: unknown[] = [
      "not json",
      { ...good, kind: "something/else" },
      { ...good, extra: 1 },
      { ...good, log: { ...good.log, version: 2 } },
      { ...good, log: { ...good.log, ticks: -1 } },
      { ...good, log: { ...good.log, ticks: 10_000_000 } },
      { ...good, log: { ...good.log, extra: true } },
      { ...good, log: { ...good.log, inputs: [{ tick: 99, kind: "keys", keys: [] }] } },
      { ...good, log: { ...good.log, inputs: [{ tick: 1, kind: "unknown" }] } },
      {
        ...good,
        log: {
          ...good.log,
          inputs: [
            { tick: 5, kind: "keys", keys: [] },
            { tick: 2, kind: "keys", keys: [] },
          ],
        },
      },
      {
        ...good,
        log: { ...good.log, inputs: [{ tick: 1, kind: "pointer", x: "a", y: 1, down: true }] },
      },
      {
        ...good,
        log: {
          ...good.log,
          inputs: [{ tick: 1, kind: "event", event: { type: "start", key: "x" } }],
        },
      },
    ];
    for (const item of bad) {
      const source = typeof item === "string" ? item : JSON.stringify(item);
      expect(() => parseRunInputs(source), source.slice(0, 60)).toThrow(RunInputsFileError);
    }
  });

  it("refuses a file that is too large before reading it", () => {
    expect(() => parseRunInputs(" ".repeat(2_000_001))).toThrow(RunInputsFileError);
  });
});
