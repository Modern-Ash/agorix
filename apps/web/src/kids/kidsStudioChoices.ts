/**
 * Closed value lists of the free scene (issue #1133). `checked` in `kidsStudioModel.ts` validates
 * with these and the palette offers exactly these, so a value can no longer be on screen without
 * being valid, nor valid and unreachable.
 */
export const STUDIO_WAIT_SECONDS = [0.5, 1, 2, 3] as const;
export const STUDIO_SIZES = [50, 75, 100, 125, 150] as const;
export const STUDIO_SIZE_DELTAS = [-50, -25, 25, 50] as const;
export const STUDIO_REPEAT_COUNTS = [2, 3, 5] as const;
export const STUDIO_EFFECT_DELTAS = [-25, 25] as const;
export const STUDIO_BRIGHTNESS_VALUES = [-50, -25, 0, 25, 50] as const;
export const STUDIO_LEVEL_VALUES = [0, 25, 50, 75, 100] as const;
export const STUDIO_TURN_AMOUNTS = [45, 90, 180] as const;
export const STUDIO_POINT_DIRECTIONS = [0, 90, 180, -90] as const;
/** Palette moves in whole cells of 40 steps; the model accepts any multiple of 20 up to 200. */
export const STUDIO_MOVE_CELLS = [1, 2, 3, 4, 5] as const;

export function studioEffectValues(effect: "color" | "ghost" | "brightness"): readonly number[] {
  return effect === "brightness" ? STUDIO_BRIGHTNESS_VALUES : STUDIO_LEVEL_VALUES;
}
