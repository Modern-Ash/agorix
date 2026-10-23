/** The only link data kept on the child device: an opaque token and the on-device sharing switch. */
export const KIDS_LINK_KEY = "agorix.kids.link.v1";
export const KIDS_LINK_CHANGED_EVENT = "agorix-kids-link-changed";

export interface LinkState {
  readonly token: string;
  /** "Stop sharing" on this device. When false nothing is uploaded, even though the link exists. */
  readonly sharing: boolean;
}

export interface LinkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const TOKEN = /^[A-Za-z0-9_-]{20,256}$/;

function defaultStorage(): LinkStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadLink(storage: LinkStorage | undefined = defaultStorage()): LinkState | null {
  try {
    const parsed = JSON.parse(storage?.getItem(KIDS_LINK_KEY) ?? "null") as {
      token?: unknown;
      sharing?: unknown;
    } | null;
    if (!parsed || typeof parsed.token !== "string" || !TOKEN.test(parsed.token)) return null;
    return { token: parsed.token, sharing: parsed.sharing !== false };
  } catch {
    return null;
  }
}

/** False when storage is blocked: the caller must say linking cannot be kept on this device. */
export function saveLink(
  state: LinkState,
  storage: LinkStorage | undefined = defaultStorage(),
): boolean {
  try {
    if (storage === undefined) return false;
    storage.setItem(KIDS_LINK_KEY, JSON.stringify(state));
    return loadLink(storage)?.token === state.token;
  } catch {
    return false;
  }
}

export function clearLink(storage: LinkStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(KIDS_LINK_KEY);
  } catch {
    // Nothing else to do: a blocked store cannot hold a link either.
  }
}

/** Tells the app a link appeared, changed or went away, so sync can react without polling. */
export function announceLinkChange(): void {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(KIDS_LINK_CHANGED_EVENT));
  } catch {
    // Optional.
  }
}
