import { comparePrediction, type PredictionAnswer } from "@agorix/agent-workflow";
import type { Locale } from "./i18n.js";
import { t } from "./i18n.js";

/** Optional, skippable prediction. Running without answering is a valid, silent skip. */
export function PredictionChip({
  locale,
  answer,
  onAnswer,
}: {
  readonly locale: Locale;
  readonly answer: PredictionAnswer | undefined;
  readonly onAnswer: (answer: PredictionAnswer | undefined) => void;
}) {
  return (
    <fieldset className="prediction-chip">
      <legend>{t(locale, "predictQuestion")}</legend>
      <button type="button" aria-pressed={answer === "yes"} onClick={() => onAnswer("yes")}>
        {t(locale, "predictYes")}
      </button>
      <button type="button" aria-pressed={answer === "no"} onClick={() => onAnswer("no")}>
        {t(locale, "predictNo")}
      </button>
      <button type="button" aria-pressed={answer === undefined} onClick={() => onAnswer(undefined)}>
        {t(locale, "predictSkip")}
      </button>
    </fieldset>
  );
}

/** Compares the learner's prediction with the observed runtime result. Neutral tone, no scoring. */
export function PredictionComparison({
  locale,
  answer,
  reachedGoal,
}: {
  readonly locale: Locale;
  readonly answer: PredictionAnswer | undefined;
  readonly reachedGoal: boolean | undefined;
}) {
  if (answer === undefined || reachedGoal === undefined) return null;
  const mismatched = comparePrediction(answer, reachedGoal) === "mismatched";
  return (
    <p role="status" className="prediction-comparison" data-testid="prediction-comparison">
      {t(locale, "predictionCompared", {
        predicted: t(locale, answer === "yes" ? "predictYes" : "predictNo"),
        observed: t(locale, reachedGoal ? "observedReached" : "observedNotReached"),
      })}{" "}
      <small>({t(locale, "runtimeFactLabel")})</small>
      {mismatched ? <> {t(locale, "predictionLookCloser")}</> : null}
    </p>
  );
}
