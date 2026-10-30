import { describe, expect, it } from "vitest";
import { semanticProjectHash, validatePortableStoredProject } from "./index.js";
import { validateKidsProjectView } from "./kidsView.js";

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

describe("Kids project presentation metadata", () => {
  it("round-trips a bounded world and avatar and binds them to the semantic hash", () => {
    const withView = {
      ...project,
      metadata: { ...project.metadata, kidsView: { world: "ocean", avatar: "🐸" } },
    };
    const parsed = validatePortableStoredProject(withView);
    expect(parsed.metadata.kidsView).toEqual({ world: "ocean", avatar: "🐸" });
    expect(semanticProjectHash(parsed)).not.toBe(
      semanticProjectHash(validatePortableStoredProject(project)),
    );
  });

  it("rejects unknown presentation fields and values", () => {
    expect(() =>
      validateKidsProjectView({ world: "ocean", avatar: "🐸", unexpected: "x" }),
    ).toThrow();
    expect(() => validateKidsProjectView({ world: "internet", avatar: "🐸" })).toThrow();
  });
});
