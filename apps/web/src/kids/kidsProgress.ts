import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { ProjectStore } from "@agorix/persistence";
import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "./kidsState.js";

/**
 * What the Kids map needs to remember about a child (issue #374): onboarding done, the avatar,
 * stars, and which missions are finished. It stores no program and no free text. The program of
 * each mission lives in its own stored project (Kids 04/05); once those exist `done` is derived
 * from their `missionProgress` and this record keeps only the profile.
 */
export interface KidsProgress {
  readonly onboarded: boolean;
  readonly avatar: KidsAvatar;
  readonly stars: number;
  /** Keys are `"<world>:<missionIndex>"`. */
  readonly done: Readonly<Record<string, true>>;
}

export const KIDS_PROGRESS_KEY = "agorix.kids.progress.v1";
export type MissionState = "done" | "current" | "locked";
export type ConceptState = "learned" | "practicing" | "soon";

export function emptyKidsProgress(): KidsProgress {
  return { onboarded: false, avatar: "🦊", stars: 0, done: {} };
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadKidsProgress(
  storage: Storage | undefined = defaultStorage(),
  projects: ProjectStore = new ProjectStore(),
): KidsProgress {
  try {
    const raw = storage?.getItem(KIDS_PROGRESS_KEY);
    const parsed = raw == null ? emptyKidsProgress() : (JSON.parse(raw) as Record<string, unknown>);
    if (
      typeof parsed["onboarded"] !== "boolean" ||
      typeof parsed["stars"] !== "number" ||
      !Number.isInteger(parsed["stars"]) ||
      typeof parsed["done"] !== "object" ||
      parsed["done"] === null
    ) {
      return emptyKidsProgress();
    }
    const avatar = KIDS_AVATARS.find((candidate) => candidate === parsed["avatar"]) ?? "🦊";
    const done: Record<string, true> = {};
    for (const world of KIDS_WORLDS) {
      for (const index of [0, 1, 2]) {
        if ((parsed["done"] as Record<string, unknown>)[`${world}:${index}`] === true) {
          done[`${world}:${index}`] = true;
        }
      }
    }
    // A stored project's metadata is authoritative for that mission. Keep older progress
    // entries for missions without projects so migration does not erase earned stars.
    const authoritativeDone: Record<string, true> = { ...done };
    let hasMissionProject = false;
    for (const world of KIDS_WORLDS) {
      KIDS_MISSION_IDS.forEach((id, index) => {
        const projectId = `kids.${world}.${id}`;
        if (!projects.has(projectId)) return;
        hasMissionProject = true;
        const key = `${world}:${index}`;
        delete authoritativeDone[key];
        try {
          if (projects.load(projectId).metadata.missionProgress === 1) {
            authoritativeDone[key] = true;
          }
        } catch {
          /* A damaged project cannot establish mission completion. */
        }
      });
    }
    return {
      onboarded: parsed["onboarded"],
      avatar,
      stars: hasMissionProject
        ? Object.keys(authoritativeDone).length
        : Math.max(0, parsed["stars"]),
      done: authoritativeDone,
    };
  } catch {
    return emptyKidsProgress();
  }
}

export function saveKidsProgress(
  progress: KidsProgress,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(KIDS_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be blocked; progress is a convenience, the app keeps working.
  }
}

export function markMissionDone(
  progress: KidsProgress,
  world: KidsWorld,
  index: number,
): KidsProgress {
  const key = `${world}:${index}`;
  if (progress.done[key] === true) return progress;
  return { ...progress, stars: progress.stars + 1, done: { ...progress.done, [key]: true } };
}

/** The mission to play next in a world; once all three are done the last one stays current. */
export function firstOpenMission(progress: KidsProgress, world: KidsWorld): 0 | 1 | 2 {
  const open = [0, 1, 2].findIndex((index) => progress.done[`${world}:${index}`] !== true);
  return (open < 0 ? 2 : open) as 0 | 1 | 2;
}

export function missionState(
  progress: KidsProgress,
  world: KidsWorld,
  index: number,
): MissionState {
  const done = progress.done[`${world}:${index}`] === true;
  const open = firstOpenMission(progress, world);
  if (index === open) return "current";
  return index > open && !done ? "locked" : "done";
}

/**
 * Sequence, turns, loops (missions 1, 2 and 3 of any world): learned once any world has it done,
 * practicing when the previous concept is learned, otherwise next up.
 */
export function conceptStates(
  progress: KidsProgress,
): readonly [ConceptState, ConceptState, ConceptState] {
  const doneAny = (index: number) =>
    KIDS_WORLDS.some((world) => progress.done[`${world}:${index}`] === true);
  const state = (index: number): ConceptState =>
    doneAny(index) ? "learned" : index === 0 || doneAny(index - 1) ? "practicing" : "soon";
  return [state(0), state(1), state(2)];
}
