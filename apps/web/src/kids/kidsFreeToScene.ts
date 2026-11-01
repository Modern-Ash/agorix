import { ProjectStore } from "@agorix/persistence";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import type { KidsGalleryBackdropId, KidsGalleryCharacterId } from "./kidsGallery.js";
import { KIDS_SOUNDS } from "./kidsSoundLibrary.js";
import { resolveKidsCustom } from "./kidsCustom.js";
import { listFreeProjectRefs, parseKidsGoalSpec, type KidsFreeProjectRef } from "./kidsProjects.js";
import {
  addStudioArt,
  createStudioProject,
  deleteStudioProject,
  saveStudioProject,
  setStudioSceneGoal,
} from "./kidsStudioProjects.js";
import {
  appendStudioStatement,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";
import { createEditorHistory } from "@agorix/block-editor";
import { KIDS_WORLD_STYLES } from "./worlds.js";
import { kidsV2Enabled } from "./kidsFlags.js";

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

function renderEmojiCostume(emoji: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.font = "96px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji, 64, 68);
  return canvas.toDataURL("image/png");
}

function renderWorldBackdrop(world: keyof typeof KIDS_WORLD_STYLES): string | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 260;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const style = KIDS_WORLD_STYLES[world];
  context.fillStyle = style.bg;
  context.fillRect(0, 0, 400, 260);
  context.strokeStyle = style.cell;
  context.lineWidth = 2;
  for (let x = 0; x <= 400; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 260);
    context.stroke();
  }
  for (let y = 0; y <= 260; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(400, y);
    context.stroke();
  }
  context.font = "56px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.fillText(style.character, 380, 240);
  return canvas.toDataURL("image/png");
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
  | { readonly kind: "scene"; readonly studioId: string }
  | {
      readonly kind: "kept";
      readonly reason: "unknown" | "custom-art" | "unsupported-block" | "unsupported-goal";
    };

function sceneStatement(statement: Statement): Statement | null {
  switch (statement.type) {
    case "move":
    case "turn":
      return statement;
    case "playSound":
      return KIDS_SOUNDS.some((sound) => sound.id === statement.soundId) ? statement : null;
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
  if (already !== undefined && store.has(already)) return { kind: "scene", studioId: already };
  const ref: KidsFreeProjectRef | undefined = listFreeProjectRefs(storage as never).find(
    (entry) => entry.id === freeId,
  );
  if (!ref || !store.has(freeId)) return { kind: "kept", reason: "unknown" };
  if (
    !kidsV2Enabled("customImages", { ...(storage ? { storage } : {}), production: true }) &&
    (ref.avatar.kind !== "gallery" || ref.world.kind !== "gallery")
  ) {
    return { kind: "kept", reason: "custom-art" };
  }
  const costume =
    ref.avatar.kind === "custom"
      ? resolveKidsCustom(ref.avatar.id, "explorer", storage)
      : ref.avatar.kind === "emoji"
        ? renderEmojiCostume(ref.avatar.value)
        : undefined;
  const backdrop =
    ref.world.kind === "custom"
      ? resolveKidsCustom(ref.world.id, "backdrop", storage)
      : ref.world.kind === "builtin"
        ? renderWorldBackdrop(ref.world.value)
        : undefined;
  if ((ref.avatar.kind === "custom" && !costume) || (ref.world.kind === "custom" && !backdrop))
    return { kind: "kept", reason: "custom-art" };
  const characterId =
    ref.avatar.kind === "gallery"
      ? ref.avatar.id
      : ref.avatar.kind === "emoji"
        ? (CHARACTER_OF_EMOJI[ref.avatar.value] ?? "nova")
        : "nova";
  const backdropId =
    ref.world.kind === "gallery"
      ? ref.world.id
      : ref.world.kind === "builtin"
        ? BACKDROP_OF_WORLD[ref.world.value]
        : "forest";
  const saved = store.load(freeId);
  const oldGoal = saved.metadata.missionSpec;
  if (
    oldGoal &&
    oldGoal.successCheck !== "touches-goal" &&
    oldGoal.successCheck !== "touches-goal-after-turn"
  )
    return { kind: "kept", reason: "unsupported-goal" };
  let goalCell: { cx: number; cy: number } | undefined;
  try {
    goalCell = oldGoal?.goal ? parseKidsGoalSpec(oldGoal.goal) : undefined;
  } catch {
    return { kind: "kept", reason: "unsupported-goal" };
  }
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
    const actorId = `actor:studio-1-${characterId}`;
    if (costume) addStudioArt(scene.id, "costume", actorId, costume, locale, store, storage);
    if (backdrop) addStudioArt(scene.id, "backdrop", actorId, backdrop, locale, store, storage);
    if (goalCell) {
      setStudioSceneGoal(
        scene.id,
        {
          kind: "reachCell",
          actorId,
          ...goalCell,
          ...(oldGoal?.successCheck === "touches-goal-after-turn" ? { afterTurn: true } : {}),
        },
        store,
      );
    }
    storage?.setItem(
      MIGRATED_KEY,
      JSON.stringify({ ...migratedScenes(storage), [freeId]: scene.id }),
    );
  } catch {
    deleteStudioProject(scene.id, store, storage as never);
    return { kind: "kept", reason: "unsupported-block" };
  }
  return { kind: "scene", studioId: scene.id };
}
