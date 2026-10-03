import { DEFAULT_WORLD_ID, WORLDS } from "@agorix/curriculum";

/**
 * Per-device presentation state. It lives under its own key, never inside the
 * stored project, so it cannot change the canonical program or its hash.
 */
export interface PresentationPrefs {
  readonly worldId: string;
  /** Repeat suggestions the learner declined; System-0 goes quiet at 2. */
  readonly repeatDeclines: number;
}

export const PRESENTATION_PREFS_KEY = "agorix:presentation";
export const DEFAULT_PRESENTATION_PREFS: PresentationPrefs = {
  worldId: DEFAULT_WORLD_ID,
  repeatDeclines: 0,
};

const MAX_DECLINES = 10;

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadPresentationPrefs(
  storage: Storage | undefined = defaultStorage(),
): PresentationPrefs {
  try {
    const raw = storage?.getItem(PRESENTATION_PREFS_KEY);
    if (raw === null || raw === undefined) return DEFAULT_PRESENTATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof PresentationPrefs, unknown>>;
    const worldId =
      typeof parsed.worldId === "string" && WORLDS.some((world) => world.id === parsed.worldId)
        ? parsed.worldId
        : DEFAULT_PRESENTATION_PREFS.worldId;
    const declines =
      typeof parsed.repeatDeclines === "number" && Number.isFinite(parsed.repeatDeclines)
        ? Math.min(MAX_DECLINES, Math.max(0, Math.trunc(parsed.repeatDeclines)))
        : 0;
    return { worldId, repeatDeclines: declines };
  } catch {
    return DEFAULT_PRESENTATION_PREFS;
  }
}

export function savePresentationPrefs(
  prefs: PresentationPrefs,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(PRESENTATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Presentation state is a convenience; losing it must never break the app.
  }
}
