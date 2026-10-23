import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "./kidsState.js";

export const KIDS_IMAGES_KEY = "agorix.kids.imgs.v1";
const TOTAL_LIMIT = 1024 * 1024;
const IMAGE_LIMIT = 60 * 1024;

export type KidsImageSlot = "ori" | `explorer:${KidsAvatar}` | `world:${KidsWorld}`;
export const KIDS_IMAGE_SLOTS: readonly KidsImageSlot[] = [
  "ori",
  ...KIDS_AVATARS.map((avatar) => `explorer:${avatar}` as const),
  ...KIDS_WORLDS.map((world) => `world:${world}` as const),
];
export type KidsImages = Partial<Record<KidsImageSlot, string>>;
export type KidsImageSaveResult =
  | { readonly ok: true; readonly images: KidsImages }
  | {
      readonly ok: false;
      readonly reason: "invalidSlot" | "invalidImage" | "tooLarge" | "storageUnavailable";
    };

type ImageStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): ImageStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function imageSlot(value: unknown): value is KidsImageSlot {
  return typeof value === "string" && (KIDS_IMAGE_SLOTS as readonly string[]).includes(value);
}

function validDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^data:image\/(?:webp|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return match !== null && Math.ceil(match[1]!.length * 0.75) < IMAGE_LIMIT;
}

/** localStorage stores UTF-16 code units; count its conservative occupied size. */
export function imageStorageBytes(images: KidsImages): number {
  return JSON.stringify(images).length * 2;
}

export function loadKidsImages(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
): KidsImages {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KIDS_IMAGES_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = parsed as Record<string, unknown>;
    const images: KidsImages = {};
    for (const slot of KIDS_IMAGE_SLOTS) {
      const candidate = entries[slot];
      if (!validDataUrl(candidate)) continue;
      const next = { ...images, [slot]: candidate };
      if (imageStorageBytes(next) <= TOTAL_LIMIT) Object.assign(images, next);
    }
    return images;
  } catch {
    return {};
  }
}

/** Transactional update: never changes the in-memory image map if persistence fails. */
export function updateKidsImage(
  slot: string,
  dataUrl: string | null,
  storage: ImageStorage | undefined = browserStorage(),
): KidsImageSaveResult {
  if (!imageSlot(slot)) return { ok: false, reason: "invalidSlot" };
  if (dataUrl !== null && !validDataUrl(dataUrl)) return { ok: false, reason: "invalidImage" };
  const next: KidsImages = { ...loadKidsImages(storage) };
  if (dataUrl === null) delete next[slot];
  else next[slot] = dataUrl;
  if (imageStorageBytes(next) > TOTAL_LIMIT) return { ok: false, reason: "tooLarge" };
  try {
    if (!storage) return { ok: false, reason: "storageUnavailable" };
    storage.setItem(KIDS_IMAGES_KEY, JSON.stringify(next));
    return { ok: true, images: next };
  } catch {
    return { ok: false, reason: "storageUnavailable" };
  }
}

export function clearKidsImages(
  storage: ImageStorage | undefined = browserStorage(),
): KidsImageSaveResult {
  try {
    if (!storage) return { ok: false, reason: "storageUnavailable" };
    storage.setItem(KIDS_IMAGES_KEY, "{}");
    return { ok: true, images: {} };
  } catch {
    return { ok: false, reason: "storageUnavailable" };
  }
}
