import type { LearningEvidenceEvent } from "@agorix/learning-evidence";
import { adultSummary, type AdultSettings } from "../kidsAdults.js";
import type { KidsProgress } from "../kidsProgress.js";
import { isLinkApiError, type DeviceSummary, type LinkApi } from "./linkApi.js";
import { clearLink, loadLink, saveLink, type LinkStorage } from "./kidsLink.js";
import { clearUsageDays } from "./kidsUsageDays.js";

/**
 * The upload is built from exactly what the Adults panel already shows (same function), plus
 * minutes per day. Nothing from projects, events with times, Ori chat, images or audio.
 */
export function buildLinkSummary(input: {
  readonly progress: KidsProgress;
  readonly events: readonly LearningEvidenceEvent[];
  readonly settings: AdultSettings;
  readonly usageDays: Readonly<Record<string, number>>;
}): DeviceSummary {
  const shown = adultSummary(input.progress, input.events);
  const minutesByDay = Object.keys(input.usageDays)
    .sort()
    .slice(-14)
    .map((day) => ({
      day,
      minutes: Math.min(1440, Math.floor((input.usageDays[day] ?? 0) / 60)),
    }));
  const cap = (value: number, max: number) => Math.max(0, Math.min(max, Math.floor(value)));
  return {
    version: 1,
    completedMissions: cap(shown.completedMissions, 12),
    practicedConcepts: [
      cap(shown.practicedConcepts[0], 4),
      cap(shown.practicedConcepts[1], 4),
      cap(shown.practicedConcepts[2], 4),
    ],
    decisions: {
      used: cap(shown.decisions.used, 100_000),
      changed: cap(shown.decisions.changed, 100_000),
      rejected: cap(shown.decisions.rejected, 100_000),
    },
    minutesByDay,
    ageBand: input.settings.ageBand,
    dailyLimitMinutes: cap(input.settings.dailyLimitMinutes, 120),
  };
}

export type SyncResult = "skipped" | "stored" | "sync-off" | "unlinked" | "retry";

/** One upload attempt. Silent by design: the child never sees a sync problem. */
export async function syncOnce(deps: {
  readonly api: Pick<LinkApi, "putSummary">;
  readonly summary: () => DeviceSummary;
  readonly storage?: LinkStorage;
}): Promise<SyncResult> {
  const link = loadLink(deps.storage);
  if (link === null || !link.sharing) return "skipped";
  try {
    const result = await deps.api.putSummary(link.token, deps.summary());
    // The token rotates on every use: keep the new one or the link is lost.
    saveLink({ token: result.deviceToken, sharing: link.sharing }, deps.storage);
    return result.stored ? "stored" : "sync-off";
  } catch (error) {
    if (isLinkApiError(error, "unauthenticated")) {
      // The adult unlinked this device (or the token expired): forget it quietly.
      clearLink(deps.storage);
      clearUsageDays(deps.storage);
      return "unlinked";
    }
    return "retry";
  }
}

export interface SyncScheduler {
  /** Ask for an upload. Bursts coalesce; `force` skips the minimum interval (used right after linking). */
  request(options?: { readonly force?: boolean }): void;
  dispose(): void;
}

export function createSyncScheduler(deps: {
  readonly run: () => Promise<SyncResult>;
  readonly minIntervalMs?: number;
  readonly now?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly retryMs?: number;
}): SyncScheduler {
  const minInterval = deps.minIntervalMs ?? 5 * 60 * 1000;
  const retryMs = deps.retryMs ?? 60 * 1000;
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as number));
  let lastRun = Number.NEGATIVE_INFINITY;
  let timer: unknown;
  let running = false;
  let again = false;
  let disposed = false;

  async function fire() {
    timer = undefined;
    if (disposed) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    lastRun = now();
    let outcome: SyncResult = "skipped";
    try {
      outcome = await deps.run();
    } catch {
      outcome = "retry";
    } finally {
      running = false;
    }
    if (disposed) return;
    if (outcome === "retry") schedule(retryMs);
    else if (again) {
      again = false;
      schedule(minInterval);
    }
  }

  function schedule(ms: number) {
    if (timer !== undefined || disposed) return;
    timer = setTimer(() => void fire(), ms);
  }

  return {
    request(options = {}) {
      if (disposed) return;
      if (running) {
        again = true;
        return;
      }
      const wait = options.force === true ? 0 : Math.max(0, lastRun + minInterval - now());
      if (wait === 0) {
        if (timer !== undefined) {
          clearTimer(timer);
          timer = undefined;
        }
        void fire();
      } else {
        schedule(wait);
      }
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
    },
  };
}
