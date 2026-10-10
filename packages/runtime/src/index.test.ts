import { describe, expect, it } from "vitest";
import { projectProgram } from "@agorix/code-generator";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  PACKAGE_NAME,
  RuntimeExecutionError,
  createWorldState,
  moveWorld,
  normalizeHeading,
  resetWorldState,
  runProgram,
  toSanitizedTutorContext,
  touchingGoal,
  turnWorld,
  type RunResult,
} from "./index.js";

const program = (statements: ProjectProgram["scripts"][number]["statements"]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});

const serialize = (result: RunResult): string => JSON.stringify(result);

describe("runtime package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/runtime");
  });
});

describe("world semantics", () => {
  it("normalizes headings and moves east at 0 degrees", () => {
    expect(normalizeHeading(-90)).toBe(270);
    const world = createWorldState({ sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 10, y: 0 } });
    const moved = moveWorld(world, 10);
    expect(moved.sprite).toMatchObject({ x: 10, y: 0, heading: 0 });
    expect(moved.sprite).toMatchObject({ visible: true, size: 100 });
    expect(touchingGoal(moved)).toBe(true);
  });

  it("turns counter-clockwise and rounds coordinates deterministically", () => {
    const world = createWorldState({ sprite: { heading: 0 }, goal: { x: 0, y: 1 } });
    const turned = turnWorld(world, 90);
    const moved = moveWorld(turned, 1);
    expect(turned.sprite.heading).toBe(90);
    expect(moved.sprite.x).toBe(0);
    expect(moved.sprite.y).toBe(1);
    expect(touchingGoal(moved)).toBe(true);
  });
});

describe("runProgram operations", () => {
  it("executes onStart scripts, move, turn, repeat, if, and touchingGoal in order", () => {
    const result = runProgram(
      program([
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
        { type: "move", steps: 2 },
        {
          type: "if",
          condition: { type: "touchingGoal" },
          then: [{ type: "turn", degrees: 90 }],
        },
        {
          type: "repeat",
          count: 2,
          body: [{ type: "move", steps: 1 }],
        },
      ]),
      createWorldState({ goal: { x: 3, y: 2 } }),
    );
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite).toMatchObject({ x: 1, y: 2, heading: 180 });
    expect(result.stepsUsed).toBe(8);
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "move",
      "turn",
      "move",
      "turn",
      "if",
      "move",
      "move",
      "repeat",
    ]);
  });

  it("uses boolean and numeric literal truthiness", () => {
    const result = runProgram(
      program([
        {
          type: "if",
          condition: { type: "booleanLiteral", value: false },
          then: [{ type: "move", steps: 10 }],
        },
        {
          type: "if",
          condition: { type: "numericLiteral", value: 0 },
          then: [{ type: "move", steps: 10 }],
        },
        {
          type: "if",
          condition: { type: "numericLiteral", value: -1 },
          then: [{ type: "move", steps: 4 }],
        },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.x).toBe(4);
    expect(result.stepsUsed).toBe(4);
  });

  it("executes variables, operators, and watcher visibility as world state", () => {
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        variables: [
          { id: "score", name: "score", initialValue: 2, visible: true },
          { id: "energy", name: "energy", initialValue: 5, visible: false },
        ],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              {
                type: "changeVariable",
                variableId: "score",
                delta: {
                  type: "multiply",
                  left: { type: "variable", variableId: "energy" },
                  right: { type: "numericLiteral", value: 3 },
                },
              },
              {
                type: "if",
                condition: {
                  type: "equals",
                  left: {
                    type: "add",
                    left: { type: "variable", variableId: "score" },
                    right: { type: "numericLiteral", value: 3 },
                  },
                  right: { type: "numericLiteral", value: 20 },
                },
                then: [{ type: "showVariable", variableId: "energy" }],
              },
              {
                type: "setVariable",
                variableId: "energy",
                value: {
                  type: "divide",
                  left: { type: "variable", variableId: "score" },
                  right: { type: "numericLiteral", value: 4 },
                },
              },
              { type: "hideVariable", variableId: "score" },
            ],
          },
        ],
      },
      createWorldState(),
    );

    expect(result.world.variables).toEqual({
      energy: { value: 4.25, visible: true },
      score: { value: 17, visible: false },
    });
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "changeVariable",
      "showVariable",
      "if",
      "setVariable",
      "hideVariable",
    ]);
  });

  it("fails deterministically on divide-by-zero expressions", () => {
    expect(() =>
      runProgram(
        {
          schema: SCHEMA_VERSION,
          variables: [{ id: "score", name: "score", initialValue: 1, visible: true }],
          scripts: [
            {
              id: "main",
              trigger: { type: "onStart" },
              statements: [
                {
                  type: "setVariable",
                  variableId: "score",
                  value: {
                    type: "divide",
                    left: { type: "numericLiteral", value: 1 },
                    right: { type: "numericLiteral", value: 0 },
                  },
                },
              ],
            },
          ],
        },
        createWorldState(),
      ),
    ).toThrow(RuntimeExecutionError);
  });

  it("executes greater-than, boolean operators, and seeded random deterministically", () => {
    const randomProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [{ id: "score", name: "score", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "score",
              value: {
                type: "random",
                min: { type: "numericLiteral", value: 1 },
                max: { type: "numericLiteral", value: 3 },
              },
            },
            {
              type: "if",
              condition: {
                type: "and",
                left: {
                  type: "greaterThan",
                  left: { type: "variable", variableId: "score" },
                  right: { type: "numericLiteral", value: 1 },
                },
                right: {
                  type: "not",
                  value: {
                    type: "or",
                    left: { type: "booleanLiteral", value: false },
                    right: { type: "booleanLiteral", value: false },
                  },
                },
              },
              then: [{ type: "move", steps: 5 }],
            },
          ],
        },
      ],
    };

    const first = runProgram(randomProgram, createWorldState(), { randomSeed: 42 });
    const replay = runProgram(randomProgram, createWorldState(), { randomSeed: 42 });
    const differentSeed = runProgram(randomProgram, createWorldState(), { randomSeed: 7 });

    expect(first.world.variables?.score?.value).toBe(replay.world.variables?.score?.value);
    expect(first.trace.map((entry) => entry.statementType)).toEqual(["setVariable", "move", "if"]);
    expect(differentSeed.world.variables?.score?.value).not.toBe(
      first.world.variables?.score?.value,
    );
  });

  it("executes looks statements as deterministic world changes", () => {
    const result = runProgram(
      program([
        { type: "say", text: "Hello" },
        { type: "think", text: "Hmm" },
        { type: "hide" },
        { type: "show" },
        { type: "setSize", size: 150 },
        { type: "switchCostume", costumeId: "asset:costume.default" },
        { type: "switchBackdrop", backdropId: "asset:space.trailhead" },
        { type: "playSound", soundId: "asset:sound.beacon" },
        { type: "stopSounds" },
      ]),
      createWorldState(),
    );

    expect(result.world.sprite).toMatchObject({
      visible: true,
      size: 150,
      costumeId: "asset:costume.default",
      bubble: { kind: "think", text: "Hmm" },
    });
    expect(result.world.backdropId).toBe("asset:space.trailhead");
    expect(result.world.sounds?.activeSoundIds).toEqual([]);
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "say",
      "think",
      "hide",
      "show",
      "setSize",
      "switchCostume",
      "switchBackdrop",
      "playSound",
      "stopSounds",
    ]);
    expect(result.trace.at(-2)?.worldAfter.sounds?.activeSoundIds).toEqual(["asset:sound.beacon"]);
  });

  it("supports nested repeat and if structures", () => {
    const result = runProgram(
      program([
        {
          type: "repeat",
          count: 2,
          body: [
            { type: "move", steps: 1 },
            {
              type: "if",
              condition: { type: "booleanLiteral", value: true },
              then: [{ type: "repeat", count: 2, body: [{ type: "move", steps: 1 }] }],
            },
          ],
        },
      ]),
      createWorldState(),
    );
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite.x).toBe(6);
    expect(result.stepsUsed).toBe(11);
  });
});

describe("budget and stop", () => {
  it("returns budget-exceeded before applying the next statement", () => {
    const result = runProgram(
      program([
        { type: "move", steps: 1 },
        { type: "move", steps: 1 },
      ]),
      createWorldState(),
      { maxSteps: 1 },
    );
    expect(result.outcome).toBe("budget-exceeded");
    expect(result.world.sprite.x).toBe(1);
    expect(result.stepsUsed).toBe(1);
    expect(result.trace).toHaveLength(1);
  });

  it("returns stopped distinctly at a statement boundary", () => {
    const result = runProgram(
      program([
        { type: "move", steps: 1 },
        { type: "move", steps: 1 },
      ]),
      createWorldState(),
      { stopAfterSteps: 1 },
    );
    expect(result.outcome).toBe("stopped");
    expect(result.world.sprite.x).toBe(1);
    expect(result.stepsUsed).toBe(1);
  });

  it("lets caller stop callbacks inspect a cloned boundary", () => {
    const result = runProgram(
      program([
        { type: "move", steps: 1 },
        { type: "turn", degrees: 90 },
      ]),
      createWorldState(),
      { shouldStop: ({ stepsUsed, world }) => stepsUsed === 1 && world.sprite.x === 1 },
    );
    expect(result.outcome).toBe("stopped");
    expect(result.world.sprite.heading).toBe(0);
  });
});

describe("determinism and canonical parity", () => {
  it("does not mutate inputs and repeated runs serialize identically", () => {
    const input = program([
      { type: "move", steps: 1 },
      { type: "turn", degrees: 45 },
      { type: "move", steps: 1 },
    ]);
    const before = JSON.stringify(input);
    const world = createWorldState({ goal: { x: 1, y: 1 } });
    const a = runProgram(input, world);
    const b = runProgram(structuredClone(input), world);
    expect(JSON.stringify(input)).toBe(before);
    expect(serialize(a)).toBe(serialize(b));
    expect(world).toEqual(createWorldState({ goal: { x: 1, y: 1 } }));
  });

  it("uses the same canonical model as the visible code projection without executing text", () => {
    const canonical = program([{ type: "move", steps: 5 }]);
    const run = runProgram(canonical, createWorldState());
    const projection = projectProgram(canonical);
    expect(run.world.sprite.x).toBe(5);
    expect(projection.code).toContain("sprite.move(5);");
    expect(JSON.stringify(run)).not.toContain(projection.code);
  });
});

describe("observations and reset", () => {
  it("keeps observation collection optional", () => {
    const result = runProgram(program([{ type: "move", steps: 1 }]), createWorldState());
    expect(result.observations).toEqual([]);
  });

  it("emits deterministic observations with canonical node ids for highlighting", () => {
    const canonical = program([
      { type: "move", steps: 1 },
      { type: "turn", degrees: 90 },
    ]);
    const projection = projectProgram(canonical);
    const result = runProgram(canonical, createWorldState(), { collectObservations: true });
    expect(result.observations.map((observation) => observation.kind)).toEqual([
      "statement-start",
      "statement-end",
      "statement-start",
      "statement-end",
      "run-complete",
    ]);
    expect(result.observations[0]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(result.observations[2]?.nodeId).toBe("scripts[0]/statements[1]");
    expect(projection.mapping[result.observations[0]?.nodeId ?? ""]).toBeDefined();
    expect(projection.mapping[result.observations[2]?.nodeId ?? ""]).toBeDefined();
    expect(JSON.stringify(result.observations)).toBe(JSON.stringify(result.observations));
  });

  it("tags every observation with the activating event for traceability", () => {
    const messageProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "react",
          trigger: { type: "onMessage", message: "go" },
          statements: [{ type: "broadcast", message: "done" }],
        },
      ],
    };
    const result = runProgram(messageProgram, createWorldState(), {
      collectObservations: true,
      event: "message:go",
    });
    expect(result.stepsUsed).toBe(1);
    expect(result.observations[0]?.statementType).toBe("broadcast");
    expect(result.observations.every((observation) => observation.event === "message:go")).toBe(
      true,
    );
  });

  it("provides sanitized serializable tutor context from observations", () => {
    const result = runProgram(program([{ type: "move", steps: 2 }]), createWorldState(), {
      collectObservations: true,
    });
    const context = toSanitizedTutorContext(result);
    expect(context).toEqual(JSON.parse(JSON.stringify(context)));
    expect(context.outcome).toBe("completed");
    expect(context.finalWorld.sprite.x).toBe(2);
    expect(context.observations.every((observation) => observation.nodeId.length > 0)).toBe(true);
    expect(JSON.stringify(context)).not.toMatch(/name|email|provider|prompt/i);
  });

  it("reset restores an exact clone of the initial world", () => {
    const initial = createWorldState({
      sprite: { x: 3, y: 4, heading: 90 },
      goal: { x: 3, y: 10 },
    });
    const run = runProgram(program([{ type: "move", steps: 6 }]), initial);
    expect(run.world).not.toEqual(initial);
    expect(resetWorldState(initial)).toEqual(initial);
    expect(resetWorldState(initial)).not.toBe(initial);
  });
});

describe("failure paths", () => {
  it("rejects malformed programs through program-model validation", () => {
    const invalid = {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [{ type: "move" }] }],
    };
    expect(() => runProgram(invalid as unknown as ProjectProgram, createWorldState())).toThrow(
      "MISSING_FIELD",
    );
  });

  it("throws an explicit runtime error for corrupted repeat counts after validation boundary", () => {
    const corrupted = program([{ type: "repeat", count: 1.5, body: [] }]);
    expect(() => runProgram(corrupted, createWorldState())).toThrow(RuntimeExecutionError);
  });
});

describe("green-flag dispatch", () => {
  const withTriggers = (...types: Array<"onStart" | "greenFlag">): ProjectProgram => ({
    schema: SCHEMA_VERSION,
    scripts: types.map((type, index) => ({
      id: `s${index}`,
      trigger: { type },
      statements: [{ type: "move", steps: 10 }],
    })),
  });
  const start = () =>
    createWorldState({ sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 500, y: 0 } });

  it("runs green-flag scripts and legacy hats on the green-flag event, in order", () => {
    const result = runProgram(withTriggers("greenFlag", "onStart", "greenFlag"), start());
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite.x).toBe(30);
    expect(result.stepsUsed).toBe(3);
  });

  it("runs the same either way and projects the green flag clearly", () => {
    const legacy = runProgram(withTriggers("onStart"), start());
    const flag = runProgram(withTriggers("greenFlag"), start());
    expect(flag.world).toEqual(legacy.world);
    const projected = projectProgram(withTriggers("greenFlag")).code;
    expect(projected).toContain("whenGreenFlagClicked");
    expect(projectProgram(withTriggers("onStart")).code).toContain("whenStarted");
  });

  it("skips scripts that answer to a different event than the one dispatched", () => {
    const options = { event: "greenFlag" } as const;
    expect(runProgram(withTriggers("greenFlag"), start(), options).stepsUsed).toBe(1);
  });
});
