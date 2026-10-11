const MAX_GAIN = 0.05;

/** Gain for the synthetic stage cue: full volume (or unset) keeps the original 0.05 ceiling. */
export function soundCueGain(volume: number | undefined): number {
  const clamped = Math.min(100, Math.max(0, volume ?? 100));
  return (MAX_GAIN * clamped) / 100;
}
