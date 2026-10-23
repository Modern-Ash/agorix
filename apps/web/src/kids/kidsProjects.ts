import { createFreeWorldMission, verifyKidsFreeGoal, type KidsCell } from "@agorix/curriculum";
import {
  parseAgorixProject,
  ProjectStore,
  serializeAgorixProject,
  type ProjectMetadata,
  type StoredProject,
} from "@agorix/persistence";
import type { KidsAvatar, KidsWorld } from "./kidsState.js";

const INDEX_KEY = "agorix.kids.projects.v1";
const FREE_ID = /^free-[1-9][0-9]*$/;
const GOAL_SPEC = /^kids\.cell\.([0-5])\.([0-3])$/;

export interface KidsIndexStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KidsFreeProject {
  readonly id: string;
  readonly world: KidsWorld;
  readonly avatar: KidsAvatar;
}

function defaultStorage(): KidsIndexStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function kidsGoalSpec(cell: KidsCell): string {
  createFreeWorldMission(cell, "es");
  return `kids.cell.${cell.cx}.${cell.cy}`;
}

export function parseKidsGoalSpec(value: string): KidsCell {
  const match = GOAL_SPEC.exec(value);
  if (!match) throw new RangeError("invalid Kids free-world goal spec");
  const cell = { cx: Number(match[1]), cy: Number(match[2]) };
  createFreeWorldMission(cell, "es");
  return cell;
}

export function listFreeProjects(
  storage: KidsIndexStorage | undefined = defaultStorage(),
): readonly KidsFreeProject[] {
  try {
    const parsed = JSON.parse(storage?.getItem(INDEX_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is KidsFreeProject =>
        typeof entry === "object" &&
        entry !== null &&
        FREE_ID.test((entry as KidsFreeProject).id) &&
        ["space", "ocean", "robots", "city"].includes((entry as KidsFreeProject).world) &&
        ["🦊", "🐼", "🐸", "🦁", "🐨", "🦄"].includes((entry as KidsFreeProject).avatar),
    );
  } catch {
    return [];
  }
}

export function createFreeProject(
  world: KidsWorld,
  avatar: KidsAvatar,
  storage: KidsIndexStorage | undefined = defaultStorage(),
): KidsFreeProject {
  const previous = listFreeProjects(storage);
  const next = Math.max(0, ...previous.map((entry) => Number(entry.id.slice(5)))) + 1;
  const project = { id: `free-${next}`, world, avatar };
  try {
    storage?.setItem(INDEX_KEY, JSON.stringify([...previous, project]));
  } catch {
    // Full or blocked storage must not end the child's session; the project lives in memory.
  }
  return project;
}

export function exportKidsProject(store: ProjectStore, projectId: string): string {
  return serializeAgorixProject(store.load(projectId));
}

/** Import as a separate free project. A legacy mission without a goal gets a safe default. */
export function importKidsProject(
  source: string,
  world: KidsWorld,
  avatar: KidsAvatar,
  store: ProjectStore,
  storage: KidsIndexStorage | undefined = defaultStorage(),
): KidsFreeProject {
  const imported = parseAgorixProject(source).project;
  const goal = imported.metadata.missionSpec?.goal;
  const cell = goal === undefined ? { cx: 4, cy: 2 } : parseKidsGoalSpec(goal);
  const successCheck = imported.metadata.missionSpec?.successCheck ?? "touches-goal";
  verifyKidsFreeGoal(cell, successCheck, "es");
  const spec = {
    goal: kidsGoalSpec(cell),
    successCheck,
  };
  // Validate and save before listing the project, so failed imports never leave a broken card.
  const next =
    Math.max(0, ...listFreeProjects(storage).map((entry) => Number(entry.id.slice(5)))) + 1;
  const id = `free-${next}`;
  const metadata: ProjectMetadata = { ...imported.metadata, missionSpec: spec };
  store.save(id, imported.program, metadata);
  const project = { id, world, avatar };
  try {
    storage?.setItem(INDEX_KEY, JSON.stringify([...listFreeProjects(storage), project]));
  } catch (error) {
    // Never leave a stored project that no card can reach.
    store.remove(id);
    throw error;
  }
  return project;
}

export interface RemovedFreeProject {
  readonly project: KidsFreeProject;
  readonly stored?: StoredProject;
}

/** Remove a free project. Returns what is needed to restore it, or null when nothing was removed. */
export function deleteFreeProject(
  id: string,
  store: ProjectStore,
  storage: KidsIndexStorage | undefined = defaultStorage(),
): RemovedFreeProject | null {
  if (!FREE_ID.test(id)) return null;
  const all = listFreeProjects(storage);
  const project = all.find((entry) => entry.id === id);
  if (!project) return null;
  let stored: StoredProject | undefined;
  try {
    stored = store.has(id) ? store.load(id) : undefined;
  } catch {
    stored = undefined;
  }
  try {
    storage?.setItem(INDEX_KEY, JSON.stringify(all.filter((entry) => entry.id !== id)));
  } catch {
    return null;
  }
  try {
    store.remove(id);
  } catch {
    // The card is gone; an unreachable record only costs quota.
  }
  return stored ? { project, stored } : { project };
}

/** Undo a delete. Fails (false) if the id was taken meanwhile or storage cannot be written. */
export function restoreFreeProject(
  removed: RemovedFreeProject,
  store: ProjectStore,
  storage: KidsIndexStorage | undefined = defaultStorage(),
): boolean {
  const current = listFreeProjects(storage);
  if (current.some((entry) => entry.id === removed.project.id)) return false;
  try {
    if (removed.stored) {
      store.save(removed.project.id, removed.stored.program, removed.stored.metadata);
    }
    const next = [...current, removed.project].sort(
      (a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)),
    );
    storage?.setItem(INDEX_KEY, JSON.stringify(next));
    return true;
  } catch {
    store.remove(removed.project.id);
    return false;
  }
}
