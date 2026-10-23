import type { ExecutionTraceEntry } from "@agorix/runtime";

export interface SoundParameters {
  readonly wave: OscillatorType;
  readonly startHz: number;
  readonly endHz: number;
  readonly duration: number;
  readonly gain: number;
}

export const KIDS_SOUNDS = [
  {
    id: "kids:pop",
    nameKey: "soundPop",
    parameters: { wave: "sine", startHz: 620, endHz: 360, duration: 0.09, gain: 0.08 },
  },
  {
    id: "kids:bell",
    nameKey: "soundBell",
    parameters: { wave: "sine", startHz: 880, endHz: 660, duration: 0.4, gain: 0.06 },
  },
  {
    id: "kids:drum",
    nameKey: "soundDrum",
    parameters: { wave: "triangle", startHz: 150, endHz: 70, duration: 0.18, gain: 0.1 },
  },
  {
    id: "kids:whoosh",
    nameKey: "soundWhoosh",
    parameters: { wave: "sawtooth", startHz: 420, endHz: 100, duration: 0.3, gain: 0.04 },
  },
  {
    id: "kids:win",
    nameKey: "soundWin",
    parameters: { wave: "sine", startHz: 660, endHz: 990, duration: 0.36, gain: 0.07 },
  },
  {
    id: "kids:oops",
    nameKey: "soundOops",
    parameters: { wave: "triangle", startHz: 330, endHz: 165, duration: 0.25, gain: 0.07 },
  },
] as const satisfies readonly {
  readonly id: string;
  readonly nameKey: string;
  readonly parameters: SoundParameters;
}[];

export const KIDS_CUSTOM_SOUND_ID = "kids:custom";
export type KidsSoundId = (typeof KIDS_SOUNDS)[number]["id"] | typeof KIDS_CUSTOM_SOUND_ID;

const DEFAULT: SoundParameters = {
  wave: "sine",
  startHz: 440,
  endHz: 440,
  duration: 0.16,
  gain: 0.08,
};

export function isKidsSoundId(value: string): value is KidsSoundId {
  return value === KIDS_CUSTOM_SOUND_ID || KIDS_SOUNDS.some((item) => item.id === value);
}

export function soundParameters(id: string): SoundParameters {
  return KIDS_SOUNDS.find((item) => item.id === id)?.parameters ?? DEFAULT;
}

export function soundChoices(customEnabled: boolean): readonly string[] {
  return customEnabled
    ? [...KIDS_SOUNDS.map((item) => item.id), KIDS_CUSTOM_SOUND_ID]
    : KIDS_SOUNDS.map((item) => item.id);
}

/** Runtime trace, never the speaker, is the proof and count of executed sounds. */
export function soundEvents(trace: readonly ExecutionTraceEntry[]): readonly string[] {
  return trace
    .filter((entry) => entry.statementType === "playSound")
    .map((entry) => entry.soundId ?? "kids-tone");
}
