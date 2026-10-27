import type { OriMig04RolloutPolicy } from "./oriMig04RolloutGate.js";
import { createOriMig04RolloutGate } from "./oriMig04RolloutGate.js";

/**
 * Server-owned, reversible rollout controller. Every decision re-evaluates
 * current policy so a kill switch takes effect without a process restart.
 * No public API or browser setter is exposed.
 */
export function createOriMig04RolloutController() {
  let policy: OriMig04RolloutPolicy = Object.freeze({
    mode: "disabled",
    humanAuthorized: false,
    killSwitch: true,
    approvedProjectIds: Object.freeze([]),
  });
  return Object.freeze({
    decide(projectId: string) {
      return createOriMig04RolloutGate(policy).decide(projectId);
    },
    /** Trusted host control-plane only; never accept arbitrary client input. */
    replaceFromHost(next: OriMig04RolloutPolicy): boolean {
      if (!["disabled", "shadow", "pilot"].includes(next.mode) ||
          typeof next.humanAuthorized !== "boolean" ||
          typeof next.killSwitch !== "boolean" ||
          !Array.isArray(next.approvedProjectIds) ||
          next.approvedProjectIds.length > 100 ||
          next.approvedProjectIds.some((id) => typeof id !== "string" ||
            !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) return false;
      policy = Object.freeze({
        mode: next.mode,
        humanAuthorized: next.humanAuthorized,
        killSwitch: next.killSwitch,
        approvedProjectIds: Object.freeze([...new Set(next.approvedProjectIds)]),
      });
      return true;
    },
    emergencyDisable() {
      policy = Object.freeze({
        mode: "disabled",
        humanAuthorized: false,
        killSwitch: true,
        approvedProjectIds: Object.freeze([]),
      });
    },
  });
}
