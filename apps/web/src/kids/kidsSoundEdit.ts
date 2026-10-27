/**
 * A small, reversible sound editor over plain samples. It runs entirely on the device: decoded
 * audio goes in, a clean mono WAV comes out, and every step can be undone. Limits keep the memory
 * of an edit session small (a few seconds of mono samples and a short history).
 */
export const SOUND_EDIT_RATE = 22_050;
export const SOUND_EDIT_MAX_SECONDS = 5;
export const SOUND_EDIT_MAX_SAMPLES = SOUND_EDIT_RATE * SOUND_EDIT_MAX_SECONDS;
export const SOUND_EDIT_MIN_SAMPLES = Math.floor(SOUND_EDIT_RATE * 0.1);
export const SOUND_EDIT_HISTORY = 12;

export type SoundEdit =
  | { readonly kind: "trim"; readonly start: number; readonly end: number }
  | { readonly kind: "reverse" }
  | { readonly kind: "fadeIn" }
  | { readonly kind: "fadeOut" }
  | { readonly kind: "louder" }
  | { readonly kind: "quieter" }
  | { readonly kind: "faster" }
  | { readonly kind: "slower" };

export interface SoundEditorState {
  readonly past: readonly Float32Array[];
  readonly present: Float32Array;
  readonly future: readonly Float32Array[];
}

/** Mono samples at the editor rate; longer input is cut at five seconds. */
export function samplesFromChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
): Float32Array {
  if (channels.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return new Float32Array(0);
  }
  const length = Math.min(...channels.map((channel) => channel.length));
  const mono = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[index] ?? 0;
    mono[index] = sum / channels.length;
  }
  return limit(resample(mono, sampleRate / SOUND_EDIT_RATE));
}

/** `ratio` > 1 plays faster (fewer samples). Linear interpolation, deterministic. */
function resample(samples: Float32Array, ratio: number): Float32Array {
  if (ratio === 1) return samples;
  const length = Math.max(0, Math.floor(samples.length / ratio));
  const out = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const fraction = position - left;
    const a = samples[left] ?? 0;
    const b = samples[left + 1] ?? a;
    out[index] = a + (b - a) * fraction;
  }
  return out;
}

function limit(samples: Float32Array): Float32Array {
  return samples.length > SOUND_EDIT_MAX_SAMPLES
    ? samples.slice(0, SOUND_EDIT_MAX_SAMPLES)
    : samples;
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** The result of one edit, or `null` when it would not change anything allowed. */
export function applySoundEdit(samples: Float32Array, edit: SoundEdit): Float32Array | null {
  switch (edit.kind) {
    case "trim": {
      const start = Math.max(0, Math.floor(edit.start));
      const end = Math.min(samples.length, Math.floor(edit.end));
      if (!(end - start >= SOUND_EDIT_MIN_SAMPLES)) return null;
      if (start === 0 && end === samples.length) return null;
      return samples.slice(start, end);
    }
    case "reverse":
      return Float32Array.from(samples).reverse();
    case "fadeIn":
    case "fadeOut": {
      const fade = Math.min(samples.length, Math.floor(SOUND_EDIT_RATE * 0.3));
      const out = Float32Array.from(samples);
      for (let index = 0; index < fade; index += 1) {
        const weight = index / fade;
        if (edit.kind === "fadeIn") out[index] = (out[index] ?? 0) * weight;
        else out[out.length - 1 - index] = (out[out.length - 1 - index] ?? 0) * weight;
      }
      return out;
    }
    case "louder":
    case "quieter": {
      const factor = edit.kind === "louder" ? 1.5 : 0.6;
      return samples.map((value) => clamp(value * factor));
    }
    case "faster":
    case "slower": {
      const next = resample(samples, edit.kind === "faster" ? 1.25 : 0.8);
      return next.length < SOUND_EDIT_MIN_SAMPLES ? null : limit(next);
    }
  }
}

export function createSoundEditor(samples: Float32Array): SoundEditorState {
  return { past: [], present: limit(samples), future: [] };
}

export function editSound(state: SoundEditorState, edit: SoundEdit): SoundEditorState {
  const next = applySoundEdit(state.present, edit);
  if (next === null) return state;
  return {
    past: [...state.past, state.present].slice(-SOUND_EDIT_HISTORY),
    present: next,
    future: [],
  };
}

export function undoSound(state: SoundEditorState): SoundEditorState {
  const previous = state.past.at(-1);
  if (!previous) return state;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, SOUND_EDIT_HISTORY),
  };
}

export function redoSound(state: SoundEditorState): SoundEditorState {
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, state.present].slice(-SOUND_EDIT_HISTORY),
    present: next,
    future: state.future.slice(1),
  };
}

export function soundSeconds(samples: Float32Array): number {
  return Math.round((samples.length / SOUND_EDIT_RATE) * 100) / 100;
}

/** Loudness per slice, 0 to 1, for drawing the wave. */
export function waveformPeaks(samples: Float32Array, bins = 48): readonly number[] {
  if (samples.length === 0) return Array.from({ length: bins }, () => 0);
  const size = Math.max(1, Math.floor(samples.length / bins));
  return Array.from({ length: bins }, (_value, bin) => {
    let peak = 0;
    for (let index = bin * size; index < Math.min(samples.length, (bin + 1) * size); index += 1) {
      peak = Math.max(peak, Math.abs(samples[index] ?? 0));
    }
    return Math.round(peak * 100) / 100;
  });
}

/** 16-bit mono PCM WAV: no metadata, no file name, nothing but the sound. */
export function encodeWav(samples: Float32Array): Blob {
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      data.setUint8(at + index, value.charCodeAt(index));
    }
  };
  text(0, "RIFF");
  data.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, SOUND_EDIT_RATE, true);
  data.setUint32(28, SOUND_EDIT_RATE * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  text(36, "data");
  data.setUint32(40, samples.length * 2, true);
  samples.forEach((value, index) => {
    data.setInt16(44 + index * 2, Math.round(clamp(value) * 32767), true);
  });
  return new Blob([data.buffer], { type: "audio/wav" });
}
