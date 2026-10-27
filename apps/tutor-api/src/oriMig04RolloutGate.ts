export type OriMig04Mode = "disabled" | "shadow" | "pilot";

export interface OriMig04RolloutPolicy {
  readonly mode: OriMig04Mode;
  readonly humanAuthorized: boolean;
  readonly killSwitch: boolean;
  readonly approvedProjectIds: readonly string[];
}

/**
 * Server-only, fail-closed routing decision. This does not enable Ori routes
 * by itself; the host must explicitly install the reviewed policy.
 */
export function createOriMig04RolloutGate(policy: OriMig04RolloutPolicy) {
  const approved = new Set(policy.approvedProjectIds);
  return Object.freeze({
    decide(projectId: string): {
      readonly mode: OriMig04Mode;
      readonly learnerVisible: boolean;
      readonly fallbackToKids: boolean;
    } {
      if (policy.killSwitch || !projectId || policy.mode === "disabled")
        return { mode: "disabled", learnerVisible: false, fallbackToKids: true };
      if (policy.mode === "shadow")
        return { mode: "shadow", learnerVisible: false, fallbackToKids: true };
      if (!policy.humanAuthorized || !approved.has(projectId))
        return { mode: "disabled", learnerVisible: false, fallbackToKids: true };
      return { mode: "pilot", learnerVisible: true, fallbackToKids: true };
    },
  });
}
