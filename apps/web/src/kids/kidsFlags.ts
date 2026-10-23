import { useMemo } from "react";

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
const DEFAULT_FEATURES: readonly KidsV2Feature[] = ["customImages"];

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
  return useMemo(() => kidsV2Enabled(feature, browserSources()), [feature]);
}
