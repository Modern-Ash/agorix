import { describe, expect, it } from "vitest";
import { playKidsSound } from "./kidsSoundPlayer.js";

const actor = { kind: "emoji", value: "🐸" } as const;

function fakeContext() {
  let oscillators = 0;
  let buffers = 0;
  let frequency = 0;
  let gainValue = 0;
  const node = { connect: () => node };
  const context = {
    currentTime: 0,
    destination: {},
    createOscillator: () => {
      oscillators++;
      return {
        ...node,
        type: "sine",
        frequency: {
          setValueAtTime: (value: number) => {
            frequency = value;
          },
          exponentialRampToValueAtTime: () => undefined,
        },
        start: () => undefined,
        stop: () => undefined,
        onended: null,
      };
    },
    createGain: () => ({
      ...node,
      gain: {
        setValueAtTime: (value: number) => {
          gainValue = value;
        },
        exponentialRampToValueAtTime: () => undefined,
      },
    }),
    createBufferSource: () => {
      buffers++;
      return { ...node, buffer: null, start: () => undefined, onended: null };
    },
    decodeAudioData: async () => ({ duration: 1 }),
    close: async () => undefined,
  };
  return {
    context: context as unknown as AudioContext,
    counts: () => ({ oscillators, buffers, frequency, gainValue }),
  };
}

describe("Kids sound playback (issues #461 and #462)", () => {
  it("uses the canonical runtime volume for the audible gallery sound", async () => {
    const half = fakeContext();
    await playKidsSound("kids:bell", actor, { createContext: () => half.context, volume: 50 });
    const full = fakeContext();
    await playKidsSound("kids:bell", actor, { createContext: () => full.context, volume: 100 });
    expect(half.counts().gainValue).toBeCloseTo(full.counts().gainValue / 2);
    const muted = fakeContext();
    await playKidsSound("kids:bell", actor, { createContext: () => muted.context, volume: 0 });
    expect(muted.counts().oscillators).toBe(0);
  });
  it("starts a decoded custom buffer once and falls back to the old tone when missing", async () => {
    const first = fakeContext();
    await playKidsSound("kids:custom", actor, {
      createContext: () => first.context,
      loadCustom: async () => new Blob(["audio"]),
      volume: 50,
    });
    expect(first.counts()).toMatchObject({ buffers: 1, oscillators: 0, gainValue: 0.5 });
    const missing = fakeContext();
    await playKidsSound("kids:custom", actor, {
      createContext: () => missing.context,
      loadCustom: async () => undefined,
    });
    expect(missing.counts()).toMatchObject({ buffers: 0, oscillators: 1, frequency: 440 });
  });

  it("plays an unknown legacy id with the default tone and ignores a blocked context", async () => {
    const old = fakeContext();
    await playKidsSound("unknown", actor, { createContext: () => old.context });
    expect(old.counts()).toMatchObject({ oscillators: 1, frequency: 440 });
    await expect(
      playKidsSound("kids:bell", actor, {
        createContext: () => {
          throw Error("blocked");
        },
      }),
    ).resolves.toBeUndefined();
  });
});
