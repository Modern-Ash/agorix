import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  COUNTER_CAP,
  LOG_LIMIT,
  MASTERY_CONCEPTS,
  STRUGGLE_RUNS,
  applyEvidence,
  conceptsOfProgram,
  emptyMastery,
  explainMastery,
  masteryStageLabel,
  readMastery,
  reusedConcepts,
  rungOf,
  stageOf,
  type MasteryEvidence,
  type MasteryState,
} from "./mastery.js";

// Issues #609 and #610: six stages per concept, moved only by runtime evidence.
const REPEAT = ["programming.repetition"] as const;
const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
const run = (
  options: Partial<{ completed: boolean; helped: boolean; free: boolean }> = {},
): MasteryEvidence => ({
  kind: "run",
  concepts: REPEAT,
  completed: options.completed ?? true,
  helped: options.helped ?? false,
  free: options.free ?? false,
});
const apply = (state: MasteryState, ...evidence: MasteryEvidence[]) =>
  evidence.reduce((current, item, index) => applyEvidence(current, item, day(index + 1)), state);
const stage = (state: MasteryState) => state.concepts["programming.repetition"].stage;

describe("stages are earned by evidence, and a higher rung implies the lower ones", () => {
  it("starts empty and reaches Descubre with one completed run", () => {
    expect(stage(emptyMastery())).toBe(0);
    expect(stage(apply(emptyMastery(), run({ helped: true })))).toBe(2);
    expect(rungOf({ ...emptyMastery().concepts["programming.sequence"].counts, runs: 1 })).toBe(1);
  });

  it("walks the whole ladder: Descubre, Imita, Prueba, Crea, Explica, Enseña", () => {
    const steps: [MasteryEvidence[], number][] = [
      [[run({ helped: true })], 2],
      [[run(), run()], 3],
      [[run({ free: true })], 4],
      [[{ kind: "explained", concepts: REPEAT }], 5],
      [[{ kind: "reuse", concepts: REPEAT }], 6],
    ];
    let state = emptyMastery();
    for (const [evidence, expected] of steps) {
      state = apply(state, ...evidence);
      expect(stage(state), String(expected)).toBe(expected);
    }
    expect(state.concepts["programming.repetition"].log.map((change) => change.to)).toEqual([
      2, 3, 4, 5, 6,
    ]);
  });

  it("does not credit a run that did not finish, nor help as independence, nor a creation with help", () => {
    expect(stage(apply(emptyMastery(), run({ completed: false })))).toBe(0);
    expect(stage(apply(emptyMastery(), run({ helped: true }), run({ helped: true })))).toBe(2);
    expect(stage(apply(emptyMastery(), run({ helped: true, free: true })))).toBe(2);
    // A free creation finished without help is Crea at once; a guided one never is.
    expect(stage(apply(emptyMastery(), run({ free: true })))).toBe(4);
  });

  it("only touches the concepts the evidence names", () => {
    const state = apply(emptyMastery(), run());
    for (const concept of MASTERY_CONCEPTS)
      expect(state.concepts[concept].stage).toBe(concept === "programming.repetition" ? 2 : 0);
  });
});

describe("going back down, and coming back up", () => {
  const earned = () => apply(emptyMastery(), run(), run());

  it("drops one stage after three failed runs in a row, and a completed run restores it", () => {
    let state = earned();
    expect(stage(state)).toBe(3);
    state = apply(state, run({ completed: false }), run({ completed: false }));
    expect(stage(state)).toBe(3);
    state = applyEvidence(state, run({ completed: false }), day(9));
    expect(stage(state)).toBe(2);
    expect(state.concepts["programming.repetition"].log.at(-1)).toMatchObject({
      from: 3,
      to: 2,
      because: "struggling",
    });
    state = applyEvidence(state, run(), day(10));
    expect(stage(state)).toBe(3);
    expect(state.concepts["programming.repetition"].log.at(-1)?.because).toBe("recovered");
  });

  it("never drops below Imita from struggling, and never removes the counts", () => {
    let state = apply(emptyMastery(), run({ helped: true }));
    for (let i = 0; i < 6; i += 1) state = applyEvidence(state, run({ completed: false }), day(5));
    expect(stage(state)).toBe(2);
    expect(state.concepts["programming.repetition"].counts.runs).toBe(1);
    expect(state.concepts["programming.repetition"].counts.failedRuns).toBe(6);
    expect(STRUGGLE_RUNS).toBe(3);
  });

  it("a success in between resets the count of failures in a row", () => {
    let state = earned();
    state = apply(
      state,
      run({ completed: false }),
      run({ completed: false }),
      run(),
      run({ completed: false }),
      run({ completed: false }),
    );
    expect(stage(state)).toBe(3);
  });

  it("computes the stage from the counters alone", () => {
    const counts = earned().concepts["programming.repetition"].counts;
    expect(stageOf(counts, 0)).toBe(3);
    expect(stageOf(counts, STRUGGLE_RUNS)).toBe(2);
  });
});

describe("bounds and purity", () => {
  it("caps counters and the log, and leaves the old state untouched", () => {
    const start = emptyMastery();
    let state = start;
    for (let i = 0; i < 150; i += 1) state = applyEvidence(state, run(), day(1));
    expect(state.concepts["programming.repetition"].counts.runs).toBe(COUNTER_CAP);
    expect(start).toEqual(emptyMastery());
    let churn = apply(emptyMastery(), run(), run());
    for (let i = 0; i < 30; i += 1)
      churn = applyEvidence(
        applyEvidence(
          applyEvidence(
            applyEvidence(churn, run({ completed: false }), day(2)),
            run({ completed: false }),
            day(2),
          ),
          run({ completed: false }),
          day(2),
        ),
        run(),
        day(3),
      );
    expect(churn.concepts["programming.repetition"].log.length).toBeLessThanOrEqual(LOG_LIMIT);
  });

  it("refuses a day that is not a day", () => {
    for (const bad of ["", "today", "2026-1-1", "2026-10-26T10:00:00Z"])
      expect(() => applyEvidence(emptyMastery(), run(), bad)).toThrow();
  });
});

describe("reading what was stored", () => {
  it("round-trips a state and recomputes the stage instead of trusting it", () => {
    const state = apply(emptyMastery(), run(), run());
    expect(readMastery(JSON.parse(JSON.stringify(state)))).toEqual(state);
    const forged = JSON.parse(JSON.stringify(state));
    forged.concepts["programming.repetition"].stage = 6;
    expect(readMastery(forged).concepts["programming.repetition"].stage).toBe(3);
  });

  it("reads anything wrong, old or hostile as empty, and keeps only known fields", () => {
    const good = JSON.parse(JSON.stringify(apply(emptyMastery(), run())));
    const bad = [
      null,
      "text",
      42,
      [],
      { version: 0, concepts: good.concepts },
      { version: 1 },
      { version: 1, concepts: { "programming.repetition": { counts: { runs: -1 } } } },
    ];
    for (const raw of bad) expect(readMastery(raw)).toEqual(emptyMastery());
    const counter = JSON.parse(JSON.stringify(good));
    counter.concepts["programming.repetition"].counts.runs = 1000;
    expect(readMastery(counter)).toEqual(emptyMastery());
    const day = JSON.parse(JSON.stringify(good));
    day.concepts["programming.repetition"].log[0].day = "2026-10-26T10:00";
    expect(readMastery(day)).toEqual(emptyMastery());
    const extra = JSON.parse(JSON.stringify(good));
    extra.concepts["programming.repetition"].name = "Mora";
    extra.childName = "Mora";
    expect(JSON.stringify(readMastery(extra))).not.toContain("Mora");
  });
});

describe("which concepts a program uses", () => {
  const program = (partial: Partial<ProjectProgram["scripts"][number]>): ProjectProgram => ({
    schema: SCHEMA_VERSION,
    variables: [{ id: "v", name: "n", initialValue: 0, visible: false }],
    scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements: [], ...partial }],
  });

  it("reads them from the canonical program only", () => {
    expect(conceptsOfProgram(program({ statements: [{ type: "move", steps: 1 }] }))).toEqual([]);
    expect(
      conceptsOfProgram(
        program({
          trigger: { type: "onKeyPressed", key: "Space" },
          statements: [
            { type: "move", steps: 1 },
            {
              type: "repeat",
              count: 2,
              body: [
                {
                  type: "changeVariable",
                  variableId: "v",
                  delta: { type: "numericLiteral", value: 1 },
                },
              ],
            },
            { type: "if", condition: { type: "touchingGoal" }, then: [{ type: "show" }] },
          ],
        }),
      ),
    ).toEqual([
      "programming.sequence",
      "programming.events",
      "programming.repetition",
      "programming.conditions",
      "programming.state.variables",
    ]);
  });

  it("counts a custom block as reused only when it is called at least twice", () => {
    const blocks = (calls: number) =>
      program({
        statements: Array.from({ length: calls }, () => ({
          type: "callProcedure" as const,
          procedureId: "p",
        })),
        procedures: [
          {
            id: "p",
            name: "Paso",
            body: [
              { type: "repeat", count: 2, body: [{ type: "move", steps: 1 }] },
              { type: "show" },
            ],
          },
        ],
      });
    expect(reusedConcepts(blocks(1))).toEqual([]);
    expect(reusedConcepts(blocks(2))).toEqual(["programming.sequence", "programming.repetition"]);
    expect(conceptsOfProgram(blocks(1))).toContain("programming.decomposition.functions");
  });
});

describe("explaining a stage", () => {
  it("says in plain words what happened, in both languages, with no text from the child", () => {
    const state = apply(emptyMastery(), run(), run());
    const concept = state.concepts["programming.repetition"];
    const es = explainMastery(concept, "es");
    expect(es[0]).toContain("Etapa: Prueba");
    expect(es[0]).toContain("2 sin ayuda");
    expect(es.join(" ")).toContain("completó dos corridas sin ayuda");
    expect(explainMastery(concept, "en")[0]).toContain("Stage: Try");
    expect(masteryStageLabel(0, "es")).toBe("Sin empezar");
    expect(masteryStageLabel(6, "en")).toBe("Teach");
  });
});
