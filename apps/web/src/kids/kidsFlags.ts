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
  "groupMode",
  "extensionPen",
  "extensionMusic",
  "freeToScene",
] as const;

export type KidsV2Feature = (typeof KIDS_V2_FEATURES)[number];

export const KIDS_FLAGS_KEY = "agorix.kids.flags.v1";
const FLAGS_CHANGED = "agorix:kids-flags-changed";
// Creative Kids tools are visible by default. Account linking needs a live
// verification service and remains a separate operational release. Closed groups (ADR 0010)
// stay off until the legal and privacy review of #556. `freeToScene` (issue #1134) retires
// ¡Crear! and opens old single-explorer projects as scenes; it stays off until the E2E suite
// that still creates ¡Crear! projects has moved to scenes.
const DEFAULT_FEATURES: readonly KidsV2Feature[] = KIDS_V2_FEATURES.filter(
  (feature) => feature !== "adultLink" && feature !== "groupMode" && feature !== "freeToScene",
);

export interface KidsFlagSources {
  readonly search?: string;
  readonly storage?: Pick<Storage, "getItem">;
  /** Deployment build switch; off unless the private account service is verified. */
  readonly adultLinkDefault?: boolean;
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

function stored(
  storage: KidsFlagSources["storage"],
  defaults: readonly KidsV2Feature[],
): readonly unknown[] {
  try {
    const raw = storage?.getItem(KIDS_FLAGS_KEY);
    if (raw === null || raw === undefined) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Approved defaults apply to a new browser; an explicit stored list can roll them back. */
export function kidsV2Features(sources: KidsFlagSources = {}): ReadonlySet<KidsV2Feature> {
  const adultLinkDefault =
    sources.adultLinkDefault ??
    (import.meta as { env?: { VITE_KIDS_ADULT_LINK_DEFAULT?: string } }).env
      ?.VITE_KIDS_ADULT_LINK_DEFAULT === "1";
  const defaults: readonly KidsV2Feature[] = adultLinkDefault
    ? [...DEFAULT_FEATURES, "adultLink"]
    : DEFAULT_FEATURES;
  const names: unknown[] = [...stored(sources.storage, defaults)];
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

/** The flag now, for code that runs outside React (route lookup). */
export function kidsFlagNow(feature: KidsV2Feature): boolean {
  return kidsV2Enabled(feature, browserSources());
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
