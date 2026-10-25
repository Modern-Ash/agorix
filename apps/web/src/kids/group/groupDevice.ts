/**
 * The only group data kept on a child device: an opaque key, for this tab session only.
 * Closing the tab forgets it, so a shared tablet never reopens a previous group by itself.
 */
export const KIDS_GROUP_DEVICE_KEY = "agorix.kids.group.device.v1";

export interface GroupDeviceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const TOKEN = /^dev_[A-Za-z0-9_-]{20,256}$/;

function defaultStorage(): GroupDeviceStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function loadGroupDevice(
  storage: GroupDeviceStorage | undefined = defaultStorage(),
): string | null {
  try {
    const value = storage?.getItem(KIDS_GROUP_DEVICE_KEY) ?? null;
    return value !== null && TOKEN.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** False when storage is blocked: the caller must say the group cannot be kept on this device. */
export function saveGroupDevice(
  token: string,
  storage: GroupDeviceStorage | undefined = defaultStorage(),
): boolean {
  try {
    if (storage === undefined || !TOKEN.test(token)) return false;
    storage.setItem(KIDS_GROUP_DEVICE_KEY, token);
    return loadGroupDevice(storage) === token;
  } catch {
    return false;
  }
}

export function clearGroupDevice(storage: GroupDeviceStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(KIDS_GROUP_DEVICE_KEY);
  } catch {
    // A blocked store cannot hold a key either.
  }
}
