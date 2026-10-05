import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createModelComparisonActivity,
  recordModelComparisonDecision,
} from "@agorix/learning-evidence";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import { assertCatalogCompleteness } from "./i18n.js";
import { ModelComparison } from "./ModelComparison.js";
import { comparisonStage, derivedPrediction } from "./modelComparisonFlow.js";
import { BASE_PROGRAM, COMPARISON_FIXTURES } from "./modelComparisonFixtures.js";

const ids = ["proposal-a", "proposal-b"];
const progress = (patch: Record<string, unknown> = {}) => ({
  alternativeIds: ids,
  inspected: [] as string[],
  predictions: {} as Record<string, boolean>,
  ran: false,
  decided: false,
  ...patch,
});

describe("model comparison flow", () => {
  it("requires inspect, predict and run before the learner can conclude", () => {
    expect(comparisonStage(progress())).toBe("inspect");
    expect(comparisonStage(progress({ inspected: ["proposal-a"] }))).toBe("inspect");
    expect(comparisonStage(progress({ inspected: ids }))).toBe("predict");
    const predicted = { inspected: ids, predictions: { "proposal-a": true, "proposal-b": false } };
    expect(comparisonStage(progress(predicted))).toBe("run");
    expect(comparisonStage(progress({ ...predicted, ran: true }))).toBe("conclude");
    expect(comparisonStage(progress({ ...predicted, ran: true, conclusion: "one-works" }))).toBe(
      "reflect",
    );
    expect(
      comparisonStage(
        progress({ ...predicted, ran: true, conclusion: "one-works", decided: true }),
      ),
    ).toBe("done");
  });

  it("maps per-proposal guesses onto the shared prediction vocabulary", () => {
    expect(derivedPrediction({ a: true, b: false })).toBe("reachGoal");
    expect(derivedPrediction({ a: false, b: false })).toBe("notReachGoal");
  });
});

describe("model comparison fixtures against the First Mission", () => {
  const world = getLocalizedFirstMission("en").starterStage;
  const run = (id: string) =>
    createModelComparisonActivity({
      id: `fx:${id}`,
      baseProgram: BASE_PROGRAM,
      world,
      alternatives: COMPARISON_FIXTURES.find((fixture) => fixture.id === id)!.alternatives.map(
        (alternative) => ({
          id: alternative.id,
          label: alternative.id,
          program: alternative.program,
        }),
      ),
    }).alternatives.map((alternative) => alternative.runtimeStatus);

  it("covers one working, both working and one invalid proposal, without a winner", () => {
    expect(run("one-works")).toEqual(["reaches-goal", "does-not-reach-goal"]);
    expect(run("both-work")).toEqual(["reaches-goal", "reaches-goal"]);
    expect(run("one-invalid")).toEqual(["reaches-goal", "invalid-proposal"]);
  });

  it("scores a conclusion from runtime evidence only", () => {
    const activity = createModelComparisonActivity({
      id: "fx:check",
      baseProgram: BASE_PROGRAM,
      world,
      alternatives: COMPARISON_FIXTURES[0]!.alternatives.map((alternative) => ({
        id: alternative.id,
        label: alternative.id,
        program: alternative.program,
      })),
    });
    const decide = (conclusion: "one-works" | "both-work") =>
      recordModelComparisonDecision({
        activity,
        inspectedAlternativeIds: ids,
        prediction: "reachGoal",
        conclusion,
        reflection: "runtime-evidence",
        sequence: 1,
      }).evidenceBacked;
    expect(decide("one-works")).toBe(true);
    expect(decide("both-work")).toBe(false);
  });
});

describe("model comparison panel", () => {
  it("starts at inspection, shows aliases and never names a provider or a winner", () => {
    const html = renderToStaticMarkup(<ModelComparison locale="en" onClose={() => undefined} />);
    expect(html).toContain('data-stage="inspect"');
    expect(html).toContain("Proposal A");
    expect(html).toContain("Proposal B");
    expect(html).toContain("Move 160 steps");
    expect(html).toContain("Look at both suggestions first.");
    expect(html).not.toMatch(/winner|best model|ranking|GPT|Claude|Gemini/i);
    expect(html).not.toContain("Test both");
    expect(html).not.toContain("What do the runs show?");
  });

  it("is available in Spanish and the catalog is complete", () => {
    expect(() => assertCatalogCompleteness()).not.toThrow();
    const html = renderToStaticMarkup(<ModelComparison locale="es" onClose={() => undefined} />);
    expect(html).toContain("Sugerencia A");
    expect(html).toContain("Una respuesta de IA no es la verdad");
  });
});
