import type { Prediction } from "@agorix/learning-evidence";

export type ComparisonStage = "inspect" | "predict" | "run" | "conclude" | "reflect" | "done";

export interface ComparisonProgress {
  readonly alternativeIds: readonly string[];
  readonly inspected: readonly string[];
  /** The learner's yes/no guess per alternative: "will it reach the goal?" */
  readonly predictions: Readonly<Record<string, boolean>>;
  readonly ran: boolean;
  readonly conclusion?: string | undefined;
  readonly reflection?: string | undefined;
  readonly decided: boolean;
}

/** The learner must inspect, predict and run before concluding; nothing is auto-selected. */
export function comparisonStage(progress: ComparisonProgress): ComparisonStage {
  if (!progress.alternativeIds.every((id) => progress.inspected.includes(id))) return "inspect";
  if (!progress.alternativeIds.every((id) => progress.predictions[id] !== undefined)) {
    return "predict";
  }
  if (!progress.ran) return "run";
  if (progress.conclusion === undefined) return "conclude";
  if (!progress.decided) return "reflect";
  return "done";
}

/** Maps the per-proposal guesses onto the shared evidence prediction vocabulary. */
export function derivedPrediction(predictions: Readonly<Record<string, boolean>>): Prediction {
  return Object.values(predictions).some(Boolean) ? "reachGoal" : "notReachGoal";
}
