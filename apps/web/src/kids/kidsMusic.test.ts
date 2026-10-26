import { describe, expect, it } from "vitest";
import { createWorldState, runProgram } from "@agorix/runtime";
import { SCHEMA_VERSION, type Statement } from "@agorix/program-model";
import { frequencyOf, MUSIC_MAX_EVENTS, planMusic, playKidsMusic } from "./kidsMusic.js";

const trace = (statements: Statement[]) =>
  runProgram(
    {
      schema: SCHEMA_VERSION,
      extensions: ["music"],
      scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements }],
    },
    createWorldState(),
  ).trace;

describe("kids music timeline", () => {
  it("starts each note when the previous one is done, at the tempo then", () => {
    const plan = planMusic(
      trace([
        { type: "setTempo", bpm: 120 },
        { type: "playNote", note: 60, beats: 1 },
        { type: "playDrum", drum: "snare", beats: 0.5 },
        { type: "setTempo", bpm: 60 },
        { type: "playNote", note: 67, beats: 1 },
      ]),
    );
    expect(plan.map((event) => [event.kind, event.at])).toEqual([
      ["note", 0],
      ["drum", 0.5],
      ["note", 0.75],
    ]);
  });

  it("carries pitch and pan, and a sound waits for its own length", () => {
    const plan = planMusic(
      trace([
        { type: "setPitch", semitones: 12 },
        { type: "setPan", pan: -100 },
        { type: "playSound", soundId: "kids:pop" },
        { type: "playNote", note: 60, beats: 0.25 },
      ]),
    );
    expect(plan[0]).toMatchObject({ kind: "sound", at: 0, pitch: 12, pan: -100 });
    expect(plan[1]?.at).toBeCloseTo(0.09, 5);
  });

  it("is empty without music, so old programs keep their behaviour", () => {
    expect(planMusic(trace([{ type: "playSound", soundId: "kids:pop" }]))).toEqual([]);
  });

  it("caps the number of events", () => {
    const plan = planMusic(
      trace([
        {
          type: "repeat",
          count: 100,
          body: [{ type: "playNote", note: 60, beats: 0.25 }],
        },
      ]),
    );
    expect(plan.length).toBeLessThanOrEqual(MUSIC_MAX_EVENTS);
  });

  it("maps midi to equal-tempered frequency and shifts by semitones", () => {
    expect(frequencyOf(69, 0)).toBeCloseTo(440, 6);
    expect(frequencyOf(57, 12)).toBeCloseTo(440, 6);
  });

  it("never throws when the audio device is blocked", () => {
    expect(
      playKidsMusic(trace([{ type: "playNote", note: 60, beats: 1 }]), {
        createContext: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(1);
  });
});

describe("sounds before the first music block", () => {
  it("still play, at default pitch and pan, once the project uses music", () => {
    const plan = planMusic(
      trace([
        { type: "playSound", soundId: "kids:pop" },
        { type: "playNote", note: 60, beats: 1 },
      ]),
    );
    expect(plan.map((event) => event.kind)).toEqual(["sound", "note"]);
    expect(plan[0]).toMatchObject({ pitch: 0, pan: 0 });
  });
});
