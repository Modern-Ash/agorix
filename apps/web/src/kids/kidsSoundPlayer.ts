import type { KidsAvatarRef } from "./kidsProjects.js";
import { loadKidsAudio } from "./kidsAudio.js";
import { KIDS_CUSTOM_SOUND_ID, soundParameters } from "./kidsSoundLibrary.js";

interface SoundDependencies {
  readonly createContext?: () => AudioContext;
  readonly loadCustom?: (actor: KidsAvatarRef) => Promise<Blob | undefined>;
}

function closeWhenEnded(node: OscillatorNode | AudioBufferSourceNode, context: AudioContext): void {
  node.onended = () => void context.close().catch(() => undefined);
}

function synth(context: AudioContext, id: string): void {
  const sound = soundParameters(id);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = sound.wave;
  oscillator.frequency.setValueAtTime(sound.startHz, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    sound.endHz,
    context.currentTime + sound.duration,
  );
  gain.gain.setValueAtTime(sound.gain, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + sound.duration);
  oscillator.connect(gain).connect(context.destination);
  closeWhenEnded(oscillator, context);
  oscillator.start();
  oscillator.stop(context.currentTime + sound.duration);
}

/** Audio is presentation only. A failed device, missing asset or decode never changes runtime evidence. */
export async function playKidsSound(
  id: string,
  actor: KidsAvatarRef,
  deps: SoundDependencies = {},
): Promise<void> {
  let context: AudioContext | undefined;
  try {
    context = (deps.createContext ?? (() => new AudioContext()))();
    if (id === KIDS_CUSTOM_SOUND_ID) {
      try {
        const blob = await (deps.loadCustom ?? loadKidsAudio)(actor);
        if (blob) {
          const buffer = await context.decodeAudioData(await blob.arrayBuffer());
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          closeWhenEnded(source, context);
          source.start();
          return;
        }
      } catch {
        // A corrupt or unavailable local asset falls back to the default tone.
      }
      synth(context, "kids-tone");
    } else {
      synth(context, id);
    }
  } catch {
    // Muted or blocked AudioContext must never interrupt the child's run.
    if (context) await context.close().catch(() => undefined);
  }
}
