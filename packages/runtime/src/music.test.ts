import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// ADR 0011: the music extension is deterministic, bounded and ordered by the trace.
const program = (statements: Statement[], declare = true): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  ...(declare ? { extensions: ["music" as const] } : {}),
  scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements }],
});
const run = (statements: Statement[]) => runProgram(program(statements), createWorldState());

describe("music extension", () => {
  it("turns beats and tempo into seconds, in the order the blocks ran", () => {
    const { trace } = run([
      { type: "setTempo", bpm: 120 },
      { type: "playNote", note: 60, beats: 1 },
      { type: "playNote", note: 64, beats: 0.5 },
      { type: "setTempo", bpm: 60 },
      { type: "playDrum", drum: "kick", beats: 2 },
    ]);
    const heard = trace.flatMap((entry) => (entry.audio ? [entry.audio] : []));
    expect(heard).toEqual([
      { instrument: "piano", pitch: 0, pan: 0, note: 60, seconds: 0.5 },
      { instrument: "piano", pitch: 0, pan: 0, note: 64, seconds: 0.25 },
      { instrument: "piano", pitch: 0, pan: 0, drum: "kick", seconds: 2 },
    ]);
  });

  it("applies instrument, pitch and pan to what plays next, including plain sounds", () => {
    const { trace } = run([
      { type: "playSound", soundId: "kids:pop" },
      { type: "setInstrument", instrument: "flute" },
      { type: "setPitch", semitones: -5 },
      { type: "setPan", pan: 80 },
      { type: "playSound", soundId: "kids:pop" },
      { type: "playNote", note: 72, beats: 1 },
    ]);
    const audio = trace.map((entry) => entry.audio);
    expect(audio[0]).toBeUndefined();
    expect(audio[4]).toEqual({ instrument: "flute", pitch: -5, pan: 80 });
    expect(audio[5]).toMatchObject({ instrument: "flute", pitch: -5, pan: 80, note: 72 });
  });

  it("leaves programs without music exactly as before", () => {
    const result = run([{ type: "playSound", soundId: "kids:pop" }]);
    expect(result.world.music).toBeUndefined();
    expect(result.trace[0]?.audio).toBeUndefined();
  });

  it("is repeatable", () => {
    const statements: Statement[] = [
      { type: "setTempo", bpm: 90 },
      { type: "repeat", count: 3, body: [{ type: "playNote", note: 55, beats: 0.25 }] },
    ];
    expect(JSON.stringify(run(statements).trace)).toBe(JSON.stringify(run(statements).trace));
  });

  it("validation keeps notes, tempo, pitch, pan and beats inside the closed limits", () => {
    const bad: Statement[] = [
      { type: "playNote", note: 47, beats: 1 },
      { type: "playNote", note: 85, beats: 1 },
      { type: "playNote", note: 60.5, beats: 1 },
      { type: "playNote", note: 60, beats: 3 as never },
      { type: "playDrum", drum: "gong" as never, beats: 1 },
      { type: "setInstrument", instrument: "tuba" as never },
      { type: "setTempo", bpm: 59 },
      { type: "setTempo", bpm: 181 },
      { type: "setPitch", semitones: 13 },
      { type: "setPan", pan: -101 },
    ];
    for (const statement of bad) expect(() => validateProgram(program([statement]))).toThrow();
    expect(() =>
      validateProgram(program([{ type: "playNote", note: 48, beats: 0.25 }])),
    ).not.toThrow();
  });

  it("requires the music pack to be declared", () => {
    expect(() =>
      validateProgram(program([{ type: "playNote", note: 60, beats: 1 }], false)),
    ).toThrow(/extension/);
  });
});
