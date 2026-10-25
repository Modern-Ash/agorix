/**
 * Strict schema validation for the experimental Ori /v1/plan response.
 * Shadow-only: no returned content is used in child-facing tutor decisions.
 */
export interface OriShadowPlan {
  readonly schema: "ori/shadow-plan/v1";
  readonly kind: "pedagogical-plan";
  readonly stage: 1 | 2 | 3 | 4 | 5;
  readonly steps: readonly [string, string, string];
  readonly hint: string;
  readonly requiresLearnerApproval: false;
  readonly appliedChanges: false;
  readonly context: { readonly missionStage: number };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
export function validateOriShadowPlan(value: unknown): OriShadowPlan | null {
  if (!record(value) || !exactKeys(value, [
    "schema", "kind", "stage", "steps", "hint", "requiresLearnerApproval",
    "appliedChanges", "context",
  ])) return null;
  if (value.schema !== "ori/shadow-plan/v1" || value.kind !== "pedagogical-plan" ||
      !Number.isInteger(value.stage) || (value.stage as number) < 1 || (value.stage as number) > 5 ||
      value.requiresLearnerApproval !== false || value.appliedChanges !== false ||
      !Array.isArray(value.steps) || value.steps.length !== 3 ||
      !value.steps.every((step: unknown) => typeof step === "string" && step.length > 0 && step.length <= 140) ||
      typeof value.hint !== "string" || value.hint.length === 0 || value.hint.length > 180 ||
      !record(value.context) || !exactKeys(value.context, ["missionStage"]) ||
      !Number.isInteger(value.context.missionStage) ||
      (value.context.missionStage as number) < 0 || (value.context.missionStage as number) > 1000) return null;
  return value as unknown as OriShadowPlan;
}
