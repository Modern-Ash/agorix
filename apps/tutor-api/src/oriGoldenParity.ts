/**
 * MIG-03: deterministic, non-mutating comparison of synthetic golden cases.
 * The comparator reports differences; it never decides that a model is safe
 * for children or silently upgrades shadow traffic to active execution.
 */
export interface OriGoldenCase {
  readonly caseId: string;
  readonly contextDigest: string;
  readonly legacy: { readonly kind: string; readonly hintLevel: number };
  readonly ori: { readonly kind: string; readonly hintLevel: number } | null;
}
export type OriParityOutcome =
  | "parity"
  | "missing-ori"
  | "kind-divergence"
  | "hint-level-divergence"
  | "invalid-context";
export interface OriParityFinding {
  readonly caseId: string;
  readonly outcome: OriParityOutcome;
}
const DIGEST = /^[a-f0-9]{64}$/;
export function classifyOriGoldenParity(cases: readonly OriGoldenCase[]): readonly OriParityFinding[] {
  return cases.map((entry) => {
    const valid =
      !!entry.caseId && entry.caseId.length <= 80 &&
      DIGEST.test(entry.contextDigest) &&
      Number.isSafeInteger(entry.legacy.hintLevel) &&
      entry.legacy.hintLevel >= 1 && entry.legacy.hintLevel <= 5 &&
      (entry.ori === null || (
        Number.isSafeInteger(entry.ori.hintLevel) &&
        entry.ori.hintLevel >= 1 && entry.ori.hintLevel <= 5
      ));
    const outcome: OriParityOutcome = !valid
      ? "invalid-context"
      : entry.ori === null
        ? "missing-ori"
        : entry.legacy.kind !== entry.ori.kind
          ? "kind-divergence"
          : entry.legacy.hintLevel !== entry.ori.hintLevel
            ? "hint-level-divergence"
            : "parity";
    return Object.freeze({ caseId: entry.caseId, outcome });
  });
}
