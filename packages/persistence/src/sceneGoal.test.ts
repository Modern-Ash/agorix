import { describe, expect, it } from "vitest";
import { semanticProjectHash, validatePortableStoredProject } from "./index.js";
import { validateProjectSceneGoal } from "./sceneGoal.js";

const project = {
  schemaVersion: "agorix/program/v1",
  program: { schema: "agorix/program/v1", scripts: [] },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
  },
};

describe("Free scene goal metadata", () => {
  it("round-trips a goal and binds it to the semantic hash", () => {
    const goal = {
      kind: "touchActor",
      actorId: "actor:studio-1-nova",
      targetId: "actor:studio-2-luma",
    };
    const parsed = validatePortableStoredProject({
      ...project,
      metadata: { ...project.metadata, sceneGoal: goal },
    });
    expect(parsed.metadata.sceneGoal).toEqual(goal);
    expect(semanticProjectHash(parsed)).not.toBe(
      semanticProjectHash(validatePortableStoredProject(project)),
    );
  });

  it("accepts a reach-the-edge goal", () => {
    expect(validateProjectSceneGoal({ kind: "reachEdge", actorId: "actor:studio-1-nova" })).toEqual(
      { kind: "reachEdge", actorId: "actor:studio-1-nova" },
    );
  });

  it("round-trips a bounded migrated cell goal", () => {
    const goal = { kind: "reachCell", actorId: "actor:studio-1-nova", cx: 4, cy: 2 };
    const parsed = validatePortableStoredProject({
      ...project,
      metadata: { ...project.metadata, sceneGoal: goal },
    });
    expect(parsed.metadata.sceneGoal).toEqual(goal);
    expect(() => validateProjectSceneGoal({ ...goal, cx: 6 })).toThrow();
    expect(validateProjectSceneGoal({ ...goal, afterTurn: true })).toEqual({
      ...goal,
      afterTurn: true,
    });
    expect(() => validateProjectSceneGoal({ ...goal, afterTurn: "yes" })).toThrow();
    expect(() => validateProjectSceneGoal({ ...goal, note: "private" })).toThrow();
  });

  it("rejects free text, unknown fields, self targets and other kinds", () => {
    expect(() =>
      validateProjectSceneGoal({ kind: "reachEdge", actorId: "actor:studio-1-nova", note: "hi" }),
    ).toThrow();
    expect(() =>
      validateProjectSceneGoal({ kind: "reachEdge", actorId: "Nova talks to me" }),
    ).toThrow();
    expect(() =>
      validateProjectSceneGoal({
        kind: "touchActor",
        actorId: "actor:studio-1-nova",
        targetId: "actor:studio-1-nova",
      }),
    ).toThrow();
    expect(() =>
      validateProjectSceneGoal({ kind: "score", actorId: "actor:studio-1-nova" }),
    ).toThrow();
    expect(() => validateProjectSceneGoal(null)).toThrow();
  });
});

describe("a goal about a value", () => {
  it("keeps a variable and a whole number from 1 to 99", () => {
    const goal = { kind: "variableReaches", variableId: "studio-var-2", value: 10 };
    expect(validateProjectSceneGoal(goal)).toEqual(goal);
    const parsed = validatePortableStoredProject({
      ...project,
      metadata: { ...project.metadata, sceneGoal: goal },
    });
    expect(parsed.metadata.sceneGoal).toEqual(goal);
  });

  it("refuses anything else", () => {
    for (const bad of [
      { kind: "variableReaches", variableId: "studio-var-4", value: 5 },
      { kind: "variableReaches", variableId: "score", value: 5 },
      { kind: "variableReaches", variableId: "studio-var-1", value: 0 },
      { kind: "variableReaches", variableId: "studio-var-1", value: 100 },
      { kind: "variableReaches", variableId: "studio-var-1", value: 2.5 },
      { kind: "variableReaches", variableId: "studio-var-1", value: 5, actorId: "actor:x" },
    ])
      expect(() => validateProjectSceneGoal(bad), JSON.stringify(bad)).toThrow();
  });
});
