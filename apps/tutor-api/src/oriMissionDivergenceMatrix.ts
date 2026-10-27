import type { OriMissionSemanticFinding } from "./oriMissionSemanticReport.js";

export interface OriMissionDivergenceRow {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly status: "missing" | "divergent" | "partial-match" | "matched-observables";
  readonly matches: number;
  readonly divergences: number;
  readonly notComparable: number;
}
export interface OriMissionDivergenceMatrix {
  readonly total: number;
  readonly available: number;
  readonly missing: number;
  readonly divergent: number;
  readonly rows: readonly OriMissionDivergenceRow[];
}

/**
 * Technical evidence only. Even matched-observables does not demonstrate
 * pedagogical equivalence or authorize a child-facing rollout.
 */
export function buildOriMissionDivergenceMatrix(
  findings: readonly OriMissionSemanticFinding[],
): OriMissionDivergenceMatrix {
  const rows = findings.map((finding): OriMissionDivergenceRow => {
    const fields = finding.comparison?.fields ?? [];
    const matches = fields.filter((field) => field.status === "match").length;
    const divergences = fields.filter((field) => field.status === "divergence").length;
    const notComparable = fields.filter((field) => field.status === "not-comparable").length;
    const status = !finding.candidateAvailable || !finding.comparison
      ? "missing" as const
      : divergences > 0
        ? "divergent" as const
        : notComparable > 0
          ? "partial-match" as const
          : "matched-observables" as const;
    return Object.freeze({
      missionId: finding.missionId,
      missionIndex: finding.missionIndex,
      status,
      matches,
      divergences,
      notComparable,
    });
  });
  return Object.freeze({
    total: rows.length,
    available: rows.filter((row) => row.status !== "missing").length,
    missing: rows.filter((row) => row.status === "missing").length,
    divergent: rows.filter((row) => row.status === "divergent").length,
    rows: Object.freeze(rows),
  });
}
