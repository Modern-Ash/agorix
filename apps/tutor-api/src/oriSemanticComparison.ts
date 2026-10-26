import type { OriSemanticProjection } from "./oriSemanticProjection.js";

export interface OriSemanticFieldComparison {
  readonly field: "actionFamily" | "reviewRequired" | "mutatesProgram" | "pedagogicalHintLevel";
  readonly status: "match" | "divergence" | "not-comparable";
}
export interface OriSemanticComparison {
  readonly fields: readonly OriSemanticFieldComparison[];
  readonly comparableFields: number;
  readonly matchingFields: number;
  /** Null when no shared observable field exists. Not a pedagogical score. */
  readonly matchRate: number | null;
}

/**
 * Compares only jointly observed properties; unknown and null are not
 * treated as equality. A match is technical parity, not educator approval.
 */
export function compareOriSemanticProjections(
  legacy: OriSemanticProjection,
  ori: OriSemanticProjection,
): OriSemanticComparison {
  const fields = ([
    "actionFamily",
    "reviewRequired",
    "mutatesProgram",
    "pedagogicalHintLevel",
  ] as const).map((field): OriSemanticFieldComparison => {
    const left = legacy[field];
    const right = ori[field];
    if (left === null || right === null || left === "unknown" || right === "unknown")
      return { field, status: "not-comparable" };
    return { field, status: left === right ? "match" : "divergence" };
  });
  const comparableFields = fields.filter((entry) => entry.status !== "not-comparable").length;
  const matchingFields = fields.filter((entry) => entry.status === "match").length;
  return Object.freeze({
    fields,
    comparableFields,
    matchingFields,
    matchRate: comparableFields === 0 ? null : matchingFields / comparableFields,
  });
}
