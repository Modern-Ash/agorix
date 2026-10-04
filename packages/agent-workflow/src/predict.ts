export type PredictionAnswer = "yes" | "no";
export type PredictionResult = "matched" | "mismatched" | "skipped";

/** The only question in this slice: will the character reach the goal. Compared with a real run. */
export function comparePrediction(
  answer: PredictionAnswer | undefined,
  reachedGoal: boolean,
): PredictionResult {
  if (answer === undefined) {
    return "skipped";
  }
  return (answer === "yes") === reachedGoal ? "matched" : "mismatched";
}
