import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { buildOriPedagogicalReviewCorpus, type OriPedagogicalReviewCase } from "./oriPedagogicalReviewCorpus.js";

export interface OriReviewSamplingPlan {
  readonly schemaVersion: "agorix/ori-mig03-review-sampling/v1";
  readonly strategy: "risk-first-deterministic";
  readonly totalMissions: number;
  readonly selected: readonly OriPedagogicalReviewCase[];
  readonly deferred: readonly string[];
  readonly mandatoryCount: number;
  readonly requiresHumanReview: true;
  readonly rolloutAuthorized: false;
}

/**
 * Risk-first, deterministic review scheduling. Missing evidence and observable
 * divergences are mandatory; lower-risk cases are sampled in stable mission order.
 * Sampling reduces triage effort, not formal educator acceptance requirements.
 */
export function planOriPedagogicalReview(
  matrix: OriMissionDivergenceMatrix,
  normalSampleLimit = 5,
): OriReviewSamplingPlan {
  if (!Number.isSafeInteger(normalSampleLimit) || normalSampleLimit < 0 || normalSampleLimit > 1000)
    throw Error("invalid-sample-limit");
  const cases = buildOriPedagogicalReviewCorpus(matrix);
  const mandatory = cases.filter((item) => item.priority === "high")
    .sort((a, b) => a.missionIndex - b.missionIndex || a.missionId.localeCompare(b.missionId));
  const normal = cases.filter((item) => item.priority === "normal")
    .sort((a, b) => a.missionIndex - b.missionIndex || a.missionId.localeCompare(b.missionId));
  const selected = [...mandatory, ...normal.slice(0, normalSampleLimit)];
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-review-sampling/v1",
    strategy: "risk-first-deterministic",
    totalMissions: cases.length,
    selected: Object.freeze(selected),
    deferred: Object.freeze(normal.slice(normalSampleLimit).map((item) => item.missionId)),
    mandatoryCount: mandatory.length,
    requiresHumanReview: true,
    rolloutAuthorized: false,
  });
}
