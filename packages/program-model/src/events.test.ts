import { describe, expect, it } from "vitest";
import {
  ProgramValidationError,
  SCHEMA_VERSION,
  eventForTrigger,
  migrateLegacyTriggers,
  validateProgram,
  type ProjectProgram,
} from "./index.js";

const program = (...triggers: Array<"onStart" | "greenFlag">): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: triggers.map((type, index) => ({
    id: `script-${index}`,
    trigger: { type },
    statements: [{ type: "move", steps: 5 }],
  })),
});

describe("green-flag trigger", () => {
  it("validates both the green flag and the legacy hat, and rejects anything else", () => {
    expect(validateProgram(program("greenFlag")).scripts[0]?.trigger).toEqual({
      type: "greenFlag",
    });
    expect(validateProgram(program("onStart")).scripts[0]?.trigger).toEqual({ type: "onStart" });
    const unknown = {
      ...program("greenFlag"),
      scripts: [{ id: "x", trigger: { type: "keyPressed" }, statements: [] }],
    };
    expect(() => validateProgram(unknown)).toThrow(ProgramValidationError);
  });

  it("maps both hats to the green-flag event", () => {
    expect(eventForTrigger({ type: "greenFlag" })).toBe("greenFlag");
    expect(eventForTrigger({ type: "onStart" })).toBe("greenFlag");
  });

  it("maps interaction triggers to their canonical events", () => {
    expect(eventForTrigger({ type: "onKeyPressed", key: "ArrowUp" })).toBe("key:ArrowUp");
    expect(eventForTrigger({ type: "onActorClicked" })).toBe("actorClicked");
    expect(eventForTrigger({ type: "onMessage", message: "go" })).toBe("message:go");
  });

  it("migrates only legacy hats, without touching anything else or mutating the input", () => {
    const legacy = program("onStart", "greenFlag", "onStart");
    const migrated = migrateLegacyTriggers(legacy);
    expect(migrated.scripts.map((script) => script.trigger.type)).toEqual([
      "greenFlag",
      "greenFlag",
      "greenFlag",
    ]);
    expect(migrated.scripts[0]?.statements).toEqual(legacy.scripts[0]?.statements);
    expect(legacy.scripts[0]?.trigger.type).toBe("onStart");
    const current = program("greenFlag");
    expect(migrateLegacyTriggers(current)).toBe(current);
  });
});
