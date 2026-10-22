import { assessMission, type LearningEvidenceEvent } from "@agorix/learning-evidence";
import type { KidsProgress } from "./kidsProgress.js";
import { KIDS_WORLDS } from "./kidsState.js";

const SETTINGS_KEY = "agorix.kids.adults.v1";
const USAGE_KEY = "agorix.kids.usage.v1";

export interface AdultSettings {
  readonly oriSuggestions: boolean;
  readonly readAloud: boolean;
  readonly dailyLimitMinutes: number;
}

const DEFAULT_SETTINGS: AdultSettings = {
  oriSuggestions: true,
  readAloud: true,
  dailyLimitMinutes: 30,
};

function localStorageOrUndefined(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadAdultSettings(
  storage: Storage | undefined = localStorageOrUndefined(),
): AdultSettings {
  try {
    const parsed = JSON.parse(
      storage?.getItem(SETTINGS_KEY) ?? "null",
    ) as Partial<AdultSettings> | null;
    if (
      !parsed ||
      typeof parsed.oriSuggestions !== "boolean" ||
      typeof parsed.readAloud !== "boolean" ||
      !Number.isInteger(parsed.dailyLimitMinutes) ||
      (parsed.dailyLimitMinutes ?? 0) < 10 ||
      (parsed.dailyLimitMinutes ?? 0) > 120
    ) {
      return DEFAULT_SETTINGS;
    }
    return {
      oriSuggestions: parsed.oriSuggestions,
      readAloud: parsed.readAloud,
      dailyLimitMinutes: parsed.dailyLimitMinutes!,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAdultSettings(
  settings: AdultSettings,
  storage: Storage | undefined = localStorageOrUndefined(),
): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Private mode may block storage. */
  }
}

/** Local calendar day only; no event timestamps or activity trail is retained. */
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function readTodaySeconds(
  day = localDay(),
  storage: Storage | undefined = localStorageOrUndefined(),
): number {
  try {
    const parsed = JSON.parse(storage?.getItem(USAGE_KEY) ?? "null") as {
      day?: unknown;
      seconds?: unknown;
    } | null;
    return parsed?.day === day &&
      typeof parsed.seconds === "number" &&
      Number.isInteger(parsed.seconds) &&
      parsed.seconds >= 0
      ? parsed.seconds
      : 0;
  } catch {
    return 0;
  }
}

export function addActiveSeconds(
  seconds: number,
  day = localDay(),
  storage: Storage | undefined = localStorageOrUndefined(),
): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const total = readTodaySeconds(day, storage) + Math.min(60, Math.floor(seconds));
  try {
    storage?.setItem(USAGE_KEY, JSON.stringify({ day, seconds: total }));
  } catch {
    /* Optional local aggregate. */
  }
}

export function adultSummary(progress: KidsProgress, events: readonly LearningEvidenceEvent[]) {
  const practicedConcepts = [0, 1, 2].map(
    (index) => KIDS_WORLDS.filter((world) => progress.done[`${world}:${index}`] === true).length,
  ) as [number, number, number];
  const decisions = { used: 0, changed: 0, rejected: 0 };
  for (const event of events) {
    if (event.kind !== "proposalDecided") continue;
    if (event.decision === "accept") decisions.used++;
    else if (event.decision === "modify") decisions.changed++;
    else decisions.rejected++;
  }
  const assessment = assessMission({ missionId: "kids.session", missionVersion: 1, events });
  return {
    completedMissions: Object.keys(progress.done).length,
    practicedConcepts,
    decisions,
    understandingObserved: assessment.understanding.demonstrated.length > 0,
    assessment,
  };
}
