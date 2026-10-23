import { isCustomRefId, listFreeProjectRefs, MAX_CUSTOM_REFS } from "./kidsProjects.js";
import { validKidsImageDataUrl } from "./kidsImages.js";

export const KIDS_CUSTOM_KEY = "agorix.kids.custom.v1";
const TOTAL_LIMIT = 2 * 1024 * 1024;
export type KidsCustomKind = "explorer" | "backdrop";
export interface KidsCustomItem {
  readonly id: string;
  readonly kind: KidsCustomKind;
  readonly dataUrl: string;
}
type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadKidsCustom(
  store: Pick<Store, "getItem"> | undefined = browserStore(),
): readonly KidsCustomItem[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KIDS_CUSTOM_KEY) ?? "null");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: KidsCustomItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const { id, kind, dataUrl } = entry as Record<string, unknown>;
      if (
        !isCustomRefId(id) ||
        seen.has(id) ||
        (kind !== "explorer" && kind !== "backdrop") ||
        !validKidsImageDataUrl(dataUrl)
      )
        continue;
      const next = [...items, { id, kind, dataUrl }];
      if (next.length > MAX_CUSTOM_REFS || JSON.stringify(next).length * 2 > TOTAL_LIMIT) break;
      seen.add(id);
      items.push({ id, kind, dataUrl });
    }
    return items;
  } catch {
    return [];
  }
}

export function resolveKidsCustom(
  id: string,
  kind: KidsCustomKind,
  store: Pick<Store, "getItem"> | undefined = browserStore(),
): string | undefined {
  return loadKidsCustom(store).find((item) => item.id === id && item.kind === kind)?.dataUrl;
}

export type KidsCustomResult =
  | { readonly ok: true; readonly item: KidsCustomItem }
  | { readonly ok: false; readonly reason: "invalidImage" | "limit" | "storageUnavailable" };

export function addKidsCustom(
  kind: KidsCustomKind,
  dataUrl: string,
  store: Store | undefined = browserStore(),
): KidsCustomResult {
  if (!validKidsImageDataUrl(dataUrl)) return { ok: false, reason: "invalidImage" };
  const previous = loadKidsCustom(store);
  const usedByProjects = listFreeProjectRefs(store)
    .flatMap((project) => [project.avatar, project.world])
    .filter((ref): ref is { readonly kind: "custom"; readonly id: string } => ref.kind === "custom")
    .map((ref) => Number(ref.id.slice(7)));
  const idNumber =
    Math.max(0, ...previous.map((item) => Number(item.id.slice(7))), ...usedByProjects) + 1;
  if (previous.length >= MAX_CUSTOM_REFS || idNumber > 99) return { ok: false, reason: "limit" };
  const item: KidsCustomItem = { id: `custom-${idNumber}`, kind, dataUrl };
  const next = [...previous, item];
  if (JSON.stringify(next).length * 2 > TOTAL_LIMIT) return { ok: false, reason: "limit" };
  try {
    if (!store) return { ok: false, reason: "storageUnavailable" };
    store.setItem(KIDS_CUSTOM_KEY, JSON.stringify(next));
    return { ok: true, item };
  } catch {
    return { ok: false, reason: "storageUnavailable" };
  }
}

export function deleteKidsCustom(id: string, store: Store | undefined = browserStore()): boolean {
  if (!isCustomRefId(id)) return false;
  const previous = loadKidsCustom(store);
  if (!previous.some((item) => item.id === id)) return false;
  try {
    if (!store) return false;
    store.setItem(KIDS_CUSTOM_KEY, JSON.stringify(previous.filter((item) => item.id !== id)));
    return true;
  } catch {
    return false;
  }
}
