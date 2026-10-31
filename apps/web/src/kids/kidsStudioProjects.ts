import {
  parseAgorixProject,
  ProjectStore,
  serializeAgorixProject,
  type ProjectMetadata,
  type ProjectSceneGoal,
} from "@agorix/persistence";
import type { ProjectAsset, ProjectProgram } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import {
  isGalleryBackdropId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "./kidsGallery.js";
import {
  createStudioProgram,
  creativeForStudio,
  studioArtAssets,
  validateStudioProgram,
} from "./kidsStudioModel.js";
import { validKidsImageDataUrl } from "./kidsImages.js";
import { sceneGoalValid } from "./kidsSceneGoal.js";

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

function costumeMap(
  actors: readonly { readonly id: string; readonly costumeId?: string }[] = [],
): Record<string, string> {
  return Object.fromEntries(
    actors
      .filter((actor) => actor.costumeId !== undefined)
      .map((actor) => [actor.id, actor.costumeId!]),
  ) as Record<string, string>;
}

export function saveStudioProject(
  id: string,
  program: ProjectProgram,
  backdropId: KidsGalleryBackdropId,
  activeActorId: string,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  backdropOverride?: string,
): void {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  const valid = validateStudioProgram(program);
  const previous = store.has(id) ? store.load(id).metadata : undefined;
  const positions = Object.fromEntries(
    (previous?.actors?.items ?? []).map((actor) => [actor.id, { x: actor.x, y: actor.y }]),
  );
  const artAssets = studioArtAssets(
    previous?.assets?.filter((asset) => asset.source.startsWith("data:")),
  );
  const creative = creativeForStudio(
    valid,
    backdropId,
    locale,
    positions,
    previous?.stage?.actorOrder,
    {
      assets: artAssets,
      actorCostumes: costumeMap(previous?.actors?.items),
      stageBackdropId: backdropOverride ?? previous?.stage?.backdropId,
    },
  );
  if (!creative.actors?.some((actor) => actor.id === activeActorId))
    throw new RangeError("active actor is not in studio");
  const now = new Date().toISOString();
  // A goal survives edits while both of its characters are still in the scene.
  const keptGoal =
    previous?.sceneGoal !== undefined &&
    sceneGoalValid(
      previous.sceneGoal,
      creative.actors.map((actor) => actor.id),
    )
      ? previous.sceneGoal
      : undefined;
  const metadata: ProjectMetadata = {
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    missionProgress: 0,
    hintLevel: 0,
    locale,
    actors: { activeId: activeActorId, items: creative.actors },
    ...(creative.stage === undefined ? {} : { stage: creative.stage }),
    ...(creative.assets === undefined ? {} : { assets: creative.assets }),
    ...(keptGoal === undefined ? {} : { sceneGoal: keptGoal }),
  };
  store.save(id, valid, metadata);
}

/** The goal the child set on this scene, if both of its characters are still there. */
export function studioSceneGoal(
  id: string,
  store: ProjectStore = new ProjectStore(),
): ProjectSceneGoal | undefined {
  if (!STUDIO_ID.test(id) || !store.has(id)) return undefined;
  const saved = store.load(id);
  const goal = saved.metadata.sceneGoal;
  const actorIds = (saved.metadata.actors?.items ?? []).map((actor) => actor.id);
  return goal !== undefined && sceneGoalValid(goal, actorIds) ? goal : undefined;
}

/** Sets or clears (null) the scene goal; the program and the art are left as they are. */
export function setStudioSceneGoal(
  id: string,
  goal: ProjectSceneGoal | null,
  store: ProjectStore = new ProjectStore(),
): void {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  const saved = store.load(id);
  const actorIds = (saved.metadata.actors?.items ?? []).map((actor) => actor.id);
  if (goal !== null && !sceneGoalValid(goal, actorIds))
    throw new RangeError("goal needs characters in the scene");
  const rest: Record<string, unknown> = { ...saved.metadata };
  delete rest["sceneGoal"];
  store.save(id, saved.program, {
    ...(rest as unknown as ProjectMetadata),
    updatedAt: new Date().toISOString(),
    ...(goal === null ? {} : { sceneGoal: goal }),
  });
}

export function addStudioArt(
  id: string,
  kind: "costume" | "backdrop",
  actorId: string,
  dataUrl: string,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: StudioStorage | undefined = browserStorage(),
): string {
  if (!STUDIO_ID.test(id) || !validKidsImageDataUrl(dataUrl))
    throw new RangeError("invalid studio image");
  const saved = store.load(id);
  const program = validateStudioProgram(saved.program);
  const metadata = saved.metadata;
  const backdropId = metadata.stage?.backdropId?.replace(/^backdrop:/, "");
  const indexBackdrop = listStudioProjects(storage).find((item) => item.id === id)?.backdropId;
  const fallback = isGalleryBackdropId(backdropId) ? backdropId : indexBackdrop;
  if (!fallback || !isGalleryBackdropId(fallback)) throw new RangeError("unknown studio backdrop");
  const custom = studioArtAssets(
    metadata.assets?.filter((asset) => asset.source.startsWith("data:")),
  );
  if (custom.length >= 12) throw new RangeError("studio art limit");
  const number = Math.max(0, ...custom.map((asset) => Number(asset.id.split("-").at(-1)))) + 1;
  if (number > 99) throw new RangeError("studio art limit");
  const asset: ProjectAsset = {
    id: `${kind}:studio-art-${number}`,
    kind,
    name:
      locale === "es"
        ? kind === "costume"
          ? `Mi disfraz ${number}`
          : `Mi fondo ${number}`
        : kind === "costume"
          ? `My costume ${number}`
          : `My backdrop ${number}`,
    source: dataUrl,
  };
  const positions = Object.fromEntries(
    (metadata.actors?.items ?? []).map((actor) => [actor.id, { x: actor.x, y: actor.y }]),
  );
  const actorCostumes = costumeMap(metadata.actors?.items);
  if (kind === "costume") {
    if (!metadata.actors?.items.some((actor) => actor.id === actorId))
      throw new RangeError("unknown studio actor");
    actorCostumes[actorId] = asset.id;
  }
  const creative = creativeForStudio(
    program,
    fallback,
    locale,
    positions,
    metadata.stage?.actorOrder,
    {
      assets: [...custom, asset],
      actorCostumes,
      stageBackdropId: kind === "backdrop" ? asset.id : metadata.stage?.backdropId,
    },
  );
  store.save(id, program, {
    ...metadata,
    updatedAt: new Date().toISOString(),
    actors: { activeId: metadata.actors?.activeId ?? actorId, items: creative.actors! },
    stage: creative.stage!,
    assets: creative.assets!,
  });
  return asset.id;
}

export function selectStudioArt(
  id: string,
  assetId: string,
  actorId: string,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: StudioStorage | undefined = browserStorage(),
): void {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  const saved = store.load(id);
  const program = validateStudioProgram(saved.program);
  const metadata = saved.metadata;
  const custom = studioArtAssets(
    metadata.assets?.filter((asset) => asset.source.startsWith("data:")),
  );
  const asset = custom.find((item) => item.id === assetId);
  if (!asset) throw new RangeError("unknown studio art");
  const fallback =
    listStudioProjects(storage).find((item) => item.id === id)?.backdropId ?? "forest";
  const actorCostumes = costumeMap(metadata.actors?.items);
  if (asset.kind === "costume") {
    if (!metadata.actors?.items.some((actor) => actor.id === actorId))
      throw new RangeError("unknown studio actor");
    actorCostumes[actorId] = asset.id;
  }
  const creative = creativeForStudio(
    program,
    fallback,
    locale,
    Object.fromEntries(
      (metadata.actors?.items ?? []).map((actor) => [actor.id, { x: actor.x, y: actor.y }]),
    ),
    metadata.stage?.actorOrder,
    {
      assets: custom,
      actorCostumes,
      stageBackdropId: asset.kind === "backdrop" ? asset.id : metadata.stage?.backdropId,
    },
  );
  store.save(id, program, {
    ...metadata,
    updatedAt: new Date().toISOString(),
    actors: { activeId: actorId, items: creative.actors! },
    stage: creative.stage!,
    assets: creative.assets!,
  });
}

/** Replace only child-created art; bundled assets are never editable. */
export function updateStudioArt(
  id: string,
  assetId: string,
  dataUrl: string,
  store: ProjectStore = new ProjectStore(),
): void {
  if (!STUDIO_ID.test(id) || !validKidsImageDataUrl(dataUrl))
    throw new RangeError("invalid studio image");
  const saved = store.load(id);
  validateStudioProgram(saved.program);
  const custom = studioArtAssets(
    saved.metadata.assets?.filter((asset) => asset.source.startsWith("data:")),
  );
  if (!custom.some((asset) => asset.id === assetId)) throw new RangeError("unknown studio art");
  store.save(id, saved.program, {
    ...saved.metadata,
    updatedAt: new Date().toISOString(),
    assets: (saved.metadata.assets ?? []).map((asset) =>
      asset.id === assetId ? { ...asset, source: dataUrl } : asset,
    ),
  });
}

export function setStudioActorPosition(
  id: string,
  actorId: string,
  x: number,
  y: number,
  store: ProjectStore = new ProjectStore(),
): void {
  if (
    !STUDIO_ID.test(id) ||
    !Number.isInteger(x) ||
    x < 0 ||
    x > 320 ||
    !Number.isInteger(y) ||
    y < -100 ||
    y > 120
  )
    throw new RangeError("invalid studio position");
  const saved = store.load(id);
  validateStudioProgram(saved.program);
  const actors = saved.metadata.actors;
  if (!actors?.items.some((actor) => actor.id === actorId))
    throw new RangeError("unknown studio actor");
  store.save(id, saved.program, {
    ...saved.metadata,
    updatedAt: new Date().toISOString(),
    actors: {
      ...actors,
      items: actors.items.map((actor) => (actor.id === actorId ? { ...actor, x, y } : actor)),
    },
  });
}

export function moveStudioActorLayer(
  id: string,
  actorId: string,
  direction: "forward" | "backward",
  store: ProjectStore = new ProjectStore(),
): boolean {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  const saved = store.load(id);
  validateStudioProgram(saved.program);
  const stage = saved.metadata.stage;
  const order = [...(stage?.actorOrder ?? [])];
  const index = order.indexOf(actorId);
  if (index < 0) throw new RangeError("unknown studio actor");
  const next = index + (direction === "forward" ? 1 : -1);
  if (next < 0 || next >= order.length) return false;
  [order[index], order[next]] = [order[next]!, order[index]!];
  store.save(id, saved.program, {
    ...saved.metadata,
    updatedAt: new Date().toISOString(),
    stage: { ...stage!, actorOrder: order },
  });
  return true;
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
  saveStudioProject(id, saved.program, backdropId, active, locale, store, `backdrop:${backdropId}`);
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

export function exportStudioProject(
  id: string,
  store: ProjectStore = new ProjectStore(),
  includeMedia = false,
): string {
  if (!STUDIO_ID.test(id)) throw new RangeError("invalid studio id");
  return serializeAgorixProject(store.load(id), { includeMedia });
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
  const stageBackdrop = imported.metadata.stage?.backdropId;
  const galleryBackdrop = stageBackdrop?.replace(/^backdrop:/, "");
  const backdropId = isGalleryBackdropId(galleryBackdrop) ? galleryBackdrop : "forest";
  const active = imported.metadata.actors?.activeId;
  const importedActors = imported.metadata.actors?.items ?? [];
  const creative = creativeForStudio(
    program,
    backdropId,
    locale,
    Object.fromEntries(importedActors.map((actor) => [actor.id, { x: actor.x, y: actor.y }])),
    imported.metadata.stage?.actorOrder,
    {
      assets: studioArtAssets(
        imported.metadata.assets?.filter((asset) => asset.source.startsWith("data:")),
      ),
      actorCostumes: costumeMap(importedActors),
      stageBackdropId: stageBackdrop,
    },
  );
  const activeActorId = creative.actors?.some((actor) => actor.id === active)
    ? active!
    : creative.actors![0]!.id;
  const previous = listStudioProjects(storage);
  const project = { id: nextId(previous), backdropId };
  try {
    store.save(project.id, program, {
      ...imported.metadata,
      actors: { activeId: activeActorId, items: creative.actors! },
      stage: creative.stage!,
      assets: creative.assets!,
    });
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
