import { ProjectStore } from "@agorix/persistence";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import type { KidsGalleryBackdropId, KidsGalleryCharacterId } from "./kidsGallery.js";
import { KIDS_SOUNDS } from "./kidsSoundLibrary.js";
import { listFreeProjectRefs, type KidsFreeProjectRef } from "./kidsProjects.js";
import {
  createStudioProject,
  deleteStudioProject,
  saveStudioProject,
} from "./kidsStudioProjects.js";
import {
  appendStudioStatement,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";
import { createEditorHistory } from "@agorix/block-editor";

/**
 * Turns an old single-explorer project (`#/libre/{id}`, issue #1134) into a scene. The old project
 * is never changed or removed, so the child can always go back to it; a conversion is a copy, and
 * it is remembered so the same project does not become two scenes. A project that cannot become a
 * scene without losing something (custom art, a block the scene lacks) stays as it was.
 */
const MIGRATED_KEY = "agorix.kids.freeScenes.v1";
const FREE_ID = /^free-[1-9][0-9]*$/;
const STUDIO_ID = /^studio-[1-9][0-9]*$/;

const BACKDROP_OF_WORLD = {
  space: "galaxy",
  ocean: "reef",
  robots: "lab",
  city: "castle",
} as const satisfies Record<string, KidsGalleryBackdropId>;

const CHARACTER_OF_EMOJI: Readonly<Record<string, KidsGalleryCharacterId>> = {
  "🦊": "mika",
  "🐼": "pip",
  "🐸": "tito",
  "🦁": "mika",
  "🐨": "pip",
  "🦄": "luma",
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function migratedScenes(
  storage: Storage | undefined = browserStorage(),
): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(MIGRATED_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          FREE_ID.test(entry[0]) && typeof entry[1] === "string" && STUDIO_ID.test(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export type FreeToSceneResult =
  | { readonly kind: "scene"; readonly studioId: string; readonly goalDropped: boolean }
  | { readonly kind: "kept"; readonly reason: "unknown" | "custom-art" | "unsupported-block" };

function sceneStatement(statement: Statement): Statement | null {
  switch (statement.type) {
    case "move":
    case "turn":
      return statement;
    case "playSound":
      return { type: "playSound", soundId: KIDS_SOUNDS[0]!.id };
    case "repeat": {
      const body = statement.body.map(sceneStatement);
      return body.some((item) => item === null)
        ? null
        : { ...statement, body: body as Statement[] };
    }
    default:
      return null;
  }
}

function translateProgram(
  program: ProjectProgram,
  characterId: KidsGalleryCharacterId,
): ProjectProgram | null {
  const source = program.scripts[0]?.statements ?? [];
  const translated = source.map(sceneStatement);
  if (translated.some((item) => item === null)) return null;
  const actorId = `actor:studio-1-${characterId}`;
  try {
    const empty = createEditorHistory(createStudioProgram(characterId));
    const done = (translated as Statement[]).reduce(
      (history, statement) => appendStudioStatement(history, actorId, statement),
      empty,
    );
    return validateStudioProgram(done.current);
  } catch {
    return null;
  }
}

/** Converts one old project to a scene (or finds the scene it already became). */
export function convertFreeProject(
  freeId: string,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: Storage | undefined = browserStorage(),
): FreeToSceneResult {
  const already = migratedScenes(storage)[freeId];
  if (already !== undefined) return { kind: "scene", studioId: already, goalDropped: false };
  const ref: KidsFreeProjectRef | undefined = listFreeProjectRefs(storage as never).find(
    (entry) => entry.id === freeId,
  );
  if (!ref || !store.has(freeId)) return { kind: "kept", reason: "unknown" };
  if (ref.avatar.kind === "custom" || ref.world.kind === "custom")
    return { kind: "kept", reason: "custom-art" };
  const characterId =
    ref.avatar.kind === "gallery"
      ? ref.avatar.id
      : (CHARACTER_OF_EMOJI[ref.avatar.value] ?? "nova");
  const backdropId =
    ref.world.kind === "gallery" ? ref.world.id : BACKDROP_OF_WORLD[ref.world.value];
  const saved = store.load(freeId);
  const program = translateProgram(saved.program, characterId);
  if (program === null) return { kind: "kept", reason: "unsupported-block" };
  const scene = createStudioProject(characterId, backdropId, locale, store, storage as never);
  try {
    saveStudioProject(
      scene.id,
      program,
      backdropId,
      `actor:studio-1-${characterId}`,
      locale,
      store,
    );
    storage?.setItem(
      MIGRATED_KEY,
      JSON.stringify({ ...migratedScenes(storage), [freeId]: scene.id }),
    );
  } catch {
    deleteStudioProject(scene.id, store, storage as never);
    return { kind: "kept", reason: "unsupported-block" };
  }
  return {
    kind: "scene",
    studioId: scene.id,
    // A cell goal has no scene equivalent; the old project keeps it.
    goalDropped: saved.metadata.missionSpec?.goal !== undefined,
  };
}
