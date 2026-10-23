import { loadLink, type LinkStorage } from "./kidsLink.js";

/**
 * Minutes per day for the last 14 days. It is kept ONLY while a device is linked (so an unlinked
 * device keeps no daily trail, as before) and is cleared when the link goes away.
 */
export const KIDS_USAGE_DAYS_KEY = "agorix.kids.usage-days.v1";
const MAX_DAYS = 14;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function defaultStorage(): (LinkStorage & { removeItem(key: string): void }) | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readUsageDays(
  storage: LinkStorage | undefined = defaultStorage(),
): Readonly<Record<string, number>> {
  try {
    const parsed = JSON.parse(storage?.getItem(KIDS_USAGE_DAYS_KEY) ?? "null") as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const days: Record<string, number> = {};
    for (const [day, seconds] of Object.entries(parsed)) {
      if (
        DAY.test(day) &&
        typeof seconds === "number" &&
        Number.isFinite(seconds) &&
        seconds >= 0
      ) {
        days[day] = Math.min(86_400, Math.floor(seconds));
      }
    }
    return days;
  } catch {
    return {};
  }
}

/** No-op unless linked. Keeps the newest 14 days. */
export function recordLinkedUsage(
  day: string,
  seconds: number,
  storage: LinkStorage | undefined = defaultStorage(),
): void {
  if (!DAY.test(day) || !Number.isFinite(seconds) || seconds <= 0) return;
  if (loadLink(storage) === null) return;
  try {
    const days = { ...readUsageDays(storage) };
    days[day] = Math.min(86_400, (days[day] ?? 0) + Math.floor(seconds));
    const keep = Object.keys(days).sort().slice(-MAX_DAYS);
    const trimmed: Record<string, number> = {};
    for (const key of keep) trimmed[key] = days[key]!;
    storage?.setItem(KIDS_USAGE_DAYS_KEY, JSON.stringify(trimmed));
  } catch {
    // Optional aggregate.
  }
}

export function clearUsageDays(storage: LinkStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(KIDS_USAGE_DAYS_KEY);
  } catch {
    // Nothing to do.
  }
}
