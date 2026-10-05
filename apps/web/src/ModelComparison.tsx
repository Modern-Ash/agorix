import { useState } from "react";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import {
  createModelComparisonActivity,
  recordModelComparisonDecision,
  type LearningEvidenceEvent,
  type ModelComparisonActivity,
  type ModelComparisonAlternativeResult,
  type ModelComparisonConclusion,
  type ModelComparisonDecision,
  type ModelComparisonReflection,
} from "@agorix/learning-evidence";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import type { Locale, MessageKey } from "./i18n.js";
import { t } from "./i18n.js";
import { comparisonStage, derivedPrediction } from "./modelComparisonFlow.js";
import {
  BASE_PROGRAM,
  COMPARISON_FIXTURES,
  type ComparisonFixture,
} from "./modelComparisonFixtures.js";

const SCENARIO_LABEL: Record<ComparisonFixture["id"], MessageKey> = {
  "one-works": "compareScenarioOneWorks",
  "both-work": "compareScenarioBothWork",
  "one-invalid": "compareScenarioOneInvalid",
};

const CONCLUSIONS: readonly [ModelComparisonConclusion, MessageKey][] = [
  ["both-work", "compareBothWork"],
  ["one-works", "compareOneWorks"],
  ["neither-works", "compareNeitherWorks"],
  ["inconclusive", "compareInconclusive"],
];

const REFLECTIONS: readonly [ModelComparisonReflection, MessageKey][] = [
  ["runtime-evidence", "compareReflectRuntime"],
  ["different-structure", "compareReflectStructure"],
  ["needs-debugging", "compareReflectDebug"],
];

function aliasKey(id: string): MessageKey {
  return id === "proposal-a" ? "compareProposalA" : "compareProposalB";
}

function programSteps(program: ProjectProgram): number[] | undefined {
  try {
    const valid = validateProgram(program);
    return valid.scripts.flatMap((script) =>
      script.statements.flatMap((statement) =>
        statement.type === "move" ? [statement.steps] : [],
      ),
    );
  } catch {
    return undefined;
  }
}

function resultText(locale: Locale, result: ModelComparisonAlternativeResult): string {
  switch (result.runtimeStatus) {
    case "reaches-goal":
      return t(locale, "compareResultReaches", { steps: result.stepsUsed });
    case "does-not-reach-goal":
      return t(locale, "compareResultMisses", { steps: result.stepsUsed });
    case "invalid-proposal":
      return t(locale, "compareResultInvalid");
    default:
      return t(locale, "compareResultError");
  }
}

/**
 * Model-comparison activity (#101). Two AI suggestions (deterministic fixtures) are inspected,
 * predicted, tested in separate worlds and judged from runtime evidence. There is no winner
 * label and nothing is chosen for the learner.
 */
export function ModelComparison({
  locale,
  onClose,
  onEvidence,
}: {
  readonly locale: Locale;
  readonly onClose: () => void;
  readonly onEvidence?: ((event: LearningEvidenceEvent) => void) | undefined;
}) {
  const [fixtureId, setFixtureId] = useState<ComparisonFixture["id"]>("one-works");
  const [inspected, setInspected] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState<ModelComparisonActivity | undefined>();
  const [conclusion, setConclusion] = useState<ModelComparisonConclusion | undefined>();
  const [reflection, setReflection] = useState<ModelComparisonReflection | undefined>();
  const [decision, setDecision] = useState<ModelComparisonDecision | undefined>();
  const fixture =
    COMPARISON_FIXTURES.find((item) => item.id === fixtureId) ?? COMPARISON_FIXTURES[0]!;
  const alternativeIds = fixture.alternatives.map((alternative) => alternative.id);

  // Reset in the handler, not an effect, so a new scenario never renders stale results.
  function changeFixture(next: ComparisonFixture["id"]) {
    setFixtureId(next);
    setInspected([]);
    setPredictions({});
    setActivity(undefined);
    setConclusion(undefined);
    setReflection(undefined);
    setDecision(undefined);
  }

  const stage = comparisonStage({
    alternativeIds,
    inspected,
    predictions,
    ran: activity !== undefined,
    conclusion,
    reflection,
    decided: decision !== undefined,
  });

  function run() {
    const mission = getLocalizedFirstMission(locale);
    setActivity(
      createModelComparisonActivity({
        id: `model-comparison:${fixture.id}`,
        baseProgram: BASE_PROGRAM,
        world: mission.starterStage,
        alternatives: fixture.alternatives.map((alternative) => ({
          id: alternative.id,
          label: t(locale, aliasKey(alternative.id)),
          program: alternative.program,
        })),
      }),
    );
  }

  function decide() {
    if (activity === undefined || conclusion === undefined || reflection === undefined) return;
    const recorded = recordModelComparisonDecision({
      activity,
      inspectedAlternativeIds: inspected,
      prediction: derivedPrediction(predictions),
      conclusion,
      reflection,
      sequence: 1,
    });
    setDecision(recorded);
    onEvidence?.(recorded.event);
  }

  const guidance: MessageKey | undefined =
    stage === "inspect"
      ? "compareNeedInspect"
      : stage === "predict"
        ? "compareNeedPredict"
        : stage === "run"
          ? "compareNeedRun"
          : undefined;

  return (
    <section
      className="model-comparison"
      aria-labelledby="model-comparison-title"
      data-testid="model-comparison"
      data-stage={stage}
    >
      <h3 id="model-comparison-title">{t(locale, "compareTitle")}</h3>
      <p>{t(locale, "compareIntro")}</p>
      <label>
        {t(locale, "compareScenario")}{" "}
        <select
          value={fixtureId}
          onChange={(event) => changeFixture(event.target.value as ComparisonFixture["id"])}
        >
          {COMPARISON_FIXTURES.map((item) => (
            <option key={item.id} value={item.id}>
              {t(locale, SCENARIO_LABEL[item.id])}
            </option>
          ))}
        </select>
      </label>
      {activity === undefined ? null : <h4>{t(locale, "compareResults")}</h4>}
      <div className="comparison-cards">
        {fixture.alternatives.map((alternative) => {
          const name = t(locale, aliasKey(alternative.id));
          const steps = programSteps(alternative.program);
          const seen = inspected.includes(alternative.id);
          const result = activity?.alternatives.find((item) => item.id === alternative.id);
          return (
            <article key={alternative.id} aria-label={name} data-testid={`card-${alternative.id}`}>
              <h4>{name}</h4>
              {steps === undefined ? (
                <p>{t(locale, "compareNotValid")}</p>
              ) : (
                <ol>
                  {steps.map((count, index) => (
                    <li key={index}>{t(locale, "compareStepMove", { steps: count })}</li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                disabled={seen}
                onClick={() => setInspected((current) => [...current, alternative.id])}
              >
                {seen ? t(locale, "compareInspected") : t(locale, "compareInspect", { name })}
              </button>
              {stage !== "inspect" && activity === undefined ? (
                <fieldset>
                  <legend>{t(locale, "comparePredictFor", { name })}</legend>
                  {[true, false].map((guess) => (
                    <label key={String(guess)}>
                      <input
                        type="radio"
                        name={`predict-${alternative.id}`}
                        checked={predictions[alternative.id] === guess}
                        onChange={() =>
                          setPredictions((current) => ({ ...current, [alternative.id]: guess }))
                        }
                      />{" "}
                      {t(locale, guess ? "comparePredictYes" : "comparePredictNo")}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {result === undefined ? null : (
                <p role="status" data-testid={`result-${alternative.id}`}>
                  {name}: {resultText(locale, result)}.{" "}
                  {t(locale, "compareYouPredicted", {
                    predicted: t(
                      locale,
                      predictions[alternative.id] ? "comparePredictYes" : "comparePredictNo",
                    ),
                  })}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="comparison-status">
        {guidance === undefined ? "" : t(locale, guidance)}
      </p>
      {stage === "run" ? (
        <button type="button" onClick={run}>
          {t(locale, "compareRun")}
        </button>
      ) : null}
      {activity !== undefined && decision === undefined ? (
        <>
          <fieldset>
            <legend>{t(locale, "compareConclusionTitle")}</legend>
            {CONCLUSIONS.map(([value, key]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="comparison-conclusion"
                  checked={conclusion === value}
                  onChange={() => setConclusion(value)}
                />{" "}
                {t(locale, key)}
              </label>
            ))}
          </fieldset>
          {conclusion === undefined ? null : (
            <fieldset>
              <legend>{t(locale, "compareReflectionTitle")}</legend>
              {REFLECTIONS.map(([value, key]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="comparison-reflection"
                    checked={reflection === value}
                    onChange={() => setReflection(value)}
                  />{" "}
                  {t(locale, key)}
                </label>
              ))}
            </fieldset>
          )}
          <button
            type="button"
            disabled={stage !== "reflect" || reflection === undefined}
            onClick={decide}
          >
            {t(locale, "compareDecide")}
          </button>
        </>
      ) : null}
      {decision === undefined ? null : (
        <p
          role="status"
          data-testid="comparison-feedback"
          data-evidence-backed={decision.evidenceBacked}
        >
          {t(
            locale,
            conclusion === "inconclusive"
              ? "compareInconclusiveNote"
              : decision.evidenceBacked
                ? "compareMatches"
                : "compareLookAgain",
          )}{" "}
          {t(locale, "compareNoWinner")}
        </p>
      )}
      <button type="button" onClick={onClose}>
        {t(locale, "compareClose")}
      </button>
    </section>
  );
}
