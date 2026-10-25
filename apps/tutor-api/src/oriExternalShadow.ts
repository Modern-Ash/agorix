/**
 * Experimental Ori external-agent shadow boundary.
 * No learner text, program content, identifiers or provider credentials cross
 * this boundary. Shadow results are deliberately discarded.
 */
export interface OriExternalShadowInput {
  readonly missionIndex: number;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly scriptCount: number;
}
export type OriExternalShadow = (input: OriExternalShadowInput) => Promise<unknown>;

export function oriExternalShadowEnabled(env: NodeJS.ProcessEnv): boolean {
  return env["AGORIX_ORI_EXTERNAL_SHADOW"] === "true";
}

/**
 * Isolated per-server dispatcher with bounded in-flight calls.
 * No queue: when capacity is exhausted, skip the shadow call so it cannot
 * introduce backpressure or hold references to child requests.
 */
export function createOriExternalShadowDispatcher(maxInFlight = 2) {
  if (!Number.isSafeInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 8) {
    throw new RangeError("Invalid Ori shadow concurrency");
  }
  let inFlight = 0;
  return Object.freeze({
    dispatch(enabled: boolean, shadow: OriExternalShadow | undefined, input: OriExternalShadowInput): void {
      if (!enabled || !shadow || inFlight >= maxInFlight) return;
      inFlight++;
      // Async boundary ensures callback exceptions never alter the tutor response.
      void Promise.resolve()
        .then(() => shadow(Object.freeze({ ...input })))
        .catch(() => undefined)
        .finally(() => { inFlight--; });
    },
    get inFlight(): number { return inFlight; },
  });
}

/** Compatibility helper; prefer a per-server dispatcher in production. */
const defaultDispatcher = createOriExternalShadowDispatcher();
export function dispatchOriExternalShadow(
  enabled: boolean,
  shadow: OriExternalShadow | undefined,
  input: OriExternalShadowInput,
): void {
  defaultDispatcher.dispatch(enabled, shadow, input);
}
