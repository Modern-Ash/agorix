import type { ExecutionTraceEntry } from "@agorix/runtime";
import { soundParameters } from "./kidsSoundLibrary.js";

/** Longest tune the speaker plays and most events scheduled, so a loop can never run away. */
export const MUSIC_MAX_SECONDS = 30;
export const MUSIC_MAX_EVENTS = 64;

export type MusicEvent =
  | {
      readonly kind: "sound";
      readonly at: number;
      readonly soundId: string;
      readonly pitch: number;
      readonly pan: number;
      readonly volume: number;
    }
  | {
      readonly kind: "note";
      readonly at: number;
      readonly seconds: number;
      readonly midi: number;
      readonly instrument: string;
      readonly pitch: number;
      readonly pan: number;
      readonly volume: number;
    }
  | {
      readonly kind: "drum";
      readonly at: number;
      readonly seconds: number;
      readonly drum: string;
      readonly pan: number;
      readonly volume: number;
    };

export function frequencyOf(midi: number, pitch: number): number {
  return 440 * 2 ** ((midi + pitch - 69) / 12);
}

/**
 * Turns the executed trace into a timeline. The runtime trace is the proof: each note or drum
 * lasts its beats at the tempo then and the next one starts after it ("play until done"). A sound
 * block in a project that uses music waits for its own length too. Programs without music keep
 * their old behaviour and return an empty plan.
 */
export function planMusic(trace: readonly ExecutionTraceEntry[]): readonly MusicEvent[] {
  const events: MusicEvent[] = [];
  let clock = 0;
  const usesMusic = trace.some((entry) => entry.audio !== undefined);
  for (const entry of trace) {
    // Before the first music block a plain sound has no audio yet: default pitch and pan.
    const audio =
      entry.audio ??
      (usesMusic && entry.statementType === "playSound"
        ? { instrument: "piano" as const, pitch: 0, pan: 0 }
        : undefined);
    if (!audio) continue;
    if (events.length >= MUSIC_MAX_EVENTS || clock >= MUSIC_MAX_SECONDS) break;
    const volume = (entry.worldAfter.sounds?.volume ?? 100) / 100;
    if (audio.note !== undefined && audio.seconds !== undefined) {
      events.push({
        kind: "note",
        at: clock,
        seconds: audio.seconds,
        midi: audio.note,
        instrument: audio.instrument,
        pitch: audio.pitch,
        pan: audio.pan,
        volume,
      });
      clock += audio.seconds;
    } else if (audio.drum !== undefined && audio.seconds !== undefined) {
      events.push({
        kind: "drum",
        at: clock,
        seconds: audio.seconds,
        drum: audio.drum,
        pan: audio.pan,
        volume,
      });
      clock += audio.seconds;
    } else if (entry.statementType === "playSound") {
      const soundId = entry.soundId ?? "kids-tone";
      events.push({
        kind: "sound",
        at: clock,
        soundId,
        pitch: audio.pitch,
        pan: audio.pan,
        volume,
      });
      clock += soundParameters(soundId).duration;
    }
  }
  return events;
}

interface MusicDependencies {
  readonly createContext?: () => AudioContext;
}

let active: AudioContext | undefined;

export function stopKidsMusic(): void {
  if (active) void active.close().catch(() => undefined);
  active = undefined;
}

function noise(context: AudioContext, seconds: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // A fixed pattern, not Math.random, so a drum sounds the same every time.
  let seed = 12345;
  for (let index = 0; index < length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[index] = (seed / 0xffffffff) * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  return source;
}

function route(context: AudioContext, gain: GainNode, pan: number): void {
  if (typeof context.createStereoPanner === "function") {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan / 100));
    gain.connect(panner).connect(context.destination);
  } else gain.connect(context.destination);
}

const WAVES: Record<string, OscillatorType> = {
  piano: "triangle",
  flute: "sine",
  guitar: "sawtooth",
  bell: "sine",
};

function schedule(context: AudioContext, event: MusicEvent, base: number): void {
  const start = base + event.at;
  const gain = context.createGain();
  route(context, gain, event.pan);
  if (event.kind === "drum") {
    const length = Math.min(event.seconds, 0.3);
    if (event.drum === "kick") {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(150, start);
      oscillator.frequency.exponentialRampToValueAtTime(45, start + length);
      gain.gain.setValueAtTime(0.25 * event.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + length);
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + length);
      return;
    }
    const source = noise(context, length);
    const filter = context.createBiquadFilter();
    filter.type = event.drum === "hat" ? "highpass" : "bandpass";
    filter.frequency.value = event.drum === "hat" ? 7000 : event.drum === "snare" ? 1800 : 1200;
    const level = event.drum === "hat" ? 0.08 : 0.16;
    gain.gain.setValueAtTime(level * event.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + (event.drum === "hat" ? 0.06 : length));
    source.connect(filter).connect(gain);
    source.start(start);
    source.stop(start + length);
    return;
  }
  const oscillator = context.createOscillator();
  if (event.kind === "sound") {
    const sound = soundParameters(event.soundId);
    const detune = 2 ** (event.pitch / 12);
    oscillator.type = sound.wave;
    oscillator.frequency.setValueAtTime(sound.startHz * detune, start);
    oscillator.frequency.exponentialRampToValueAtTime(sound.endHz * detune, start + sound.duration);
    gain.gain.setValueAtTime(sound.gain * event.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + sound.duration);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + sound.duration);
    return;
  }
  oscillator.type = WAVES[event.instrument] ?? "sine";
  oscillator.frequency.setValueAtTime(frequencyOf(event.midi, event.pitch), start);
  const length = Math.max(0.05, event.seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.12 * event.volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    start + length * (event.instrument === "bell" ? 1.4 : 0.95),
  );
  oscillator.connect(gain);
  oscillator.start(start);
  oscillator.stop(start + length * 1.4);
}

/** Audio is presentation only: a blocked or failing device never changes the run's evidence. */
export function playKidsMusic(
  trace: readonly ExecutionTraceEntry[],
  deps: MusicDependencies = {},
): number {
  const plan = planMusic(trace);
  if (plan.length === 0) return 0;
  try {
    stopKidsMusic();
    const context = (deps.createContext ?? (() => new AudioContext()))();
    active = context;
    const base = context.currentTime + 0.05;
    for (const event of plan) schedule(context, event, base);
    const last = plan.at(-1)!;
    const end = last.at + ("seconds" in last ? last.seconds : 0.5) + 0.6;
    setTimeout(() => {
      if (active === context) stopKidsMusic();
    }, end * 1000);
  } catch {
    stopKidsMusic();
  }
  return plan.length;
}

const SOLFEGE = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** "Do 4" / "C4": the name a child sees for a MIDI note. */
export function noteName(midi: number, locale: "es" | "en"): string {
  const octave = Math.floor(midi / 12) - 1;
  return locale === "es" ? `${SOLFEGE[midi % 12]} ${octave}` : `${LETTERS[midi % 12]}${octave}`;
}
