import type { LibraryAsset } from "./assetLibrary";

/** Plays a library sound as a short synthesized tone. Silently does nothing without Web Audio. */
export function previewSound(asset: LibraryAsset): boolean {
  const tone = asset.tone;
  const Context =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (tone === undefined || Context === undefined) return false;
  try {
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = tone.hz;
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + tone.ms / 1000);
    oscillator.onended = () => void context.close();
    return true;
  } catch {
    return false;
  }
}
