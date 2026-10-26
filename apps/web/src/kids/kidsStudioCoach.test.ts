import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  DIRECTIONS,
  directionBetween,
  explainRun,
  factsOfRun,
  judgePrediction,
  reflectionFor,
} from "./kidsStudioCoach.js";
import {
  appendStudioStatement,
  creativeForStudio,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";

// Issues #604 and #606: Ori explains and asks from the runtime's own trace.
const nova = "actor:studio-1-nova";

function run(statements: Parameters<typeof appendStudioStatement>[2][]) {
  let history = createEditorHistory(createStudioProgram("nova"));
  for (const statement of statements) history = appendStudioStatement(history, nova, statement);
  const program = validateStudioProgram(history.current);
  return runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
}

describe("direction", () => {
  it("names the main direction and treats a tiny wobble as staying", () => {
    expect(directionBetween({ x: 0, y: 0 }, { x: 40, y: 3 })).toBe("right");
    expect(directionBetween({ x: 0, y: 0 }, { x: -40, y: 3 })).toBe("left");
    expect(directionBetween({ x: 0, y: 0 }, { x: 2, y: 60 })).toBe("down");
    expect(directionBetween({ x: 0, y: 0 }, { x: 2, y: -60 })).toBe("up");
    expect(directionBetween({ x: 5, y: 5 }, { x: 5.4, y: 5.4 })).toBe("stay");
    expect(DIRECTIONS).toHaveLength(5);
  });
});

describe("facts and explanation come from the trace", () => {
  it("counts blocks, positions and what moved the character", () => {
    const result = run([
      { type: "move", steps: 40 },
      { type: "turn", degrees: 90 },
      { type: "move", steps: 40 },
    ]);
    const facts = factsOfRun(result, nova);
    expect(facts.steps).toBe(3);
    expect(facts.movedBy).toEqual(["move", "move"]);
    expect(facts.outcome).toBe("completed");
    const lines = explainRun(facts, "Nova", "es");
    expect(lines[0]).toContain("ejecutó 3 bloques");
    expect(lines[0]).toContain(`(${facts.start.x}, ${facts.start.y})`);
    expect(lines.some((line) => line.includes("se detuvo"))).toBe(false);
  });

  it("reports condition results only when the trace has them", () => {
    const none = factsOfRun(run([{ type: "move", steps: 40 }]), nova);
    expect(explainRun(none, "Nova", "es").join(" ")).not.toContain("condición");
    const some = factsOfRun(
      run([
        {
          type: "if",
          condition: {
            type: "greaterThan",
            left: { type: "xPosition" },
            right: { type: "numericLiteral", value: 5 },
          },
          then: [{ type: "move", steps: 40 }],
        },
      ]),
      nova,
    );
    expect(some.condition.yes + some.condition.no).toBeGreaterThan(0);
    expect(explainRun(some, "Nova", "es").join(" ")).toContain("condición");
  });

  it("says a character ran nothing when it has no blocks, and never invents a stop", () => {
    const facts = factsOfRun(run([]), nova);
    expect(facts.steps).toBe(0);
    expect(explainRun(facts, "Nova", "es")).toEqual(["Nova no ejecutó ningún bloque."]);
    expect(
      explainRun(factsOfRun(run([{ type: "move", steps: 40 }]), nova), "Nova", "en").join(" "),
    ).not.toContain("stopped");
  });

  it("explains a stop with the real last step", () => {
    const stopped = {
      ...factsOfRun(run([{ type: "move", steps: 40 }]), nova),
      outcome: "budget-exceeded",
    };
    const text = explainRun(stopped, "Nova", "es").join(" ");
    expect(text).toContain("usó demasiados pasos");
    expect(text).toContain(`paso ${stopped.lastStep!.step}`);
  });
});

describe("prediction and reflection", () => {
  it("judges a prediction against the real direction", () => {
    const facts = factsOfRun(run([{ type: "move", steps: 40 }]), nova);
    expect(judgePrediction(facts.direction, facts, "Nova", "es").match).toBe(true);
    const wrong = judgePrediction("left", facts, "Nova", "es");
    expect(wrong.match).toBe(false);
    expect(wrong.text).toContain("pero fue");
  });

  it("asks a simpler question to younger children and a number question to older ones", () => {
    const facts = factsOfRun(
      run([
        { type: "move", steps: 40 },
        { type: "turn", degrees: 90 },
        { type: "move", steps: 40 },
      ]),
      nova,
    );
    expect(reflectionFor("6-8", facts, ["move", "turn"], "Nova", "es")?.kind).toBe("expected");
    const cause = reflectionFor("9-12", facts, ["move", "turn"], "Nova", "es");
    expect(cause).toMatchObject({ kind: "cause", answers: ["move"] });
    const count = reflectionFor("13+", facts, ["move", "turn"], "Nova", "es");
    expect(count).toMatchObject({ kind: "count", answer: 3 });
    expect(count?.kind === "count" && count.options).toContain(3);
  });

  it("asks nothing when nothing ran", () => {
    expect(reflectionFor("6-8", factsOfRun(run([]), nova), [], "Nova", "es")).toBeNull();
  });
});
