/**
 * Production safety guard: an environment variable must never activate the
 * MIG-04 learner pilot without trusted authenticated infrastructure.
 */
export function assertOriMig04StartupSafe(env: Record<string, string | undefined>): void {
  const hostMode = env["AGORIX_ORI_MIG04_HOST"];
  if (hostMode !== undefined && hostMode !== "legacy" && hostMode !== "integrated") {
    throw new Error(
      "Invalid Ori MIG-04 host mode",
    );
  }
  const requested = env["AGORIX_ORI_MIG04_PILOT"];
  // Only an absent or explicitly disabled value is accepted. Reject typos,
  // alternative truthy strings and whitespace rather than silently ignoring them.
  if (requested !== undefined && requested !== "0") {
    throw new Error(
      "Ori MIG-04 pilot requires explicit trusted PostgreSQL host bootstrap; environment activation is forbidden",
    );
  }
}
