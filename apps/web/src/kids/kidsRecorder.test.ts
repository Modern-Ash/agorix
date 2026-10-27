// agora-allowlist-file: tests of the one supervised voice recorder (issue #622); they use fake media.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  microphoneAllowed,
  RECORDING_MAX_MS,
  RecordingError,
  setMicrophoneAllowed,
  startKidsRecording,
} from "./kidsRecorder.js";

class FakeTrack {
  stopped = 0;
  stop() {
    this.stopped += 1;
  }
}

function fakes(options: { data?: Blob[]; startFails?: boolean } = {}) {
  const track = new FakeTrack();
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const recorder = {
    state: "inactive" as "inactive" | "recording",
    mimeType: "audio/webm",
    ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null,
    onerror: null as (() => void) | null,
    start() {
      if (options.startFails) throw new Error("no");
      this.state = "recording";
    },
    stop() {
      this.state = "inactive";
      for (const data of options.data ?? [new Blob([new Uint8Array(8)])]) {
        this.ondataavailable?.({ data });
      }
      this.onstop?.();
    },
  };
  const timers: { callback: () => void; ms: number; cleared: boolean }[] = [];
  const deps = {
    getStream: async () => stream,
    createRecorder: () => recorder as unknown as MediaRecorder,
    setTimer: (callback: () => void, ms: number) => {
      const timer = { callback, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle: unknown) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  };
  return { track, recorder, timers, deps };
}

describe("supervised voice recording (issue #622)", () => {
  it("records until the adult stops, then lets go of the microphone", async () => {
    const { track, deps, timers } = fakes();
    const recording = await startKidsRecording(deps);
    expect(track.stopped).toBe(0);
    recording.stop();
    const blob = await recording.result;
    expect(blob.size).toBe(8);
    expect(track.stopped).toBe(1);
    expect(timers[0]!.cleared).toBe(true);
  });

  it("stops on its own after five seconds and lets go of the microphone", async () => {
    const { track, deps, timers } = fakes();
    const recording = await startKidsRecording(deps);
    expect(timers[0]!.ms).toBe(RECORDING_MAX_MS);
    expect(RECORDING_MAX_MS).toBe(5_000);
    timers[0]!.callback();
    await recording.result;
    expect(track.stopped).toBe(1);
  });

  it("stopping twice does nothing more and never reopens the microphone", async () => {
    const { track, deps } = fakes();
    const recording = await startKidsRecording(deps);
    recording.stop();
    await recording.result;
    recording.stop();
    expect(track.stopped).toBe(1);
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "failed"],
  ])("a %s while asking becomes %s", async (name, code) => {
    await expect(
      startKidsRecording({
        getStream: async () => {
          throw Object.assign(new Error(name), { name });
        },
      }),
    ).rejects.toMatchObject({ code });
  });

  it("says unsupported without a microphone API, and releases a stream it cannot record", async () => {
    await expect(
      startKidsRecording({ getStream: () => Promise.reject(new RecordingError("unsupported")) }),
    ).rejects.toMatchObject({ code: "unsupported" });
    const { track, deps } = fakes();
    await expect(
      startKidsRecording({
        ...deps,
        createRecorder: () => {
          throw new Error("no recorder");
        },
      }),
    ).rejects.toMatchObject({ code: "unsupported" });
    expect(track.stopped).toBe(1);
  });

  it("releases the microphone when the recorder fails to start, errors, or records nothing", async () => {
    const failing = fakes({ startFails: true });
    const start = await startKidsRecording(failing.deps);
    await expect(start.result).rejects.toMatchObject({ code: "failed" });
    expect(failing.track.stopped).toBe(1);
    const silent = fakes({ data: [] });
    const recording = await startKidsRecording(silent.deps);
    recording.stop();
    await expect(recording.result).rejects.toMatchObject({ code: "empty" });
    expect(silent.track.stopped).toBe(1);
    const broken = fakes();
    const errored = await startKidsRecording(broken.deps);
    broken.recorder.onerror?.();
    await expect(errored.result).rejects.toMatchObject({ code: "failed" });
    expect(broken.track.stopped).toBe(1);
  });

  it("the permission is off until an adult turns it on, and off again removes it", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    expect(microphoneAllowed(store)).toBe(false);
    setMicrophoneAllowed(true, store);
    expect(microphoneAllowed(store)).toBe(true);
    setMicrophoneAllowed(false, store);
    expect(microphoneAllowed(store)).toBe(false);
    expect([...data.keys()]).toEqual([]);
    expect(microphoneAllowed(undefined)).toBe(false);
    data.set("agorix.kids.microphone.v1", "yes");
    expect(microphoneAllowed(store)).toBe(false);
  });

  it("the recorder module has no way to send or keep a recording", () => {
    const source = readFileSync(new URL("./kidsRecorder.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|indexedDB|createObjectURL|FileReader|\.setItem\([^)]*(blob|chunks|audio)/i,
    );
  });
});
