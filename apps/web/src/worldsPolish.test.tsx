import { renderToStaticMarkup } from "react-dom/server";
import { runProgram } from "@agorix/runtime";
import { FIRST_MISSION, WORLDS, evaluateMission, type WorldId } from "@agorix/curriculum";
import {
  deriveStageFeedback,
  executionStepsFromRuntimeObservations,
  type StageRunStatus,
} from "@agorix/stage";
import { describe, expect, it } from "vitest";
import { StageView } from "./App.js";
import {
  INITIAL_STAGE,
  addBlockToWorkspace,
  createEditorModel,
  editNumericBlockField,
} from "./editorModel.js";

function programWithMove(steps: number) {
  const added = addBlockToWorkspace(createEditorModel().workspace, "motion_move");
  return editNumericBlockField(added.workspace, 0, "steps", steps).program;
}

function runFor(steps: number) {
  const initial = INITIAL_STAGE.initial;
  return runProgram(
    programWithMove(steps),
    {
      sprite: { x: initial.sprite.x, y: initial.sprite.y, heading: initial.sprite.heading },
      goal: { x: initial.goal.x, y: initial.goal.y },
    },
    { collectObservations: true, stopAfterSteps: 24 },
  );
}

function render(
  worldId: WorldId,
  steps: number,
  status: StageRunStatus,
  opts: { index?: number; stepping?: boolean; reduced?: boolean; locale?: "en" | "es" } = {},
) {
  const result = runFor(steps);
  const execution = executionStepsFromRuntimeObservations(result.observations);
  const frames = execution.map((step) => step.frame);
  const index = opts.index ?? frames.length - 1;
  const feedback = deriveStageFeedback({
    frames,
    index,
    status,
    stepping: opts.stepping ?? false,
  });
  const world = WORLDS.find((w) => w.id === worldId)!;
  return renderToStaticMarkup(
    <StageView
      world={world}
      frame={frames[index]}
      fallback={INITIAL_STAGE.current}
      locale={opts.locale ?? "en"}
      feedback={feedback}
      activeCode="sprite.move(10);"
      reducedMotion={opts.reduced ?? false}
    />,
  );
}

describe("Worlds are presentation over one runtime", () => {
  it("same program yields the same runtime outcome and completion in every World", () => {
    const outcomes = WORLDS.map((world) => {
      void world;
      const result = runFor(160);
      return JSON.stringify({
        outcome: result.outcome,
        world: result.world,
        observations: result.observations,
        completion: evaluateMission({ mission: FIRST_MISSION, result }),
      });
    });
    expect(new Set(outcomes).size).toBe(1);
  });

  it("every World renders the same stage geometry for the same frame", () => {
    const geometry = WORLDS.map((world) => {
      const html = render(world.id, 160, "complete");
      return /data-x="([^"]+)" data-y="([^"]+)" data-heading="([^"]+)"/.exec(html)!.slice(1);
    });
    for (const g of geometry) expect(g).toEqual(geometry[0]);
  });

  it("shows success in the World with a non-color-only mark, World copy and a runtime-observed label", () => {
    for (const world of WORLDS) {
      const html = render(world.id, 160, "complete");
      expect(html).toContain('data-stage-phase="success"');
      expect(html).toContain("Goal reached");
      expect(html).toContain("★");
      expect(html).toContain(world.copy.en.reachedFeedback);
      expect(html).toContain('data-fact-source="runtime"');
      expect(html).not.toContain("provenance-suggestion");
      expect(html).toContain("goal-ring");
    }
  });

  it("shows retry feedback in the World when the sprite stops short", () => {
    const html = render("ocean.reef", 20, "retry");
    expect(html).toContain('data-stage-phase="retry"');
    expect(html).toContain("Not there yet");
    expect(html).toContain("↻");
    expect(html).toContain("The submarine stopped before the marker.");
    expect(html).not.toContain("goal-ring");
  });

  it("syncs the active block and observed position while stepping", () => {
    const html = render("space.trailhead", 160, "stopped", { index: 0, stepping: true });
    expect(html).toContain('data-stage-phase="stepping"');
    expect(html).toContain("Step 1 of");
    expect(html).toContain('data-testid="stage-active-block"');
    expect(html).toContain("Now running: sprite.move(10);");
  });

  it("carries Agorix World identity and localizes it", () => {
    expect(render("city.crossing", 160, "idle", { locale: "en" })).toContain("Agorix World");
    const es = render("city.crossing", 160, "idle", { locale: "es" });
    expect(es).toContain("Mundo Agorix");
    expect(es).toContain('data-world="city.crossing"');
  });

  it("disables glide and pulse under reduced motion but keeps feedback", () => {
    const reduced = render("space.trailhead", 160, "complete", { reduced: true });
    expect(reduced).toContain('data-reduced-motion="true"');
    expect(reduced).toContain("transition:none");
    expect(reduced).toContain('data-pulse="false"');
    expect(reduced).toContain("Goal reached");
    const full = render("space.trailhead", 160, "complete", { reduced: false });
    expect(full).toContain("transition:transform 400ms");
    expect(full).toContain('data-pulse="true"');
  });
});
