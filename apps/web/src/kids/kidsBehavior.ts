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
): Promise<OriInterventionPolicy> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BEHAVIOR_TIMEOUT_MS);
  try {
    const response = await fetchImpl(BEHAVIOR_PATH, {
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
