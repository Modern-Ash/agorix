import type { AssetView } from "@agorix/studio-protocol";
import { ADVANCED_SOUNDS } from "@agorix/curriculum";

/** Only known, bundled identifiers may request local audio. Never load project URLs. */
export function canPreviewSound(asset: AssetView): boolean {
  return asset.kind === "sound" && ADVANCED_SOUNDS.some((sound) => sound.source === asset.source);
}

/** Audio is presentation only; failure never changes program or runtime evidence. */
export function playSoundPreview(
  asset: AssetView,
  createContext: () => AudioContext = () => new AudioContext(),
): boolean {
  if (!canPreviewSound(asset)) return false;
  const sound = ADVANCED_SOUNDS.find((item) => item.source === asset.source)!;
  let context: AudioContext | undefined;
  try {
    context = createContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = sound.wave;
    oscillator.frequency.value = sound.frequencyHz;
    gain.gain.value = sound.gain;
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => void context?.close().catch(() => undefined);
    oscillator.start();
    oscillator.stop(context.currentTime + sound.durationMs / 1000);
    return true;
  } catch {
    if (context !== undefined) void context.close().catch(() => undefined);
    return false;
  }
}
