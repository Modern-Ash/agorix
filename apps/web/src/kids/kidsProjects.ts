import { createFreeWorldMission, verifyKidsFreeGoal, type KidsCell } from "@agorix/curriculum";
import {
  parseAgorixProject,
  ProjectStore,
  serializeAgorixProject,
  type ProjectMetadata,
  type StoredProject,
} from "@agorix/persistence";
import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "./kidsState.js";
import {
  isGalleryBackdropId,
  isGalleryCharacterId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "./kidsGallery.js";

const INDEX_KEY = "agorix.kids.projects.v1";
/** v2 adds custom explorers/backdrops. v1 stays dual-written so an older build loses nothing. */
const INDEX_V2_KEY = "agorix.kids.projects.v2";
const CUSTOM_ID = /^custom-[1-9][0-9]?$/;
export const MAX_CUSTOM_REFS = 12;
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
  /** The full v2 entry, so undo can restore a custom explorer or backdrop. */
  readonly ref?: KidsFreeProjectRef;
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
  const ref = listFreeProjectRefs(storage).find((entry) => entry.id === id);
  try {
    storage?.setItem(INDEX_KEY, JSON.stringify(all.filter((entry) => entry.id !== id)));
  } catch {
    return null;
  }
  removeFromV2(id, storage);
  try {
    store.remove(id);
  } catch {
    // The card is gone; an unreachable record only costs quota.
  }
  return { project, ...(stored ? { stored } : {}), ...(ref ? { ref } : {}) };
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
    if (removed.ref) addToV2(removed.ref, storage);
    return true;
  } catch {
    store.remove(removed.project.id);
    return false;
  }
}

export type KidsAvatarRef =
  | { readonly kind: "emoji"; readonly value: KidsAvatar }
  | { readonly kind: "gallery"; readonly id: KidsGalleryCharacterId }
  | { readonly kind: "custom"; readonly id: string };
export type KidsWorldRef =
  | { readonly kind: "builtin"; readonly value: KidsWorld }
  | { readonly kind: "gallery"; readonly id: KidsGalleryBackdropId }
  | { readonly kind: "custom"; readonly id: string };

export interface KidsFreeProjectRef {
  readonly id: string;
  readonly world: KidsWorldRef;
  readonly avatar: KidsAvatarRef;
}

export function isCustomRefId(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_ID.test(value) && Number(value.slice(7)) <= 99;
}

function parseAvatarRef(value: unknown): KidsAvatarRef | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { kind, value: emoji, id } = value as Record<string, unknown>;
  if (kind === "emoji" && (KIDS_AVATARS as readonly unknown[]).includes(emoji)) {
    return { kind, value: emoji as KidsAvatar };
  }
  if (kind === "gallery" && isGalleryCharacterId(id)) return { kind, id };
  if (kind === "custom" && isCustomRefId(id)) return { kind, id };
  return undefined;
}

function parseWorldRef(value: unknown): KidsWorldRef | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { kind, value: world, id } = value as Record<string, unknown>;
  if (kind === "builtin" && (KIDS_WORLDS as readonly unknown[]).includes(world)) {
    return { kind, value: world as KidsWorld };
  }
  if (kind === "gallery" && isGalleryBackdropId(id)) return { kind, id };
  if (kind === "custom" && isCustomRefId(id)) return { kind, id };
  return undefined;
}

function readV2(storage: KidsIndexStorage | undefined): readonly KidsFreeProjectRef[] {
  try {
    const parsed = JSON.parse(storage?.getItem(INDEX_V2_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return [];
    const result: KidsFreeProjectRef[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const { id, world, avatar } = entry as Record<string, unknown>;
      const w = parseWorldRef(world);
      const a = parseAvatarRef(avatar);
      if (typeof id === "string" && FREE_ID.test(id) && w && a)
        result.push({ id, world: w, avatar: a });
    }
    return result;
  } catch {
    return [];
  }
}

function v1View(ref: KidsFreeProjectRef): KidsFreeProject {
  return {
    id: ref.id,
    world: ref.world.kind === "builtin" ? ref.world.value : "space",
    avatar: ref.avatar.kind === "emoji" ? ref.avatar.value : "🦊",
  };
}

function refOfV1(project: KidsFreeProject): KidsFreeProjectRef {
  return {
    id: project.id,
    world: { kind: "builtin", value: project.world },
    avatar: { kind: "emoji", value: project.avatar },
  };
}

function sortById<T extends { readonly id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)));
}

/**
 * Every free project with its full explorer/backdrop reference. v2 wins for ids it knows; projects
 * only in v1 (made by an older build, or before any custom item) are added with built-in refs.
 */
export function listFreeProjectRefs(
  storage: KidsIndexStorage | undefined = defaultStorage(),
): readonly KidsFreeProjectRef[] {
  const v2 = readV2(storage);
  const known = new Set(v2.map((entry) => entry.id));
  return sortById([
    ...v2,
    ...listFreeProjects(storage)
      .filter((project) => !known.has(project.id))
      .map(refOfV1),
  ]);
}

function writeBoth(
  refs: readonly KidsFreeProjectRef[],
  storage: KidsIndexStorage | undefined,
): void {
  storage?.setItem(INDEX_V2_KEY, JSON.stringify(refs));
  storage?.setItem(INDEX_KEY, JSON.stringify(refs.map(v1View)));
}

function removeFromV2(id: string, storage: KidsIndexStorage | undefined): void {
  try {
    if (storage?.getItem(INDEX_V2_KEY) == null) return;
    storage.setItem(
      INDEX_V2_KEY,
      JSON.stringify(readV2(storage).filter((entry) => entry.id !== id)),
    );
  } catch {
    // v1 already dropped it; the merge never resurrects an id that v1 no longer lists.
  }
}

function addToV2(ref: KidsFreeProjectRef, storage: KidsIndexStorage | undefined): void {
  try {
    if (storage?.getItem(INDEX_V2_KEY) == null) return;
    storage.setItem(INDEX_V2_KEY, JSON.stringify(sortById([...readV2(storage), ref])));
  } catch {
    // The v1 entry is restored; the project reappears with its built-in fallback.
  }
}

/** Create a project that may use a custom explorer/backdrop. Writes v2 and the v1 fallback view. */
export function createFreeProjectRef(
  world: KidsWorldRef,
  avatar: KidsAvatarRef,
  storage: KidsIndexStorage | undefined = defaultStorage(),
): KidsFreeProjectRef {
  const previous = listFreeProjectRefs(storage);
  const next = Math.max(0, ...previous.map((entry) => Number(entry.id.slice(5)))) + 1;
  const project: KidsFreeProjectRef = { id: `free-${next}`, world, avatar };
  try {
    writeBoth([...previous, project], storage);
  } catch {
    // Full or blocked storage must not end the session; the project lives in memory.
  }
  return project;
}
