import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Issue #467 (re-scoped): `random` already exists and is continuous; kids need whole numbers.
const num = (value: number) => ({ type: "numericLiteral" as const, value });
const roll = (min: number, max: number, count: number): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  variables: [{ id: "r", name: "r", initialValue: 0, visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "repeat",
          count,
          body: [
            {
              type: "setVariable",
              variableId: "r",
              value: { type: "randomInteger", min: num(min), max: num(max) },
            },
            { type: "move", steps: 0 },
          ],
        },
      ],
    },
  ],
});

function rolls(min: number, max: number, count: number, seed: number): number[] {
  const result = runProgram(roll(min, max, count), createWorldState(), {
    randomSeed: seed,
    collectObservations: true,
  });
  return result.trace
    .filter((entry) => entry.statementType === "setVariable")
    .map((entry) => entry.worldAfter.variables?.["r"]?.value as number);
}

describe("randomInteger (issue #467)", () => {
  it("is deterministic per seed and differs across seeds", () => {
    expect(rolls(1, 6, 6, 42)).toEqual(rolls(1, 6, 6, 42));
    expect(rolls(1, 6, 6, 42)).not.toEqual(rolls(1, 6, 6, 7));
  });

  it("returns whole numbers, and both ends are reachable", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++)
      for (const value of rolls(1, 3, 6, seed)) seen.add(value);
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("swaps reversed bounds, handles equal bounds, negatives and fractions", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const value of rolls(6, 1, 6, seed)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
      for (const value of rolls(-2, 2, 6, seed)) {
        expect(value).toBeGreaterThanOrEqual(-2);
        expect(value).toBeLessThanOrEqual(2);
      }
    }
    expect(new Set(rolls(4, 4, 5, 9))).toEqual(new Set([4]));
    // Fractional bounds round to the nearest whole numbers: 1.4 -> 1, 1.6 -> 2.
    for (const value of rolls(1.4, 1.6, 5, 9)) expect([1, 2]).toContain(value);
  });

  it("never uses Math.random", () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    try {
      expect(() => rolls(1, 6, 6, 3)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});
