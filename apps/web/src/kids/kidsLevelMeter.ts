// agora-allowlist-file: the one microphone level meter (issue #1304, docs/safety/VOICE_RECORDINGS.md); the baseline refuses the microphone in any other file.

/**
 * Microphone level for the "loudness" value of a running program (issue #1304). It measures how
 * loud it is as ONE whole number from 0 to 100 and keeps nothing else: no samples, no recording, no
 * storage, no network. It asks only after an adult turned on its own switch in the grown-ups area
 * (separate from the recording switch), starts only while a program that uses loudness is playing,
 * and releases the microphone the moment play ends. The sound never leaves the audio graph.
 */
export interface LevelMeter {
  /** The loudness now, a whole number from 0 to 100. */
  read(): number;
  /** Releases the microphone; `read` is 0 afterwards. */
  stop(): void;
}

export interface LevelMeterDependencies {
  readonly getStream?: () => Promise<MediaStream>;
  readonly createContext?: () => AudioContext;
}

const KEY = "agorix.kids.microphoneLevel.v1";

/** Loudness of a block of samples (-1 to 1): the root mean square, scaled so speech reads high. */
export function levelFromSamples(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Number(samples[i]);
    if (Number.isFinite(value)) sum += value * value;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.max(0, Math.min(100, Math.round(rms * 300)));
}

/** The adult's permission to measure the level while a program plays; off until turned on. */
export function microphoneLevelAllowed(
  store: Pick<Storage, "getItem"> | undefined = browserStore(),
): boolean {
  try {
    return store?.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setMicrophoneLevelAllowed(
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

function release(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // A track that is already gone needs nothing more.
    }
  }
}

/**
 * Starts measuring. Resolves to null when the device has no microphone or the browser refuses: the
 * program then runs with loudness 0, never with an error in a child's way.
 */
export async function startLevelMeter(
  deps: LevelMeterDependencies = {},
): Promise<LevelMeter | null> {
  let stream: MediaStream;
  try {
    const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!deps.getStream && (!devices || typeof AudioContext === "undefined")) return null;
    stream = await (deps.getStream ?? (() => devices!.getUserMedia({ audio: true })))();
  } catch {
    return null;
  }
  let context: AudioContext;
  let analyser: AnalyserNode;
  try {
    context = (deps.createContext ?? (() => new AudioContext()))();
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
  } catch {
    release(stream);
    return null;
  }
  const buffer = new Float32Array(analyser.fftSize);
  let stopped = false;
  return {
    read() {
      if (stopped) return 0;
      analyser.getFloatTimeDomainData(buffer);
      return levelFromSamples(buffer);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      release(stream);
      void context.close().catch(() => undefined);
    },
  };
}
