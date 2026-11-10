import type { KidsAvatarRef } from "./kidsProjects.js";
import { loadKidsAudio } from "./kidsAudio.js";
import { isStudioRecordedSoundId } from "./kidsStudioModel.js";
import {
  KIDS_CUSTOM_SOUND_ID,
  soundParameters,
  type SoundNoise,
  type SoundParameters,
} from "./kidsSoundLibrary.js";

interface SoundDependencies {
  readonly createContext?: () => AudioContext;
  readonly loadCustom?: (actor: KidsAvatarRef) => Promise<Blob | undefined>;
  readonly volume?: number;
  /** The project's recording for a `sound:recorded-N` id, as its data URL; undefined when absent. */
  readonly recorded?: (id: string) => string | undefined;
}

/** The bytes of a data URL's base64 payload, or undefined when it is not one. */
function bytesOfDataUrl(source: string): ArrayBuffer | undefined {
  const comma = source.indexOf(",");
  if (!source.startsWith("data:") || comma < 0) return undefined;
  try {
    const text = atob(source.slice(comma + 1));
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
    return bytes.buffer;
  } catch {
    return undefined;
  }
}

const activeContexts = new Set<AudioContext>();

export function stopKidsSounds(): void {
  for (const context of activeContexts) void context.close().catch(() => undefined);
  activeContexts.clear();
}

function closeWhenEnded(node: OscillatorNode | AudioBufferSourceNode, context: AudioContext): void {
  node.onended = () => {
    activeContexts.delete(context);
    void context.close().catch(() => undefined);
  };
}

function envelope(gain: GainNode, context: AudioContext, peak: number, d: number, attack = 0) {
  const t = context.currentTime;
  if (attack > 0) {
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  } else {
    gain.gain.setValueAtTime(peak, t);
  }
  gain.gain.exponentialRampToValueAtTime(0.001, t + d);
}

function synthNoise(
  context: AudioContext,
  sound: SoundParameters,
  noise: SoundNoise,
  volume: number,
): void {
  const length = Math.ceil(context.sampleRate * sound.duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = noise.filter;
  filter.Q.value = noise.q;
  filter.frequency.setValueAtTime(noise.startHz, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(noise.endHz, context.currentTime + sound.duration);
  envelope(gain, context, sound.gain * volume, sound.duration, noise.attack);
  source.connect(filter).connect(gain).connect(context.destination);
  closeWhenEnded(source, context);
  source.start();
}

function synth(context: AudioContext, id: string, volume: number): void {
  const sound = soundParameters(id);
  if (sound.noise) return synthNoise(context, sound, sound.noise, volume);
  const ratios = sound.partials ?? [1];
  const t = context.currentTime;
  const step = sound.notes ? sound.duration / sound.notes.length : 0;
  ratios.forEach((ratio, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = sound.wave;
    if (sound.notes) {
      sound.notes.forEach((hz, i) => oscillator.frequency.setValueAtTime(hz * ratio, t + i * step));
    } else {
      oscillator.frequency.setValueAtTime(sound.startHz * ratio, t);
      oscillator.frequency.exponentialRampToValueAtTime(sound.endHz * ratio, t + sound.duration);
    }
    if (sound.vibrato) {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.setValueAtTime(sound.vibrato.hz, t);
      depth.gain.setValueAtTime(sound.vibrato.depth * ratio, t);
      lfo.connect(depth).connect(oscillator.frequency);
      lfo.start();
      lfo.stop(t + sound.duration);
    }
    // Higher overtones fade sooner, like a struck bell.
    const d = sound.duration / (1 + index * 0.6);
    envelope(gain, context, (sound.gain * volume) / (1 + index), d);
    oscillator.connect(gain).connect(context.destination);
    if (index === 0) closeWhenEnded(oscillator, context);
    oscillator.start();
    oscillator.stop(t + sound.duration);
  });
}

/** Audio is presentation only. A failed device, missing asset or decode never changes runtime evidence. */
export async function playKidsSound(
  id: string,
  actor: KidsAvatarRef,
  deps: SoundDependencies = {},
): Promise<void> {
  let context: AudioContext | undefined;
  const requestedVolume = deps.volume ?? 100;
  const volume = Number.isFinite(requestedVolume)
    ? Math.max(0, Math.min(100, requestedVolume)) / 100
    : 1;
  if (volume === 0) return;
  try {
    context = (deps.createContext ?? (() => new AudioContext()))();
    activeContexts.add(context);
    if (isStudioRecordedSoundId(id)) {
      // A recording kept in the project. If it cannot be played, the run just stays quiet.
      const source = deps.recorded?.(id);
      const data = source === undefined ? undefined : bytesOfDataUrl(source);
      try {
        if (data) {
          const buffer = await context.decodeAudioData(data);
          const player = context.createBufferSource();
          const gain = context.createGain();
          gain.gain.setValueAtTime(volume, context.currentTime);
          player.buffer = buffer;
          player.connect(gain).connect(context.destination);
          closeWhenEnded(player, context);
          player.start();
          return;
        }
      } catch {
        // A recording that will not decode is left silent.
      }
      activeContexts.delete(context);
      await context.close().catch(() => undefined);
      return;
    }
    if (id === KIDS_CUSTOM_SOUND_ID) {
      try {
        const blob = await (deps.loadCustom ?? loadKidsAudio)(actor);
        if (blob) {
          const buffer = await context.decodeAudioData(await blob.arrayBuffer());
          const source = context.createBufferSource();
          const gain = context.createGain();
          gain.gain.setValueAtTime(volume, context.currentTime);
          source.buffer = buffer;
          source.connect(gain).connect(context.destination);
          closeWhenEnded(source, context);
          source.start();
          return;
        }
      } catch {
        // A corrupt or unavailable local asset falls back to the default tone.
      }
      synth(context, "kids-tone", volume);
    } else {
      synth(context, id, volume);
    }
  } catch {
    // Muted or blocked AudioContext must never interrupt the child's run.
    if (context) {
      activeContexts.delete(context);
      await context.close().catch(() => undefined);
    }
  }
}
