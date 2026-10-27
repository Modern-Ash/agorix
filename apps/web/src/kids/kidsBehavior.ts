import {
  ORI_INTERVENTION_DEFAULT,
  validateOriInterventionPolicy,
  type OriInterventionPolicy,
} from "@agorix/ori-agent";
import { useEffect, useState } from "react";

const BEHAVIOR_PATH = "/api/tutor/behavior";
const BEHAVIOR_TIMEOUT_MS = 3_000;

/**
 * The administrator's intervention numbers (issue #615). Offline, late, malformed or out of range
 * answers all leave the built-in defaults, which are also the safest values.
 */
export async function loadInterventionPolicy(
  fetchImpl: typeof fetch = fetch,
  bucket: number = deviceBucket(),
): Promise<OriInterventionPolicy> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BEHAVIOR_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${BEHAVIOR_PATH}?bucket=${bucket}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return ORI_INTERVENTION_DEFAULT;
    const text = await response.text();
    if (text.length > 1024) return ORI_INTERVENTION_DEFAULT;
    const body = JSON.parse(text) as { intervention?: unknown };
    return validateOriInterventionPolicy(body.intervention);
  } catch {
    return ORI_INTERVENTION_DEFAULT;
  } finally {
    clearTimeout(timer);
  }
}

export const ROLLOUT_BUCKET_KEY = "agorix.kids.rollout.v1";

/**
 * This device's place in a gradual rollout (issue #620): a random whole number from 0 to 99, made
 * here once and kept. It is not tied to a child, an account or a group, it is only sent to the
 * behaviour numbers request, and 100 places is too coarse to tell devices apart.
 */
export function deviceBucket(
  store: Pick<Storage, "getItem" | "setItem"> | undefined = browserStore(),
  random: () => number = Math.random,
): number {
  try {
    const kept = store?.getItem(ROLLOUT_BUCKET_KEY);
    if (kept !== null && kept !== undefined && /^\d{1,2}$/.test(kept)) return Number(kept);
  } catch {
    // Without storage the device simply draws again next time.
  }
  const drawn = Math.min(99, Math.max(0, Math.floor(random() * 100)));
  try {
    store?.setItem(ROLLOUT_BUCKET_KEY, String(drawn));
  } catch {
    // The rollout still works for this visit.
  }
  return drawn;
}

function browserStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

let shared: Promise<OriInterventionPolicy> | undefined;

/** Reads the policy once per page load; screens start with the defaults and switch when it lands. */
export function useInterventionPolicy(): OriInterventionPolicy {
  const [policy, setPolicy] = useState<OriInterventionPolicy>(ORI_INTERVENTION_DEFAULT);
  useEffect(() => {
    let live = true;
    shared ??= loadInterventionPolicy();
    void shared.then((value) => {
      if (live) setPolicy(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return policy;
}
