import { describe, expect, it } from "vitest";
import type { Expression, ProjectProgram, Statement, Trigger } from "@agorix/program-model";
import { SCHEMA_VERSION } from "@agorix/program-model";
import {
  assertAllowedRuntimeOperation,
  assertProgramOperationsAllowed,
  isAllowedRuntimeOperation,
  listRuntimeOperations,
  RUNTIME_EXPRESSION_OPERATIONS,
  RUNTIME_OPERATIONS,
  RUNTIME_STATEMENT_OPERATIONS,
  RUNTIME_TRIGGER_OPERATIONS,
  RuntimeExecutionError,
  runProgram,
  type RuntimeOperationAllowlistIsExhaustive,
} from "./index.js";
import { createWorldState } from "./world.js";

/** RuntimeExecutionError must stay importable from the package barrel. */
import { RuntimeExecutionError as BarrelError } from "./index.js";

function programWithStatements(statements: readonly Statement[]): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "s1", trigger: { type: "onStart" }, statements }],
  };
}

const NON_ALLOWED_OPERATIONS = [
  "teleport",
  "eval",
  "executeJavascript",
  "import",
  "evalExpression",
  "onCollision",
  "onKeyPress",
  "randomChance",
  "runScript",
  "httpRequest",
  "tts",
  "__proto__",
  "constructor",
  "",
];

describe("runtime operation allowlist", () => {
  it("re-exports the interpreter failure type from the barrel", () => {
    expect(BarrelError).toBe(RuntimeExecutionError);
  });

  it("is exhaustive against the canonical program-model unions", () => {
    const exhaustive: RuntimeOperationAllowlistIsExhaustive = true;
    expect(exhaustive).toBe(true);
  });

  it("names every canonical statement, expression and trigger exactly once", () => {
    expect([...RUNTIME_STATEMENT_OPERATIONS].sort()).toEqual(["if", "move", "repeat", "turn"]);
    expect([...RUNTIME_EXPRESSION_OPERATIONS].sort()).toEqual([
      "booleanLiteral",
      "numericLiteral",
      "touchingGoal",
    ]);
    expect([...RUNTIME_TRIGGER_OPERATIONS]).toEqual(["onStart"]);
  });

  it("freezes the allowlist so callers cannot widen it at runtime", () => {
    expect(Object.isFrozen(RUNTIME_OPERATIONS)).toBe(true);
    expect(Object.isFrozen(RUNTIME_STATEMENT_OPERATIONS)).toBe(true);
    expect(Object.isFrozen(RUNTIME_EXPRESSION_OPERATIONS)).toBe(true);
    expect(Object.isFrozen(RUNTIME_TRIGGER_OPERATIONS)).toBe(true);
  });

  it("lists every allowlisted operation once", () => {
    const listed = listRuntimeOperations();
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toHaveLength(
      RUNTIME_STATEMENT_OPERATIONS.length +
        RUNTIME_EXPRESSION_OPERATIONS.length +
        RUNTIME_TRIGGER_OPERATIONS.length,
    );
  });

  it.each([...listRuntimeOperations()])("accepts allowlisted operation %s", (operation) => {
    const kind = (Object.keys(RUNTIME_OPERATIONS) as Array<keyof typeof RUNTIME_OPERATIONS>).find(
      (candidate) => (RUNTIME_OPERATIONS[candidate] as readonly string[]).includes(operation),
    );
    expect(kind).toBeDefined();
    expect(isAllowedRuntimeOperation(kind!, operation)).toBe(true);
    expect(() => assertAllowedRuntimeOperation(kind!, operation, "path")).not.toThrow();
  });

  it.each(NON_ALLOWED_OPERATIONS)("rejects operation %s on every kind", (operation) => {
    for (const kind of Object.keys(RUNTIME_OPERATIONS) as Array<keyof typeof RUNTIME_OPERATIONS>) {
      expect(isAllowedRuntimeOperation(kind, operation)).toBe(false);
      expect(() => assertAllowedRuntimeOperation(kind, operation, "scripts[0]")).toThrow(
        RuntimeExecutionError,
      );
    }
  });

  it.each([undefined, null, 0, 1, {}, [], true])(
    "rejects non-string node types (%s)",
    (nodeType) => {
      expect(isAllowedRuntimeOperation("statement", nodeType)).toBe(false);
      expect(isAllowedRuntimeOperation("expression", nodeType)).toBe(false);
      expect(isAllowedRuntimeOperation("trigger", nodeType)).toBe(false);
    },
  );

  it("rejects prototype-chain lookups as allowlisted operations", () => {
    expect(isAllowedRuntimeOperation("statement", "toString")).toBe(false);
    expect(isAllowedRuntimeOperation("expression", "hasOwnProperty")).toBe(false);
  });

  it("accepts a canonical program that only uses allowlisted operations", () => {
    const program = programWithStatements([
      { type: "move", steps: 2 },
      {
        type: "repeat",
        count: 2,
        body: [{ type: "turn", degrees: 90 }],
      },
      {
        type: "if",
        condition: { type: "touchingGoal" },
        then: [{ type: "move", steps: 1 }],
      },
    ]);
    expect(() => assertProgramOperationsAllowed(program)).not.toThrow();
  });

  it("rejects a program with a nested non-allowlisted statement", () => {
    const program = programWithStatements([
      {
        type: "repeat",
        count: 1,
        body: [{ type: "teleport", x: 0, y: 0 } as unknown as Statement],
      },
    ]);
    expect(() => assertProgramOperationsAllowed(program)).toThrow(RuntimeExecutionError);
    expect(() => assertProgramOperationsAllowed(program)).toThrow(/teleport/);
  });

  it("rejects a program with a non-allowlisted condition", () => {
    const program = programWithStatements([
      {
        type: "if",
        condition: { type: "randomChance" } as unknown as Expression,
        then: [],
      },
    ]);
    expect(() => assertProgramOperationsAllowed(program)).toThrow(RuntimeExecutionError);
  });

  it("rejects a program with a non-allowlisted trigger", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "s1",
          trigger: { type: "onCollision" } as unknown as Trigger,
          statements: [],
        },
      ],
    };
    expect(() => assertProgramOperationsAllowed(program)).toThrow(RuntimeExecutionError);
  });

  it("names the failing program path so evidence is actionable", () => {
    const program = programWithStatements([
      { type: "move", steps: 1 },
      { type: "teleport" } as unknown as Statement,
    ]);
    expect(() => assertProgramOperationsAllowed(program)).toThrow(/scripts\[0\]\.statements\[1\]/);
  });

  it("leaves the input world untouched when a tampered program is rejected", () => {
    const world = createWorldState({ sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 10, y: 0 } });
    const before = { ...world, sprite: { ...world.sprite }, goal: { ...world.goal } };

    const tampered = programWithStatements([
      { type: "move", steps: 99 },
      { type: "eval", source: "1+1" } as unknown as Statement,
    ]);
    expect(() => runProgram(tampered, world)).toThrow();
    expect(world).toEqual(before);
  });

  it("rejects a tampered trigger before any statement executes", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "s1",
          trigger: { type: "onKeyPress" } as unknown as Trigger,
          statements: [{ type: "move", steps: 1 }],
        },
      ],
    };
    // Schema validation runs first; the allowlist is the second, independent gate.
    expect(() => runProgram(program, createWorldState())).toThrow(/onKeyPress/);
  });

  it("executes a canonical allowlisted program end to end", () => {
    const program = programWithStatements([
      { type: "move", steps: 1 },
      { type: "turn", degrees: 90 },
    ]);
    const result = runProgram(program, createWorldState());
    expect(result.outcome).toBe("completed");
    expect(result.stepsUsed).toBe(2);
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["move", "turn"]);
  });
});
