/**
 * Production safety guard: an environment variable must never activate the
 * MIG-04 learner pilot without trusted authenticated infrastructure.
 */
export function assertOriMig04StartupSafe(env: Record<string, string | undefined>): void {
  const requested = env["AGORIX_ORI_MIG04_PILOT"] === "1";
  if (requested) {
    throw new Error(
      "Ori MIG-04 pilot requires explicit trusted PostgreSQL host bootstrap; environment activation is forbidden",
    );
  }
}
