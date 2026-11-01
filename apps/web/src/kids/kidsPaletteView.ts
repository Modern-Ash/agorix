import { useSyncExternalStore } from "react";

/**
 * How the block palette is shown (#1110). "focused" opens one category at a time from the colour
 * column, so the program and the stage keep the space; "all" lists every block, as before. It is a
 * preference of this device, never sent anywhere.
 */
export type PaletteView = "focused" | "all";

export const PALETTE_VIEW_KEY = "agorix.kids.palette.view.v1";
const CHANGED = "agorix:kids-palette-view";

export function readPaletteView(storage: Pick<Storage, "getItem"> | undefined): PaletteView {
  try {
    return storage?.getItem(PALETTE_VIEW_KEY) === "all" ? "all" : "focused";
  } catch {
    return "focused";
  }
}

export function writePaletteView(
  view: PaletteView,
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PALETTE_VIEW_KEY, view);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
    return true;
  } catch {
    return false;
  }
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function usePaletteView(): PaletteView {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener(CHANGED, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(CHANGED, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => readPaletteView(browserStorage()),
    () => "focused",
  );
}
