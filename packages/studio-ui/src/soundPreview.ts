import type { AssetView } from "@agorix/studio-protocol";

/** Studio's bundled beacon is the short tone used by the advanced Web scene. */
export function canPreviewSound(asset: AssetView): boolean {
  return asset.kind === "sound" && asset.source === "builtin:sound.beacon";
}

/** Audio is presentation only; failure never changes program or runtime evidence. */
export function playSoundPreview(
  asset: AssetView,
  createContext: () => AudioContext = () => new AudioContext(),
): boolean {
  if (!canPreviewSound(asset)) return false;
  let context: AudioContext | undefined;
  try {
    context = createContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 520;
    gain.gain.value = 0.06;
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => void context?.close().catch(() => undefined);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    return true;
  } catch {
    if (context !== undefined) void context.close().catch(() => undefined);
    return false;
  }
}
