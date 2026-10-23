export const AGE_BANDS = ["6-8", "9-12", "13+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const DEFAULT_AGE_BAND: AgeBand = "6-8";

export type CodeTab = "agorix" | "python" | "node" | "java";

export interface BandProfile {
  /** Code languages shown in the editor strip for this band, in order. */
  readonly codeTabs: readonly CodeTab[];
  readonly oriShape: "round" | "soft" | "angular";
  readonly palette: "warm" | "balanced" | "compact";
  /** How much of the map and editor chrome is shown: 1 simplest. */
  readonly mapComplexity: 1 | 2 | 3;
}

const PROFILES: Readonly<Record<AgeBand, BandProfile>> = {
  "6-8": {
    codeTabs: ["agorix"],
    oriShape: "round",
    palette: "warm",
    mapComplexity: 1,
  },
  "9-12": {
    codeTabs: ["agorix", "python", "node"],
    oriShape: "soft",
    palette: "balanced",
    mapComplexity: 2,
  },
  "13+": {
    codeTabs: ["agorix", "python", "node", "java"],
    oriShape: "angular",
    palette: "compact",
    mapComplexity: 3,
  },
};

export function isAgeBand(value: unknown): value is AgeBand {
  return (AGE_BANDS as readonly unknown[]).includes(value);
}

/** Pure constants per band. A setting for the adult, never sent to Ori or any provider. */
export function bandProfile(band: AgeBand): BandProfile {
  return PROFILES[band];
}
