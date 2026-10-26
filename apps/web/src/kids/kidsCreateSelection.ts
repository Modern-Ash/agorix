import { KIDS_AVATARS, KIDS_WORLDS } from "./kidsState.js";
import { isCustomRefId, type KidsAvatarRef, type KidsWorldRef } from "./kidsProjects.js";
import {
  isGalleryBackdropId,
  isGalleryCharacterId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "./kidsGallery.js";

/**
 * The one character and one backdrop the child picked in Crear (issue #594). It is remembered on
 * this device so the choice survives leaving the screen and reloading, and every way of creating
 * (a scene or a single-character world) starts from it. It holds only fixed ids, never text.
 */
export const KIDS_CREATE_SELECTION_KEY = "agorix.kids.create.v1";

export interface KidsCreateSelection {
  readonly avatar: KidsAvatarRef;
  readonly world: KidsWorldRef;
}

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function avatarRef(value: unknown): KidsAvatarRef | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as { kind?: unknown; value?: unknown; id?: unknown };
  if (item.kind === "emoji" && (KIDS_AVATARS as readonly unknown[]).includes(item.value))
    return { kind: "emoji", value: item.value as (typeof KIDS_AVATARS)[number] };
  if (item.kind === "gallery" && isGalleryCharacterId(item.id))
    return { kind: "gallery", id: item.id };
  if (item.kind === "custom" && isCustomRefId(item.id)) return { kind: "custom", id: item.id };
  return null;
}

function worldRef(value: unknown): KidsWorldRef | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as { kind?: unknown; value?: unknown; id?: unknown };
  if (item.kind === "builtin" && (KIDS_WORLDS as readonly unknown[]).includes(item.value))
    return { kind: "builtin", value: item.value as (typeof KIDS_WORLDS)[number] };
  if (item.kind === "gallery" && isGalleryBackdropId(item.id))
    return { kind: "gallery", id: item.id };
  if (item.kind === "custom" && isCustomRefId(item.id)) return { kind: "custom", id: item.id };
  return null;
}

/** The saved choice, or null when there is none or it is not valid. */
export function loadCreateSelection(
  store: Store | undefined = browserStore(),
): KidsCreateSelection | null {
  try {
    const parsed = JSON.parse(store?.getItem(KIDS_CREATE_SELECTION_KEY) ?? "null") as {
      avatar?: unknown;
      world?: unknown;
    } | null;
    const avatar = avatarRef(parsed?.avatar);
    const world = worldRef(parsed?.world);
    return avatar && world ? { avatar, world } : null;
  } catch {
    return null;
  }
}

export function saveCreateSelection(
  selection: KidsCreateSelection,
  store: Store | undefined = browserStore(),
): void {
  try {
    store?.setItem(KIDS_CREATE_SELECTION_KEY, JSON.stringify(selection));
  } catch {
    // The choice still works for this visit.
  }
}

export const DEFAULT_STUDIO_CHARACTER: KidsGalleryCharacterId = "nova";
export const DEFAULT_STUDIO_BACKDROP: KidsGalleryBackdropId = "forest";

/** What Escena libre can start with: a gallery character and backdrop, else its defaults. */
export function studioStart(selection: KidsCreateSelection): {
  readonly characterId: KidsGalleryCharacterId;
  readonly backdropId: KidsGalleryBackdropId;
  readonly characterIsChosen: boolean;
  readonly backdropIsChosen: boolean;
} {
  const characterIsChosen = selection.avatar.kind === "gallery";
  const backdropIsChosen = selection.world.kind === "gallery";
  return {
    characterId:
      selection.avatar.kind === "gallery" ? selection.avatar.id : DEFAULT_STUDIO_CHARACTER,
    backdropId: selection.world.kind === "gallery" ? selection.world.id : DEFAULT_STUDIO_BACKDROP,
    characterIsChosen,
    backdropIsChosen,
  };
}
