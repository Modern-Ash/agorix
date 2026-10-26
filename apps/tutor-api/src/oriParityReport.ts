import { classifyOriGoldenParity, type OriGoldenCase, type OriParityOutcome } from "./oriGoldenParity.js";

export interface OriParityReport {
  readonly total: number;
  readonly counts: Readonly<Record<OriParityOutcome, number>>;
  readonly comparable: number;
  readonly exactMatches: number;
  /** Null when no comparable observations exist; never treat missing as parity. */
  readonly exactMatchRate: number | null;
  readonly findings: ReturnType<typeof classifyOriGoldenParity>;
}

/**
 * Evidence-only summary. Equality of labels is not pedagogical equivalence,
 * and no threshold here can authorize rollout to children.
 */
export function buildOriParityReport(cases: readonly OriGoldenCase[]): OriParityReport {
  const findings = classifyOriGoldenParity(cases);
  const counts: Record<OriParityOutcome, number> = {
    parity: 0,
    "missing-ori": 0,
    "kind-divergence": 0,
    "hint-level-divergence": 0,
    "invalid-context": 0,
  };
  for (const finding of findings) counts[finding.outcome]++;
  const comparable = counts.parity + counts["kind-divergence"] + counts["hint-level-divergence"];
  return Object.freeze({
    total: findings.length,
    counts: Object.freeze(counts),
    comparable,
    exactMatches: counts.parity,
    exactMatchRate: comparable === 0 ? null : counts.parity / comparable,
    findings,
  });
}
