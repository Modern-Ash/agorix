import { unsolvableKidsMissions, validateKidsCatalog, type KidsCatalog } from "@agorix/curriculum";
import { useEffect, useState } from "react";

const CATALOG_PATH = "/api/tutor/catalog";
const CATALOG_TIMEOUT_MS = 3_000;
const MAX_CHARS = 32 * 1024;

/**
 * The missions as the administrator published them (issue #616). Anything that does not arrive, is
 * late, is malformed or has a mission the runtime cannot win leaves the built-in missions, which
 * the app always has: it works offline and is never blocked on this.
 */
export async function loadKidsCatalog(
  fetchImpl: typeof fetch = fetch,
): Promise<KidsCatalog | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  try {
    const response = await fetchImpl(CATALOG_PATH, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const text = await response.text();
    if (text.length > MAX_CHARS) return undefined;
    const catalog = validateKidsCatalog((JSON.parse(text) as { catalog?: unknown }).catalog);
    return unsolvableKidsMissions(catalog).length === 0 ? catalog : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

let shared: Promise<KidsCatalog | undefined> | undefined;

/** Read once per page load. `undefined` means the built-in missions, `ready` that it is settled. */
export function useKidsCatalogState(): {
  readonly catalog: KidsCatalog | undefined;
  readonly ready: boolean;
} {
  const [state, setState] = useState<{
    readonly catalog: KidsCatalog | undefined;
    readonly ready: boolean;
  }>({ catalog: undefined, ready: false });
  useEffect(() => {
    let live = true;
    shared ??= loadKidsCatalog();
    void shared.then((value) => {
      if (live) setState({ catalog: value, ready: true });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function useKidsCatalog(): KidsCatalog | undefined {
  return useKidsCatalogState().catalog;
}
