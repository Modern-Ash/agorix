import { describe, expect, it } from "vitest";
import { FULL_COVERAGE_PROGRAM } from "./fixtures.js";
import { MAX_EMBEDDED_SOUNDS, validEmbeddedSoundSource } from "./creative.js";
import { validateProjectCreativeState } from "./creative.js";

function wav(options: {
  readonly rate?: number;
  readonly samples?: number;
  readonly channels?: number;
  readonly bits?: number;
  readonly format?: number;
  readonly riff?: string;
}): string {
  const rate = options.rate ?? 16000;
  const samples = options.samples ?? 1600;
  const channels = options.channels ?? 1;
  const bits = options.bits ?? 16;
  const dataSize = samples * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const put = (at: number, text: string) =>
    [...text].forEach((char, index) => (bytes[at + index] = char.charCodeAt(0)));
  put(0, options.riff ?? "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  put(8, "WAVE");
  put(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, options.format ?? 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, bits, true);
  put(36, "data");
  view.setUint32(40, dataSize, true);
  return `data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("embedded recorded sounds", () => {
  it("accepts a mono 16-bit PCM WAV at a stored rate, up to five seconds", () => {
    expect(validEmbeddedSoundSource(wav({}))).toBe(true);
    expect(validEmbeddedSoundSource(wav({ rate: 22050, samples: 22050 * 5 }))).toBe(true);
  });

  it("rejects every other shape", () => {
    expect(validEmbeddedSoundSource(wav({ rate: 44100 }))).toBe(false);
    expect(validEmbeddedSoundSource(wav({ channels: 2 }))).toBe(false);
    expect(validEmbeddedSoundSource(wav({ bits: 8 }))).toBe(false);
    expect(validEmbeddedSoundSource(wav({ format: 3 }))).toBe(false);
    expect(validEmbeddedSoundSource(wav({ riff: "RIFX" }))).toBe(false);
    expect(validEmbeddedSoundSource(wav({ samples: 16000 * 5 + 1 }))).toBe(false);
    expect(validEmbeddedSoundSource(wav({ samples: 0 }))).toBe(false);
    expect(validEmbeddedSoundSource("data:audio/mpeg;base64,AAAA")).toBe(false);
    expect(validEmbeddedSoundSource("data:text/html;base64,PGI+")).toBe(false);
    expect(validEmbeddedSoundSource("data:audio/wav;base64,!!!")).toBe(false);
    expect(validEmbeddedSoundSource(42)).toBe(false);
  });

  it("is checked when a project asset carries it, with at most eight per project", () => {
    const program = { ...FULL_COVERAGE_PROGRAM, scripts: [] };
    const sound = (n: number) => ({
      id: `sound:recorded-${n}`,
      kind: "sound" as const,
      name: `Mi sonido ${n}`,
      source: wav({}),
    });
    expect(() => validateProjectCreativeState({ assets: [sound(1)] }, program)).not.toThrow();
    expect(() =>
      validateProjectCreativeState(
        { assets: [{ ...sound(1), source: wav({ rate: 44100 }) }] },
        program,
      ),
    ).toThrow(/WAV/);
    const many = Array.from({ length: MAX_EMBEDDED_SOUNDS + 1 }, (_, index) => sound(index));
    expect(() => validateProjectCreativeState({ assets: many.slice(0, 8) }, program)).not.toThrow();
    expect(() => validateProjectCreativeState({ assets: many }, program)).toThrow(/at most 8/);
    expect(() =>
      validateProjectCreativeState(
        { assets: [{ ...sound(1), kind: "costume" as const }] },
        program,
      ),
    ).toThrow();
  });
});
