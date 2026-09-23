import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";
import {
  UnsupportedNodeError,
  formatNumber,
  projectProgram,
  type ProjectionResult,
} from "./project.js";
import {
  DOCUMENTED_EXAMPLE_PROGRAM,
  EMPTY_EDGE_PROGRAM,
  FULL_COVERAGE_PROGRAM,
} from "./fixtures.js";
import type { ProjectProgram } from "@agorix/program-model";

function expectValidRanges(result: ProjectionResult): void {
  const { code, mapping } = result;
  expect(Object.keys(mapping).length).toBeGreaterThan(0);
  for (const [nodeId, range] of Object.entries(mapping)) {
    expect(range.start, nodeId).toBeGreaterThanOrEqual(0);
    expect(range.end, nodeId).toBeGreaterThanOrEqual(range.start);
    expect(range.end, nodeId).toBeLessThanOrEqual(code.length);
  }
}

describe("PACKAGE_NAME", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/code-generator");
  });
});

describe("formatNumber", () => {
  it("normalizes -0 to 0 and keeps integers stable", () => {
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(10)).toBe("10");
    expect(formatNumber(-90)).toBe("-90");
    expect(formatNumber(42)).toBe("42");
  });
});

describe("projectProgram", () => {
  it("projects the documented example to the exact educational text (snapshot)", () => {
    const result = projectProgram(DOCUMENTED_EXAMPLE_PROGRAM);
    expect(result.code).toMatchInlineSnapshot(`
      "whenStarted(() => {
        repeat(5, () => {
          sprite.move(10);
        });
      });
      "
    `);
    expectValidRanges(result);
  });

  it("covers every POC operation in the full-coverage fixture (snapshot)", () => {
    const result = projectProgram(FULL_COVERAGE_PROGRAM);
    expect(result.code).toMatchInlineSnapshot(`
      "whenStarted(() => {
        sprite.move(3);
        sprite.turn(90);
        repeat(2, () => {
          sprite.move(1);
          if (sprite.touchingGoal()) {
            sprite.turn(-90);
          }
        });
        if (true) {
          sprite.move(0);
        }
        if (false) {
        }
        if (42) {
        }
      });
      "
    `);
    expectValidRanges(result);
    for (const op of [
      "whenStarted",
      "sprite.move",
      "sprite.turn",
      "repeat",
      "if (sprite.touchingGoal())",
      "if (true)",
      "if (false)",
      "if (42)",
    ]) {
      expect(result.code).toContain(op);
    }
  });

  it("projects empty edge structures without crashing", () => {
    const result = projectProgram(EMPTY_EDGE_PROGRAM);
    expect(result.code).toContain("whenStarted(() => {\n");
    expect(result.code).toContain("  if (true) {\n  }\n");
    expect(result.code).toContain("});\n");
    expectValidRanges(result);
  });

  it("is deterministic: same program twice yields identical code and mapping", () => {
    const a = projectProgram(FULL_COVERAGE_PROGRAM);
    const b = projectProgram(structuredClone(FULL_COVERAGE_PROGRAM));
    expect(a.code).toBe(b.code);
    expect(a.mapping).toEqual(b.mapping);
  });

  it("does not mutate the input program", () => {
    const input = structuredClone(FULL_COVERAGE_PROGRAM);
    const before = JSON.stringify(input);
    projectProgram(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("mapping ranges slice back to the expected nested source text", () => {
    const result = projectProgram(DOCUMENTED_EXAMPLE_PROGRAM);
    const script = result.mapping["scripts[0]"];
    const stmt = result.mapping["scripts[0]/statements[0]"];
    const trigger = result.mapping["scripts[0]/trigger"];
    expect(script).toBeDefined();
    expect(stmt).toBeDefined();
    expect(trigger).toBeDefined();
    if (!script || !stmt || !trigger) {
      return;
    }
    expect(result.code.slice(trigger.start, trigger.end)).toBe("whenStarted");
    expect(result.code.slice(stmt.start, stmt.end)).toBe(
      "  repeat(5, () => {\n    sprite.move(10);\n  });\n",
    );
    expect(result.code.slice(script.start, script.end)).toBe(result.code);
    expect(result.code.slice(stmt.start, stmt.end)).toContain("sprite.move(10);");
  });

  it("maps if-condition ranges to the exact condition substring", () => {
    const result = projectProgram(FULL_COVERAGE_PROGRAM);
    const condId = "scripts[0]/statements[2]/body[1]/condition";
    // full-coverage: statements[2] = repeat, body[1] = if(touchingGoal)
    const range = result.mapping[condId];
    expect(range).toBeDefined();
    if (!range) {
      return;
    }
    expect(result.code.slice(range.start, range.end)).toBe("sprite.touchingGoal()");
  });

  it("throws UnsupportedNodeError with nodeId and nodeType for unknown statement", () => {
    const bad = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "wait", seconds: 1 }],
        },
      ],
    } as unknown as ProjectProgram;
    expect(() => projectProgram(bad)).toThrow(UnsupportedNodeError);
    try {
      projectProgram(bad);
      expect.unreachable("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedNodeError);
      const err = error as UnsupportedNodeError;
      expect(err.nodeType).toBe("wait");
      expect(err.nodeId).toBe("scripts[0]/statements[0]");
      expect(err.name).toBe("UnsupportedNodeError");
    }
  });

  it("throws UnsupportedNodeError for unknown expression type", () => {
    const bad = {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: { type: "touchingWall" },
              then: [],
            },
          ],
        },
      ],
    } as unknown as ProjectProgram;
    expect(() => projectProgram(bad)).toThrow(UnsupportedNodeError);
    try {
      projectProgram(bad);
      expect.unreachable("should throw");
    } catch (error) {
      const err = error as UnsupportedNodeError;
      expect(err.nodeType).toBe("touchingWall");
      expect(err.nodeId).toBe("scripts[0]/statements[0]/condition");
    }
  });

  it("throws UnsupportedNodeError for unknown trigger type", () => {
    const bad = {
      schema: "agorix/program/v1",
      scripts: [{ id: "main", trigger: { type: "onKey" }, statements: [] }],
    } as unknown as ProjectProgram;
    expect(() => projectProgram(bad)).toThrow(UnsupportedNodeError);
    try {
      projectProgram(bad);
      expect.unreachable("should throw");
    } catch (error) {
      const err = error as UnsupportedNodeError;
      expect(err.nodeType).toBe("onKey");
      expect(err.nodeId).toBe("scripts[0]/trigger");
    }
  });

  it("handles multi-script programs with blank line separation", () => {
    const program: ProjectProgram = {
      schema: "agorix/program/v1",
      scripts: [
        { id: "a", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
        { id: "b", trigger: { type: "onStart" }, statements: [{ type: "turn", degrees: 1 }] },
      ],
    };
    const result = projectProgram(program);
    expect(result.code.match(/whenStarted/g)?.length).toBe(2);
    expect(result.code).toContain("});\n\nwhenStarted");
    expectValidRanges(result);
  });
});
