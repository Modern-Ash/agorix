import type { OriRealTextBaseline } from "./oriRealTextBaseline.js";
import type { OriLearnerHintPreview } from "./oriLearnerHintPreview.js";

/**
 * Exploratory one-message comparison. Both messages are authentic outputs
 * supplied by their actual producers, but the underlying inputs differ.
 * This is not an equal-context efficacy study.
 */
export interface OriSingleMessageComparison {
  readonly schema: "agorix/ori-single-message-comparison/v1";
  readonly missionId: string;
  readonly A: string;
  readonly B: string;
  readonly provenance: {
    readonly oriCandidate: "A" | "B";
    readonly deterministicCandidate: "A" | "B";
  };
  readonly equalInputContextProven: false;
  readonly eligibleForEfficacyClaim: false;
}
export function prepareOriSingleMessageComparison(
  baseline: OriRealTextBaseline,
  preview: OriLearnerHintPreview,
  oriFirst: boolean,
): OriSingleMessageComparison | null {
  if (!baseline || baseline.source !== "agorix-deterministic-text" ||
      baseline.programUnchanged !== true || baseline.nextStepAvailable !== false) return null;
  if (!preview || preview.status !== "ready" ||
      preview.requiresLearnerApproval !== true || preview.appliedChanges !== false) return null;
  if (typeof oriFirst !== "boolean") return null;
  if (typeof baseline.message !== "string" || baseline.message.trim().length < 8 ||
      baseline.message.length > 500) return null;
  if (typeof preview.hint !== "string" || preview.hint.trim().length < 8 ||
      preview.hint.length > 180) return null;
  if (typeof baseline.missionId !== "string" || baseline.missionId.length > 80 ||
      baseline.missionId.length < 1) return null;
  const A = oriFirst ? preview.hint : baseline.message;
  const B = oriFirst ? baseline.message : preview.hint;
  return Object.freeze({
    schema: "agorix/ori-single-message-comparison/v1",
    missionId: baseline.missionId,
    A,
    B,
    provenance: Object.freeze({
      oriCandidate: oriFirst ? "A" : "B",
      deterministicCandidate: oriFirst ? "B" : "A",
    }),
    equalInputContextProven: false,
    eligibleForEfficacyClaim: false,
  });
}
