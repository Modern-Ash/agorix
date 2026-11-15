import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  DIRECTIONS,
  directionBetween,
  explainRun,
  factsOfRun,
  judgePrediction,
  judgeQuantity,
  ideaPreviewNotes,
  previewCandidate,
  changesBetween,
  quantityKindFor,
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

describe("guessing a number", () => {
  it("asks for copies, or for blocks run when something repeats, and never for a forever", () => {
    expect(quantityKindFor(["move", "createCopies"])).toBe("copies");
    expect(quantityKindFor(["repeat", "move"])).toBe("steps");
    expect(quantityKindFor(["repeat", "forever"])).toBeNull();
    expect(quantityKindFor(["move"])).toBeNull();
  });
  it("checks the guess against the run's own copies", () => {
    const facts = factsOfRun(run([{ type: "createCopies", count: 3, rule: "spread" }]), nova);
    expect(facts.copies).toBe(3);
    expect(judgeQuantity("copies", 3, facts, "Nova", "es").match).toBe(true);
    expect(judgeQuantity("copies", 5, facts, "Nova", "en").text).toContain("but it was 3");
  });
});

describe("what changed between two runs", () => {
  const first = factsOfRun(run([{ type: "move", steps: 20 }]), nova);
  it("names every difference the runs show", () => {
    const second = factsOfRun(
      run([
        { type: "move", steps: 40 },
        { type: "createCopies", count: 2, rule: "spread" },
      ]),
      nova,
    );
    expect(changesBetween(first, second)).toEqual(["place", "steps", "copies"]);
  });
  it("says same only when nothing differs", () => {
    expect(changesBetween(first, first)).toEqual(["same"]);
  });
});

describe("previewCandidate: what an idea would change or stop", () => {
  const program = (statements: unknown[]) =>
    ({
      schema: "agorix/program/v1",
      scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements }],
    }) as never;
  const creative = {
    actors: [
      { id: "a", name: "A", x: 0, y: 0, direction: 90, size: 100, visible: true, scripts: ["s"] },
    ],
  } as never;
  const show = (current: unknown[], candidate: unknown[]) =>
    previewCandidate(program(current), program(candidate), creative, "a", []);

  it("says an idea that adds a visible step changes something", () => {
    const preview = show(
      [{ type: "move", steps: 40 }],
      [
        { type: "move", steps: 40 },
        { type: "move", steps: 40 },
      ],
    );
    expect(preview).toMatchObject({ unchanged: false, lost: [], outcome: "completed" });
  });

  it("says an idea that changes nothing on a run changes nothing", () => {
    const same = [{ type: "move", steps: 40 }];
    expect(show(same, [...same])).toMatchObject({ unchanged: true, lost: [] });
  });

  it("says how the program ends now, so a program that never ends is not blamed on the idea", () => {
    const loop = [{ type: "forever", body: [{ type: "move", steps: 40 }] }];
    const preview = show(loop, [...loop, { type: "move", steps: 40 }]);
    expect(preview?.outcomeBefore).not.toBe("completed");
    expect(preview?.unchanged).toBe(true);
    expect(show([{ type: "move", steps: 40 }], [{ type: "move", steps: 40 }])?.outcomeBefore).toBe(
      "completed",
    );
  });

  it("names what the program does now and the idea would stop", () => {
    const now = [
      { type: "move", steps: 40 },
      { type: "say", text: "Hola" },
    ];
    expect(show(now, [{ type: "move", steps: 40 }])).toMatchObject({
      unchanged: false,
      lost: ["speech"],
    });
    expect(show(now, [{ type: "say", text: "Hola" }])).toMatchObject({ lost: ["motion"] });
  });
});

describe("ideaPreviewNotes: the sentences a card adds", () => {
  const base = {
    lost: [],
    unchanged: false,
    outcomeBefore: "completed",
    outcome: "completed",
    stepsBefore: 1,
    stepsAfter: 2,
    from: { x: 0, y: 0 },
    to: { x: 40, y: 0 },
  } as const;

  it("says nothing when the idea only adds something", () => {
    expect(ideaPreviewNotes(base, "es")).toEqual([]);
  });

  it("says what an idea changes nothing of, stops, or loses, in both languages", () => {
    const notes = ideaPreviewNotes({ ...base, unchanged: true, lost: ["motion", "sound"] }, "es");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("no cambia lo que pasa");
    expect(notes[1]).toContain("el movimiento, el sonido");
    expect(ideaPreviewNotes({ ...base, lost: ["speech"] }, "en")[0]).toContain("what it says");
    expect(ideaPreviewNotes({ ...base, outcome: "budget-exceeded" }, "es")[0]).toContain(
      "no llega al final",
    );
  });

  it("does not blame an idea for a program that never ended", () => {
    expect(
      ideaPreviewNotes(
        { ...base, outcomeBefore: "budget-exceeded", outcome: "budget-exceeded" },
        "es",
      ),
    ).toEqual([]);
  });

  it("judges a tidy-up by whether it does exactly the same", () => {
    const same = ideaPreviewNotes({ ...base, unchanged: true }, "es", { meantToDoTheSame: true });
    expect(same).toEqual(["Lo probé en una copia: el programa hace exactamente lo mismo."]);
    const different = ideaPreviewNotes(base, "en", { meantToDoTheSame: true });
    expect(different[0]).toContain("does not do exactly the same");
  });
});
