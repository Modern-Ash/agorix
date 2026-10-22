import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import {
  ADVANCED_PROGRESS_SCHEMA,
  parseAgorixProject,
  semanticProjectSnapshot,
  serializeAgorixProject,
  validateAdvancedProgress,
  type StoredProject,
} from "./index.js";

const project: StoredProject = {
  schemaVersion: SCHEMA_VERSION,
  program: {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "start",
        trigger: { type: "greenFlag" },
        statements: [],
      },
    ],
  },
  metadata: {
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    missionProgress: 1,
    hintLevel: 0,
    advancedProgress: { schema: ADVANCED_PROGRESS_SCHEMA, stage: "scene", completed: true },
  },
};

describe("versioned Kids advanced progress", () => {
  it("round-trips as structured project metadata and cross-surface truth", () => {
    const restored = parseAgorixProject(serializeAgorixProject(project)).project;
    expect(restored.metadata.advancedProgress).toEqual(project.metadata.advancedProgress);
    expect(semanticProjectSnapshot(restored).advancedProgress).toEqual(
      project.metadata.advancedProgress,
    );
  });

  it("rejects unknown versions, stages, extra fields and free text", () => {
    expect(() =>
      validateAdvancedProgress({ schema: "bad", stage: "scene", completed: true }),
    ).toThrow();
    expect(() =>
      validateAdvancedProgress({
        schema: ADVANCED_PROGRESS_SCHEMA,
        stage: "other",
        completed: true,
      }),
    ).toThrow();
    expect(() =>
      validateAdvancedProgress({
        schema: ADVANCED_PROGRESS_SCHEMA,
        stage: "scene",
        completed: true,
        childText: "private",
      }),
    ).toThrow();
  });
});
