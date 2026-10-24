import {
  parseAgorixProject,
  ProjectStore,
  serializeAgorixProject,
  type ProjectMetadata,
} from "@agorix/persistence";
import type { ProjectProgram } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import {
  isGalleryBackdropId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "./kidsGallery.js";
import {
  createStudioProgram,
  creativeForStudio,
  validateStudioProgram,
} from "./kidsStudioModel.js";

const INDEX = "agorix.kids.studios.v1";
const STUDIO_ID = /^studio-[1-9][0-9]*$/;

interface StudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KidsStudioProject {
  readonly id: string;
  readonly backdropId: KidsGalleryBackdropId;
}

function browserStorage(): StudioStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function listStudioProjects(
  storage: StudioStorage | undefined = browserStorage(),
): readonly KidsStudioProject[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(INDEX) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is KidsStudioProject =>
        typeof item === "object" &&
        item !== null &&
        STUDIO_ID.test((item as KidsStudioProject).id) &&
        isGalleryBackdropId((item as KidsStudioProject).backdropId),
    );
  } catch {
    return [];
  }
}

function nextId(projects: readonly KidsStudioProject[]): string {
  return `studio-${Math.max(0, ...projects.map((item) => Number(item.id.slice(7)))) + 1}`;
}

export function saveStudioProject(
  id: string,
  program: ProjectProgram,
  backdropId: KidsGalleryBackdropId,
  activeActorId: string,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
): void {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  const valid = validateStudioProgram(program);
  const creative = creativeForStudio(valid, backdropId, locale);
  if (!creative.actors?.some((actor) => actor.id === activeActorId))
    throw new RangeError("active actor is not in studio");
  const now = new Date().toISOString();
  const previous = store.has(id) ? store.load(id).metadata : undefined;
  const metadata: ProjectMetadata = {
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    missionProgress: 0,
    hintLevel: 0,
    locale,
    actors: { activeId: activeActorId, items: creative.actors },
    ...(creative.stage === undefined ? {} : { stage: creative.stage }),
    ...(creative.assets === undefined ? {} : { assets: creative.assets }),
  };
  store.save(id, valid, metadata);
}

export function createStudioProject(
  characterId: KidsGalleryCharacterId,
  backdropId: KidsGalleryBackdropId,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: StudioStorage | undefined = browserStorage(),
): KidsStudioProject {
  if (!storage) throw new Error("studio storage unavailable");
  const previous = listStudioProjects(storage);
  const project = { id: nextId(previous), backdropId };
  const program = createStudioProgram(characterId);
  try {
    saveStudioProject(
      project.id,
      program,
      backdropId,
      `actor:studio-1-${characterId}`,
      locale,
      store,
    );
    storage.setItem(INDEX, JSON.stringify([...previous, project]));
    return project;
  } catch (error) {
    store.remove(project.id);
    throw error;
  }
}

export function setStudioBackdrop(
  id: string,
  backdropId: KidsGalleryBackdropId,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: StudioStorage | undefined = browserStorage(),
): void {
  if (!storage || !isGalleryBackdropId(backdropId)) throw new RangeError("invalid studio backdrop");
  const projects = listStudioProjects(storage);
  if (!projects.some((item) => item.id === id)) throw new RangeError("unknown studio project");
  const saved = store.load(id);
  const active = saved.metadata.actors?.activeId ?? "";
  // A quota failure in either store must leave both views on the old backdrop.
  saveStudioProject(id, saved.program, backdropId, active, locale, store);
  try {
    storage.setItem(
      INDEX,
      JSON.stringify(projects.map((item) => (item.id === id ? { ...item, backdropId } : item))),
    );
  } catch (error) {
    store.save(id, saved.program, saved.metadata);
    throw error;
  }
}

export function exportStudioProject(id: string, store: ProjectStore = new ProjectStore()): string {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  return serializeAgorixProject(store.load(id));
}

export function importStudioProject(
  source: string,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: StudioStorage | undefined = browserStorage(),
): KidsStudioProject {
  if (!storage) throw new Error("studio storage unavailable");
  const imported = parseAgorixProject(source).project;
  const program = validateStudioProgram(imported.program);
  const backdropId = imported.metadata.stage?.backdropId?.replace(/^backdrop:/, "");
  if (!isGalleryBackdropId(backdropId)) throw new RangeError("invalid studio backdrop");
  const active = imported.metadata.actors?.activeId;
  const creative = creativeForStudio(program, backdropId, locale);
  const activeActorId = creative.actors?.some((actor) => actor.id === active)
    ? active!
    : creative.actors![0]!.id;
  const previous = listStudioProjects(storage);
  const project = { id: nextId(previous), backdropId };
  try {
    saveStudioProject(project.id, program, backdropId, activeActorId, locale, store);
    storage.setItem(INDEX, JSON.stringify([...previous, project]));
    return project;
  } catch (error) {
    store.remove(project.id);
    throw error;
  }
}

export function deleteStudioProject(
  id: string,
  store: ProjectStore = new ProjectStore(),
  storage: StudioStorage | undefined = browserStorage(),
): boolean {
  if (!storage || !STUDIO_ID.test(id)) return false;
  const projects = listStudioProjects(storage);
  if (!projects.some((item) => item.id === id)) return false;
  storage.setItem(INDEX, JSON.stringify(projects.filter((item) => item.id !== id)));
  store.remove(id);
  return true;
}
