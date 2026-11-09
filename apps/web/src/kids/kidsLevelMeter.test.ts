// agora-allowlist-file: tests of the one microphone level meter, issue 1304
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  levelFromSamples,
  microphoneLevelAllowed,
  setMicrophoneLevelAllowed,
  startLevelMeter,
} from "./kidsLevelMeter.js";

function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

function fakeContext(samples: number[]) {
  const analyser = {
    fftSize: 0,
    getFloatTimeDomainData: (into: Float32Array) => {
      for (let i = 0; i < into.length; i += 1) into[i] = samples[i % samples.length] ?? 0;
    },
  };
  const close = vi.fn(() => Promise.resolve());
  const context = {
    createAnalyser: () => analyser,
    createMediaStreamSource: () => ({ connect: vi.fn() }),
    close,
  } as unknown as AudioContext;
  return { context, close };
}

describe("microphone level meter", () => {
  it("turns samples into one whole number from 0 to 100", () => {
    expect(levelFromSamples([])).toBe(0);
    expect(levelFromSamples([0, 0, 0])).toBe(0);
    expect(levelFromSamples([1, -1, 1, -1])).toBe(100);
    const quiet = levelFromSamples([0.02, -0.02, 0.02, -0.02]);
    expect(Number.isInteger(quiet)).toBe(true);
    expect(quiet).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(20);
    expect(levelFromSamples([Number.NaN, 0.5])).toBeGreaterThanOrEqual(0);
  });

  it("is off until an adult turns it on, and is its own switch", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    expect(microphoneLevelAllowed(store)).toBe(false);
    setMicrophoneLevelAllowed(true, store);
    expect(microphoneLevelAllowed(store)).toBe(true);
    expect([...data.keys()]).toEqual(["agorix.kids.microphoneLevel.v1"]);
    setMicrophoneLevelAllowed(false, store);
    expect(microphoneLevelAllowed(store)).toBe(false);
  });

  it("reads a level and releases every track when it stops", async () => {
    const { stream, track } = fakeStream();
    const { context, close } = fakeContext([1, -1, 1, -1]);
    const meter = await startLevelMeter({
      getStream: async () => stream,
      createContext: () => context,
    });
    expect(meter?.read()).toBe(100);
    meter?.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(meter?.read()).toBe(0);
  });

  it("gives null, not an error, when the microphone is refused or unavailable", async () => {
    expect(
      await startLevelMeter({
        getStream: async () => {
          throw Object.assign(new Error("no"), { name: "NotAllowedError" });
        },
      }),
    ).toBeNull();
    const { stream, track } = fakeStream();
    expect(
      await startLevelMeter({
        getStream: async () => stream,
        createContext: () => {
          throw new Error("no audio");
        },
      }),
    ).toBeNull();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("has no network, storage or file API: only the level leaves the audio graph", () => {
    const source = readFileSync(new URL("./kidsLevelMeter.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "sendBeacon",
      "WebSocket",
      "indexedDB",
      "MediaRecorder",
      "FileReader",
      "Blob",
      "createScriptProcessor",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
