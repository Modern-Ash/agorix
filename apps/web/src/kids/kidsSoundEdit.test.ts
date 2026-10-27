import { describe, expect, it } from "vitest";
import {
  applySoundEdit,
  createSoundEditor,
  editSound,
  encodeWav,
  redoSound,
  samplesFromChannels,
  SOUND_EDIT_HISTORY,
  SOUND_EDIT_MAX_SAMPLES,
  SOUND_EDIT_MIN_SAMPLES,
  SOUND_EDIT_RATE,
  soundSeconds,
  undoSound,
  waveformPeaks,
} from "./kidsSoundEdit.js";
import { processKidsAudio } from "./kidsAudio.js";

const ramp = (length: number) => Float32Array.from({ length }, (_v, i) => (i + 1) / length);

describe("kids sound editor", () => {
  it("mixes to mono, resamples to the editor rate and caps at five seconds", () => {
    const left = new Float32Array(44_100).fill(1);
    const right = new Float32Array(44_100).fill(0);
    const mono = samplesFromChannels([left, right], 44_100);
    expect(mono).toHaveLength(SOUND_EDIT_RATE);
    expect(mono[100]).toBeCloseTo(0.5, 5);
    const long = samplesFromChannels([new Float32Array(44_100 * 9)], 44_100);
    expect(long).toHaveLength(SOUND_EDIT_MAX_SAMPLES);
    expect(samplesFromChannels([], 44_100)).toHaveLength(0);
  });

  it("trims inside the limits and refuses a clip that is too short or unchanged", () => {
    const samples = ramp(SOUND_EDIT_RATE);
    expect(applySoundEdit(samples, { kind: "trim", start: 1000, end: 6000 })).toHaveLength(5000);
    expect(
      applySoundEdit(samples, { kind: "trim", start: 0, end: SOUND_EDIT_MIN_SAMPLES - 1 }),
    ).toBe(null);
    expect(applySoundEdit(samples, { kind: "trim", start: 0, end: samples.length })).toBeNull();
    expect(applySoundEdit(samples, { kind: "trim", start: 500, end: 100 })).toBeNull();
  });

  it("reverses, fades, scales and changes speed without leaving range", () => {
    const samples = ramp(SOUND_EDIT_RATE);
    expect(applySoundEdit(samples, { kind: "reverse" })![0]).toBe(1);
    const faded = applySoundEdit(samples, { kind: "fadeIn" })!;
    expect(faded[0]).toBe(0);
    expect(faded.at(-1)).toBe(samples.at(-1));
    expect(applySoundEdit(samples, { kind: "fadeOut" })!.at(-1)).toBe(0);
    const loud = applySoundEdit(samples, { kind: "louder" })!;
    expect(Math.max(...loud)).toBeLessThanOrEqual(1);
    expect(applySoundEdit(samples, { kind: "quieter" })![100]).toBeCloseTo(samples[100]! * 0.6, 5);
    expect(applySoundEdit(samples, { kind: "faster" })!.length).toBeLessThan(samples.length);
    expect(applySoundEdit(samples, { kind: "slower" })!.length).toBeGreaterThan(samples.length);
  });

  it("never grows past five seconds when slowed down", () => {
    const full = new Float32Array(SOUND_EDIT_MAX_SAMPLES).fill(0.2);
    expect(applySoundEdit(full, { kind: "slower" })!.length).toBe(SOUND_EDIT_MAX_SAMPLES);
  });

  it("undoes and redoes each step, drops the redo branch on a new edit and bounds the history", () => {
    let state = createSoundEditor(ramp(SOUND_EDIT_RATE));
    const original = state.present;
    state = editSound(state, { kind: "reverse" });
    state = editSound(state, { kind: "quieter" });
    expect(state.past).toHaveLength(2);
    const afterUndo = undoSound(undoSound(state));
    expect(afterUndo.present).toBe(original);
    expect(redoSound(afterUndo).present).not.toBe(original);
    const branched = editSound(afterUndo, { kind: "louder" });
    expect(branched.future).toHaveLength(0);
    expect(undoSound(createSoundEditor(original)).present).toBe(original);
    let many = createSoundEditor(ramp(SOUND_EDIT_RATE));
    for (let index = 0; index < SOUND_EDIT_HISTORY + 8; index += 1) {
      many = editSound(many, { kind: "reverse" });
    }
    expect(many.past).toHaveLength(SOUND_EDIT_HISTORY);
  });

  it("a refused edit leaves the history alone", () => {
    const state = createSoundEditor(ramp(SOUND_EDIT_RATE));
    expect(editSound(state, { kind: "trim", start: 0, end: 3 })).toBe(state);
  });

  it("draws bounded peaks", () => {
    const peaks = waveformPeaks(ramp(SOUND_EDIT_RATE), 16);
    expect(peaks).toHaveLength(16);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1);
    expect(waveformPeaks(new Float32Array(0), 8)).toEqual(Array(8).fill(0));
    expect(soundSeconds(new Float32Array(SOUND_EDIT_RATE * 2))).toBe(2);
  });

  it("encodes a clean WAV that the audio import accepts, with no metadata", async () => {
    const samples = ramp(SOUND_EDIT_RATE * 2);
    const blob = encodeWav(samples);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + samples.length * 2);
    expect(blob.size).toBeLessThanOrEqual(500 * 1024);
    const clean = await processKidsAudio(blob, async () => soundSeconds(samples));
    expect(clean.type).toBe("audio/wav");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe("data");
  });

  it("the biggest clip still fits the 500 KB audio limit", () => {
    expect(encodeWav(new Float32Array(SOUND_EDIT_MAX_SAMPLES)).size).toBeLessThanOrEqual(
      500 * 1024,
    );
  });
});
