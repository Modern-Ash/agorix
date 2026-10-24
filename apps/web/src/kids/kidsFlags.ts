import { useSyncExternalStore } from "react";

export const KIDS_V2_FEATURES = [
  "duplicate",
  "zoom",
  "contextMenu",
  "shortcuts",
  "puzzleShape",
  "ageBands",
  "customImages",
  "soundLibrary",
  "customAudio",
  "oriFloat",
  "tutorial",
  "advancedOps",
  "adultLink",
] as const;

export type KidsV2Feature = (typeof KIDS_V2_FEATURES)[number];

export const KIDS_FLAGS_KEY = "agorix.kids.flags.v1";
const FLAGS_CHANGED = "agorix:kids-flags-changed";
// Creative Kids tools are visible by default. Account linking needs a live
// verification service and remains a separate operational release.
const DEFAULT_FEATURES: readonly KidsV2Feature[] = KIDS_V2_FEATURES.filter(
  (feature) => feature !== "adultLink",
);

export interface KidsFlagSources {
  readonly search?: string;
  readonly storage?: Pick<Storage, "getItem">;
  /** Production builds ignore the query parameter. */
  readonly production?: boolean;
}

function keep(names: readonly unknown[]): ReadonlySet<KidsV2Feature> {
  return new Set(
    names.filter((name): name is KidsV2Feature =>
      (KIDS_V2_FEATURES as readonly unknown[]).includes(name),
    ),
  );
}

function stored(storage: KidsFlagSources["storage"]): readonly unknown[] {
  try {
    const raw = storage?.getItem(KIDS_FLAGS_KEY);
    if (raw === null || raw === undefined) return DEFAULT_FEATURES;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Approved defaults apply to a new browser; an explicit stored list can roll them back. */
export function kidsV2Features(sources: KidsFlagSources = {}): ReadonlySet<KidsV2Feature> {
  const names: unknown[] = [...stored(sources.storage)];
  if (sources.production !== true) {
    const query = new URLSearchParams(sources.search ?? "").get("kidsv2");
    if (query) names.push(...query.split(","));
  }
  return keep(names);
}

export function kidsV2Enabled(feature: KidsV2Feature, sources: KidsFlagSources = {}): boolean {
  return kidsV2Features(sources).has(feature);
}

export function setKidsV2Feature(
  feature: KidsV2Feature,
  enabled: boolean,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    const next = kidsV2Features({ storage, production: true });
    const names = new Set(next);
    if (enabled) names.add(feature);
    else names.delete(feature);
    storage.setItem(KIDS_FLAGS_KEY, JSON.stringify([...names]));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(FLAGS_CHANGED));
    return true;
  } catch {
    return false;
  }
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function browserSources(): KidsFlagSources {
  try {
    return {
      search: window.location.search,
      storage: window.localStorage,
      production: (import.meta as { env?: { PROD?: boolean } }).env?.PROD !== false,
    };
  } catch {
    return { production: true };
  }
}

export function useKidsFlag(feature: KidsV2Feature): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener(FLAGS_CHANGED, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(FLAGS_CHANGED, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => kidsV2Enabled(feature, browserSources()),
    () => false,
  );
}
