export const AGE_BANDS = ["6-8", "9-12", "13+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const DEFAULT_AGE_BAND: AgeBand = "6-8";

export type CodeTab = "agorix" | "python" | "node" | "java";

export interface BandProfile {
  /** Code languages shown in the editor strip for this band, in order. */
  readonly codeTabs: readonly CodeTab[];
  readonly oriShape: "round" | "soft" | "angular";
  readonly palette: "warm" | "balanced" | "compact";
  /** Text size of the whole Kids area, as a share of the browser's: bigger for younger readers. */
  readonly fontScale: number;
  /** Smallest touch target in px. Never below 44, the accessibility floor. */
  readonly minTarget: number;
  /** Whether the hint ladder reaches its last step, which shows the idea outright. */
  readonly solutionHint: boolean;
  /** Most blocks in one Ori idea; the administrator's limit can only lower it. */
  readonly oriMaxBlocks: number;
  /** Whether read-aloud starts on when an adult first picks this band. */
  readonly readAloudDefault: boolean;
}

/*
 * Every property is read somewhere: codeTabs by the code strip, oriShape by Ori's face, palette and
 * fontScale/minTarget by the Kids root, solutionHint by the hint ladder, oriMaxBlocks by the
 * Studio's goals and readAloudDefault by the first band choice. A property nothing reads is removed
 * (issue #607 dropped mapComplexity, which no screen used).
 */

const PROFILES: Readonly<Record<AgeBand, BandProfile>> = {
  "6-8": {
    codeTabs: ["agorix"],
    oriShape: "round",
    palette: "warm",
    fontScale: 1.125,
    minTarget: 56,
    solutionHint: true,
    oriMaxBlocks: 6,
    readAloudDefault: true,
  },
  "9-12": {
    codeTabs: ["agorix", "python", "node"],
    oriShape: "soft",
    palette: "balanced",
    fontScale: 1,
    minTarget: 48,
    solutionHint: true,
    oriMaxBlocks: 8,
    readAloudDefault: false,
  },
  "13+": {
    codeTabs: ["agorix", "python", "node", "java"],
    oriShape: "angular",
    palette: "compact",
    fontScale: 0.95,
    minTarget: 44,
    solutionHint: false,
    oriMaxBlocks: 8,
    readAloudDefault: false,
  },
};

export function isAgeBand(value: unknown): value is AgeBand {
  return (AGE_BANDS as readonly unknown[]).includes(value);
}

/** Pure constants per band. A setting for the adult, never sent to Ori or any provider. */
export function bandProfile(band: AgeBand): BandProfile {
  return PROFILES[band];
}

/** The extra 6–8 languages are one tap away; the Java projection is installed locally. */
export function codeTabsForBand(band: AgeBand, showMore: boolean): readonly CodeTab[] {
  return band === "6-8" && showMore ? PROFILES["13+"].codeTabs : PROFILES[band].codeTabs;
}

/** Hint steps this band can open: the last one is the idea itself. */
export function hintLevelsForBand(band: AgeBand | undefined): number {
  return band === undefined || PROFILES[band].solutionHint ? 5 : 4;
}
