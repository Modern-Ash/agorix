// agora-allowlist-file: the one supervised voice recorder (issue #622, docs/safety/VOICE_RECORDINGS.md); the baseline refuses the microphone in any other file.
import { samplesFromChannels } from "./kidsSoundEdit.js";

/**
 * Supervised voice recording (issue #622, docs/safety/VOICE_RECORDINGS.md). This is the only module
 * that reaches the microphone, and the security baseline enforces it. It asks only when an adult
 * presses Record in the grown-ups area, records at most five seconds, releases the microphone the
 * moment it stops or fails, and hands back the sound to the caller: nothing is stored or sent here.
 */
export const RECORDING_MAX_MS = 5_000;

export type RecordingErrorCode = "unsupported" | "denied" | "failed" | "empty";

export class RecordingError extends Error {
  constructor(readonly code: RecordingErrorCode) {
    super(code);
    this.name = "RecordingError";
  }
}

export interface RecorderDependencies {
  readonly getStream?: () => Promise<MediaStream>;
  readonly createRecorder?: (stream: MediaStream) => MediaRecorder;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface KidsRecording {
  /** Ends the recording now; the sound still arrives through `result`. */
  stop(): void;
  readonly result: Promise<Blob>;
}

function defaultStream(): Promise<MediaStream> {
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!devices || typeof MediaRecorder === "undefined") {
    return Promise.reject(new RecordingError("unsupported"));
  }
  return devices.getUserMedia({ audio: true });
}

function release(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // A track that is already gone needs nothing more.
    }
  }
}

/** Starts recording. Rejects when the device has no microphone, or the adult declines the prompt. */
export async function startKidsRecording(deps: RecorderDependencies = {}): Promise<KidsRecording> {
  let stream: MediaStream;
  try {
    stream = await (deps.getStream ?? defaultStream)();
  } catch (error) {
    if (error instanceof RecordingError) throw error;
    const name = (error as { name?: string } | null)?.name;
    throw new RecordingError(
      name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed",
    );
  }
  let recorder: MediaRecorder;
  try {
    recorder = (deps.createRecorder ?? ((source) => new MediaRecorder(source)))(stream);
  } catch {
    release(stream);
    throw new RecordingError("unsupported");
  }
  const chunks: Blob[] = [];
  const setTimer = deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as number));
  const timer: { handle?: unknown } = {};
  let finished = false;
  const result = new Promise<Blob>((resolve, reject) => {
    const finish = (action: () => void) => {
      if (finished) return;
      finished = true;
      if (timer.handle !== undefined) clearTimer(timer.handle);
      release(stream);
      action();
    };
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => finish(() => reject(new RecordingError("failed")));
    recorder.onstop = () =>
      finish(() => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) reject(new RecordingError("empty"));
        else resolve(blob);
      });
    try {
      recorder.start();
    } catch {
      finish(() => reject(new RecordingError("failed")));
    }
  });
  const stop = () => {
    if (finished) return;
    try {
      if (recorder.state !== "inactive") recorder.stop();
      else release(stream);
    } catch {
      release(stream);
    }
  };
  timer.handle = setTimer(stop, RECORDING_MAX_MS);
  return { stop, result };
}

/** The recorded sound as editable samples, at most five seconds. Nothing leaves the device. */
export async function decodeKidsRecording(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_value, index) =>
      decoded.getChannelData(index),
    );
    return samplesFromChannels(channels, decoded.sampleRate);
  } finally {
    await context.close().catch(() => undefined);
  }
}

const KEY = "agorix.kids.microphone.v1";

/**
 * The adult's permission, kept on this device and off until an adult turns it on in the grown-ups
 * area. Turning it off removes the Record buttons; recordings already saved are removed from the
 * same panel like any other audio.
 */
export function microphoneAllowed(
  store: Pick<Storage, "getItem"> | undefined = browserStore(),
): boolean {
  try {
    return store?.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setMicrophoneAllowed(
  allowed: boolean,
  store: Pick<Storage, "setItem" | "removeItem"> | undefined = browserStore(),
): void {
  try {
    if (allowed) store?.setItem(KEY, "on");
    else store?.removeItem(KEY);
  } catch {
    // Without storage the permission simply stays off.
  }
}

function browserStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
