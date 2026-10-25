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

export function dispatchOriExternalShadow(
  enabled: boolean,
  shadow: OriExternalShadow | undefined,
  input: OriExternalShadowInput,
): void {
  if (!enabled || !shadow) return;
  // Fire-and-forget by design: no external result can change the existing
  // deterministic or CLI-backed tutor response. Failures are swallowed.
  try {
    void Promise.resolve().then(() => shadow(Object.freeze({ ...input }))).catch(() => undefined);
  } catch {
    // The existing tutor path must remain unaffected.
  }
}
