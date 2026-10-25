import type { OriLearnerHintPreview } from "./oriLearnerHintPreview.js";

/**
 * Neutral text-only evaluation representation.
 * This is not a program proposal, a model transport or a child-facing response.
 */
export interface OriTextHintCandidate {
  readonly schema: "agorix/pedagogical-text-hint/v1";
  readonly hint: string;
  readonly nextStep: string;
  readonly appliedChanges: false;
}
export function toOriTextHintCandidate(
  preview: OriLearnerHintPreview,
): OriTextHintCandidate | null {
  if (
    !preview ||
    preview.status !== "ready" ||
    preview.appliedChanges !== false ||
    preview.requiresLearnerApproval !== true
  )
    return null;
  if (
    Object.keys(preview).sort().join(",") !==
    "appliedChanges,hint,nextStep,requiresLearnerApproval,status"
  )
    return null;
  if (
    typeof preview.hint !== "string" ||
    preview.hint.trim().length < 8 ||
    preview.hint.length > 180
  )
    return null;
  if (
    typeof preview.nextStep !== "string" ||
    preview.nextStep.trim().length < 8 ||
    preview.nextStep.length > 140
  )
    return null;
  return Object.freeze({
    schema: "agorix/pedagogical-text-hint/v1",
    hint: preview.hint,
    nextStep: preview.nextStep,
    appliedChanges: false,
  });
}
