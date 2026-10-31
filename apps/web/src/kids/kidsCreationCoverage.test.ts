import { describe, expect, it } from "vitest";
import type { Expression, ProjectProgram, Trigger } from "@agorix/program-model";
import {
  EVERY_ENGINE_EFFECT_IS_DECIDED,
  EVERY_ENGINE_EXPRESSION_IS_DECIDED,
  EVERY_ENGINE_EXTENSION_IS_DECIDED,
  EVERY_ENGINE_STATEMENT_IS_DECIDED,
  EVERY_ENGINE_TRIGGER_IS_DECIDED,
  EXPRESSIONS_NOT_IN_SCENE,
  MISSION_PALETTE_STATEMENTS,
  NOT_OFFERED_IN_SCENE,
  SCENE_CONDITION_EXPRESSIONS,
  SCENE_EXTENSIONS,
  SCENE_TRIGGERS,
  TRIGGERS_NOT_IN_SCENE,
} from "./kidsCreationCoverage.js";
import { createStudioProgram, validateStudioProgram } from "./kidsStudioModel.js";

const base = createStudioProgram("nova");
const num = (value: number): Expression => ({ type: "numericLiteral", value });
const key: Expression = { type: "keyDown", key: "Space" };

function accepts(program: ProjectProgram): boolean {
  try {
    validateStudioProgram(program);
    return true;
  } catch {
    return false;
  }
}
const withCondition = (condition: Expression): ProjectProgram => ({
  ...base,
  scripts: [
    {
      ...base.scripts[0]!,
      statements: [{ type: "if", condition, then: [{ type: "move", steps: 20 }] }],
    },
  ],
});
const withTrigger = (trigger: Trigger): ProjectProgram => ({
  ...base,
  scripts: [{ ...base.scripts[0]!, trigger }],
});

/** One sample per condition kind, so the lists in the coverage module cannot drift from the model. */
const CONDITION_SAMPLES: Readonly<Record<string, Expression>> = {
  keyDown: key,
  touchingStageEdge: { type: "touchingStageEdge", minX: 0, maxX: 320, minY: -100, maxY: 120 },
  touchingActor: { type: "touchingActor", actorId: "actor:studio-1-nova" },
  greaterThan: { type: "greaterThan", left: num(1), right: num(0) },
  lessThan: { type: "lessThan", left: num(1), right: num(2) },
  equals: { type: "equals", left: num(1), right: num(1) },
  lessOrEqual: { type: "lessOrEqual", left: num(1), right: num(2) },
  greaterOrEqual: { type: "greaterOrEqual", left: num(2), right: num(1) },
  booleanLiteral: { type: "booleanLiteral", value: true },
  and: { type: "and", left: key, right: key },
  or: { type: "or", left: key, right: key },
  not: { type: "not", value: key },
  touchingGoal: { type: "touchingGoal" },
};

const TRIGGER_SAMPLES: Readonly<Record<string, Trigger>> = {
  greenFlag: { type: "greenFlag" },
  onActorClicked: { type: "onActorClicked" },
  onKeyPressed: { type: "onKeyPressed", key: "Space" },
  onMessage: { type: "onMessage", message: "hola" },
  onStart: { type: "onStart" },
};

describe("creation coverage against the engine (#1121)", () => {
  it("decides every engine statement, expression, trigger, effect and extension (checked by tsc)", () => {
    expect(EVERY_ENGINE_STATEMENT_IS_DECIDED).toBe(true);
    expect(EVERY_ENGINE_EXPRESSION_IS_DECIDED).toBe(true);
    expect(EVERY_ENGINE_TRIGGER_IS_DECIDED).toBe(true);
    expect(EVERY_ENGINE_EFFECT_IS_DECIDED).toBe(true);
    expect(EVERY_ENGINE_EXTENSION_IS_DECIDED).toBe(true);
    expect(SCENE_EXTENSIONS).toEqual(["pen", "music"]);
  });

  it("explains everything the scene hides", () => {
    for (const reason of [
      ...Object.values<string>(NOT_OFFERED_IN_SCENE),
      ...Object.values<string>(EXPRESSIONS_NOT_IN_SCENE),
      ...Object.values<string>(TRIGGERS_NOT_IN_SCENE),
    ]) {
      expect(reason).toMatch(/^(gap|by design): .{10,}/);
    }
  });

  it("matches the scene model: offered conditions validate, hidden ones do not", () => {
    for (const kind of SCENE_CONDITION_EXPRESSIONS) {
      expect(accepts(withCondition(CONDITION_SAMPLES[kind]!)), kind).toBe(true);
    }
    for (const kind of Object.keys(EXPRESSIONS_NOT_IN_SCENE)) {
      const sample = CONDITION_SAMPLES[kind];
      if (sample !== undefined) expect(accepts(withCondition(sample)), kind).toBe(false);
    }
  });

  it("matches the scene model: offered events validate, hidden ones do not", () => {
    for (const kind of SCENE_TRIGGERS) {
      expect(accepts(withTrigger(TRIGGER_SAMPLES[kind]!)), kind).toBe(true);
    }
    for (const kind of Object.keys(TRIGGERS_NOT_IN_SCENE)) {
      expect(accepts(withTrigger(TRIGGER_SAMPLES[kind]!)), kind).toBe(false);
    }
  });

  it("lists the mission blocks as statements the scene offers", () => {
    expect(Object.keys(MISSION_PALETTE_STATEMENTS).sort()).toEqual(
      ["move", "repeat", "sound", "turnL", "turnR"].sort(),
    );
  });
});
