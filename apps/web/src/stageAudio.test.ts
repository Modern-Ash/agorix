import { describe, expect, it } from "vitest";
import { soundCueGain } from "./stageAudio.js";

describe("soundCueGain", () => {
  it("keeps the current 0.05 ceiling at full or unset volume", () => {
    expect(soundCueGain(undefined)).toBe(0.05);
    expect(soundCueGain(100)).toBe(0.05);
  });

  it("scales linearly and is silent at zero", () => {
    expect(soundCueGain(50)).toBeCloseTo(0.025);
    expect(soundCueGain(0)).toBe(0);
  });

  it("clamps out-of-range values", () => {
    expect(soundCueGain(500)).toBe(0.05);
    expect(soundCueGain(-5)).toBe(0);
  });
});
