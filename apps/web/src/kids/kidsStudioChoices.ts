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
/** Sideways or vertical nudges of the "change x / change y" blocks, in stage units. */
export const STUDIO_SHIFT_AMOUNTS = [-80, -40, -20, 20, 40, 80] as const;
export const STUDIO_POINT_DIRECTIONS = [0, 90, 180, -90] as const;
/** Palette moves in whole cells of 40 steps; the model accepts any multiple of 20 up to 200. */
export const STUDIO_MOVE_CELLS = [1, 2, 3, 4, 5] as const;

export function studioEffectValues(effect: "color" | "ghost" | "brightness"): readonly number[] {
  return effect === "brightness" ? STUDIO_BRIGHTNESS_VALUES : STUDIO_LEVEL_VALUES;
}

/** Bounded numeric inputs: the validator checks `inRange`, the palette passes the same bounds to the input. */
export interface StudioRange {
  readonly min: number;
  readonly max: number;
}
export const STUDIO_X_RANGE: StudioRange = { min: 0, max: 320 };
export const STUDIO_Y_RANGE: StudioRange = { min: -100, max: 120 };
export const STUDIO_VOLUME_RANGE: StudioRange = { min: 0, max: 100 };
export const STUDIO_VOLUME_DELTA_RANGE: StudioRange = { min: -100, max: 100 };
/** Free text a child types into a bubble or a name. */
export const STUDIO_BUBBLE_MAX_LENGTH = 80;
export const STUDIO_NAME_MAX_LENGTH = 20;

export function inStudioRange(value: number, range: StudioRange): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

/**
 * The keys a program can wait for or ask about: space, the arrows, Enter, every letter and every
 * digit, as Scratch offers. A letter is written in lower case and a digit as itself, so the same
 * key is the same string for a block, a held key and a pressed key.
 */
export const STUDIO_KEYS = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
] as const;
export type StudioKey = (typeof STUDIO_KEYS)[number];

export function isStudioKey(value: unknown): value is StudioKey {
  return (STUDIO_KEYS as readonly unknown[]).includes(value);
}

/** The Studio key a physical key press is, or null when it is not one the Studio offers. */
export function studioKeyOfEvent(event: {
  readonly code: string;
  readonly key: string;
}): StudioKey | null {
  const key =
    event.code === "Space" ? "Space" : event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return isStudioKey(key) ? key : null;
}

/** A key as a child reads it: letters and digits in capitals, the rest by their names. */
export function studioKeyLabel(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}
