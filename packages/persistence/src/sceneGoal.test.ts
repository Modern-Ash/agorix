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

  it("rejects free text, unknown fields, self targets and other kinds", () => {
    expect(() =>
      validateProjectSceneGoal({ kind: "reachEdge", actorId: "actor:studio-1-nova", note: "hi" }),
    ).toThrow();
    expect(() => validateProjectSceneGoal({ kind: "reachEdge", actorId: "Nova talks to me" })).toThrow();
    expect(() =>
      validateProjectSceneGoal({
        kind: "touchActor",
        actorId: "actor:studio-1-nova",
        targetId: "actor:studio-1-nova",
      }),
    ).toThrow();
    expect(() => validateProjectSceneGoal({ kind: "score", actorId: "actor:studio-1-nova" })).toThrow();
    expect(() => validateProjectSceneGoal(null)).toThrow();
  });
});
